import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { get, all, run, insert } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '../../../data/assets');
const BRAND_ASSETS_DIR = path.join(ASSETS_DIR, 'brand');

// Ensure brand assets directory exists
if (!fs.existsSync(BRAND_ASSETS_DIR)) {
  fs.mkdirSync(BRAND_ASSETS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, BRAND_ASSETS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `brand_${Date.now()}_${uuidv4().substring(0, 8)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for brand assets
  },
  fileFilter: (req, file, cb) => {
    // Only allow images for brand assets
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for brand assets'));
    }
  }
});

const router = Router();

// GET /api/brand-assets - List all brand assets for user
router.get('/', (req, res) => {
  try {
    const { course_id } = req.query;
    
    let query = `
      SELECT ba.*, a.storage_path, a.filename as original_filename, a.mime_type
      FROM brand_assets ba
      JOIN assets a ON ba.asset_id = a.id
      WHERE ba.user_id = ?
    `;
    const params = [req.user.id];
    
    if (course_id) {
      query += ` AND (ba.course_id = ? OR ba.course_id IS NULL)`;
      params.push(course_id);
    }
    
    query += ` ORDER BY ba.created_at DESC`;
    
    const brandAssets = all(query, params);
    
    // Add URL for each asset
    const assetsWithUrls = brandAssets.map(asset => ({
      ...asset,
      url: `/data/assets/brand/${asset.storage_path}`
    }));
    
    res.json(assetsWithUrls);
  } catch (error) {
    console.error('Error fetching brand assets:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/brand-assets - Upload a new brand asset
router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { name, type, course_id, default_position, default_size, default_opacity } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!type || !['logo', 'watermark', 'icon'].includes(type)) {
      return res.status(400).json({ error: 'Type must be logo, watermark, or icon' });
    }

    // First, create the asset record
    const assetId = insert(`
      INSERT INTO assets (user_id, course_id, kind, filename, mime_type, size_bytes, storage_path, metadata)
      VALUES (?, ?, 'brand', ?, ?, ?, ?, ?)
    `, [
      req.user.id,
      course_id || null,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      req.file.filename,
      JSON.stringify({ type })
    ]);

    // Then create the brand asset record
    const brandAssetId = insert(`
      INSERT INTO brand_assets (user_id, course_id, name, type, asset_id, default_position, default_size, default_opacity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.user.id,
      course_id || null,
      name,
      type,
      assetId,
      default_position || 'bottom-right',
      default_size ? parseInt(default_size) : 10,
      default_opacity ? parseFloat(default_opacity) : 1.0
    ]);

    const brandAsset = get(`
      SELECT ba.*, a.storage_path, a.filename as original_filename, a.mime_type
      FROM brand_assets ba
      JOIN assets a ON ba.asset_id = a.id
      WHERE ba.id = ?
    `, [brandAssetId]);

    res.status(201).json({
      ...brandAsset,
      url: `/data/assets/brand/${brandAsset.storage_path}`
    });
  } catch (error) {
    console.error('Error creating brand asset:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/brand-assets/:id - Get a specific brand asset
router.get('/:id', (req, res) => {
  try {
    const brandAsset = get(`
      SELECT ba.*, a.storage_path, a.filename as original_filename, a.mime_type
      FROM brand_assets ba
      JOIN assets a ON ba.asset_id = a.id
      WHERE ba.id = ? AND ba.user_id = ?
    `, [req.params.id, req.user.id]);

    if (!brandAsset) {
      return res.status(404).json({ error: 'Brand asset not found' });
    }

    res.json({
      ...brandAsset,
      url: `/data/assets/brand/${brandAsset.storage_path}`
    });
  } catch (error) {
    console.error('Error fetching brand asset:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/brand-assets/:id - Update a brand asset
router.put('/:id', (req, res) => {
  try {
    const brandAssetId = req.params.id;
    const { name, type, course_id, default_position, default_size, default_opacity } = req.body;

    // Check ownership
    const existing = get('SELECT id FROM brand_assets WHERE id = ? AND user_id = ?', [brandAssetId, req.user.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Brand asset not found' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (type !== undefined) {
      if (!['logo', 'watermark', 'icon'].includes(type)) {
        return res.status(400).json({ error: 'Type must be logo, watermark, or icon' });
      }
      updates.push('type = ?');
      params.push(type);
    }
    if (course_id !== undefined) {
      updates.push('course_id = ?');
      params.push(course_id || null);
    }
    if (default_position !== undefined) {
      updates.push('default_position = ?');
      params.push(default_position);
    }
    if (default_size !== undefined) {
      updates.push('default_size = ?');
      params.push(parseInt(default_size));
    }
    if (default_opacity !== undefined) {
      updates.push('default_opacity = ?');
      params.push(parseFloat(default_opacity));
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(brandAssetId);
      run(`UPDATE brand_assets SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const brandAsset = get(`
      SELECT ba.*, a.storage_path, a.filename as original_filename, a.mime_type
      FROM brand_assets ba
      JOIN assets a ON ba.asset_id = a.id
      WHERE ba.id = ?
    `, [brandAssetId]);

    res.json({
      ...brandAsset,
      url: `/data/assets/brand/${brandAsset.storage_path}`
    });
  } catch (error) {
    console.error('Error updating brand asset:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/brand-assets/:id - Delete a brand asset
router.delete('/:id', (req, res) => {
  try {
    const brandAssetId = req.params.id;

    // Get the brand asset with its file path
    const brandAsset = get(`
      SELECT ba.*, a.storage_path
      FROM brand_assets ba
      JOIN assets a ON ba.asset_id = a.id
      WHERE ba.id = ? AND ba.user_id = ?
    `, [brandAssetId, req.user.id]);

    if (!brandAsset) {
      return res.status(404).json({ error: 'Brand asset not found' });
    }

    // Delete the file
    const filePath = path.join(BRAND_ASSETS_DIR, brandAsset.storage_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete the brand asset record (this will keep the asset record for now)
    run('DELETE FROM brand_assets WHERE id = ?', [brandAssetId]);
    
    // Also delete the underlying asset record
    run('DELETE FROM assets WHERE id = ?', [brandAsset.asset_id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting brand asset:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

