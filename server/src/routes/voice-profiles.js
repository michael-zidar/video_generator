import express from 'express';
import { get, all, run, insert } from '../db.js';

const router = express.Router();

// GET /api/voice-profiles - List all voice profiles for user
router.get('/', (req, res) => {
  try {
    const profiles = all('SELECT * FROM voice_profiles WHERE user_id = ? ORDER BY created_at DESC', [req.userId]);
    
    // Parse JSON fields
    const parsed = profiles.map(p => ({
      ...p,
      defaults: p.defaults ? JSON.parse(p.defaults) : {},
      pronunciation_lexicon: p.pronunciation_lexicon ? JSON.parse(p.pronunciation_lexicon) : {},
    }));
    
    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/voice-profiles/:id - Get a specific voice profile
router.get('/:id', (req, res) => {
  try {
    const profile = get('SELECT * FROM voice_profiles WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    
    if (!profile) {
      return res.status(404).json({ error: 'Voice profile not found' });
    }
    
    res.json({
      ...profile,
      defaults: profile.defaults ? JSON.parse(profile.defaults) : {},
      pronunciation_lexicon: profile.pronunciation_lexicon ? JSON.parse(profile.pronunciation_lexicon) : {},
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/voice-profiles - Create a new voice profile
router.post('/', (req, res) => {
  try {
    const { name, provider = 'elevenlabs', voice_id, defaults = {}, pronunciation_lexicon = {} } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!voice_id) {
      return res.status(400).json({ error: 'Voice ID is required' });
    }
    
    const profileId = insert(
      `INSERT INTO voice_profiles (user_id, name, provider, voice_id, defaults, pronunciation_lexicon, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [req.userId, name, provider, voice_id, JSON.stringify(defaults), JSON.stringify(pronunciation_lexicon)]
    );
    
    const profile = get('SELECT * FROM voice_profiles WHERE id = ?', [profileId]);
    
    res.status(201).json({
      ...profile,
      defaults: JSON.parse(profile.defaults || '{}'),
      pronunciation_lexicon: JSON.parse(profile.pronunciation_lexicon || '{}'),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/voice-profiles/:id - Update a voice profile
router.put('/:id', (req, res) => {
  try {
    const { name, provider, voice_id, defaults } = req.body;
    
    // Check ownership
    const existing = get('SELECT * FROM voice_profiles WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    
    if (!existing) {
      return res.status(404).json({ error: 'Voice profile not found' });
    }
    
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (provider !== undefined) {
      updates.push('provider = ?');
      values.push(provider);
    }
    if (voice_id !== undefined) {
      updates.push('voice_id = ?');
      values.push(voice_id);
    }
    if (defaults !== undefined) {
      updates.push('defaults = ?');
      values.push(JSON.stringify(defaults));
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    
    updates.push('updated_at = datetime("now")');
    values.push(req.params.id);
    
    run(`UPDATE voice_profiles SET ${updates.join(', ')} WHERE id = ?`, values);
    
    const profile = get('SELECT * FROM voice_profiles WHERE id = ?', [req.params.id]);
    
    res.json({
      ...profile,
      defaults: JSON.parse(profile.defaults || '{}'),
      pronunciation_lexicon: JSON.parse(profile.pronunciation_lexicon || '{}'),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/voice-profiles/:id/lexicon - Update pronunciation lexicon
router.put('/:id/lexicon', (req, res) => {
  try {
    const { pronunciation_lexicon } = req.body;
    
    // Check ownership
    const existing = get('SELECT * FROM voice_profiles WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    
    if (!existing) {
      return res.status(404).json({ error: 'Voice profile not found' });
    }
    
    run(`UPDATE voice_profiles SET pronunciation_lexicon = ?, updated_at = datetime('now') WHERE id = ?`,
      [JSON.stringify(pronunciation_lexicon || {}), req.params.id]);
    
    const profile = get('SELECT * FROM voice_profiles WHERE id = ?', [req.params.id]);
    
    res.json({
      ...profile,
      defaults: JSON.parse(profile.defaults || '{}'),
      pronunciation_lexicon: JSON.parse(profile.pronunciation_lexicon || '{}'),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/voice-profiles/:id - Delete a voice profile
router.delete('/:id', (req, res) => {
  try {
    // Check ownership
    const existing = get('SELECT * FROM voice_profiles WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    
    if (!existing) {
      return res.status(404).json({ error: 'Voice profile not found' });
    }
    
    run('DELETE FROM voice_profiles WHERE id = ?', [req.params.id]);
    
    res.json({ message: 'Voice profile deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
