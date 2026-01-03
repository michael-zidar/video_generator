import OpenAI from 'openai';

// Initialize OpenAI client
let openai = null;

// Latest OpenAI model (GPT-5.2 released Dec 2025)
const MODEL = 'gpt-5.2';

const getOpenAIClient = () => {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith('sk-your-')) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY in server/.env');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
};

/**
 * Available slide layout types with their schemas
 */
export const LAYOUT_TYPES = {
  'title-only': {
    description: 'Large centered title, no body content. Best for section headers or dramatic statements.',
    fields: ['title'],
  },
  'title-body': {
    description: 'Title with paragraph text below. Best for explanatory content.',
    fields: ['title', 'text'],
  },
  'title-bullets': {
    description: 'Title with bullet points. Best for lists, features, or multiple discrete points.',
    fields: ['title', 'bullets'],
  },
  'centered': {
    description: 'Centered title and subtitle/tagline. Best for intro/outro slides.',
    fields: ['title', 'text'],
  },
  'quote': {
    description: 'Large quote with attribution. Best for impactful quotes or testimonials.',
    fields: ['title', 'quote_text', 'quote_author'],
  },
  'stats-grid': {
    description: 'Grid of statistics/numbers with labels. Best for data, metrics, or key figures.',
    fields: ['title', 'stats'],
  },
  'comparison': {
    description: 'Two-column comparison. Best for before/after, pros/cons, or contrasting ideas.',
    fields: ['title', 'comparison_left', 'comparison_right', 'left_label', 'right_label'],
  },
  'image-text': {
    description: 'Image on one side, text on the other. Best when visuals support the content.',
    fields: ['title', 'text', 'image_prompt'],
  },
};

/**
 * Generate a presentation outline from a topic/prompt
 * Now includes suggested layouts for each slide based on content type
 * @param {string} topic - The topic or prompt for the presentation
 * @param {number} numSlides - Target number of slides (default: 5)
 * @returns {Promise<Array<{title: string, keyPoints: string[], suggestedLayout: string, layoutHint: string}>>}
 */
export async function generateOutline(topic, numSlides = 5) {
  const client = getOpenAIClient();
  
  const layoutDescriptions = Object.entries(LAYOUT_TYPES)
    .map(([key, value]) => `- "${key}": ${value.description}`)
    .join('\n');
  
  const systemPrompt = `You are an expert presentation designer. Create clear, engaging slide outlines for educational presentations.

Available layout types:
${layoutDescriptions}

Return your response as a JSON array of objects with this structure:
[
  {
    "title": "Slide title",
    "keyPoints": ["Point 1", "Point 2", "Point 3"],
    "suggestedLayout": "layout-type",
    "layoutHint": "Brief reason for layout choice"
  }
]

Guidelines for layout selection:
- First slide: Use "centered" for title/intro
- Lists of items or features: Use "title-bullets"
- Key statistics or numbers: Use "stats-grid"  
- Comparisons or contrasts: Use "comparison"
- Impactful quotes: Use "quote"
- Explanatory content: Use "title-body"
- Section headers: Use "title-only"
- When visuals would help: Use "image-text"
- Last slide: Use "centered" for summary/call-to-action

Additional guidelines:
- Each slide should have 2-4 key points (except for specialized layouts)
- Keep titles concise (under 60 characters)
- Key points should be brief but informative
- Vary layouts throughout the presentation for visual interest
- Return ONLY valid JSON, no markdown formatting`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Create an outline for a ${numSlides}-slide presentation about: ${topic}` }
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  try {
    // Try to parse JSON from response (handle potential markdown code blocks)
    let jsonStr = content;
    if (content.includes('```')) {
      jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse outline:', content);
    throw new Error('Failed to parse AI response as JSON');
  }
}

/**
 * Generate content for a single slide based on layout type
 * @param {string} title - The slide title
 * @param {string[]} keyPoints - Key points to expand on
 * @param {string} context - Additional context about the presentation
 * @param {string} layout - Slide layout type
 * @returns {Promise<{title: string, body: object}>}
 */
