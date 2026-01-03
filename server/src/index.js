import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db.js';
import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import lessonRoutes from './routes/lessons.js';
import deckRoutes from './routes/decks.js';
import slideRoutes from './routes/slides.js';
import assetRoutes from './routes/assets.js';
import exportRoutes from './routes/export.js';
import aiRoutes from './routes/ai.js';
import voiceProfileRoutes from './routes/voice-profiles.js';
import { authMiddleware } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/ai', authMiddleware, aiRoutes);
app.use('/api/voice-profiles', authMiddleware, voiceProfileRoutes);

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
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
