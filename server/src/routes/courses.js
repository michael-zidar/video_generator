import { Router } from 'express';
import { get, all, run, insert } from '../db.js';

const router = Router();

// GET /api/courses - List all courses for user
router.get('/', (req, res) => {
  const courses = all(`
    SELECT c.*,
           (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as lesson_count
    FROM courses c
    WHERE c.user_id = ?
    ORDER BY c.is_pinned DESC, c.updated_at DESC
  `, [req.user.id]);

  res.json(courses);
});

// POST /api/courses - Create a new course
router.post('/', (req, res) => {
  const { name, description, branding } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const id = insert(`
    INSERT INTO courses (user_id, name, description, branding)
    VALUES (?, ?, ?, ?)
  `, [req.user.id, name, description || '', JSON.stringify(branding || {})]);

  const course = get('SELECT * FROM courses WHERE id = ?', [id]);
  res.status(201).json(course);
});

// GET /api/courses/:id - Get a single course
router.get('/:id', (req, res) => {
  const course = get(`
    SELECT c.*,
           (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as lesson_count
    FROM courses c
    WHERE c.id = ? AND c.user_id = ?
  `, [req.params.id, req.user.id]);

  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }

  res.json(course);
});

// PUT /api/courses/:id - Update a course
router.put('/:id', (req, res) => {
  const { name, description, branding } = req.body;
  const courseId = req.params.id;

  // Check ownership
  const existing = get('SELECT id FROM courses WHERE id = ? AND user_id = ?', [courseId, req.user.id]);
  if (!existing) {
    return res.status(404).json({ error: 'Course not found' });
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
  if (branding !== undefined) {
    updates.push('branding = ?');
    params.push(JSON.stringify(branding));
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(courseId);
    run(`UPDATE courses SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  const course = get('SELECT * FROM courses WHERE id = ?', [courseId]);
  res.json(course);
});

// DELETE /api/courses/:id - Delete a course
router.delete('/:id', (req, res) => {
  const courseId = req.params.id;

  // Check ownership
  const existing = get('SELECT id FROM courses WHERE id = ? AND user_id = ?', [courseId, req.user.id]);
  if (!existing) {
    return res.status(404).json({ error: 'Course not found' });
  }

  // Delete cascade (lessons, decks, slides will be deleted by FK constraints)
  run('DELETE FROM courses WHERE id = ?', [courseId]);

  res.json({ success: true });
});

// PUT /api/courses/:id/archive - Archive/unarchive a course
router.put('/:id/archive', (req, res) => {
  const courseId = req.params.id;
  const { is_archived } = req.body;

  // Check ownership
  const existing = get('SELECT id FROM courses WHERE id = ? AND user_id = ?', [courseId, req.user.id]);
  if (!existing) {
    return res.status(404).json({ error: 'Course not found' });
  }

  run('UPDATE courses SET is_archived = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [is_archived ? 1 : 0, courseId]);

  const course = get('SELECT * FROM courses WHERE id = ?', [courseId]);
  res.json(course);
});

// PUT /api/courses/:id/pin - Pin/unpin a course
router.put('/:id/pin', (req, res) => {
  const courseId = req.params.id;
  const { is_pinned } = req.body;

  // Check ownership
  const existing = get('SELECT id FROM courses WHERE id = ? AND user_id = ?', [courseId, req.user.id]);
  if (!existing) {
    return res.status(404).json({ error: 'Course not found' });
  }

  run('UPDATE courses SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [is_pinned ? 1 : 0, courseId]);

  const course = get('SELECT * FROM courses WHERE id = ?', [courseId]);
  res.json(course);
});

// GET /api/courses/:courseId/lessons - Get lessons for a course
router.get('/:courseId/lessons', (req, res) => {
  const courseId = req.params.courseId;

  // Check ownership
  const course = get('SELECT id FROM courses WHERE id = ? AND user_id = ?', [courseId, req.user.id]);
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }

  const lessons = all(`
    SELECT * FROM lessons
    WHERE course_id = ?
    ORDER BY position ASC
  `, [courseId]);

  res.json(lessons);
});

// POST /api/courses/:courseId/lessons - Create a lesson in a course
router.post('/:courseId/lessons', (req, res) => {
  const courseId = req.params.courseId;
  const { title, description } = req.body;

  // Check ownership
  const course = get('SELECT id FROM courses WHERE id = ? AND user_id = ?', [courseId, req.user.id]);
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // Get max position
  const maxPos = get('SELECT MAX(position) as maxPos FROM lessons WHERE course_id = ?', [courseId]);
  const position = (maxPos?.maxPos || 0) + 1;

  const id = insert(`
    INSERT INTO lessons (course_id, title, description, position)
    VALUES (?, ?, ?, ?)
  `, [courseId, title, description || '', position]);

  const lesson = get('SELECT * FROM lessons WHERE id = ?', [id]);
  res.status(201).json(lesson);
});

export default router;
