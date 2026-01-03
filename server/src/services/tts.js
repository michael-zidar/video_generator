import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.join(__dirname, '../../../data/assets/audio');

// Ensure audio directory exists
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// Latest ElevenLabs model
const DEFAULT_MODEL = 'eleven_multilingual_v2';
const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128';

/**
 * Check if ElevenLabs is configured
 */
export function isElevenLabsConfigured() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  return apiKey && !apiKey.startsWith('your-') && apiKey.length > 10;
}

/**
 * Get ElevenLabs API key
 */
function getApiKey() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || apiKey.startsWith('your-') || apiKey.length < 10) {
    throw new Error('ElevenLabs API key not configured. Please set ELEVENLABS_API_KEY in server/.env');
  }
  return apiKey;
}

/**
 * Fetch available voices from ElevenLabs
 * @returns {Promise<Array<{voice_id: string, name: string, category: string, labels: object}>>}
 */
export async function getVoices() {
  const apiKey = getApiKey();
  
  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: {
      'xi-api-key': apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch voices: ${error}`);
  }

  const data = await response.json();
  
  return data.voices.map((voice) => ({
    voice_id: voice.voice_id,
    name: voice.name,
    category: voice.category || 'premade',
    preview_url: voice.preview_url,
    labels: voice.labels || {},
  }));
}

/**
 * Generate audio from text using ElevenLabs Text-to-Speech API
 * @param {string} text - The text to convert to speech
 * @param {string} voiceId - ElevenLabs voice ID
 * @param {object} settings - Voice settings (stability, similarity, style, model)
 * @returns {Promise<{audioPath: string, filename: string, duration_ms: number, relativePath: string}>}
 */
export async function generateAudio(text, voiceId, settings = {}) {
  const apiKey = getApiKey();
  
  // Voice settings with sensible defaults
  const voiceSettings = {
    stability: settings.stability ?? 0.5,
    similarity_boost: settings.similarity_boost ?? 0.75,
    style: settings.style ?? 0,
    use_speaker_boost: settings.use_speaker_boost ?? true,
  };

  // Use the default voice if none provided (George - a clear male voice)
  const selectedVoiceId = voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
  
  // Model selection - default to multilingual v2
  const modelId = settings.model_id || DEFAULT_MODEL;
  
  // Output format
  const outputFormat = settings.output_format || DEFAULT_OUTPUT_FORMAT;

  console.log(`Generating audio with ElevenLabs: voice=${selectedVoiceId}, model=${modelId}, text_length=${text.length}`);

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: text,
      model_id: modelId,
      output_format: outputFormat,
      voice_settings: voiceSettings,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `ElevenLabs API error (${response.status}): ${errorText}`;
    
    // Parse common error messages
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.detail) {
        if (typeof errorJson.detail === 'string') {
          errorMessage = errorJson.detail;
        } else if (errorJson.detail.message) {
          errorMessage = errorJson.detail.message;
        }
      }
    } catch (e) {
      // Keep original error message
    }
    
    throw new Error(errorMessage);
  }

  // Save audio to file
  const audioBuffer = await response.arrayBuffer();
  const filename = `voiceover_${Date.now()}_${Math.random().toString(36).substring(2, 11)}.mp3`;
  const audioPath = path.join(AUDIO_DIR, filename);
  
  fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
  console.log(`Audio saved to: ${audioPath} (${audioBuffer.byteLength} bytes)`);

  // Get audio duration
  const duration_ms = await getAudioDuration(audioPath);

  return {
    audioPath,
    filename,
    duration_ms,
    relativePath: `/data/assets/audio/${filename}`,
  };
}

/**
 * Generate audio with streaming (for longer texts)
 * @param {string} text - The text to convert to speech
 * @param {string} voiceId - ElevenLabs voice ID
 * @param {object} settings - Voice settings
 * @returns {Promise<{audioPath: string, filename: string, duration_ms: number, relativePath: string}>}
 */
export async function generateAudioStream(text, voiceId, settings = {}) {
  const apiKey = getApiKey();
  
  const voiceSettings = {
    stability: settings.stability ?? 0.5,
    similarity_boost: settings.similarity_boost ?? 0.75,
    style: settings.style ?? 0,
    use_speaker_boost: settings.use_speaker_boost ?? true,
  };

  const selectedVoiceId = voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
  const modelId = settings.model_id || DEFAULT_MODEL;
  const outputFormat = settings.output_format || DEFAULT_OUTPUT_FORMAT;

  console.log(`Generating audio stream with ElevenLabs: voice=${selectedVoiceId}, model=${modelId}`);

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}/stream`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: text,
      model_id: modelId,
      output_format: outputFormat,
      voice_settings: voiceSettings,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs streaming API error: ${errorText}`);
  }

  // Collect all chunks
  const chunks = [];
  const reader = response.body.getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  // Combine chunks and save
  const audioBuffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
  const filename = `voiceover_${Date.now()}_${Math.random().toString(36).substring(2, 11)}.mp3`;
  const audioPath = path.join(AUDIO_DIR, filename);
  
  fs.writeFileSync(audioPath, audioBuffer);
  console.log(`Streamed audio saved to: ${audioPath} (${audioBuffer.byteLength} bytes)`);

  const duration_ms = await getAudioDuration(audioPath);

  return {
    audioPath,
    filename,
    duration_ms,
    relativePath: `/data/assets/audio/${filename}`,
  };
}

/**
 * Get audio duration using ffprobe
 * @param {string} filePath - Path to the audio file
 * @returns {Promise<number>} Duration in milliseconds
 */
export async function getAudioDuration(filePath) {
  return new Promise((resolve) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);

    let output = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        // If ffprobe fails, estimate duration based on file size
        // MP3 at 128kbps = 16KB/s
        try {
          const stats = fs.statSync(filePath);
          const estimatedSeconds = stats.size / 16000;
          resolve(Math.round(estimatedSeconds * 1000));
        } catch (e) {
          resolve(5000); // Default to 5 seconds
        }
        return;
      }

      const duration = parseFloat(output.trim());
      if (isNaN(duration)) {
        resolve(5000);
      } else {
        resolve(Math.round(duration * 1000));
      }
    });

    ffprobe.on('error', () => {
      // ffprobe not available, estimate duration
      try {
        const stats = fs.statSync(filePath);
        const estimatedSeconds = stats.size / 16000;
        resolve(Math.round(estimatedSeconds * 1000));
      } catch (e) {
        resolve(5000);
      }
    });
  });
}

/**
 * Delete an audio file
 * @param {string} filePath - Path to the audio file
 */
export function deleteAudio(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Get TTS status and configuration
 */
export function getTTSStatus() {
  const configured = isElevenLabsConfigured();
  return {
    configured,
    provider: 'elevenlabs',
    model: DEFAULT_MODEL,
    output_format: DEFAULT_OUTPUT_FORMAT,
    default_voice_id: process.env.ELEVENLABS_DEFAULT_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb',
    message: configured 
      ? 'ElevenLabs is configured and ready' 
      : 'Set ELEVENLABS_API_KEY in server/.env to enable voice generation',
  };
}

/**
 * Get list of preset voices (for when API is not configured or as fallback)
 * Updated with current ElevenLabs voice IDs
 */
export function getPresetVoices() {
  return [
    { voice_id: '56bVxM2zo2S7h5paHHBt', name: 'Zidar', category: 'cloned', labels: { accent: 'American', gender: 'male', description: 'custom voice' } },
    { voice_id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', category: 'premade', labels: { accent: 'British', gender: 'male', description: 'warm, clear' } },
    { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', category: 'premade', labels: { accent: 'American', gender: 'female', description: 'calm, gentle' } },
    { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', category: 'premade', labels: { accent: 'American', gender: 'female', description: 'soft, warm' } },
    { voice_id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', category: 'premade', labels: { accent: 'American', gender: 'male', description: 'well-rounded' } },
    { voice_id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', category: 'premade', labels: { accent: 'American', gender: 'female', description: 'emotional' } },
    { voice_id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', category: 'premade', labels: { accent: 'American', gender: 'male', description: 'young, deep' } },
    { voice_id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', category: 'premade', labels: { accent: 'American', gender: 'male', description: 'crisp, narrative' } },
    { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', category: 'premade', labels: { accent: 'American', gender: 'male', description: 'deep, narrator' } },
    { voice_id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', category: 'premade', labels: { accent: 'American', gender: 'male', description: 'raspy, dynamic' } },
    { voice_id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', category: 'premade', labels: { accent: 'British', gender: 'male', description: 'authoritative' } },
    { voice_id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', category: 'premade', labels: { accent: 'British', gender: 'female', description: 'seductive, video games' } },
  ];
}

/**
 * Get available models
 */
export function getAvailableModels() {
  return [
    { id: 'eleven_multilingual_v2', name: 'Multilingual v2', description: 'Best quality, supports 29 languages' },
    { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5', description: 'Low latency, optimized for real-time' },
    { id: 'eleven_turbo_v2', name: 'Turbo v2', description: 'Low latency model' },
    { id: 'eleven_monolingual_v1', name: 'English v1', description: 'English only, legacy' },
  ];
}
