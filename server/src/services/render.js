import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import puppeteer from 'puppeteer';
import { get, all, run, insert } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../../data');
const RENDERS_DIR = path.join(DATA_DIR, 'renders');
const CACHE_DIR = path.join(DATA_DIR, 'cache');

// Ensure directories exist
[RENDERS_DIR, CACHE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Global event emitter for render progress
export const renderEvents = new EventEmitter();

// Quality presets
const QUALITY_PRESETS = {
  preview: {
    width: 1280,
    height: 720,
    videoBitrate: '2M',
    audioBitrate: '128k',
    fps: 30,
    preset: 'fast',
  },
  final: {
    width: 1920,
    height: 1080,
    videoBitrate: '5M',
    audioBitrate: '192k',
    fps: 30,
    preset: 'medium',
  },
};

// Active render jobs for cancellation
const activeRenders = new Map();

/**
 * Get text color based on background brightness
 */
function getTextColor(bgColor) {
  if (!bgColor) return '#1f2937';
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#1f2937' : '#f9fafb';
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Render slide content HTML based on layout
 */
function renderSlideContent(slide) {
  const body = typeof slide.body === 'string' ? JSON.parse(slide.body) : slide.body || {};
  const layout = body.layout || 'title-body';
  const textColor = getTextColor(slide.background_color || '#ffffff');
  const subtitleColor = textColor === '#1f2937' ? '#6b7280' : '#d1d5db';

  let content = '';
  
  switch (layout) {
    case 'title-only':
      content = `<h2 style="color: ${textColor}; font-size: 4rem; font-weight: bold;">${escapeHtml(slide.title) || 'Untitled Slide'}</h2>`;
      break;

    case 'title-bullets':
      content = `<h2 style="color: ${textColor}; font-size: 3.5rem; font-weight: bold; margin-bottom: 2rem;">${escapeHtml(slide.title) || 'Untitled Slide'}</h2>`;
      if (body.bullets && body.bullets.length > 0) {
        content += `<ul style="text-align: left; font-size: 2rem; color: ${textColor}; list-style-type: disc; padding-left: 2rem;">`;
        body.bullets.forEach(bullet => {
          content += `<li style="margin-bottom: 1rem;">${escapeHtml(bullet)}</li>`;
        });
        content += '</ul>';
      }
      break;

    case 'two-column':
      content = `<h2 style="color: ${textColor}; font-size: 3.5rem; font-weight: bold; margin-bottom: 2rem;">${escapeHtml(slide.title) || 'Untitled Slide'}</h2>`;
      if (body.bullets && body.bullets.length > 0) {
        const midpoint = Math.ceil(body.bullets.length / 2);
        const left = body.bullets.slice(0, midpoint);
        const right = body.bullets.slice(midpoint);
        content += `<div style="display: flex; gap: 4rem; text-align: left; width: 100%;">`;
        content += `<ul style="flex: 1; font-size: 1.75rem; color: ${textColor}; list-style-type: disc; padding-left: 2rem;">`;
        left.forEach(b => { content += `<li style="margin-bottom: 1rem;">${escapeHtml(b)}</li>`; });
        content += '</ul>';
        content += `<ul style="flex: 1; font-size: 1.75rem; color: ${textColor}; list-style-type: disc; padding-left: 2rem;">`;
        right.forEach(b => { content += `<li style="margin-bottom: 1rem;">${escapeHtml(b)}</li>`; });
        content += '</ul></div>';
      }
      break;

    case 'centered':
      content = `<h2 style="color: ${textColor}; font-size: 4rem; font-weight: bold; margin-bottom: 2rem;">${escapeHtml(slide.title) || 'Untitled Slide'}</h2>`;
      if (body.text) {
        content += `<p style="color: ${subtitleColor}; font-size: 2rem; max-width: 80%; margin: 0 auto; line-height: 1.6;">${escapeHtml(body.text)}</p>`;
      }
      break;

    case 'quote':
      if (body.quote_text) {
        content = `<blockquote style="color: ${textColor}; font-size: 2.5rem; font-style: italic; max-width: 80%; margin: 0 auto; line-height: 1.6;">"${escapeHtml(body.quote_text)}"</blockquote>`;
        if (body.quote_author) {
          content += `<p style="color: ${subtitleColor}; font-size: 1.5rem; margin-top: 2rem;">— ${escapeHtml(body.quote_author)}</p>`;
        }
      }
      break;

    case 'image-left':
    case 'image-right':
      const imageFirst = layout === 'image-left';
      content = `<div style="display: flex; gap: 4rem; width: 100%; align-items: center;">`;
      if (imageFirst && slide.image_url) {
        content += `<div style="flex: 1;"><img src="${slide.image_url}" style="max-width: 100%; max-height: 600px; object-fit: contain;" /></div>`;
      }
      content += `<div style="flex: 1; text-align: left;">`;
      content += `<h2 style="color: ${textColor}; font-size: 3rem; font-weight: bold; margin-bottom: 1.5rem;">${escapeHtml(slide.title) || 'Untitled Slide'}</h2>`;
      if (body.text) {
        content += `<p style="color: ${subtitleColor}; font-size: 1.5rem; line-height: 1.6;">${escapeHtml(body.text)}</p>`;
      }
      content += '</div>';
      if (!imageFirst && slide.image_url) {
        content += `<div style="flex: 1;"><img src="${slide.image_url}" style="max-width: 100%; max-height: 600px; object-fit: contain;" /></div>`;
      }
      content += '</div>';
      break;

    default:
      content = `<h2 style="color: ${textColor}; font-size: 3.5rem; font-weight: bold; margin-bottom: 2rem;">${escapeHtml(slide.title) || 'Untitled Slide'}</h2>`;
      if (body.text) {
        content += `<p style="color: ${subtitleColor}; font-size: 1.75rem; text-align: left; line-height: 1.6;">${escapeHtml(body.text)}</p>`;
      }
  }

  return content;
}

/**
 * Generate HTML for a single slide
 */
function generateSlideHTML(slide, width, height) {
  const bgColor = slide.background_color || '#ffffff';
  const content = renderSlideContent(slide);
  
  // Check if there's a background image
  let backgroundStyle = `background-color: ${bgColor};`;
  if (slide.image_url && slide.image_position === 'background') {
    backgroundStyle = `
      background-image: url('${slide.image_url}');
      background-size: cover;
      background-position: center;
      background-color: ${bgColor};
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${width}px;
      height: ${height}px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      ${backgroundStyle}
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      overflow: hidden;
    }
    h2 { text-align: center; }
    img { border-radius: 8px; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
}

/**
 * Render a single slide to an image using Puppeteer
 */
async function renderSlideToImage(browser, slide, width, height, outputPath) {
  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width, height });
    
    const html = generateSlideHTML(slide, width, height);
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Small delay to ensure fonts are loaded
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await page.screenshot({
      path: outputPath,
      type: 'png',
      fullPage: false,
    });
  } finally {
    await page.close();
  }
}

/**
 * Get voiceover audio path for a slide
 */
function getVoiceoverPath(slideId) {
  const voiceover = get('SELECT * FROM voiceovers WHERE slide_id = ? AND status = ?', [slideId, 'succeeded']);
  if (!voiceover || !voiceover.audio_asset_id) return null;
  
  // audio_asset_id contains relative path like /data/assets/audio/filename.mp3
  const relativePath = voiceover.audio_asset_id;
  if (relativePath.startsWith('/data/')) {
    return path.join(DATA_DIR, '..', relativePath);
  }
  return path.join(DATA_DIR, 'assets/audio', relativePath);
}

/**
 * Create a silent audio file of specified duration
 */
async function createSilentAudio(durationMs, outputPath) {
  return new Promise((resolve, reject) => {
    const durationSec = durationMs / 1000;
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', `anullsrc=r=44100:cl=stereo`,
      '-t', durationSec.toString(),
      '-acodec', 'aac',
      '-b:a', '128k',
      outputPath
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Failed to create silent audio, exit code: ${code}`));
    });

    ffmpeg.on('error', reject);
  });
}

