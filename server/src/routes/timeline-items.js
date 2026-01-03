import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { get, all, run, insert } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../../data');
const ASSETS_DIR = path.join(DATA_DIR, 'assets');

const router = Router();

/**
 * Get video metadata using ffprobe
 * @param {string} filePath - Path to video file
 * @returns {Promise<{duration_ms: number, width: number, height: number}>}
 */
async function getVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ]);

    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams?.find((s) => s.codec_type === 'video');
        const duration = parseFloat(data.format?.duration || 0) * 1000;

        resolve({
          duration_ms: Math.round(duration),
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          codec: videoStream?.codec_name || 'unknown',
          fps: videoStream?.r_frame_rate || '0/1',
        });
      } catch (e) {
        reject(new Error('Failed to parse ffprobe output'));
      }
    });

    ffprobe.on('error', reject);
  });
}

/**
 * GET /api/timeline-items/:deckId
 * Get all timeline items for a deck
 */
router.get('/:deckId', async (req, res) => {
  try {
    const { deckId } = req.params;
    const userId = req.user.id;

    // Verify deck ownership
    const deck = get(`
      SELECT d.* FROM decks d
      JOIN lessons l ON d.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      WHERE d.id = ? AND c.user_id = ?
    `, [deckId, userId]);

    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    const items = all(`
      SELECT ti.*, a.filename, a.storage_path, a.mime_type, a.metadata
      FROM timeline_items ti
      JOIN assets a ON ti.asset_id = a.id
      WHERE ti.deck_id = ?
      ORDER BY ti.type, ti.position
    `, [deckId]);

    // Parse metadata JSON
    const parsedItems = items.map((item) => ({
      ...item,
      metadata: typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata,
    }));

    res.json(parsedItems);
  } catch (error) {
    console.error('Get timeline items error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/timeline-items
 * Create a new timeline item (attach video to deck)
 */
router.post('/', async (req, res) => {
  try {
    const { deck_id, asset_id, type, position = 0, start_time_ms = 0, end_time_ms = null } = req.body;
    const userId = req.user.id;

    if (!deck_id || !asset_id || !type) {
      return res.status(400).json({ error: 'deck_id, asset_id, and type are required' });
    }

    if (!['intro', 'outro', 'interstitial'].includes(type)) {
      return res.status(400).json({ error: 'type must be intro, outro, or interstitial' });
    }

    // Verify deck ownership
    const deck = get(`
      SELECT d.* FROM decks d
      JOIN lessons l ON d.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      WHERE d.id = ? AND c.user_id = ?
    `, [deck_id, userId]);

    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    // Verify asset exists and is a video
    const asset = get('SELECT * FROM assets WHERE id = ? AND user_id = ?', [asset_id, userId]);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    if (!asset.mime_type?.startsWith('video/')) {
      return res.status(400).json({ error: 'Asset must be a video' });
    }

    // Get video duration if not already in metadata
    let metadata = typeof asset.metadata === 'string' ? JSON.parse(asset.metadata) : asset.metadata;
    let duration_ms = metadata?.duration_ms;

    if (!duration_ms) {
      try {
        const videoPath = path.join(ASSETS_DIR, asset.storage_path);
        const videoMeta = await getVideoMetadata(videoPath);
        duration_ms = videoMeta.duration_ms;
        
        // Update asset metadata
        metadata = { ...metadata, ...videoMeta };
        run('UPDATE assets SET metadata = ? WHERE id = ?', [JSON.stringify(metadata), asset_id]);
      } catch (e) {
        console.error('Failed to get video metadata:', e);
        duration_ms = 5000; // Default 5 seconds
      }
    }

    // For intro/outro, check if one already exists
    if (type === 'intro' || type === 'outro') {
      const existing = get('SELECT id FROM timeline_items WHERE deck_id = ? AND type = ?', [deck_id, type]);
      if (existing) {
        // Update existing instead of creating new
        run(`
          UPDATE timeline_items 
          SET asset_id = ?, start_time_ms = ?, end_time_ms = ?, duration_ms = ?, updated_at = datetime('now')
          WHERE id = ?
        `, [asset_id, start_time_ms, end_time_ms, end_time_ms ? end_time_ms - start_time_ms : duration_ms, existing.id]);
        
        const updated = get('SELECT * FROM timeline_items WHERE id = ?', [existing.id]);
        return res.json(updated);
      }
    }

    // Insert new timeline item
    const id = insert(`
      INSERT INTO timeline_items (deck_id, type, asset_id, position, start_time_ms, end_time_ms, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      deck_id,
      type,
      asset_id,
      position,
      start_time_ms,
      end_time_ms,
      end_time_ms ? end_time_ms - start_time_ms : duration_ms
    ]);

    const item = get('SELECT * FROM timeline_items WHERE id = ?', [id]);
    res.status(201).json(item);
  } catch (error) {
    console.error('Create timeline item error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/timeline-items/:id
 * Update a timeline item (trim points, position)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { position, start_time_ms, end_time_ms } = req.body;
    const userId = req.user.id;

    // Verify ownership
    const item = get(`
      SELECT ti.* FROM timeline_items ti
      JOIN decks d ON ti.deck_id = d.id
      JOIN lessons l ON d.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      WHERE ti.id = ? AND c.user_id = ?
    `, [id, userId]);

    if (!item) {
      return res.status(404).json({ error: 'Timeline item not found' });
    }

    // Build update query
    const updates = [];
    const params = [];

    if (position !== undefined) {
      updates.push('position = ?');
      params.push(position);
    }

    if (start_time_ms !== undefined) {
      updates.push('start_time_ms = ?');
      params.push(start_time_ms);
    }

    if (end_time_ms !== undefined) {
      updates.push('end_time_ms = ?');
      params.push(end_time_ms);
      
      // Recalculate duration if trim points changed
      const newStart = start_time_ms !== undefined ? start_time_ms : item.start_time_ms;
      const newEnd = end_time_ms;
      if (newEnd !== null) {
        updates.push('duration_ms = ?');
        params.push(newEnd - newStart);
      }
    }

    if (updates.length === 0) {
      return res.json(item);
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    run(`UPDATE timeline_items SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = get('SELECT * FROM timeline_items WHERE id = ?', [id]);
    res.json(updated);
  } catch (error) {
    console.error('Update timeline item error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/timeline-items/:id
 * Remove a timeline item
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const item = get(`
      SELECT ti.* FROM timeline_items ti
      JOIN decks d ON ti.deck_id = d.id
      JOIN lessons l ON d.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      WHERE ti.id = ? AND c.user_id = ?
    `, [id, userId]);

    if (!item) {
      return res.status(404).json({ error: 'Timeline item not found' });
    }

    run('DELETE FROM timeline_items WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete timeline item error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/timeline-items/reorder
 * Reorder interstitial items
 */
router.post('/reorder', async (req, res) => {
  try {
    const { deck_id, item_ids } = req.body;
    const userId = req.user.id;

    if (!deck_id || !item_ids || !Array.isArray(item_ids)) {
      return res.status(400).json({ error: 'deck_id and item_ids array required' });
    }

    // Verify deck ownership
    const deck = get(`
      SELECT d.* FROM decks d
      JOIN lessons l ON d.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      WHERE d.id = ? AND c.user_id = ?
    `, [deck_id, userId]);

    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    // Update positions
    item_ids.forEach((itemId, index) => {
      run('UPDATE timeline_items SET position = ? WHERE id = ? AND deck_id = ?', [index, itemId, deck_id]);
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Reorder timeline items error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/slides/:id/video
 * Set or remove video for a slide
 */
router.put('/slides/:id/video', async (req, res) => {
  try {
    const { id } = req.params;
    const { video_asset_id } = req.body;
    const userId = req.user.id;

    // Verify slide ownership
    const slide = get(`
      SELECT s.* FROM slides s
      JOIN decks d ON s.deck_id = d.id
      JOIN lessons l ON d.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      WHERE s.id = ? AND c.user_id = ?
    `, [id, userId]);

    if (!slide) {
      return res.status(404).json({ error: 'Slide not found' });
    }

    if (video_asset_id) {
      // Verify asset is a video owned by user
      const asset = get('SELECT * FROM assets WHERE id = ? AND user_id = ?', [video_asset_id, userId]);
      if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
      }
      if (!asset.mime_type?.startsWith('video/')) {
        return res.status(400).json({ error: 'Asset must be a video' });
      }

      // Get video duration and update slide duration
      let metadata = typeof asset.metadata === 'string' ? JSON.parse(asset.metadata) : asset.metadata;
      let duration_ms = metadata?.duration_ms || 5000;

      if (!metadata?.duration_ms) {
        try {
          const videoPath = path.join(ASSETS_DIR, asset.storage_path);
          const videoMeta = await getVideoMetadata(videoPath);
          duration_ms = videoMeta.duration_ms;
          
          // Update asset metadata
          metadata = { ...metadata, ...videoMeta };
          run('UPDATE assets SET metadata = ? WHERE id = ?', [JSON.stringify(metadata), video_asset_id]);
        } catch (e) {
          console.error('Failed to get video metadata:', e);
        }
      }

      run(`
        UPDATE slides 
        SET video_asset_id = ?, duration_ms = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [video_asset_id, duration_ms, id]);
    } else {
      // Remove video from slide
      run(`
        UPDATE slides 
        SET video_asset_id = NULL, updated_at = datetime('now')
        WHERE id = ?
      `, [id]);
    }

    const updated = get('SELECT * FROM slides WHERE id = ?', [id]);
    res.json(updated);
  } catch (error) {
    console.error('Set slide video error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

