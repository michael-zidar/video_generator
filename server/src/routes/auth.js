import { Router } from 'express';
import { get, run } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = get('SELECT id, email, name, avatar_url, password FROM users WHERE email = ?', [email]);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Simple password check (in production, use bcrypt)
  if (user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Update last login
  run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

  // Return user without password
  const { password: _, ...userWithoutPassword } = user;

  res.json({
    user: userWithoutPassword,
    token: String(user.id) // Simple token (use JWT in production)
  });
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, (req, res) => {
  // In a real app, invalidate the token
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, (req, res) => {
  const { name, avatar_url } = req.body;

  if (name) {
    run('UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, req.user.id]);
  }

  if (avatar_url !== undefined) {
    run('UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [avatar_url, req.user.id]);
  }

  const updatedUser = get('SELECT id, email, name, avatar_url FROM users WHERE id = ?', [req.user.id]);
  res.json(updatedUser);
});

export default router;
