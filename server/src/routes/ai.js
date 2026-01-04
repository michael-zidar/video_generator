import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { get, all, run, insert, saveDatabase } from '../db.js';
import {
  generateOutline,
  generateSlideContent,
  generateScript,
  generateEnhancedSpeakerNotes,
  generateSlidesFromOutline,
  generateSlidesFromNotionContent,
  inferOptimalSlideCount,
  getAIStatus
} from '../services/ai.js';
import {
  getVoices,
  generateAudio,
  getTTSStatus,
  getPresetVoices,
  isElevenLabsConfigured,
} from '../services/tts.js';
import {
  generateSlideImage,
  generateImagePromptFromSlide,
  getImageGenerationStatus,
  isImageGenerationConfigured,
} from '../services/image-generation.js';
import {
  transcribeRecording,
  getTranscriptionStatus,
} from '../services/transcription.js';
import { getAudioDuration } from '../services/tts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.join(__dirname, '../../../data/assets/audio');

// Ensure audio directory exists
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// Multer configuration for recording uploads
const recordingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AUDIO_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomId = uuidv4().substring(0, 10);
    cb(null, `recording_${timestamp}_${randomId}.webm`);
  }
});

const uploadRecording = multer({
  storage: recordingStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

const router = express.Router();

// GET /api/ai/status - Get AI provider status
router.get('/status', (req, res) => {
  try {
    const status = getAIStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ai/providers - List available AI capabilities
router.get('/providers', (req, res) => {
  try {
    const status = getAIStatus();
    res.json({
      text_generation: {
        available: status.configured,
        provider: status.provider,
        model: status.model,
      },
      tts: {
        available: !!process.env.ELEVENLABS_API_KEY && 
                   !process.env.ELEVENLABS_API_KEY.startsWith('your-'),
        provider: 'elevenlabs',
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/outline/generate - Generate presentation outline from topic
router.post('/outline/generate', async (req, res) => {
  try {
    const { topic, num_slides = 5 } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const outline = await generateOutline(topic, num_slides);
    res.json({ outline });
  } catch (error) {
    console.error('Outline generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/slides/generate - Generate slides from outline or prompt
router.post('/slides/generate', async (req, res) => {
  try {
    const { deck_id, topic, outline, num_slides = 5 } = req.body;
    
    if (!deck_id) {
      return res.status(400).json({ error: 'deck_id is required' });
    }

    // Verify deck exists
    const deck = get('SELECT * FROM decks WHERE id = ?', [deck_id]);
    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    // Generate outline if not provided
    let slideOutline = outline;
    if (!slideOutline && topic) {
      slideOutline = await generateOutline(topic, num_slides);
    }
    
    if (!slideOutline || !Array.isArray(slideOutline)) {
      return res.status(400).json({ error: 'Either topic or outline is required' });
    }

    // Generate slide content from outline
    const slidesData = await generateSlidesFromOutline(slideOutline, topic || '');

    // Get current max position
    const maxPosResult = get('SELECT MAX(position) as maxPos FROM slides WHERE deck_id = ?', [deck_id]);
    let position = (maxPosResult?.maxPos ?? -1) + 1;

    // Insert slides into database
    const createdSlides = [];
    for (const slide of slidesData) {
      const slideId = insert(
        `INSERT INTO slides (deck_id, position, title, body, speaker_notes, duration_ms, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [deck_id, position, slide.title, JSON.stringify(slide.body), slide.speaker_notes || '', 5000]
      );
      
      createdSlides.push({
        id: slideId,
        deck_id,
        position: position,
        title: slide.title,
        body: slide.body,
        speaker_notes: slide.speaker_notes || '',
        duration_ms: 5000,
      });
      position++;
    }

    res.json({ 
      slides: createdSlides,
      count: createdSlides.length 
    });
  } catch (error) {
    console.error('Slide generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/slides/import-notes - Import slides from notes with dynamic slide count
router.post('/slides/import-notes', async (req, res) => {
  try {
    const { deck_id, notes, target_slides } = req.body;
    
    if (!deck_id) {
      return res.status(400).json({ error: 'deck_id is required' });
    }
    
    if (!notes || notes.trim().length === 0) {
      return res.status(400).json({ error: 'notes content is required' });
    }

    // Verify deck exists
    const deck = get('SELECT * FROM decks WHERE id = ?', [deck_id]);
    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    // Generate slides from notes content
    // If target_slides is null/undefined, AI will infer optimal count using Gemini
    const numSlides = target_slides ? parseInt(target_slides) : null;
    const result = await generateSlidesFromNotionContent(notes, numSlides, {
      contentType: 'notes',
    });
    
    const slidesData = result.slides;

    // Get current max position
    const maxPosResult = get('SELECT MAX(position) as maxPos FROM slides WHERE deck_id = ?', [deck_id]);
    let position = (maxPosResult?.maxPos ?? -1) + 1;

    // Insert slides into database
    const createdSlides = [];
    for (const slide of slidesData) {
      const slideId = insert(
        `INSERT INTO slides (deck_id, position, title, body, speaker_notes, duration_ms, background_color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [deck_id, position, slide.title, JSON.stringify(slide.body), slide.speaker_notes || '', 5000, slide.background_color || '#ffffff']
      );
      
      createdSlides.push({
        id: slideId,
        deck_id,
        position: position,
        title: slide.title,
        body: slide.body,
        speaker_notes: slide.speaker_notes || '',
        duration_ms: 5000,
        background_color: slide.background_color || '#ffffff',
      });
      position++;
    }

    res.json({ 
      slides: createdSlides,
      count: createdSlides.length,
      // Include inference info if slide count was auto-determined
      ...(result.inferredCount && {
        inference: {
          slideCount: result.inferredCount.slideCount,
          reasoning: result.inferredCount.reasoning,
        },
      }),
    });
  } catch (error) {
    console.error('Notes import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/infer-slide-count - Infer optimal slide count for content
router.post('/infer-slide-count', async (req, res) => {
  try {
    const { content, content_type = 'notes', min_slides = 3, max_slides = 20 } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'content is required' });
    }

    const result = await inferOptimalSlideCount(content, {
      minSlides: min_slides,
      maxSlides: max_slides,
      contentType: content_type,
    });

    res.json(result);
  } catch (error) {
    console.error('Slide count inference error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/scripts/generate - Generate script for a single slide
router.post('/scripts/generate', async (req, res) => {
  try {
    const { slide_id, target_duration = 30, tone = 'professional' } = req.body;
    
    if (!slide_id) {
      return res.status(400).json({ error: 'slide_id is required' });
    }

    // Get slide
    const slide = get('SELECT * FROM slides WHERE id = ?', [slide_id]);
    if (!slide) {
      return res.status(404).json({ error: 'Slide not found' });
    }

    // Parse body if needed
    const body = typeof slide.body === 'string' ? JSON.parse(slide.body) : slide.body;
    const slideObj = { ...slide, body };

    // Generate script
    const script = await generateScript(slideObj, target_duration, tone);

    // Update slide with new script
    run('UPDATE slides SET speaker_notes = ?, updated_at = datetime("now") WHERE id = ?', [script, slide_id]);

    res.json({ 
      slide_id,
      speaker_notes: script,
      target_duration,
    });
  } catch (error) {
    console.error('Script generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/scripts/generate-enhanced - Generate enhanced speaker notes with markdown
router.post('/scripts/generate-enhanced', async (req, res) => {
  try {
    const {
      slide_id,
      target_duration = 30,
      tone = 'professional',
      context = '',
      slide_index,
      total_slides
    } = req.body;

    if (!slide_id) {
      return res.status(400).json({ error: 'slide_id is required' });
    }

    // Get slide
    const slide = get('SELECT * FROM slides WHERE id = ?', [slide_id]);
    if (!slide) {
      return res.status(404).json({ error: 'Slide not found' });
    }

    // Get slide position if not provided
    let slideIndex = slide_index;
    let totalSlides = total_slides;

    if (slideIndex === undefined) {
      const deck = get('SELECT * FROM decks WHERE id = ?', [slide.deck_id]);
      if (deck) {
        const allSlides = all('SELECT id, position FROM slides WHERE deck_id = ? ORDER BY position', [slide.deck_id]);
        totalSlides = allSlides.length;
        slideIndex = allSlides.findIndex(s => s.id === slide.id);
      }
    }

    // Parse body if needed
    const body = typeof slide.body === 'string' ? JSON.parse(slide.body) : slide.body;
    const slideObj = { ...slide, body };

    // Generate enhanced speaker notes
    const notes = await generateEnhancedSpeakerNotes(slideObj, {
      targetDurationSec: target_duration,
      tone,
      context,
      slideIndex: slideIndex || 0,
      totalSlides: totalSlides || 1,
    });

    // Update slide with new notes
    run('UPDATE slides SET speaker_notes = ?, updated_at = datetime("now") WHERE id = ?', [notes, slide_id]);

    res.json({
      slide_id,
      speaker_notes: notes,
      target_duration,
      markdown: true,
    });
  } catch (error) {
    console.error('Enhanced script generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/scripts/generate-batch - Generate scripts for multiple slides
router.post('/scripts/generate-batch', async (req, res) => {
  try {
    const { slide_ids, target_duration = 30, tone = 'professional' } = req.body;
    
    if (!slide_ids || !Array.isArray(slide_ids) || slide_ids.length === 0) {
      return res.status(400).json({ error: 'slide_ids array is required' });
    }

    const results = [];
    const errors = [];

    for (const slideId of slide_ids) {
      try {
        const slide = get('SELECT * FROM slides WHERE id = ?', [slideId]);
        if (!slide) {
          errors.push({ slide_id: slideId, error: 'Slide not found' });
          continue;
        }

        const body = typeof slide.body === 'string' ? JSON.parse(slide.body) : slide.body;
        const slideObj = { ...slide, body };

        const script = await generateScript(slideObj, target_duration, tone);

        run('UPDATE slides SET speaker_notes = ?, updated_at = datetime("now") WHERE id = ?', [script, slideId]);

        results.push({ 
          slide_id: slideId, 
          speaker_notes: script 
        });
      } catch (err) {
        errors.push({ slide_id: slideId, error: err.message });
      }
    }

    res.json({ 
      results,
      errors,
      generated_count: results.length,
      error_count: errors.length,
    });
  } catch (error) {
    console.error('Batch script generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/slide/regenerate - Regenerate content for a single slide
router.post('/slide/regenerate', async (req, res) => {
  try {
    const { slide_id, layout } = req.body;
    
    if (!slide_id) {
      return res.status(400).json({ error: 'slide_id is required' });
    }

    const slide = get('SELECT * FROM slides WHERE id = ?', [slide_id]);
    if (!slide) {
      return res.status(404).json({ error: 'Slide not found' });
    }

    const currentBody = typeof slide.body === 'string' ? JSON.parse(slide.body) : slide.body;
    const targetLayout = layout || currentBody?.layout || 'title-bullets';

    // Regenerate content based on title and existing key points
    const keyPoints = currentBody?.bullets || [];
    const newContent = await generateSlideContent(
      slide.title, 
      keyPoints, 
      '', 
      targetLayout
    );

    // Update slide
    run('UPDATE slides SET title = ?, body = ?, updated_at = datetime("now") WHERE id = ?', 
      [newContent.title, JSON.stringify(newContent.body), slide_id]);

    res.json({
      id: slide_id,
      title: newContent.title,
      body: newContent.body,
    });
  } catch (error) {
    console.error('Slide regeneration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TTS / Voice Routes
// ============================================

// GET /api/ai/voices - List available voices
router.get('/voices', async (req, res) => {
  // Always include Zidar voice at the top
  const zidarVoice = { 
    voice_id: '56bVxM2zo2S7h5paHHBt', 
    name: 'Zidar', 
    category: 'cloned', 
    labels: { accent: 'American', gender: 'male', description: 'custom voice' } 
  };
  
  try {
    if (isElevenLabsConfigured()) {
      const apiVoices = await getVoices();
      // Filter out Zidar if already in API results to avoid duplicates
      const filteredVoices = apiVoices.filter(v => v.voice_id !== '56bVxM2zo2S7h5paHHBt');
      res.json({ voices: [zidarVoice, ...filteredVoices], source: 'elevenlabs' });
    } else {
      // Return preset voices when not configured
      res.json({ voices: getPresetVoices(), source: 'preset' });
    }
  } catch (error) {
    console.error('Voices fetch error:', error);
    // Fall back to preset voices on error
    res.json({ voices: getPresetVoices(), source: 'preset' });
  }
});

// GET /api/ai/tts/status - Get TTS configuration status
router.get('/tts/status', (req, res) => {
  res.json(getTTSStatus());
});

// POST /api/ai/voiceover/generate - Generate voiceover for a slide
router.post('/voiceover/generate', async (req, res) => {
  try {
    const { slide_id, voice_id: requestedVoiceId, settings = {} } = req.body;
    
    if (!slide_id) {
      return res.status(400).json({ error: 'slide_id is required' });
    }

    // Get slide
    const slide = get('SELECT * FROM slides WHERE id = ?', [slide_id]);
    if (!slide) {
      return res.status(404).json({ error: 'Slide not found' });
    }

    // Check for speaker notes
    if (!slide.speaker_notes || slide.speaker_notes.trim().length === 0) {
      return res.status(400).json({ error: 'Slide has no speaker notes. Generate a script first.' });
    }

    // Use default voice if none provided
    const voice_id = requestedVoiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';

    // Generate audio
    const result = await generateAudio(slide.speaker_notes, voice_id, settings);

    // Create or update voiceover record
    const existingVoiceover = get('SELECT * FROM voiceovers WHERE slide_id = ?', [slide_id]);
    
    if (existingVoiceover) {
      run(`UPDATE voiceovers 
           SET provider = ?, voice_profile_id = ?, script_text = ?, 
               audio_asset_id = ?, duration_ms = ?, status = ?, updated_at = datetime('now')
           WHERE slide_id = ?`,
        ['elevenlabs', voice_id, slide.speaker_notes, result.relativePath, result.duration_ms, 'succeeded', slide_id]);
    } else {
      insert(`INSERT INTO voiceovers (slide_id, provider, voice_profile_id, script_text, audio_asset_id, duration_ms, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [slide_id, 'elevenlabs', voice_id, slide.speaker_notes, result.relativePath, result.duration_ms, 'succeeded']);
    }

    // Update slide duration
    run('UPDATE slides SET duration_ms = ?, updated_at = datetime("now") WHERE id = ?', [result.duration_ms, slide_id]);

    res.json({
      slide_id,
      audio_url: result.relativePath,
      duration_ms: result.duration_ms,
      voice_id,
      filename: result.filename,
    });
  } catch (error) {
    console.error('Voiceover generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/voiceover/generate-batch - Generate voiceovers for multiple slides
router.post('/voiceover/generate-batch', async (req, res) => {
  try {
    const { slide_ids, voice_id, settings = {} } = req.body;
    
    if (!slide_ids || !Array.isArray(slide_ids) || slide_ids.length === 0) {
      return res.status(400).json({ error: 'slide_ids array is required' });
    }

    const results = [];
    const errors = [];

    for (const slideId of slide_ids) {
      try {
        const slide = get('SELECT * FROM slides WHERE id = ?', [slideId]);
        if (!slide) {
          errors.push({ slide_id: slideId, error: 'Slide not found' });
          continue;
        }

        if (!slide.speaker_notes || slide.speaker_notes.trim().length === 0) {
          errors.push({ slide_id: slideId, error: 'No speaker notes' });
          continue;
        }

        const result = await generateAudio(slide.speaker_notes, voice_id, settings);

        // Update voiceover record
        const existingVoiceover = get('SELECT * FROM voiceovers WHERE slide_id = ?', [slideId]);
        
        if (existingVoiceover) {
          run(`UPDATE voiceovers 
               SET provider = ?, voice_profile_id = ?, script_text = ?, 
                   audio_asset_id = ?, duration_ms = ?, status = ?, updated_at = datetime('now')
               WHERE slide_id = ?`,
            ['elevenlabs', voice_id, slide.speaker_notes, result.relativePath, result.duration_ms, 'succeeded', slideId]);
        } else {
          insert(`INSERT INTO voiceovers (slide_id, provider, voice_profile_id, script_text, audio_asset_id, duration_ms, status, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [slideId, 'elevenlabs', voice_id, slide.speaker_notes, result.relativePath, result.duration_ms, 'succeeded']);
        }

        // Update slide duration
        run('UPDATE slides SET duration_ms = ?, updated_at = datetime("now") WHERE id = ?', [result.duration_ms, slideId]);

        results.push({
          slide_id: slideId,
          audio_url: result.relativePath,
          duration_ms: result.duration_ms,
        });
      } catch (err) {
        errors.push({ slide_id: slideId, error: err.message });
      }
    }

    res.json({
      results,
      errors,
      generated_count: results.length,
      error_count: errors.length,
    });
  } catch (error) {
    console.error('Batch voiceover generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ai/voiceover/:slideId - Get voiceover for a slide (enhanced for recordings)
router.get('/voiceover/:slideId', async (req, res) => {
  try {
    const slideId = req.params.slideId;

    // Get generated voiceover
    const generated = get('SELECT * FROM voiceovers WHERE slide_id = ?', [slideId]);

    // Get active recording
    const activeRecording = get(
      'SELECT * FROM recorded_voiceovers WHERE slide_id = ? AND is_active = 1',
      [slideId]
    );

    // Get all recordings for version history
    const allRecordings = all(
      `SELECT id, version_number, audio_asset_id as audio_url, duration_ms,
              is_active, transcription, transcription_status, created_at
       FROM recorded_voiceovers
       WHERE slide_id = ?
       ORDER BY version_number DESC`,
      [slideId]
    );

    // Determine active source
    let activeSource = null;
    if (activeRecording) {
      activeSource = 'recorded';
    } else if (generated && generated.is_active) {
      activeSource = 'generated';
    }

    res.json({
      generated: generated ? {
        ...generated,
        audio_url: generated.audio_asset_id,
        type: 'generated',
      } : null,
      active_recording: activeRecording ? {
        ...activeRecording,
        audio_url: activeRecording.audio_asset_id,
        type: 'recorded',
      } : null,
      all_recordings: allRecordings,
      active_source: activeSource,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/voiceover/upload-recording - Upload recorded audio for a slide
router.post('/voiceover/upload-recording', uploadRecording.single('audio'), async (req, res) => {
  try {
    const { slide_id } = req.body;

    if (!slide_id) {
      return res.status(400).json({ error: 'slide_id is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    // Verify slide exists
    const slide = get('SELECT * FROM slides WHERE id = ?', [slide_id]);
    if (!slide) {
      return res.status(404).json({ error: 'Slide not found' });
    }

    // Get audio duration
    const audioPath = req.file.path;
    const duration_ms = await getAudioDuration(audioPath);

    // Get next version number
    const maxVersion = get(
      'SELECT MAX(version_number) as max_ver FROM recorded_voiceovers WHERE slide_id = ?',
      [slide_id]
    );
    const version_number = (maxVersion?.max_ver || 0) + 1;

    // Deactivate previous recordings for this slide
    run('UPDATE recorded_voiceovers SET is_active = 0 WHERE slide_id = ?', [slide_id]);

    // Also deactivate generated voiceover
    run('UPDATE voiceovers SET is_active = 0 WHERE slide_id = ?', [slide_id]);

    // Insert new recording
    const relativePath = `/data/assets/audio/${req.file.filename}`;
    const recordingId = insert(
      `INSERT INTO recorded_voiceovers
       (slide_id, version_number, audio_asset_id, duration_ms, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
      [slide_id, version_number, relativePath, duration_ms]
    );

    // Update slide duration
    run('UPDATE slides SET duration_ms = ?, updated_at = datetime("now") WHERE id = ?',
      [duration_ms, slide_id]);

    // Trigger transcription asynchronously (don't block response)
    transcribeRecording(recordingId, audioPath).catch(err =>
      console.error('Transcription failed:', err)
    );

    res.json({
      id: recordingId,
      slide_id: parseInt(slide_id),
      version_number,
      audio_url: relativePath,
      duration_ms,
      is_active: true,
    });
  } catch (error) {
    console.error('Recording upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ai/voiceover/recordings/:slideId - Get all recordings for a slide
router.get('/voiceover/recordings/:slideId', async (req, res) => {
  try {
    const recordings = all(
      `SELECT id, version_number, audio_asset_id as audio_url, duration_ms,
              is_active, transcription, transcription_status, created_at
       FROM recorded_voiceovers
       WHERE slide_id = ?
       ORDER BY version_number DESC`,
      [req.params.slideId]
    );

    res.json({ recordings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/voiceover/set-active-recording - Switch to specific recording
router.post('/voiceover/set-active-recording', async (req, res) => {
  try {
    const { recording_id } = req.body;

    if (!recording_id) {
      return res.status(400).json({ error: 'recording_id is required' });
    }

    const recording = get('SELECT * FROM recorded_voiceovers WHERE id = ?', [recording_id]);
    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    // Deactivate all recordings for this slide
    run('UPDATE recorded_voiceovers SET is_active = 0 WHERE slide_id = ?', [recording.slide_id]);

    // Deactivate generated voiceover
    run('UPDATE voiceovers SET is_active = 0 WHERE slide_id = ?', [recording.slide_id]);

    // Activate selected recording
    run('UPDATE recorded_voiceovers SET is_active = 1, updated_at = datetime("now") WHERE id = ?',
      [recording_id]);

    // Update slide duration
    run('UPDATE slides SET duration_ms = ?, updated_at = datetime("now") WHERE id = ?',
      [recording.duration_ms, recording.slide_id]);

    res.json({ success: true, recording_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/voiceover/set-active-generated - Switch to generated audio
router.post('/voiceover/set-active-generated', async (req, res) => {
  try {
    const { slide_id } = req.body;

    if (!slide_id) {
      return res.status(400).json({ error: 'slide_id is required' });
    }

    const voiceover = get('SELECT * FROM voiceovers WHERE slide_id = ?', [slide_id]);
    if (!voiceover) {
      return res.status(404).json({ error: 'No generated voiceover found' });
    }

    // Deactivate all recordings
    run('UPDATE recorded_voiceovers SET is_active = 0 WHERE slide_id = ?', [slide_id]);

    // Activate generated voiceover
    run('UPDATE voiceovers SET is_active = 1, updated_at = datetime("now") WHERE slide_id = ?',
      [slide_id]);

    // Update slide duration
    run('UPDATE slides SET duration_ms = ?, updated_at = datetime("now") WHERE id = ?',
      [voiceover.duration_ms, slide_id]);

    res.json({ success: true, slide_id: parseInt(slide_id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/ai/voiceover/recording/:recordingId - Delete a recording version
router.delete('/voiceover/recording/:recordingId', async (req, res) => {
  try {
    const recording = get('SELECT * FROM recorded_voiceovers WHERE id = ?', [req.params.recordingId]);

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    // Delete audio file
    const audioPath = path.join(__dirname, '../../../', recording.audio_asset_id);
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }

    // Delete database record
    run('DELETE FROM recorded_voiceovers WHERE id = ?', [req.params.recordingId]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Image Generation Routes (Gemini Nano Banana)
// ============================================

// GET /api/ai/image/status - Get image generation status
router.get('/image/status', (req, res) => {
  res.json(getImageGenerationStatus());
});

// POST /api/ai/image/generate - Generate image for a slide with custom prompt
router.post('/image/generate', async (req, res) => {
  try {
    const { slide_id, prompt, aspect_ratio = '16:9' } = req.body;
    
    if (!slide_id) {
      return res.status(400).json({ error: 'slide_id is required' });
    }
    
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    if (!isImageGenerationConfigured()) {
      return res.status(503).json({ error: 'Image generation not configured. Set GOOGLE_API_KEY in .env' });
    }

    // Verify slide exists
    const slide = get('SELECT * FROM slides WHERE id = ?', [slide_id]);
    if (!slide) {
      return res.status(404).json({ error: 'Slide not found' });
    }

    // Generate image
    const result = await generateSlideImage(prompt, aspect_ratio);

    // Update slide with image URL
    run('UPDATE slides SET image_url = ?, image_prompt = ?, updated_at = datetime("now") WHERE id = ?',
      [result.url, prompt, slide_id]);

    res.json({
      slide_id,
      image_url: result.url,
      filename: result.filename,
      width: result.width,
      height: result.height,
      prompt: result.prompt,
    });
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/image/generate-from-content - Auto-generate image from slide content
router.post('/image/generate-from-content', async (req, res) => {
  try {
    const { slide_id, aspect_ratio = '16:9' } = req.body;
    
    if (!slide_id) {
      return res.status(400).json({ error: 'slide_id is required' });
    }

    if (!isImageGenerationConfigured()) {
      return res.status(503).json({ error: 'Image generation not configured. Set GOOGLE_API_KEY in .env' });
    }

    // Get slide
    const slide = get('SELECT * FROM slides WHERE id = ?', [slide_id]);
    if (!slide) {
      return res.status(404).json({ error: 'Slide not found' });
    }

    // Parse body if needed
    const body = typeof slide.body === 'string' ? JSON.parse(slide.body) : slide.body;
    const slideObj = { ...slide, body };

    // Generate prompt from slide content
    const prompt = generateImagePromptFromSlide(slideObj);

    // Generate image
    const result = await generateSlideImage(prompt, aspect_ratio);

    // Update slide with image URL
    run('UPDATE slides SET image_url = ?, image_prompt = ?, updated_at = datetime("now") WHERE id = ?',
      [result.url, prompt, slide_id]);

    res.json({
      slide_id,
      image_url: result.url,
      filename: result.filename,
      width: result.width,
      height: result.height,
      prompt: result.prompt,
      auto_generated: true,
    });
  } catch (error) {
    console.error('Auto image generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/ai/image/:slideId - Remove image from slide
router.delete('/image/:slideId', async (req, res) => {
  try {
    const slideId = req.params.slideId;
    
    // Verify slide exists
    const slide = get('SELECT * FROM slides WHERE id = ?', [slideId]);
    if (!slide) {
      return res.status(404).json({ error: 'Slide not found' });
    }

    // Clear image fields
    run('UPDATE slides SET image_url = NULL, image_prompt = NULL, image_position = "none", updated_at = datetime("now") WHERE id = ?',
      [slideId]);

    res.json({ success: true, slide_id: slideId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/ai/image/:slideId/position - Update image position
router.put('/image/:slideId/position', async (req, res) => {
  try {
    const slideId = req.params.slideId;
    const { position } = req.body;
    
    const validPositions = ['none', 'background', 'left', 'right', 'top', 'bottom'];
    if (!validPositions.includes(position)) {
      return res.status(400).json({ error: `Invalid position. Must be one of: ${validPositions.join(', ')}` });
    }

    // Verify slide exists
    const slide = get('SELECT * FROM slides WHERE id = ?', [slideId]);
    if (!slide) {
      return res.status(404).json({ error: 'Slide not found' });
    }

    // Update position
    run('UPDATE slides SET image_position = ?, updated_at = datetime("now") WHERE id = ?',
      [position, slideId]);

    res.json({ success: true, slide_id: slideId, image_position: position });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