/**
 * Compose final video from slide images and audio
 */
async function composeVideo(slides, slideImages, audioFiles, settings, outputPath, renderId) {
  return new Promise((resolve, reject) => {
    const { width, height, videoBitrate, audioBitrate, fps, preset } = settings;
    
    // Build FFmpeg filter complex for slides
    // Each slide shows for its duration_ms
    let filterInputs = '';
    let filterComplex = '';
    let audioFilterComplex = '';
    
    const inputArgs = [];
    let inputIndex = 0;
    
    // Add slide images as inputs with duration
    slides.forEach((slide, i) => {
      const durationSec = (slide.duration_ms || 5000) / 1000;
      inputArgs.push('-loop', '1', '-t', durationSec.toString(), '-i', slideImages[i]);
      inputIndex++;
    });
    
    // Add audio files as inputs
    const audioInputStart = inputIndex;
    audioFiles.forEach((audioPath, i) => {
      if (audioPath) {
        inputArgs.push('-i', audioPath);
        inputIndex++;
      }
    });
    
    // Build video filter: concatenate all slides
    const videoFilters = [];
    slides.forEach((slide, i) => {
      videoFilters.push(`[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`);
    });
    
    const concatInputs = slides.map((_, i) => `[v${i}]`).join('');
    videoFilters.push(`${concatInputs}concat=n=${slides.length}:v=1:a=0[vout]`);
    
    // Build audio filter: concatenate all audio (or silent tracks)
    // We need to handle slides without audio by inserting silence
    const audioFilterParts = [];
    let audioIdx = audioInputStart;
    slides.forEach((slide, i) => {
      if (audioFiles[i]) {
        audioFilterParts.push(`[${audioIdx}:a]aresample=44100[a${i}]`);
        audioIdx++;
      } else {
        // Generate silence for this slide
        const durationSec = (slide.duration_ms || 5000) / 1000;
        audioFilterParts.push(`anullsrc=r=44100:cl=stereo,atrim=0:${durationSec}[a${i}]`);
      }
    });
    
    const audioConcat = slides.map((_, i) => `[a${i}]`).join('');
    audioFilterParts.push(`${audioConcat}concat=n=${slides.length}:v=0:a=1[aout]`);
    
    filterComplex = [...videoFilters, ...audioFilterParts].join(';');
    
    const ffmpegArgs = [
      '-y',
      ...inputArgs,
      '-filter_complex', filterComplex,
      '-map', '[vout]',
      '-map', '[aout]',
      '-c:v', 'libx264',
      '-preset', preset,
      '-b:v', videoBitrate,
      '-c:a', 'aac',
      '-b:a', audioBitrate,
      '-movflags', '+faststart',
      '-pix_fmt', 'yuv420p',
      '-r', fps.toString(),
      outputPath
    ];
    
    console.log('FFmpeg command:', 'ffmpeg', ffmpegArgs.join(' '));
    
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    
    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
      // Parse progress from FFmpeg output
      const timeMatch = data.toString().match(/time=(\d+):(\d+):(\d+)/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseInt(timeMatch[3]);
        const currentMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
        
        // Calculate total duration
        const totalMs = slides.reduce((sum, s) => sum + (s.duration_ms || 5000), 0);
        const percent = Math.min(100, Math.round((currentMs / totalMs) * 100));
        
        renderEvents.emit('progress', {
          renderId,
          step: 'composing',
          message: `Composing video: ${percent}%`,
          percent: 70 + Math.round(percent * 0.25), // 70-95% of total progress
        });
      }
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.error('FFmpeg stderr:', stderr);
        reject(new Error(`FFmpeg failed with code ${code}`));
      }
    });
    
    ffmpeg.on('error', (err) => {
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
    
    // Store for cancellation
    activeRenders.set(renderId, { ffmpeg, type: 'compose' });
  });
}

