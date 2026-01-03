import { get } from '../db.js';

// Simple token-based auth middleware
// In production, use proper JWT or session management
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.substring(7);

  // For simplicity, token is just the user ID
  // In production, use proper JWT verification
  const userId = parseInt(token, 10);

  if (isNaN(userId)) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const user = get('SELECT id, email, name, avatar_url FROM users WHERE id = ?', [userId]);

  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  next();
}
