import { Router } from 'express';
import { get, all, run, insert } from '../db.js';

const router = Router();

// GET /api/templates - List all slide templates for user
router.get('/', (req, res) => {
  try {
    const { course_id } = req.query;
    
    let query = `
      SELECT st.*, a.storage_path as thumbnail_path
      FROM slide_templates st
      LEFT JOIN assets a ON st.thumbnail_asset_id = a.id
      WHERE st.user_id = ?
    `;
    const params = [req.user.id];
    
    if (course_id) {
      // Include user-level templates (course_id IS NULL) and course-specific templates
      query += ` AND (st.course_id = ? OR st.course_id IS NULL)`;
      params.push(course_id);
    }
    
    query += ` ORDER BY st.created_at DESC`;
    
    const templates = all(query, params);
    
    // Parse elements JSON and add thumbnail URL
    const parsedTemplates = templates.map(template => ({
      ...template,
      elements: typeof template.elements === 'string' ? JSON.parse(template.elements) : template.elements,
      thumbnail_url: template.thumbnail_path ? `/data/assets/${template.thumbnail_path}` : null
    }));
    
    res.json(parsedTemplates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/templates - Create a new slide template
router.post('/', (req, res) => {
  try {
    const { name, description, elements, background_color, course_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!elements || !Array.isArray(elements)) {
      return res.status(400).json({ error: 'Elements array is required' });
    }

    const templateId = insert(`
      INSERT INTO slide_templates (user_id, course_id, name, description, elements, background_color)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      req.user.id,
      course_id || null,
      name,
      description || '',
      JSON.stringify(elements),
      background_color || '#ffffff'
    ]);

    const template = get('SELECT * FROM slide_templates WHERE id = ?', [templateId]);
    
    res.status(201).json({
      ...template,
      elements: JSON.parse(template.elements)
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/templates/from-slide/:slideId - Create template from existing slide
router.post('/from-slide/:slideId', (req, res) => {
  try {
    const slideId = req.params.slideId;
    const { name, description, course_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Get the slide and verify ownership
    const slide = get(`
      SELECT s.*, d.id as deck_id
      FROM slides s
      JOIN decks d ON s.deck_id = d.id
      JOIN lessons l ON d.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      WHERE s.id = ? AND c.user_id = ?
    `, [slideId, req.user.id]);

    if (!slide) {
      return res.status(404).json({ error: 'Slide not found' });
    }

    // Parse the slide body to get elements
    const body = typeof slide.body === 'string' ? JSON.parse(slide.body) : slide.body;
    const elements = body.elements || [];

    const templateId = insert(`
      INSERT INTO slide_templates (user_id, course_id, name, description, elements, background_color)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      req.user.id,
      course_id || null,
      name,
      description || '',
      JSON.stringify(elements),
      slide.background_color || '#ffffff'
    ]);

    const template = get('SELECT * FROM slide_templates WHERE id = ?', [templateId]);
    
    res.status(201).json({
      ...template,
      elements: JSON.parse(template.elements)
    });
  } catch (error) {
    console.error('Error creating template from slide:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/templates/:id - Get a specific template
router.get('/:id', (req, res) => {
  try {
    const template = get(`
      SELECT st.*, a.storage_path as thumbnail_path
      FROM slide_templates st
      LEFT JOIN assets a ON st.thumbnail_asset_id = a.id
      WHERE st.id = ? AND st.user_id = ?
    `, [req.params.id, req.user.id]);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      ...template,
      elements: typeof template.elements === 'string' ? JSON.parse(template.elements) : template.elements,
      thumbnail_url: template.thumbnail_path ? `/data/assets/${template.thumbnail_path}` : null
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/templates/:id - Update a template
router.put('/:id', (req, res) => {
  try {
    const templateId = req.params.id;
    const { name, description, elements, background_color, course_id } = req.body;

    // Check ownership
    const existing = get('SELECT id FROM slide_templates WHERE id = ? AND user_id = ?', [templateId, req.user.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (elements !== undefined) {
      if (!Array.isArray(elements)) {
        return res.status(400).json({ error: 'Elements must be an array' });
      }
      updates.push('elements = ?');
      params.push(JSON.stringify(elements));
    }
    if (background_color !== undefined) {
      updates.push('background_color = ?');
      params.push(background_color);
    }
    if (course_id !== undefined) {
      updates.push('course_id = ?');
      params.push(course_id || null);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(templateId);
      run(`UPDATE slide_templates SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const template = get('SELECT * FROM slide_templates WHERE id = ?', [templateId]);
    
    res.json({
      ...template,
      elements: typeof template.elements === 'string' ? JSON.parse(template.elements) : template.elements
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/templates/:id - Delete a template
router.delete('/:id', (req, res) => {
  try {
    const templateId = req.params.id;

    // Check ownership
    const existing = get('SELECT id FROM slide_templates WHERE id = ? AND user_id = ?', [templateId, req.user.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    run('DELETE FROM slide_templates WHERE id = ?', [templateId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/templates/:id/apply - Apply template to a slide
router.post('/:id/apply', (req, res) => {
  try {
    const templateId = req.params.id;
    const { slide_id } = req.body;

    if (!slide_id) {
      return res.status(400).json({ error: 'slide_id is required' });
    }

    // Get the template
    const template = get('SELECT * FROM slide_templates WHERE id = ? AND user_id = ?', [templateId, req.user.id]);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Get the slide and verify ownership
    const slide = get(`
      SELECT s.*, d.id as deck_id
      FROM slides s
      JOIN decks d ON s.deck_id = d.id
      JOIN lessons l ON d.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      WHERE s.id = ? AND c.user_id = ?
    `, [slide_id, req.user.id]);

    if (!slide) {
      return res.status(404).json({ error: 'Slide not found' });
    }

    // Parse template elements
    const templateElements = typeof template.elements === 'string' ? JSON.parse(template.elements) : template.elements;

    // Update the slide with template elements
    const currentBody = typeof slide.body === 'string' ? JSON.parse(slide.body) : slide.body;
    const newBody = {
      ...currentBody,
      elements: templateElements,
      version: (currentBody.version || 0) + 1
    };

    run(`
      UPDATE slides 
      SET body = ?, background_color = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [JSON.stringify(newBody), template.background_color, slide_id]);

    const updatedSlide = get('SELECT * FROM slides WHERE id = ?', [slide_id]);
    
    res.json({
      ...updatedSlide,
      body: JSON.parse(updatedSlide.body)
    });
  } catch (error) {
    console.error('Error applying template:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

