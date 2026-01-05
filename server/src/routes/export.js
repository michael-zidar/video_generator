import express from 'express';
import { get, all } from '../db.js';
import puppeteer from 'puppeteer';
import PptxGenJS from 'pptxgenjs';

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

// GET /api/export/deck/:id/pdf - Export deck as PDF
router.get('/deck/:id/pdf', async (req, res) => {
  let browser;
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

    // Calculate dimensions based on aspect ratio
    const aspectRatio = deck.aspect_ratio || '16:9';
    let width, height;
    switch (aspectRatio) {
      case '9:16':
        width = 1080;
        height = 1920;
        break;
      case '1:1':
        width = 1920;
        height = 1920;
        break;
      case '4:3':
        width = 1440;
        height = 1080;
        break;
      default: // 16:9
        width = 1920;
        height = 1080;
    }

    // Generate PDF pages HTML (one slide per page)
    const pagesHTML = slides.map(slide => {
      const bgColor = slide.background_color || '#ffffff';
      return `
        <div class="pdf-page" style="
          width: ${width}px;
          height: ${height}px;
          background-color: ${bgColor};
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem;
          box-sizing: border-box;
          page-break-after: always;
        ">
          ${renderSlideHTML(slide)}
        </div>`;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; }
    @page { margin: 0; }
    .pdf-page { position: relative; }
  </style>
</head>
<body>
${pagesHTML}
</body>
</html>`;

    // Launch Puppeteer to generate PDF
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      width: `${width}px`,
      height: `${height}px`,
      printBackground: true,
      pageRanges: `1-${slides.length}`,
    });

    await browser.close();
    browser = null;

    // Set headers for file download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF export error:', error);
    if (browser) {
      await browser.close();
    }
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

// GET /api/export/deck/:id/pptx - Export deck as PowerPoint
router.get('/deck/:id/pptx', async (req, res) => {
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

    // Create PowerPoint presentation
    const pptx = new PptxGenJS();

    // Set presentation properties
    pptx.author = 'CourseVideo Studio';
    pptx.title = title;
    pptx.subject = 'Course Presentation';

    // Calculate dimensions based on aspect ratio
    const aspectRatio = deck.aspect_ratio || '16:9';
    switch (aspectRatio) {
      case '9:16':
        pptx.layout = 'LAYOUT_CUSTOM';
        pptx.defineLayout({ name: 'PORTRAIT', width: 7.5, height: 13.33 });
        break;
      case '1:1':
        pptx.layout = 'LAYOUT_CUSTOM';
        pptx.defineLayout({ name: 'SQUARE', width: 10, height: 10 });
        break;
      case '4:3':
        pptx.layout = 'LAYOUT_4x3';
        break;
      default: // 16:9
        pptx.layout = 'LAYOUT_16x9';
    }

    // Add slides
    slides.forEach(slideData => {
      const slide = pptx.addSlide();
      const body = typeof slideData.body === 'string' ? JSON.parse(slideData.body) : slideData.body || {};
      const layout = body.layout || 'title-body';
      const bgColor = slideData.background_color || '#ffffff';

      // Set background color
      slide.background = { color: bgColor.replace('#', '') };

      // Add content based on layout
      switch (layout) {
        case 'title-only':
          slide.addText(slideData.title || 'Untitled Slide', {
            x: 0.5,
            y: '40%',
            w: '90%',
            h: 1.5,
            fontSize: 44,
            bold: true,
            color: getTextColor(bgColor).replace('#', ''),
            align: 'center',
            valign: 'middle',
          });
          break;

        case 'title-bullets':
          slide.addText(slideData.title || 'Untitled Slide', {
            x: 0.5,
            y: 0.5,
            w: '90%',
            h: 1,
            fontSize: 36,
            bold: true,
            color: getTextColor(bgColor).replace('#', ''),
          });

          if (body.bullets && body.bullets.length > 0) {
            slide.addText(body.bullets, {
              x: 0.5,
              y: 2,
              w: '90%',
              h: 4,
              fontSize: 24,
              bullet: true,
              color: getTextColor(bgColor).replace('#', ''),
            });
          }
          break;

        case 'two-column':
          slide.addText(slideData.title || 'Untitled Slide', {
            x: 0.5,
            y: 0.5,
            w: '90%',
            h: 1,
            fontSize: 36,
            bold: true,
            color: getTextColor(bgColor).replace('#', ''),
          });

          if (body.bullets && body.bullets.length > 0) {
            const midpoint = Math.ceil(body.bullets.length / 2);
            const left = body.bullets.slice(0, midpoint);
            const right = body.bullets.slice(midpoint);

            slide.addText(left, {
              x: 0.5,
              y: 2,
              w: '43%',
              h: 4,
              fontSize: 20,
              bullet: true,
              color: getTextColor(bgColor).replace('#', ''),
            });

            slide.addText(right, {
              x: '52%',
              y: 2,
              w: '43%',
              h: 4,
              fontSize: 20,
              bullet: true,
              color: getTextColor(bgColor).replace('#', ''),
            });
          }
          break;

        case 'centered':
          slide.addText(slideData.title || 'Untitled Slide', {
            x: 0.5,
            y: '35%',
            w: '90%',
            h: 1.5,
            fontSize: 44,
            bold: true,
            color: getTextColor(bgColor).replace('#', ''),
            align: 'center',
            valign: 'middle',
          });

          if (body.text) {
            const subtitleColor = getTextColor(bgColor) === '#1f2937' ? '6b7280' : 'd1d5db';
            slide.addText(body.text, {
              x: '10%',
              y: '50%',
              w: '80%',
              h: 1.5,
              fontSize: 24,
              color: subtitleColor,
              align: 'center',
              valign: 'middle',
            });
          }
          break;

        default: // title-body
          slide.addText(slideData.title || 'Untitled Slide', {
            x: 0.5,
            y: 0.5,
            w: '90%',
            h: 1,
            fontSize: 36,
            bold: true,
            color: getTextColor(bgColor).replace('#', ''),
          });

          if (body.text) {
            const subtitleColor = getTextColor(bgColor) === '#1f2937' ? '6b7280' : 'd1d5db';
            slide.addText(body.text, {
              x: 0.5,
              y: 2,
              w: '90%',
              h: 3,
              fontSize: 20,
              color: subtitleColor,
            });
          }
      }

      // Add speaker notes if available
      if (slideData.speaker_notes) {
        slide.addNotes(slideData.speaker_notes);
      }
    });

    // Generate PPTX file
    const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-zA-Z0-9]/g, '_')}.pptx"`);
    res.send(pptxBuffer);

  } catch (error) {
    console.error('PPTX export error:', error);
    res.status(500).json({ error: 'Failed to export PowerPoint' });
  }
});

export default router;

