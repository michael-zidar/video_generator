import OpenAI from 'openai';
import { inferOptimalSlideCount, isGeminiConfigured } from './gemini.js';

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

// Re-export Gemini utilities for use in routes
export { inferOptimalSlideCount, isGeminiConfigured };

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
    description: 'Title with bullet points (3-5 items). Best for short lists, features, or key points.',
    fields: ['title', 'bullets'],
  },
  'two-column': {
    description: 'Title with bullet points split into two columns (6-10 items). Best for longer lists or when you want a balanced layout.',
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
    description: 'Two-column labeled comparison. Best for before/after, pros/cons, or contrasting ideas with clear categories.',
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
- Short lists (3-5 items): Use "title-bullets"
- Longer lists (6-10 items): Use "two-column" for better visual balance
- Key statistics or numbers: Use "stats-grid"
- Labeled comparisons (before/after, pros/cons): Use "comparison"
- Impactful quotes: Use "quote"
- Explanatory paragraphs: Use "title-body"
- Section headers: Use "title-only"
- When visuals would help: Use "image-text"
- Last slide: Use "centered" for summary/call-to-action

Additional guidelines:
- Vary layouts throughout to maintain engagement
- Choose layouts that best fit the content structure
- Use two-column when bullet points exceed 5 items
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
    'two-column': `{
      "title": "Clear slide title",
      "body": {
        "layout": "two-column",
        "bullets": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5", "Point 6", "Point 7", "Point 8"]
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
 * Generate speaker notes/narration script for a slide (legacy - simple version)
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
 * Generate enhanced speaker notes with markdown formatting and multi-step refinement
 * @param {object} slide - Slide object with title and body
 * @param {object} options - Generation options
 * @param {number} options.targetDurationSec - Target duration in seconds (15, 30, or 60)
 * @param {string} options.tone - Tone of the notes (professional, friendly, energetic, inspirational)
 * @param {string} options.context - Additional context about the presentation
 * @param {number} options.slideIndex - Position in the presentation (0-based)
 * @param {number} options.totalSlides - Total number of slides
 * @returns {Promise<string>} - Markdown-formatted speaker notes
 */
export async function generateEnhancedSpeakerNotes(slide, options = {}) {
  const {
    targetDurationSec = 30,
    tone = 'professional',
    context = '',
    slideIndex = 0,
    totalSlides = 1,
  } = options;

  const client = getOpenAIClient();
  const targetWords = Math.round(targetDurationSec * 2.5);

  // Determine slide position in presentation
  const isOpening = slideIndex === 0;
  const isClosing = slideIndex === totalSlides - 1;
  const isMiddle = !isOpening && !isClosing;

  // Build detailed slide content description
  const layout = slide.body?.layout || 'title-body';
  let slideContent = buildSlideContentDescription(slide);

  // STEP 1: Generate initial draft as conversational transcript
  const draftPrompt = `You are transcribing what a real person would actually say during a live presentation - not a polished script, but natural, conversational speech.

**Slide Context:**
- Position: Slide ${slideIndex + 1} of ${totalSlides} (${isOpening ? 'Opening' : isClosing ? 'Closing' : 'Middle'} slide)
- Layout: ${layout}
- Target speaking time: ${targetDurationSec} seconds (~${targetWords} words)
- Tone: ${tone}
${context ? `- Presentation context: ${context}` : ''}

**Slide Content:**
${slideContent}

**Your Task:**
Write what the presenter would ACTUALLY say out loud - including natural speech patterns, filler words, and conversational style.

**Make it sound HUMAN:**
- Use contractions (I'm, it's, we're, you'll, etc.) - people don't say "I am" in conversation
- Include natural filler words and speech patterns: "uh", "um", "you know", "like", "so", "right", "okay"
- Add self-corrections or rephrasing: "what I mean is...", "or rather...", "let me put it this way..."
- Use casual, conversational language - avoid formal/stiff phrasing
- ${isOpening ? 'Start naturally - like greeting friends, not reading a teleprompter' : isClosing ? 'Wrap up casually but memorably' : 'Transition naturally, like you\'re just continuing a conversation'}
- ${layout === 'title-bullets' || layout === 'two-column' ? 'Talk through each point like you\'re explaining to a friend, not listing items' : ''}
- Speak in first person when appropriate ("I think", "I believe", "in my experience")
- Add rhetorical questions, brief pauses in thought
- Use **bold** for words you'd naturally emphasize when speaking (2-3 phrases)
- Add blank lines for natural pauses or breath breaks

**Example of GOOD conversational style:**
"Okay so... the first thing I want to talk about here is, um, basically how we approach this problem. And you know what's interesting? Most people think it's about X, but it's actually - it's really about Y.

Like, when I look at this data, what stands out to me is... **this pattern right here**. And that's huge, right? Because it means we can actually..."

**Example of BAD (too formal):**
"The first consideration is the approach to the problem. It is interesting to note that most individuals believe the focus is X, however, the reality is Y.

When examining the data, the notable pattern is significant because it enables us to..."

Return ONLY the conversational transcript in markdown. No headings, no labels - just what they'd actually say.`;

  const draftResponse = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'user', content: draftPrompt }
    ],
    temperature: 0.8, // Higher creativity for initial draft
  });

  const draft = draftResponse.choices[0]?.message?.content?.trim();
  if (!draft) {
    throw new Error('Failed to generate draft speaker notes');
  }

  // STEP 2: Refinement pass - make it MORE conversational and engaging
  const refinementPrompt = `Review this presentation transcript and make it sound even MORE like natural, engaging human speech:

${draft}

**Refinement Goals:**
1. **Increase Natural Speech:** Add MORE conversational flair - more "ums", "uhs", casual asides, thinking out loud
2. **Add Personality:** Include brief anecdotes, relatable examples, or personal observations ("I always think...", "here's what's cool...")
3. **Vary the Rhythm:** Mix quick bursts of energy with slower, thoughtful moments - like real speech
4. **Keep it Loose:** Don't over-polish - preserve the natural, slightly imperfect feel of someone talking
5. **Add Connection:** More direct address to audience ("you're probably thinking...", "let me ask you...", "imagine this...")
6. **Thinking Out Loud:** Include moments where the speaker appears to be forming thoughts in real-time ("what I mean is...", "how do I explain this...")

**Keep these conversational elements:**
- Contractions everywhere
- Filler words (um, uh, you know, like, so)
- Self-corrections and rephrasing
- Rhetorical questions
- Casual language
- First person perspective

This should sound like a TRANSCRIPT of someone actually speaking, not a written script.
Return the COMPLETE improved transcript in markdown format.`;

  const refinedResponse = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'user', content: refinementPrompt }
    ],
    temperature: 0.7,
  });

  const refined = refinedResponse.choices[0]?.message?.content?.trim();
  if (!refined) {
    return draft; // Fallback to draft if refinement fails
  }

  // STEP 3: Final polish - light cleanup while preserving natural speech
  const polishPrompt = `Light polish on this conversational transcript - DO NOT over-polish or make it formal:

${refined}

**Final Polish (KEEP IT CONVERSATIONAL):**
1. Verify word count is approximately ${targetWords} words (±15%) - adjust ONLY if way off
2. Ensure **bold** is used for 2-3 natural speaking emphases
3. Keep blank lines for natural pauses and breath breaks
4. Tone should be consistently ${tone} throughout
5. **CRITICAL:** This MUST still sound like someone actually talking - preserve all the "ums", "uhs", contractions, casual language
6. Remove only truly awkward spots - don't "clean up" the conversational feel
7. If it sounds too polished or formal, MAKE IT MORE CASUAL again

**Remember:** This is a TRANSCRIPT of natural speech, not a written script. It should sound slightly imperfect and human.

Return the final transcript in markdown. No headings, no labels - just what someone would actually say.`;

  const polishedResponse = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'user', content: polishPrompt }
    ],
    temperature: 0.5, // Lower temperature for consistency
  });

  const polished = polishedResponse.choices[0]?.message?.content?.trim();

  return polished || refined || draft;
}