/**
 * Start a render job
 */
export async function startRender(deckId, kind = 'preview') {
  const settings = QUALITY_PRESETS[kind] || QUALITY_PRESETS.preview;
  
  // Get deck
  const deck = get('SELECT * FROM decks WHERE id = ?', [deckId]);
  if (!deck) {
    throw new Error('Deck not found');
  }
  
  // Get slides
  const slides = all('SELECT * FROM slides WHERE deck_id = ? ORDER BY position ASC', [deckId]);
  if (slides.length === 0) {
    throw new Error('No slides in deck');
  }
  
  // Adjust dimensions based on aspect ratio
  const aspectRatio = deck.aspect_ratio || '16:9';
  let { width, height } = settings;
  
  if (aspectRatio === '9:16') {
    [width, height] = [height, width]; // Swap for vertical
  } else if (aspectRatio === '1:1') {
    height = width; // Square
  } else if (aspectRatio === '4:3') {
    height = Math.round(width * 3 / 4);
  }
  
  // Create render record
  const renderId = insert(
    `INSERT INTO renders (deck_id, kind, settings, status, progress, created_at, updated_at)
     VALUES (?, ?, ?, 'queued', '{}', datetime('now'), datetime('now'))`,
    [deckId, kind, JSON.stringify({ ...settings, width, height })]
  );
  
  // Start async rendering
  renderAsync(renderId, deck, slides, { ...settings, width, height });
  
  return { id: renderId, status: 'queued' };
}

