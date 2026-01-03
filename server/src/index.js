import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { ClerkExpressWithAuth } from '@clerk/clerk-sdk-node';
import { initDatabase } from './db.js';
import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import lessonRoutes from './routes/lessons.js';
import deckRoutes from './routes/decks.js';
import slideRoutes from './routes/slides.js';
import assetRoutes from './routes/assets.js';
import exportRoutes from './routes/export.js';
import renderRoutes from './routes/renders.js';
import aiRoutes from './routes/ai.js';
import voiceProfileRoutes from './routes/voice-profiles.js';
import notionRoutes from './routes/notion.js';
import timelineItemsRoutes from './routes/timeline-items.js';
import { authMiddleware } from './middleware/auth.js';
import { renderEvents } from './services/render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// WebSocket server for render progress
const wss = new WebSocketServer({ server, path: '/ws' });

// Track connected clients by render ID
const renderClients = new Map();

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  let subscribedRenderId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'subscribe' && data.renderId) {
        subscribedRenderId = data.renderId;
        
        // Add client to the render's subscribers
        if (!renderClients.has(subscribedRenderId)) {
          renderClients.set(subscribedRenderId, new Set());
        }
        renderClients.get(subscribedRenderId).add(ws);
        
        ws.send(JSON.stringify({
          type: 'subscribed',
          renderId: subscribedRenderId,
        }));
      }
      
      if (data.type === 'unsubscribe') {
        if (subscribedRenderId && renderClients.has(subscribedRenderId)) {
          renderClients.get(subscribedRenderId).delete(ws);
        }
        subscribedRenderId = null;
      }
    } catch (e) {
      console.error('WebSocket message error:', e);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    // Clean up subscriptions
    if (subscribedRenderId && renderClients.has(subscribedRenderId)) {
      renderClients.get(subscribedRenderId).delete(ws);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Broadcast render events to subscribed clients
function broadcastRenderEvent(type, data) {
  const { renderId } = data;
  const clients = renderClients.get(renderId);
  
  if (clients) {
    const message = JSON.stringify({ type, ...data });
    clients.forEach((client) => {
      if (client.readyState === 1) { // OPEN
        client.send(message);
      }
    });
    
    // Clean up completed/failed/canceled renders after a delay
    if (type === 'complete' || type === 'error' || type === 'canceled') {
      setTimeout(() => {
        renderClients.delete(renderId);
      }, 5000);
    }
  }
}

// Connect render events to WebSocket broadcasts
renderEvents.on('progress', (data) => broadcastRenderEvent('progress', data));
renderEvents.on('complete', (data) => broadcastRenderEvent('complete', data));
renderEvents.on('error', (data) => broadcastRenderEvent('error', data));
renderEvents.on('canceled', (data) => broadcastRenderEvent('canceled', data));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(ClerkExpressWithAuth());

// Static file serving for assets
app.use('/data', express.static(path.join(__dirname, '../../data')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', authMiddleware, courseRoutes);
app.use('/api/lessons', authMiddleware, lessonRoutes);
app.use('/api/decks', authMiddleware, deckRoutes);
app.use('/api/slides', authMiddleware, slideRoutes);
app.use('/api/assets', authMiddleware, assetRoutes);
app.use('/api/export', authMiddleware, exportRoutes);
app.use('/api/renders', authMiddleware, renderRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);
app.use('/api/voice-profiles', authMiddleware, voiceProfileRoutes);
app.use('/api/notion', authMiddleware, notionRoutes);
app.use('/api/timeline-items', authMiddleware, timelineItemsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Initialize database and start server
async function start() {
  try {
    await initDatabase();
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
