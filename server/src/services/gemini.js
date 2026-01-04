import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini client
let genAI = null;

// Use Gemini 2.0 Flash for fast, cost-effective inference
// Model name based on latest API: gemini-2.0-flash
const MODEL = 'gemini-2.0-flash';

const getGeminiClient = () => {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.startsWith('your-')) {
      throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY in server/.env');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
};

/**
 * Check if Gemini is configured and available
 * @returns {boolean}
 */
export function isGeminiConfigured() {
  const apiKey = process.env.GEMINI_API_KEY;
  return apiKey && !apiKey.startsWith('your-');
}

/**
 * Analyze content and determine optimal slide count
 * Uses Gemini Flash for fast, cost-effective inference
 * 
 * @param {string} content - The content to analyze (notes or Notion markdown)
 * @param {object} options - Analysis options
 * @param {number} options.minSlides - Minimum slide count (default: 3)
 * @param {number} options.maxSlides - Maximum slide count (default: 20)
 * @param {string} options.contentType - Type of content: 'notes' or 'notion'
 * @returns {Promise<{slideCount: number, reasoning: string, sections: string[]}>}
 */
export async function inferOptimalSlideCount(content, options = {}) {
  const {
    minSlides = 3,
    maxSlides = 20,
    contentType = 'notes',
  } = options;

  // If Gemini is not configured, fall back to heuristic
  if (!isGeminiConfigured()) {
    return fallbackSlideCountEstimate(content, minSlides, maxSlides);
  }

  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: MODEL });

    const prompt = `You are an expert presentation designer. Analyze this ${contentType === 'notion' ? 'Notion page' : 'content/notes'} and determine the optimal number of slides for a presentation.

**Content to analyze:**
${content.slice(0, 15000)}${content.length > 15000 ? '\n\n[Content truncated...]' : ''}

**Your task:**
1. Identify the main sections or topics in this content
2. Determine how many slides would best present this information
3. Consider that each slide should focus on ONE main idea
4. Account for intro and conclusion slides

**Constraints:**
- Minimum slides: ${minSlides}
- Maximum slides: ${maxSlides}

**Respond in this exact JSON format (no markdown, just JSON):**
{
  "slideCount": <number between ${minSlides} and ${maxSlides}>,
  "reasoning": "<1-2 sentence explanation of why this count is optimal>",
  "sections": ["<main topic 1>", "<main topic 2>", ...]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response
    let jsonStr = text;
    if (text.includes('```')) {
      jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    const parsed = JSON.parse(jsonStr);
    
    // Validate and clamp slide count
    const slideCount = Math.min(maxSlides, Math.max(minSlides, parseInt(parsed.slideCount) || 8));
    
    return {
      slideCount,
      reasoning: parsed.reasoning || 'Based on content analysis',
      sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    };
  } catch (error) {
    console.error('Gemini inference error:', error);
    // Fall back to heuristic-based estimation
    return fallbackSlideCountEstimate(content, minSlides, maxSlides);
  }
}

/**
 * Fallback heuristic-based slide count estimation
 * Used when Gemini is not available
 * 
 * @param {string} content - The content to analyze
 * @param {number} minSlides - Minimum slide count
 * @param {number} maxSlides - Maximum slide count
 * @returns {{slideCount: number, reasoning: string, sections: string[]}}
 */
function fallbackSlideCountEstimate(content, minSlides, maxSlides) {
  // Count various content indicators
  const lines = content.split('\n').filter(l => l.trim());
  const words = content.split(/\s+/).length;
  const headings = (content.match(/^#{1,3}\s+.+$/gm) || []).length;
  const bulletPoints = (content.match(/^[-*•]\s+.+$/gm) || []).length;
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim()).length;

  // Estimate based on content density
  // Rule of thumb: 
  // - 1 slide per major heading
  // - 1 slide per 150-200 words of dense content
  // - 1 slide per 5-7 bullet points
  // - Plus intro and conclusion

  let estimatedSlides = 2; // Intro + conclusion

  // Add slides for headings (each heading likely = 1 slide)
  estimatedSlides += headings;

  // If no headings, estimate from word count
  if (headings === 0) {
    estimatedSlides += Math.ceil(words / 175);
  } else {
    // Add extra slides for content-heavy sections
    const wordsPerHeading = words / Math.max(headings, 1);
    if (wordsPerHeading > 250) {
      estimatedSlides += Math.ceil((words - headings * 150) / 200);
    }
  }

  // Consider bullet point density
  if (bulletPoints > 15) {
    // Many bullet points may need additional slides
    estimatedSlides += Math.ceil(bulletPoints / 8);
  }

  // Clamp to valid range
  const slideCount = Math.min(maxSlides, Math.max(minSlides, Math.round(estimatedSlides)));

  return {
    slideCount,
    reasoning: `Estimated based on ${words} words, ${headings} sections, and ${bulletPoints} bullet points`,
    sections: [],
  };
}

/**
 * Get Gemini service status
 * @returns {{configured: boolean, model: string}}
 */
export function getGeminiStatus() {
  return {
    configured: isGeminiConfigured(),
    model: MODEL,
  };
}

