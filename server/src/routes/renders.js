import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { startRender, cancelRender, getRenderStatus, getRendersForDeck } from '../services/render.js';
import { get } from '../db.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../../data');

/**
 * POST /api/renders - Start a new render job
 * Body: { deck_id, kind: 'preview' | 'final' }
 */
router.post('/', async (req, res) => {
  try {
    const { deck_id, kind = 'preview' } = req.body;

    if (!deck_id) {
      return res.status(400).json({ error: 'deck_id is required' });
    }

    if (!['preview', 'final'].includes(kind)) {
      return res.status(400).json({ error: 'kind must be "preview" or "final"' });
    }

    // Verify deck exists
    const deck = get('SELECT * FROM decks WHERE id = ?', [deck_id]);
    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    const result = await startRender(deck_id, kind);
    
    res.status(201).json({
      message: 'Render started',
      render: result,
    });
  } catch (error) {
    console.error('Render start error:', error);
    res.status(500).json({ error: error.message || 'Failed to start render' });
  }
});

/**
 * GET /api/renders/:id - Get render status
 */
router.get('/:id', (req, res) => {
  try {
    const renderId = parseInt(req.params.id);
    
    if (isNaN(renderId)) {
      return res.status(400).json({ error: 'Invalid render ID' });
    }

    const render = getRenderStatus(renderId);
    
    if (!render) {
      return res.status(404).json({ error: 'Render not found' });
    }

    res.json(render);
  } catch (error) {
    console.error('Get render error:', error);
    res.status(500).json({ error: 'Failed to get render status' });
  }
});

/**
 * GET /api/renders/deck/:deckId - Get all renders for a deck
 */
router.get('/deck/:deckId', (req, res) => {
  try {
    const deckId = parseInt(req.params.deckId);
    
    if (isNaN(deckId)) {
      return res.status(400).json({ error: 'Invalid deck ID' });
    }

    const renders = getRendersForDeck(deckId);
    res.json(renders);
  } catch (error) {
    console.error('Get deck renders error:', error);
    res.status(500).json({ error: 'Failed to get renders' });
  }
});

/**
 * GET /api/renders/:id/download - Download the rendered video
 */
router.get('/:id/download', (req, res) => {
  try {
    const renderId = parseInt(req.params.id);
    
    if (isNaN(renderId)) {
      return res.status(400).json({ error: 'Invalid render ID' });
    }

    const render = getRenderStatus(renderId);
    
    if (!render) {
      return res.status(404).json({ error: 'Render not found' });
    }

    if (render.status !== 'succeeded') {
      return res.status(400).json({ error: 'Render not completed' });
    }

    if (!render.output_path) {
      return res.status(404).json({ error: 'Output file not found' });
    }

    // Convert relative path to absolute
    let filePath = render.output_path;
    if (filePath.startsWith('/data/')) {
      filePath = path.join(DATA_DIR, '..', filePath);
    } else {
      filePath = path.join(DATA_DIR, filePath);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Output file not found on disk' });
    }

    // Get deck for filename
    const deck = get('SELECT d.*, l.title as lesson_title FROM decks d LEFT JOIN lessons l ON d.lesson_id = l.id WHERE d.id = ?', [render.deck_id]);
    const filename = `${(deck?.lesson_title || deck?.title || 'video').replace(/[^a-zA-Z0-9]/g, '_')}_${render.kind}.mp4`;

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download render error:', error);
    res.status(500).json({ error: 'Failed to download render' });
  }
});

/**
 * POST /api/renders/:id/cancel - Cancel a render job
 */
router.post('/:id/cancel', (req, res) => {
  try {
    const renderId = parseInt(req.params.id);
    
    if (isNaN(renderId)) {
      return res.status(400).json({ error: 'Invalid render ID' });
    }

    const render = getRenderStatus(renderId);
    
    if (!render) {
      return res.status(404).json({ error: 'Render not found' });
    }

    if (render.status !== 'running' && render.status !== 'queued') {
      return res.status(400).json({ error: 'Render is not in progress' });
    }

    const canceled = cancelRender(renderId);
    
    if (canceled) {
      res.json({ message: 'Render canceled', status: 'canceled' });
    } else {
      res.status(400).json({ error: 'Failed to cancel render' });
    }
  } catch (error) {
    console.error('Cancel render error:', error);
    res.status(500).json({ error: 'Failed to cancel render' });
  }
});

export default router;