export async function generateSlideContent(title, keyPoints = [], context = '', layout = 'title-bullets') {
  const client = getOpenAIClient();
  
  // Build layout-specific schema for the response
  const layoutSchemas = {
    'title-only': `{
      "title": "Impactful slide title",
      "body": { "layout": "title-only" }
    }`,
    'title-body': `{
      "title": "Clear slide title",
      "body": {
        "layout": "title-body",
        "text": "2-3 sentences of clear, engaging explanatory content"
      }
    }`,
    'title-bullets': `{
      "title": "Clear slide title",
      "body": {
        "layout": "title-bullets",
        "bullets": ["Bullet 1", "Bullet 2", "Bullet 3", "Bullet 4"]
      }
    }`,
    'centered': `{
      "title": "Main title or statement",
      "body": {
        "layout": "centered",
        "text": "Subtitle or tagline (optional, 1 short sentence)"
      }
    }`,
    'quote': `{
      "title": "Optional context title",
      "body": {
        "layout": "quote",
        "quote_text": "The impactful quote text goes here",
        "quote_author": "Author Name, Title/Source"
      }
    }`,
    'stats-grid': `{
      "title": "What these numbers show",
      "body": {
        "layout": "stats-grid",
        "stats": [
          { "value": "85%", "label": "Metric description" },
          { "value": "2.5x", "label": "Another metric" },
          { "value": "$1.2M", "label": "Third metric" }
        ]
      }
    }`,
    'comparison': `{
      "title": "What we're comparing",
      "body": {
        "layout": "comparison",
        "left_label": "Before / Option A / Pros",
        "right_label": "After / Option B / Cons",
        "comparison_left": ["Left point 1", "Left point 2", "Left point 3"],
        "comparison_right": ["Right point 1", "Right point 2", "Right point 3"]
      }
    }`,
    'image-text': `{
      "title": "Slide title",
      "body": {
        "layout": "image-text",
        "text": "2-3 sentences describing the concept",
        "image_prompt": "A detailed prompt for AI image generation describing the ideal image"
      }
    }`,
  };

  const schema = layoutSchemas[layout] || layoutSchemas['title-bullets'];
  
  const systemPrompt = `You are a presentation content writer. Generate engaging slide content for the "${layout}" layout.

Return your response as a JSON object exactly matching this structure:
${schema}

Guidelines:
- Keep the title engaging but concise (under 60 characters)
- Content should be clear and impactful
- For quotes: Make them memorable and attributable
- For stats: Use realistic, impressive numbers with context
- For comparisons: Show clear contrast between the two sides
- For image-text: Write a detailed image prompt that would generate a relevant, professional image
- Return ONLY valid JSON, no markdown or extra text`;

  const userPrompt = `Generate slide content for:
Title: ${title}
Key Points: ${keyPoints.join(', ') || 'None provided'}
Context: ${context || 'General presentation'}
Layout: ${layout}`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  try {
    let jsonStr = content;
    if (content.includes('```')) {
      jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse slide content:', content);
    throw new Error('Failed to parse AI response as JSON');
  }
}

/**
 * Generate speaker notes/narration script for a slide
 * @param {object} slide - Slide object with title and body
 * @param {number} targetDurationSec - Target duration in seconds (15, 30, or 60)
 * @param {string} tone - Tone of the script (professional, friendly, energetic)
 * @returns {Promise<string>} - The narration script
 */
export async function generateScript(slide, targetDurationSec = 30, tone = 'professional') {
  const client = getOpenAIClient();
  
  // Estimate words per second (average speaking rate is ~150 wpm = 2.5 wps)
  const targetWords = Math.round(targetDurationSec * 2.5);
  
  const systemPrompt = `You are a presentation narrator. Write natural, engaging speaker scripts for slide presentations.

Guidelines:
- Write for spoken delivery, not reading
- Use natural language and conversational tone
- Target approximately ${targetWords} words (${targetDurationSec} seconds when spoken)
- Include brief pauses noted as "..." where appropriate
- Match the specified tone: ${tone}
- Don't read bullet points verbatim - explain and expand on them
- For quotes, introduce them naturally
- For statistics, explain their significance
- Return ONLY the script text, no formatting or labels`;

  // Build content description based on layout
  const layout = slide.body?.layout || 'title-body';
  let slideContent = `Title: ${slide.title || 'Untitled'}\nLayout: ${layout}`;
  
  if (slide.body?.text) {
    slideContent += `\nBody text: ${slide.body.text}`;
  }
  if (slide.body?.bullets?.length) {
    slideContent += `\nBullet points: ${slide.body.bullets.join('; ')}`;
  }
  if (slide.body?.quote_text) {
    slideContent += `\nQuote: "${slide.body.quote_text}" - ${slide.body.quote_author || 'Unknown'}`;
  }
  if (slide.body?.stats?.length) {
    const statsText = slide.body.stats.map(s => `${s.value}: ${s.label}`).join(', ');
    slideContent += `\nStatistics: ${statsText}`;
  }
  if (slide.body?.comparison_left?.length) {
    slideContent += `\n${slide.body.left_label || 'Left'}: ${slide.body.comparison_left.join('; ')}`;
    slideContent += `\n${slide.body.right_label || 'Right'}: ${slide.body.comparison_right?.join('; ') || ''}`;
  }

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Write a ${targetDurationSec}-second narration script for this slide:\n\n${slideContent}` }
    ],
  });

  const script = response.choices[0]?.message?.content;
  if (!script) {
    throw new Error('No response from OpenAI');
  }

  return script.trim();
}

/**
 * Generate multiple slides from an outline
 * Uses AI-suggested layouts from the outline
 * @param {Array<{title: string, keyPoints: string[], suggestedLayout?: string}>} outline - The outline to expand
 * @param {string} context - Additional context
 * @returns {Promise<Array<{title: string, body: object, speaker_notes: string}>>}
 */
export async function generateSlidesFromOutline(outline, context = '') {
  const slides = [];
  
  for (let i = 0; i < outline.length; i++) {
    const item = outline[i];
    
    // Use AI-suggested layout, or fall back to smart defaults
    let layout = item.suggestedLayout;
    
    if (!layout || !LAYOUT_TYPES[layout]) {
      // Smart fallback logic
      if (i === 0) {
        layout = 'centered'; // First slide is intro
      } else if (i === outline.length - 1) {
        layout = 'centered'; // Last slide is outro
      } else if (item.keyPoints?.length > 0) {
        layout = 'title-bullets';
      } else {
        layout = 'title-body';
      }
    }
    
    const slideContent = await generateSlideContent(
      item.title,
      item.keyPoints || [],
      context,
      layout
    );
    
    slides.push({
      title: slideContent.title,
      body: slideContent.body,
      speaker_notes: '', // Can be generated separately
    });
  }
  
  return slides;
}

/**
 * Check if AI is configured and ready
 * @returns {{configured: boolean, provider: string, capabilities: string[]}}
 */
export function getAIStatus() {
  const apiKey = process.env.OPENAI_API_KEY;
  const isConfigured = apiKey && !apiKey.startsWith('sk-your-');
  
  return {
    configured: isConfigured,
    provider: 'openai',
    model: MODEL,
    capabilities: isConfigured ? [
      'outline_generation',
      'slide_content',
      'script_generation',
      'layout_variety',
    ] : [],
  };
}
