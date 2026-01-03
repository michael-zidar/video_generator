import { Router } from 'express';
import { get, all, run, insert } from '../db.js';

const router = Router();

// PUT /api/decks/:id - Update a deck
router.put('/:id', (req, res) => {
  const deckId = req.params.id;
  const { title, aspect_ratio, resolution, theme, intro_scene_enabled, outro_scene_enabled } = req.body;

  // Check ownership
  const existing = get(`
    SELECT d.id
    FROM decks d
    JOIN lessons l ON d.lesson_id = l.id
    JOIN courses c ON l.course_id = c.id
    WHERE d.id = ? AND c.user_id = ?
  `, [deckId, req.user.id]);

  if (!existing) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  const updates = [];
  const params = [];

  if (title !== undefined) {
    updates.push('title = ?');
    params.push(title);
  }
  if (aspect_ratio !== undefined) {
    updates.push('aspect_ratio = ?');
    params.push(aspect_ratio);
  }
  if (resolution !== undefined) {
    updates.push('resolution = ?');
    params.push(resolution);
  }
  if (theme !== undefined) {
    updates.push('theme = ?');
    params.push(JSON.stringify(theme));
  }
  if (intro_scene_enabled !== undefined) {
    updates.push('intro_scene_enabled = ?');
    params.push(intro_scene_enabled ? 1 : 0);
  }
  if (outro_scene_enabled !== undefined) {
    updates.push('outro_scene_enabled = ?');
    params.push(outro_scene_enabled ? 1 : 0);
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(deckId);
    run(`UPDATE decks SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  const deck = get('SELECT * FROM decks WHERE id = ?', [deckId]);
  res.json(deck);
});

// GET /api/decks/:id/slides - Get slides for a deck
router.get('/:id/slides', (req, res) => {
  const deckId = req.params.id;

  // Check ownership
  const deck = get(`
    SELECT d.id
    FROM decks d
    JOIN lessons l ON d.lesson_id = l.id
    JOIN courses c ON l.course_id = c.id
    WHERE d.id = ? AND c.user_id = ?
  `, [deckId, req.user.id]);

  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  const slides = all('SELECT * FROM slides WHERE deck_id = ? ORDER BY position ASC', [deckId]);

  // Parse JSON fields
  const parsedSlides = slides.map(slide => ({
    ...slide,
    body: typeof slide.body === 'string' ? JSON.parse(slide.body) : slide.body,
    transition: typeof slide.transition === 'string' ? JSON.parse(slide.transition) : slide.transition
  }));

  res.json(parsedSlides);
});

// POST /api/decks/:id/slides - Add a slide to a deck
router.post('/:id/slides', (req, res) => {
  const deckId = req.params.id;
  const { title, body, speaker_notes, position, duration_ms, transition, background_color } = req.body;

  // Check ownership
  const deck = get(`
    SELECT d.id
    FROM decks d
    JOIN lessons l ON d.lesson_id = l.id
    JOIN courses c ON l.course_id = c.id
    WHERE d.id = ? AND c.user_id = ?
  `, [deckId, req.user.id]);

  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  // Get max position if not specified
  let slidePosition = position;
  if (slidePosition === undefined) {
    const maxPos = get('SELECT MAX(position) as maxPos FROM slides WHERE deck_id = ?', [deckId]);
    slidePosition = (maxPos?.maxPos ?? -1) + 1;
  }

  const id = insert(`
    INSERT INTO slides (deck_id, title, body, speaker_notes, position, duration_ms, transition, background_color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    deckId,
    title || 'New Slide',
    JSON.stringify(body || { bullets: [] }),
    speaker_notes || '',
    slidePosition,
    duration_ms || 5000,
    JSON.stringify(transition || { type: 'fade' }),
    background_color || '#ffffff'
  ]);

  const slide = get('SELECT * FROM slides WHERE id = ?', [id]);

  // Parse JSON fields
  const parsedSlide = {
    ...slide,
    body: typeof slide.body === 'string' ? JSON.parse(slide.body) : slide.body,
    transition: typeof slide.transition === 'string' ? JSON.parse(slide.transition) : slide.transition
  };

  res.status(201).json(parsedSlide);
});

export default router;
