import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { get, run, insert } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '../../../data/assets');

// Ensure assets directory exists
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ASSETS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

const router = Router();

// POST /api/assets/upload - Upload a file
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { course_id } = req.body;

  // Determine asset kind from mime type
  let kind = 'document';
  if (req.file.mimetype.startsWith('image/')) {
    kind = 'image';
  } else if (req.file.mimetype.startsWith('video/')) {
    kind = 'video';
  } else if (req.file.mimetype.startsWith('audio/')) {
    kind = 'audio';
  }

  const id = insert(`
    INSERT INTO assets (user_id, course_id, kind, filename, mime_type, size_bytes, storage_path, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    req.user.id,
    course_id || null,
    kind,
    req.file.originalname,
    req.file.mimetype,
    req.file.size,
    req.file.filename,
    JSON.stringify({})
  ]);

  const asset = get('SELECT * FROM assets WHERE id = ?', [id]);
  res.status(201).json(asset);
});

// GET /api/assets/:id - Get asset metadata
router.get('/:id', (req, res) => {
  const asset = get('SELECT * FROM assets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

  if (!asset) {
    return res.status(404).json({ error: 'Asset not found' });
  }

  res.json(asset);
});

// GET /api/assets/:id/download - Download asset file
router.get('/:id/download', (req, res) => {
  const asset = get('SELECT * FROM assets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

  if (!asset) {
    return res.status(404).json({ error: 'Asset not found' });
  }

  const filePath = path.join(ASSETS_DIR, asset.storage_path);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, asset.filename);
});

// DELETE /api/assets/:id - Delete an asset
router.delete('/:id', (req, res) => {
  const asset = get('SELECT * FROM assets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

  if (!asset) {
    return res.status(404).json({ error: 'Asset not found' });
  }

  // Delete file
  const filePath = path.join(ASSETS_DIR, asset.storage_path);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // Delete database record
  run('DELETE FROM assets WHERE id = ?', [asset.id]);

  res.json({ success: true });
});

export default router;
