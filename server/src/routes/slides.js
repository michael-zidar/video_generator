import { Router } from 'express';
import { get, all, run, insert } from '../db.js';

const router = Router();

// PUT /api/slides/:id - Update a slide
router.put('/:id', (req, res) => {
  const slideId = req.params.id;
  const { title, body, speaker_notes, position, duration_ms, transition, background_color, slide_asset_id, image_url, image_position, image_prompt } = req.body;

  // Check ownership
  const existing = get(`
    SELECT s.id
    FROM slides s
    JOIN decks d ON s.deck_id = d.id
    JOIN lessons l ON d.lesson_id = l.id
    JOIN courses c ON l.course_id = c.id
    WHERE s.id = ? AND c.user_id = ?
  `, [slideId, req.user.id]);

  if (!existing) {
    return res.status(404).json({ error: 'Slide not found' });
  }

  const updates = [];
  const params = [];

  if (title !== undefined) {
    updates.push('title = ?');
    params.push(title);
  }
  if (body !== undefined) {
    updates.push('body = ?');
    params.push(JSON.stringify(body));
  }
  if (speaker_notes !== undefined) {
    updates.push('speaker_notes = ?');
    params.push(speaker_notes);
  }
  if (position !== undefined) {
    updates.push('position = ?');
    params.push(position);
  }
  if (duration_ms !== undefined) {
    updates.push('duration_ms = ?');
    params.push(duration_ms);
  }
  if (transition !== undefined) {
    updates.push('transition = ?');
    params.push(JSON.stringify(transition));
  }
  if (background_color !== undefined) {
    updates.push('background_color = ?');
    params.push(background_color);
  }
  if (slide_asset_id !== undefined) {
    updates.push('slide_asset_id = ?');
    params.push(slide_asset_id);
  }
  if (image_url !== undefined) {
    updates.push('image_url = ?');
    params.push(image_url);
  }
  if (image_position !== undefined) {
    updates.push('image_position = ?');
    params.push(image_position);
  }
  if (image_prompt !== undefined) {
    updates.push('image_prompt = ?');
    params.push(image_prompt);
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(slideId);
    run(`UPDATE slides SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  const slide = get('SELECT * FROM slides WHERE id = ?', [slideId]);

  // Parse JSON fields
  const parsedSlide = {
    ...slide,
    body: typeof slide.body === 'string' ? JSON.parse(slide.body) : slide.body,
    transition: typeof slide.transition === 'string' ? JSON.parse(slide.transition) : slide.transition
  };

  res.json(parsedSlide);
});

// DELETE /api/slides/:id - Delete a slide
router.delete('/:id', (req, res) => {
  const slideId = req.params.id;

  // Check ownership
  const existing = get(`
    SELECT s.id, s.deck_id, s.position
    FROM slides s
    JOIN decks d ON s.deck_id = d.id
    JOIN lessons l ON d.lesson_id = l.id
    JOIN courses c ON l.course_id = c.id
    WHERE s.id = ? AND c.user_id = ?
  `, [slideId, req.user.id]);

  if (!existing) {
    return res.status(404).json({ error: 'Slide not found' });
  }

  run('DELETE FROM slides WHERE id = ?', [slideId]);

  // Update positions of remaining slides
  run(`
    UPDATE slides
    SET position = position - 1, updated_at = CURRENT_TIMESTAMP
    WHERE deck_id = ? AND position > ?
  `, [existing.deck_id, existing.position]);

  res.json({ success: true });
});

// POST /api/slides/:id/duplicate - Duplicate a slide
router.post('/:id/duplicate', (req, res) => {
  const slideId = req.params.id;

  // Get original slide and check ownership
  const slide = get(`
    SELECT s.*
    FROM slides s
    JOIN decks d ON s.deck_id = d.id
    JOIN lessons l ON d.lesson_id = l.id
    JOIN courses c ON l.course_id = c.id
    WHERE s.id = ? AND c.user_id = ?
  `, [slideId, req.user.id]);

  if (!slide) {
    return res.status(404).json({ error: 'Slide not found' });
  }

  // Shift positions of slides after this one
  run(`
    UPDATE slides
    SET position = position + 1, updated_at = CURRENT_TIMESTAMP
    WHERE deck_id = ? AND position > ?
  `, [slide.deck_id, slide.position]);

  // Create duplicate (including image fields)
  const id = insert(`
    INSERT INTO slides (deck_id, title, body, speaker_notes, position, duration_ms, transition, background_color, image_url, image_position, image_prompt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    slide.deck_id,
    slide.title,
    slide.body,
    slide.speaker_notes,
    slide.position + 1,
    slide.duration_ms,
    slide.transition,
    slide.background_color,
    slide.image_url,
    slide.image_position,
    slide.image_prompt
  ]);

  const newSlide = get('SELECT * FROM slides WHERE id = ?', [id]);

  // Parse JSON fields
  const parsedSlide = {
    ...newSlide,
    body: typeof newSlide.body === 'string' ? JSON.parse(newSlide.body) : newSlide.body,
    transition: typeof newSlide.transition === 'string' ? JSON.parse(newSlide.transition) : newSlide.transition
  };

  res.status(201).json(parsedSlide);
});

// POST /api/slides/reorder - Reorder slides
router.post('/reorder', (req, res) => {
  const { deck_id, slide_ids } = req.body;

  if (!deck_id || !Array.isArray(slide_ids)) {
    return res.status(400).json({ error: 'deck_id and slide_ids are required' });
  }

  // Check ownership
  const deck = get(`
    SELECT d.id
    FROM decks d
    JOIN lessons l ON d.lesson_id = l.id
    JOIN courses c ON l.course_id = c.id
    WHERE d.id = ? AND c.user_id = ?
  `, [deck_id, req.user.id]);

  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  // Update positions
  slide_ids.forEach((slideId, index) => {
    run('UPDATE slides SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deck_id = ?',
      [index, slideId, deck_id]);
  });

  const slides = all('SELECT * FROM slides WHERE deck_id = ? ORDER BY position ASC', [deck_id]);

  // Parse JSON fields
  const parsedSlides = slides.map(slide => ({
    ...slide,
    body: typeof slide.body === 'string' ? JSON.parse(slide.body) : slide.body,
    transition: typeof slide.transition === 'string' ? JSON.parse(slide.transition) : slide.transition
  }));

  res.json(parsedSlides);
});

export default router;
