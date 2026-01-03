import express from 'express';
import { get, all, run, insert, saveDatabase } from '../db.js';
import {
  generateOutline,
  generateSlideContent,
  generateScript,
  generateEnhancedSpeakerNotes,
  generateSlidesFromOutline,
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

// GET /api/ai/voiceover/:slideId - Get voiceover for a slide
router.get('/voiceover/:slideId', async (req, res) => {
  try {
    const voiceover = get('SELECT * FROM voiceovers WHERE slide_id = ?', [req.params.slideId]);
    
    if (!voiceover) {
      return res.status(404).json({ error: 'Voiceover not found' });
    }

    // Return with audio_url from stored audio_asset_id path
    res.json({
      ...voiceover,
      audio_url: voiceover.audio_asset_id, // audio_asset_id stores the relative path like /data/assets/audio/...
    });
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
