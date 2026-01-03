import express from 'express';
import { get, all } from '../db.js';

const router = express.Router();

// Helper to get text color based on background
const getTextColor = (bgColor) => {
  if (!bgColor) return '#1f2937';
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#1f2937' : '#f9fafb';
};

// Map transitions
const getTransition = (type) => {
  switch (type) {
    case 'fade': return 'fade';
    case 'push': return 'slide';
    case 'dissolve': return 'fade';
    case 'wipe': return 'slide';
    case 'none': return 'none';
    default: return 'slide';
  }
};

// Render slide HTML
const renderSlideHTML = (slide) => {
  const body = typeof slide.body === 'string' ? JSON.parse(slide.body) : slide.body || {};
  const layout = body.layout || 'title-body';
  const textColor = getTextColor(slide.background_color || '#ffffff');
  const subtitleColor = textColor === '#1f2937' ? '#6b7280' : '#d1d5db';

  let content = '';
  
  switch (layout) {
    case 'title-only':
      content = `<h2 style="color: ${textColor}; font-size: 3rem; font-weight: bold;">${slide.title || 'Untitled Slide'}</h2>`;
      break;

    case 'title-bullets':
      content = `<h2 style="color: ${textColor}; font-size: 2.5rem; font-weight: bold; margin-bottom: 1rem;">${slide.title || 'Untitled Slide'}</h2>`;
      if (body.bullets && body.bullets.length > 0) {
        content += `<ul style="text-align: left; font-size: 1.5rem; color: ${textColor};">`;
        body.bullets.forEach(bullet => {
          content += `<li style="margin-bottom: 0.5rem;">${escapeHtml(bullet)}</li>`;
        });
        content += '</ul>';
      }
      break;

    case 'two-column':
      content = `<h2 style="color: ${textColor}; font-size: 2.5rem; font-weight: bold; margin-bottom: 1rem;">${slide.title || 'Untitled Slide'}</h2>`;
      if (body.bullets && body.bullets.length > 0) {
        const midpoint = Math.ceil(body.bullets.length / 2);
        const left = body.bullets.slice(0, midpoint);
        const right = body.bullets.slice(midpoint);
        content += `<div style="display: flex; gap: 2rem; text-align: left;">`;
        content += `<ul style="flex: 1; font-size: 1.25rem; color: ${textColor};">`;
        left.forEach(b => { content += `<li style="margin-bottom: 0.5rem;">${escapeHtml(b)}</li>`; });
        content += '</ul>';
        content += `<ul style="flex: 1; font-size: 1.25rem; color: ${textColor};">`;
        right.forEach(b => { content += `<li style="margin-bottom: 0.5rem;">${escapeHtml(b)}</li>`; });
        content += '</ul></div>';
      }
      break;

    case 'centered':
      content = `<h2 style="color: ${textColor}; font-size: 3rem; font-weight: bold; margin-bottom: 1rem;">${slide.title || 'Untitled Slide'}</h2>`;
      if (body.text) {
        content += `<p style="color: ${subtitleColor}; font-size: 1.5rem; max-width: 80%; margin: 0 auto;">${escapeHtml(body.text)}</p>`;
      }
      break;

    default:
      content = `<h2 style="color: ${textColor}; font-size: 2.5rem; font-weight: bold; margin-bottom: 1rem;">${slide.title || 'Untitled Slide'}</h2>`;
      if (body.text) {
        content += `<p style="color: ${subtitleColor}; font-size: 1.25rem; text-align: left;">${escapeHtml(body.text)}</p>`;
      }
  }

  return content;
};

// Escape HTML special characters
const escapeHtml = (text) => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// GET /api/export/deck/:id/reveal - Export deck as RevealJS HTML
router.get('/deck/:id/reveal', async (req, res) => {
  try {
    const deckId = req.params.id;
    
    // Get deck
    const deck = get('SELECT * FROM decks WHERE id = ?', [deckId]);
    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    // Get lesson for title
    const lesson = get('SELECT * FROM lessons WHERE id = ?', [deck.lesson_id]);
    const title = lesson?.title || deck.title || 'Presentation';

    // Get slides ordered by position
    const slides = all('SELECT * FROM slides WHERE deck_id = ? ORDER BY position ASC', [deckId]);

    // Generate slides HTML
    const slidesHTML = slides.map(slide => {
      const transition = typeof slide.transition === 'string' 
        ? JSON.parse(slide.transition)?.type 
        : slide.transition?.type;
      const bgColor = slide.background_color || '#ffffff';
      const notes = slide.speaker_notes ? `<aside class="notes">${escapeHtml(slide.speaker_notes)}</aside>` : '';
      
      return `
        <section data-transition="${getTransition(transition)}" data-background-color="${bgColor}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 2rem;">
          ${renderSlideHTML(slide)}
          ${notes}
        </section>`;
    }).join('\n');

    // Calculate dimensions based on aspect ratio
    const aspectRatio = deck.aspect_ratio || '16:9';
    const width = aspectRatio === '9:16' ? 1080 : 1920;
    const height = aspectRatio === '9:16' ? 1920 : 
                   aspectRatio === '1:1' ? 1920 : 
                   aspectRatio === '4:3' ? 1440 : 1080;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/white.min.css">
  <style>
    body { margin: 0; padding: 0; }
    .reveal { font-family: system-ui, -apple-system, sans-serif; }
    .reveal h2 { text-transform: none; }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
${slidesHTML}
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.min.js"></script>
  <script>
    Reveal.initialize({
      hash: true,
      history: true,
      controls: true,
      progress: true,
      center: true,
      transition: 'slide',
      width: ${width},
      height: ${height},
    });
  </script>
</body>
</html>`;

    // Set headers for file download
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-zA-Z0-9]/g, '_')}.html"`);
    res.send(html);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export presentation' });
  }
});

export default router;

