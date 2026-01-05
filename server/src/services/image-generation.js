import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '../../data/assets/images');

// Ensure images directory exists
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

// Initialize Google GenAI client
let genAI = null;

const getGoogleAIClient = () => {
  if (!genAI) {
    // Check both GOOGLE_API_KEY and GEMINI_API_KEY for compatibility
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.startsWith('your-')) {
      throw new Error('Google API key not configured. Please set GOOGLE_API_KEY or GEMINI_API_KEY in server/.env');
    }
    // Initialize with explicit apiKey parameter
    // The SDK will use this for authentication
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
};

/**
 * Map slide aspect ratios to Gemini-supported aspect ratios
 * Gemini supports: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
 */
const mapAspectRatio = (slideAspectRatio) => {
  const mapping = {
    '16:9': '16:9',
    '9:16': '9:16',
    '1:1': '1:1',
    '4:3': '4:3',
    '3:4': '3:4',
  };
  return mapping[slideAspectRatio] || '16:9';
};

/**
 * Generate a unique filename for the image
 */
const generateFilename = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `slide_image_${timestamp}_${random}.png`;
};

/**
 * Generate an image using Gemini 2.5 Flash Image (Nano Banana)
 * @param {string} prompt - The image generation prompt
 * @param {string} aspectRatio - The aspect ratio (default: 16:9)
 * @returns {Promise<{url: string, filename: string, width: number, height: number, prompt: string}>}
 */
export async function generateSlideImage(prompt, aspectRatio = '16:9') {
  const client = getGoogleAIClient();
  const geminiAspectRatio = mapAspectRatio(aspectRatio);

  console.log(`Generating image with prompt: "${prompt.substring(0, 100)}..." (aspect ratio: ${geminiAspectRatio})`);

  try {
    // Build the request config
    const requestConfig = {
      model: 'gemini-2.5-flash-image',
      contents: prompt,
    };

    // Add aspect ratio configuration if specified
    if (geminiAspectRatio) {
      requestConfig.config = {
        imageConfig: {
          aspectRatio: geminiAspectRatio,
        },
      };
    }

    console.log('Request config:', JSON.stringify(requestConfig, null, 2));

    const response = await client.models.generateContent(requestConfig);

    console.log('Response received:', JSON.stringify(response, null, 2));

    // Find the image part in the response
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      throw new Error('No content in Gemini response');
    }

    let imageData = null;
    let textContent = '';

    for (const part of candidate.content.parts) {
      if (part.text) {
        textContent = part.text;
      } else if (part.inlineData) {
        imageData = part.inlineData.data;
      }
    }

    if (!imageData) {
      throw new Error('No image data in Gemini response. Text response: ' + textContent);
    }

    // Decode base64 and save to file
    const buffer = Buffer.from(imageData, 'base64');
    const filename = generateFilename();
    const filePath = path.join(ASSETS_DIR, filename);

    fs.writeFileSync(filePath, buffer);

    // Get image dimensions from aspect ratio
    const dimensions = getImageDimensions(geminiAspectRatio);

    const relativePath = `/data/assets/images/${filename}`;

    console.log(`Image generated and saved: ${relativePath}`);

    return {
      url: relativePath,
      filename,
      width: dimensions.width,
      height: dimensions.height,
      prompt,
    };
  } catch (error) {
    console.error('Gemini image generation error:', error);
    // Log the full error object for debugging
    if (error.response) {
      console.error('Error response:', JSON.stringify(error.response, null, 2));
    }
    if (error.message) {
      console.error('Error message:', error.message);
    }
    throw new Error(`Image generation failed: ${error.message}`);
  }
}

/**
 * Generate an image prompt from slide content
 * @param {object} slide - The slide object with title and body
 * @returns {string} - A detailed image prompt
 */
export function generateImagePromptFromSlide(slide) {
  const title = slide.title || 'Untitled';
  const bodyText = slide.body?.text || '';
  const bullets = slide.body?.bullets?.join(', ') || '';
  
  // Use the existing image_prompt if available
  if (slide.body?.image_prompt) {
    return slide.body.image_prompt;
  }
  
  // Build a descriptive prompt from slide content
  let context = title;
  if (bodyText) {
    context += `. ${bodyText}`;
  }
  if (bullets) {
    context += `. Related topics: ${bullets}`;
  }
  
  // Create a professional, presentation-appropriate image prompt
  const prompt = `Create a professional, high-quality image suitable for a presentation slide about: ${context}. 

Style guidelines:
- Clean, modern, and professional aesthetic
- Suitable for business or educational presentations
- Clear visual that supports the topic
- No text or labels in the image
- High contrast and good visibility
- Corporate/professional color palette`;

  return prompt;
}

/**
 * Get image dimensions based on aspect ratio
 */
function getImageDimensions(aspectRatio) {
  const dimensions = {
    '1:1': { width: 1024, height: 1024 },
    '2:3': { width: 832, height: 1248 },
    '3:2': { width: 1248, height: 832 },
    '3:4': { width: 864, height: 1184 },
    '4:3': { width: 1184, height: 864 },
    '4:5': { width: 896, height: 1152 },
    '5:4': { width: 1152, height: 896 },
    '9:16': { width: 768, height: 1344 },
    '16:9': { width: 1344, height: 768 },
    '21:9': { width: 1536, height: 672 },
  };
  return dimensions[aspectRatio] || dimensions['16:9'];
}

/**
 * Check if image generation is configured
 */
export function isImageGenerationConfigured() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  return apiKey && !apiKey.startsWith('your-');
}

/**
 * Get image generation status
 */
export function getImageGenerationStatus() {
  const isConfigured = isImageGenerationConfigured();
  
  return {
    configured: isConfigured,
    provider: 'google',
    model: 'gemini-2.5-flash-image',
    supportedAspectRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    capabilities: isConfigured ? ['text_to_image', 'slide_image_generation'] : [],
  };
}