/**
 * Async render process
 */
async function renderAsync(renderId, deck, slides, settings) {
  const { width, height } = settings;
  const renderDir = path.join(CACHE_DIR, `render_${renderId}`);
  
  // Create render directory
  if (!fs.existsSync(renderDir)) {
    fs.mkdirSync(renderDir, { recursive: true });
  }
  
  let browser = null;
  
  try {
    // Update status to running
    run(
      `UPDATE renders SET status = 'running', progress = ?, updated_at = datetime('now') WHERE id = ?`,
      [JSON.stringify({ percent: 0, current_step: 'Starting render...' }), renderId]
    );
    
    renderEvents.emit('progress', {
      renderId,
      step: 'starting',
      message: 'Starting render...',
      percent: 0,
    });
    
    // Launch Puppeteer
    renderEvents.emit('progress', {
      renderId,
      step: 'browser',
      message: 'Launching browser...',
      percent: 5,
    });
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    activeRenders.set(renderId, { browser, type: 'puppeteer' });
    
    // Render each slide to image
    const slideImages = [];
    const audioFiles = [];
    
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const imagePath = path.join(renderDir, `slide_${i}.png`);
      
      const percent = 10 + Math.round((i / slides.length) * 55); // 10-65% for slides
      renderEvents.emit('progress', {
        renderId,
        step: 'rendering_slides',
        message: `Rendering slide ${i + 1} of ${slides.length}...`,
        percent,
      });
      
      run(
        `UPDATE renders SET progress = ?, updated_at = datetime('now') WHERE id = ?`,
        [JSON.stringify({ percent, current_step: `Rendering slide ${i + 1}/${slides.length}` }), renderId]
      );
      
      await renderSlideToImage(browser, slide, width, height, imagePath);
      slideImages.push(imagePath);
      
      // Get audio for this slide
      const audioPath = getVoiceoverPath(slide.id);
      audioFiles.push(audioPath);
    }
    
    await browser.close();
    browser = null;
    
    // Compose video
    renderEvents.emit('progress', {
      renderId,
      step: 'composing',
      message: 'Composing video...',
      percent: 70,
    });
    
    run(
      `UPDATE renders SET progress = ?, updated_at = datetime('now') WHERE id = ?`,
      [JSON.stringify({ percent: 70, current_step: 'Composing video...' }), renderId]
    );
    
    const outputFilename = `video_${renderId}_${Date.now()}.mp4`;
    const outputPath = path.join(RENDERS_DIR, outputFilename);
    
    await composeVideo(slides, slideImages, audioFiles, settings, outputPath, renderId);
    
    // Finalize
    renderEvents.emit('progress', {
      renderId,
      step: 'finalizing',
      message: 'Finalizing...',
      percent: 98,
    });
    
    // Get file size
    const stats = fs.statSync(outputPath);
    
    // Update render record
    const outputAssetPath = `/data/renders/${outputFilename}`;
    run(
      `UPDATE renders SET status = 'succeeded', output_asset_id = ?, progress = ?, updated_at = datetime('now') WHERE id = ?`,
      [outputAssetPath, JSON.stringify({ percent: 100, current_step: 'Complete' }), renderId]
    );
    
    // Clean up temp files
    try {
      fs.rmSync(renderDir, { recursive: true });
    } catch (e) {
      console.warn('Failed to clean up render directory:', e);
    }
    
    renderEvents.emit('complete', {
      renderId,
      outputPath: outputAssetPath,
      fileSize: stats.size,
      message: 'Render complete!',
    });
    
    activeRenders.delete(renderId);
    
  } catch (error) {
    console.error('Render error:', error);
    
    // Clean up browser if still open
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    
    // Update render status
    run(
      `UPDATE renders SET status = 'failed', progress = ?, updated_at = datetime('now') WHERE id = ?`,
      [JSON.stringify({ error: error.message }), renderId]
    );
    
    renderEvents.emit('error', {
      renderId,
      error: error.message,
    });
    
    activeRenders.delete(renderId);
    
    // Clean up temp files
    try {
      if (fs.existsSync(renderDir)) {
        fs.rmSync(renderDir, { recursive: true });
      }
    } catch (e) {}
  }
}

