import { Router } from 'express';
import { get, all, run, insert } from '../db.js';

const router = Router();

// GET /api/lessons/:id - Get a single lesson
router.get('/:id', (req, res) => {
  const lessonId = req.params.id;

  const lesson = get(`
    SELECT l.*, c.user_id
    FROM lessons l
    JOIN courses c ON l.course_id = c.id
    WHERE l.id = ? AND c.user_id = ?
  `, [lessonId, req.user.id]);

  if (!lesson) {
    return res.status(404).json({ error: 'Lesson not found' });
  }

  res.json(lesson);
});

// PUT /api/lessons/:id - Update a lesson
router.put('/:id', (req, res) => {
  const lessonId = req.params.id;
  const { title, description, position } = req.body;

  // Check ownership
  const existing = get(`
    SELECT l.id
    FROM lessons l
    JOIN courses c ON l.course_id = c.id
    WHERE l.id = ? AND c.user_id = ?
  `, [lessonId, req.user.id]);

  if (!existing) {
    return res.status(404).json({ error: 'Lesson not found' });
  }

  const updates = [];
  const params = [];

  if (title !== undefined) {
    updates.push('title = ?');
    params.push(title);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description);
  }
  if (position !== undefined) {
    updates.push('position = ?');
    params.push(position);
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(lessonId);
    run(`UPDATE lessons SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  const lesson = get('SELECT * FROM lessons WHERE id = ?', [lessonId]);
  res.json(lesson);
});

// DELETE /api/lessons/:id - Delete a lesson
router.delete('/:id', (req, res) => {
  const lessonId = req.params.id;

  // Check ownership
  const existing = get(`
    SELECT l.id
    FROM lessons l
    JOIN courses c ON l.course_id = c.id
    WHERE l.id = ? AND c.user_id = ?
  `, [lessonId, req.user.id]);

  if (!existing) {
    return res.status(404).json({ error: 'Lesson not found' });
  }

  run('DELETE FROM lessons WHERE id = ?', [lessonId]);
  res.json({ success: true });
});

// POST /api/lessons/:id/duplicate - Duplicate a lesson
router.post('/:id/duplicate', (req, res) => {
  const lessonId = req.params.id;

  // Get original lesson
  const lesson = get(`
    SELECT l.*, c.user_id
    FROM lessons l
    JOIN courses c ON l.course_id = c.id
    WHERE l.id = ? AND c.user_id = ?
  `, [lessonId, req.user.id]);

  if (!lesson) {
    return res.status(404).json({ error: 'Lesson not found' });
  }

  // Get max position
  const maxPos = get('SELECT MAX(position) as maxPos FROM lessons WHERE course_id = ?', [lesson.course_id]);
  const position = (maxPos?.maxPos || 0) + 1;

  // Create duplicate lesson
  const newId = insert(`
    INSERT INTO lessons (course_id, title, description, position)
    VALUES (?, ?, ?, ?)
  `, [lesson.course_id, `${lesson.title} (Copy)`, lesson.description, position]);

  // Duplicate deck if exists
  const deck = get('SELECT * FROM decks WHERE lesson_id = ?', [lessonId]);
  if (deck) {
    const newDeckId = insert(`
      INSERT INTO decks (lesson_id, title, aspect_ratio, resolution, theme, intro_scene_enabled, outro_scene_enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [newId, deck.title, deck.aspect_ratio, deck.resolution, deck.theme, deck.intro_scene_enabled, deck.outro_scene_enabled]);

    // Duplicate slides
    const slides = all('SELECT * FROM slides WHERE deck_id = ? ORDER BY position', [deck.id]);
    for (const slide of slides) {
      insert(`
        INSERT INTO slides (deck_id, position, title, body, speaker_notes, duration_ms, transition, background_color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [newDeckId, slide.position, slide.title, slide.body, slide.speaker_notes, slide.duration_ms, slide.transition, slide.background_color]);
    }
  }

  const newLesson = get('SELECT * FROM lessons WHERE id = ?', [newId]);
  res.status(201).json(newLesson);
});

// POST /api/lessons/reorder - Reorder lessons within a course
router.post('/reorder', (req, res) => {
  const { course_id, lesson_ids } = req.body;

  if (!course_id || !Array.isArray(lesson_ids)) {
    return res.status(400).json({ error: 'course_id and lesson_ids are required' });
  }

  // Check ownership
  const course = get(`
    SELECT id FROM courses WHERE id = ? AND user_id = ?
  `, [course_id, req.user.id]);

  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }

  // Update positions
  lesson_ids.forEach((lessonId, index) => {
    run('UPDATE lessons SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND course_id = ?',
      [index, lessonId, course_id]);
  });

  const lessons = all('SELECT * FROM lessons WHERE course_id = ? ORDER BY position ASC', [course_id]);
  res.json(lessons);
});

// GET /api/lessons/:lessonId/deck - Get deck for a lesson
router.get('/:lessonId/deck', (req, res) => {
  const lessonId = req.params.lessonId;

  // Check ownership
  const lesson = get(`
    SELECT l.id
    FROM lessons l
    JOIN courses c ON l.course_id = c.id
    WHERE l.id = ? AND c.user_id = ?
  `, [lessonId, req.user.id]);

  if (!lesson) {
    return res.status(404).json({ error: 'Lesson not found' });
  }

  const deck = get('SELECT * FROM decks WHERE lesson_id = ?', [lessonId]);

  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  res.json(deck);
});

// POST /api/lessons/:lessonId/deck - Create deck for a lesson
router.post('/:lessonId/deck', (req, res) => {
  const lessonId = req.params.lessonId;
  const { title, aspect_ratio, resolution, theme, intro_scene_enabled, outro_scene_enabled } = req.body;

  // Check ownership
  const lesson = get(`
    SELECT l.id
    FROM lessons l
    JOIN courses c ON l.course_id = c.id
    WHERE l.id = ? AND c.user_id = ?
  `, [lessonId, req.user.id]);

  if (!lesson) {
    return res.status(404).json({ error: 'Lesson not found' });
  }

  // Check if deck already exists
  const existingDeck = get('SELECT id FROM decks WHERE lesson_id = ?', [lessonId]);
  if (existingDeck) {
    return res.status(400).json({ error: 'Deck already exists for this lesson' });
  }

  const id = insert(`
    INSERT INTO decks (lesson_id, title, aspect_ratio, resolution, theme, intro_scene_enabled, outro_scene_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    lessonId,
    title || 'Untitled Deck',
    aspect_ratio || '16:9',
    resolution || '1080p',
    JSON.stringify(theme || {}),
    intro_scene_enabled ? 1 : 0,
    outro_scene_enabled ? 1 : 0
  ]);

  const deck = get('SELECT * FROM decks WHERE id = ?', [id]);
  res.status(201).json(deck);
});

export default router;
