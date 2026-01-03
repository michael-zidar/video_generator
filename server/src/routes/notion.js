import { Router } from 'express';
import { get, run } from '../db.js';
import { 
  testConnection, 
  listPages, 
  getPageContent 
} from '../services/notion.js';
import { generateSlidesFromNotionContent } from '../services/ai.js';

const router = Router();

/**
 * POST /api/notion/test
 * Test Notion API connection with provided API key
 */
router.post('/test', async (req, res) => {
  try {
    const { api_key } = req.body;
    
    if (!api_key) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    const result = await testConnection(api_key);
    
    if (result.success) {
      res.json({
        success: true,
        user: result.user,
        message: 'Successfully connected to Notion',
      });
    } else {
      res.status(401).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Notion test connection error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/notion/save-key
 * Save Notion API key to user preferences
 */
router.post('/save-key', async (req, res) => {
  try {
    const { api_key } = req.body;
    const userId = req.user.id;
    
    if (!api_key) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    // Get current preferences
    const user = get('SELECT preferences FROM users WHERE id = ?', [userId]);
    let preferences = {};
    try {
      preferences = JSON.parse(user?.preferences || '{}');
    } catch (e) {
      preferences = {};
    }
    
    // Save the API key (in production, this should be encrypted)
    preferences.notion_api_key = api_key;
    
    run('UPDATE users SET preferences = ? WHERE id = ?', [
      JSON.stringify(preferences),
      userId,
    ]);
    
    res.json({ success: true, message: 'Notion API key saved' });
  } catch (error) {
    console.error('Save Notion key error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/notion/remove-key
 * Remove Notion API key from user preferences
 */
router.delete('/remove-key', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get current preferences
    const user = get('SELECT preferences FROM users WHERE id = ?', [userId]);
    let preferences = {};
    try {
      preferences = JSON.parse(user?.preferences || '{}');
    } catch (e) {
      preferences = {};
    }
    
    // Remove the API key
    delete preferences.notion_api_key;
    
    run('UPDATE users SET preferences = ? WHERE id = ?', [
      JSON.stringify(preferences),
      userId,
    ]);
    
    res.json({ success: true, message: 'Notion API key removed' });
  } catch (error) {
    console.error('Remove Notion key error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/notion/status
 * Check if Notion is connected for the current user
 */
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = get('SELECT preferences FROM users WHERE id = ?', [userId]);
    let preferences = {};
    try {
      preferences = JSON.parse(user?.preferences || '{}');
    } catch (e) {
      preferences = {};
    }
    
    const hasKey = !!preferences.notion_api_key;
    
    if (hasKey) {
      // Test the connection
      const result = await testConnection(preferences.notion_api_key);
      res.json({
        connected: result.success,
        user: result.user,
      });
    } else {
      res.json({ connected: false });
    }
  } catch (error) {
    console.error('Notion status error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/notion/pages
 * List accessible Notion pages
 */
router.get('/pages', async (req, res) => {
  try {
    const userId = req.user.id;
    const { query } = req.query;
    
    // Get API key from preferences
    const user = get('SELECT preferences FROM users WHERE id = ?', [userId]);
    let preferences = {};
    try {
      preferences = JSON.parse(user?.preferences || '{}');
    } catch (e) {
      preferences = {};
    }
    
    if (!preferences.notion_api_key) {
      return res.status(401).json({ error: 'Notion not connected. Please add your API key in settings.' });
    }
    
    const pages = await listPages(preferences.notion_api_key, query || '');
    res.json({ pages });
  } catch (error) {
    console.error('List Notion pages error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/notion/pages/:pageId/preview
 * Preview a Notion page content (markdown)
 */
router.get('/pages/:pageId/preview', async (req, res) => {
  try {
    const userId = req.user.id;
    const { pageId } = req.params;
    
    // Get API key from preferences
    const user = get('SELECT preferences FROM users WHERE id = ?', [userId]);
    let preferences = {};
    try {
      preferences = JSON.parse(user?.preferences || '{}');
    } catch (e) {
      preferences = {};
    }
    
    if (!preferences.notion_api_key) {
      return res.status(401).json({ error: 'Notion not connected' });
    }
    
    const content = await getPageContent(preferences.notion_api_key, pageId);
    res.json(content);
  } catch (error) {
    console.error('Preview Notion page error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/notion/import
 * Import a Notion page as slides using AI
 */
router.post('/import', async (req, res) => {
  try {
    const userId = req.user.id;
    const { page_id, deck_id, target_slides = 8 } = req.body;
    
    if (!page_id) {
      return res.status(400).json({ error: 'page_id is required' });
    }
    
    if (!deck_id) {
      return res.status(400).json({ error: 'deck_id is required' });
    }
    
    // Verify deck exists and belongs to user
    const deck = get(`
      SELECT d.* FROM decks d
      JOIN lessons l ON d.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      WHERE d.id = ? AND c.user_id = ?
    `, [deck_id, userId]);
    
    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }
    
    // Get API key from preferences
    const user = get('SELECT preferences FROM users WHERE id = ?', [userId]);
    let preferences = {};
    try {
      preferences = JSON.parse(user?.preferences || '{}');
    } catch (e) {
      preferences = {};
    }
    
    if (!preferences.notion_api_key) {
      return res.status(401).json({ error: 'Notion not connected' });
    }
    
    // Get page content
    const content = await getPageContent(preferences.notion_api_key, page_id);
    
    // Use AI to structure content into slides
    const slides = await generateSlidesFromNotionContent(content.markdown, target_slides);
    
    // Insert slides into database
    const insertedSlides = [];
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      
      run(`
        INSERT INTO slides (deck_id, position, title, body, speaker_notes, duration_ms, background_color)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        deck_id,
        i,
        slide.title,
        JSON.stringify(slide.body),
        slide.speaker_notes || '',
        5000,
        slide.background_color || '#ffffff',
      ]);
      
      // Get the inserted slide
      const insertedSlide = get('SELECT * FROM slides WHERE deck_id = ? AND position = ?', [deck_id, i]);
      insertedSlides.push(insertedSlide);
    }
    
    res.json({
      success: true,
      message: `Imported ${slides.length} slides from Notion`,
      source: {
        title: content.title,
        blockCount: content.blockCount,
      },
      slides: insertedSlides,
    });
  } catch (error) {
    console.error('Import Notion page error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