/**
 * Cancel a render job
 */
export function cancelRender(renderId) {
  const job = activeRenders.get(renderId);
  
  if (!job) {
    return false;
  }
  
  if (job.type === 'puppeteer' && job.browser) {
    job.browser.close().catch(() => {});
  } else if (job.type === 'compose' && job.ffmpeg) {
    job.ffmpeg.kill('SIGKILL');
  }
  
  run(
    `UPDATE renders SET status = 'canceled', updated_at = datetime('now') WHERE id = ?`,
    [renderId]
  );
  
  renderEvents.emit('canceled', { renderId });
  activeRenders.delete(renderId);
  
  return true;
}

/**
 * Get render status
 */
export function getRenderStatus(renderId) {
  const render = get('SELECT * FROM renders WHERE id = ?', [renderId]);
  if (!render) return null;
  
  return {
    id: render.id,
    deck_id: render.deck_id,
    kind: render.kind,
    status: render.status,
    progress: typeof render.progress === 'string' ? JSON.parse(render.progress) : render.progress,
    settings: typeof render.settings === 'string' ? JSON.parse(render.settings) : render.settings,
    output_path: render.output_asset_id,
    created_at: render.created_at,
    updated_at: render.updated_at,
  };
}

/**
 * Get renders for a deck
 */
export function getRendersForDeck(deckId) {
  const renders = all('SELECT * FROM renders WHERE deck_id = ? ORDER BY created_at DESC', [deckId]);
  return renders.map(r => ({
    id: r.id,
    deck_id: r.deck_id,
    kind: r.kind,
    status: r.status,
    progress: typeof r.progress === 'string' ? JSON.parse(r.progress) : r.progress,
    output_path: r.output_asset_id,
    created_at: r.created_at,
  }));
}