/**
 * Helper function to build detailed slide content description
 */
function buildSlideContentDescription(slide) {
  const layout = slide.body?.layout || 'title-body';
  let description = `**Title:** ${slide.title || 'Untitled'}\n**Layout:** ${layout}\n\n`;

  if (slide.body?.text) {
    description += `**Body Text:**\n${slide.body.text}\n\n`;
  }
  if (slide.body?.bullets?.length) {
    description += `**Bullet Points:**\n${slide.body.bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}\n\n`;
  }
  if (slide.body?.quote_text) {
    description += `**Quote:**\n> "${slide.body.quote_text}"\n> — ${slide.body.quote_author || 'Unknown'}\n\n`;
  }
  if (slide.body?.stats?.length) {
    description += `**Statistics:**\n${slide.body.stats.map(s => `- ${s.value}: ${s.label}`).join('\n')}\n\n`;
  }
  if (slide.body?.comparison_left?.length) {
    description += `**Comparison:**\n\n**${slide.body.left_label || 'Left Side'}:**\n${slide.body.comparison_left.map(item => `- ${item}`).join('\n')}\n\n`;
    description += `**${slide.body.right_label || 'Right Side'}:**\n${slide.body.comparison_right?.map(item => `- ${item}`).join('\n') || 'None'}\n\n`;
  }

  return description;
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
      } else if (item.keyPoints?.length > 5) {
        layout = 'two-column'; // Longer lists get two-column layout
      } else if (item.keyPoints?.length > 0) {
        layout = 'title-bullets'; // Shorter lists get single column
      } else {
        layout = 'title-body'; // No key points, use paragraph text
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
 * Generate slides from Notion markdown content using AI
 * The AI analyzes the content structure and creates appropriately laid-out slides
 * @param {string} markdownContent - Markdown content from Notion page
 * @param {number|null} targetSlides - Target number of slides (null = auto-infer)
 * @param {object} options - Additional options
 * @param {string} options.contentType - Type of content: 'notes' or 'notion'
 * @returns {Promise<{slides: Array<{title: string, body: object, speaker_notes: string, background_color?: string}>, inferredCount?: {slideCount: number, reasoning: string, sections: string[]}}>}
 */
export async function generateSlidesFromNotionContent(markdownContent, targetSlides = null, options = {}) {
  const client = getOpenAIClient();
  const { contentType = 'notion' } = options;
  
  // If no target slides specified, infer the optimal count using Gemini
  let inferredCount = null;
  let numSlides = targetSlides;
  
  if (numSlides === null || numSlides === undefined) {
    inferredCount = await inferOptimalSlideCount(markdownContent, {
      minSlides: 3,
      maxSlides: 20,
      contentType,
    });
    numSlides = inferredCount.slideCount;
    console.log(`Inferred optimal slide count: ${numSlides} - ${inferredCount.reasoning}`);
  }
  
  const layoutDescriptions = Object.entries(LAYOUT_TYPES)
    .map(([key, value]) => `- "${key}": ${value.description}`)
    .join('\n');
  
  const systemPrompt = `You are an expert presentation designer. Your task is to analyze content from ${contentType === 'notion' ? 'a Notion page' : 'notes'} and transform it into a well-structured slide presentation.

Available layout types:
${layoutDescriptions}

You will receive markdown content. Analyze it and create ${numSlides} slides that:
1. Capture the key ideas and structure
2. Use appropriate layouts based on content type
3. Maintain a logical flow from introduction to conclusion
4. Vary layouts for visual interest

Return a JSON array of slide objects with this exact structure:
[
  {
    "title": "Clear, engaging slide title",
    "body": {
      "layout": "layout-type",
      // Layout-specific fields like: text, bullets, quote_text, quote_author, stats, comparison_left, comparison_right, left_label, right_label
    },
    "speaker_notes": "Brief speaker notes for this slide (1-2 sentences)",
    "background_color": "#ffffff" // Optional, default white
  }
]

Guidelines:
- First slide should be "centered" layout for title/intro
- Last slide should be "centered" for conclusion/summary
- Use "title-bullets" for lists of 3-5 items
- Use "two-column" for lists of 6+ items
- Use "quote" for important quotes
- Use "stats-grid" for numerical data
- Use "comparison" for before/after or pros/cons
- Keep titles under 60 characters
- Extract key points, don't include everything
- Return ONLY valid JSON, no markdown formatting`;

  const userPrompt = `Transform this content into a ${numSlides}-slide presentation:

${markdownContent}

Create exactly ${numSlides} slides with appropriate layouts. Return only JSON.`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  try {
    // Parse JSON from response (handle potential markdown code blocks)
    let jsonStr = content;
    if (content.includes('```')) {
      jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    
    const slides = JSON.parse(jsonStr);
    
    // Validate and ensure each slide has required fields
    const processedSlides = slides.map((slide, index) => ({
      title: slide.title || `Slide ${index + 1}`,
      body: slide.body || { layout: 'title-only' },
      speaker_notes: slide.speaker_notes || '',
      background_color: slide.background_color || '#ffffff',
    }));
    
    return {
      slides: processedSlides,
      inferredCount,
    };
  } catch (e) {
    console.error('Failed to parse slides from Notion content:', content);
    throw new Error('Failed to parse AI response as JSON');
  }
}

/**
 * Check if AI is configured and ready
 * @returns {{configured: boolean, provider: string, capabilities: string[], gemini: {configured: boolean}}}
 */
export function getAIStatus() {
  const apiKey = process.env.OPENAI_API_KEY;
  const isConfigured = apiKey && !apiKey.startsWith('sk-your-');
  const geminiConfigured = isGeminiConfigured();
  
  return {
    configured: isConfigured,
    provider: 'openai',
    model: MODEL,
    capabilities: isConfigured ? [
      'outline_generation',
      'slide_content',
      'script_generation',
      'layout_variety',
      ...(geminiConfigured ? ['dynamic_slide_count'] : []),
    ] : [],
    gemini: {
      configured: geminiConfigured,
      model: 'gemini-2.0-flash',
    },
  };
}
