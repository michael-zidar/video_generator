import OpenAI from 'openai';
import fs from 'fs';
import { get, run, all } from '../db.js';

let openai = null;

/**
 * Check if OpenAI is configured for transcription
 */
export function isOpenAIConfigured() {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey && !apiKey.startsWith('sk-your-') && apiKey.length > 10;
}

/**
 * Get OpenAI client (lazy initialization)
 */
function getOpenAIClient() {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith('sk-your-') || apiKey.length < 10) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY in server/.env');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

/**
 * Transcribe audio using OpenAI Whisper API
 * @param {number} recordingId - ID from recorded_voiceovers table
 * @param {string} audioPath - Absolute path to audio file
 * @returns {Promise<string>} - The transcription text
 */
export async function transcribeRecording(recordingId, audioPath) {
  try {
    console.log(`Starting transcription for recording ${recordingId}: ${audioPath}`);

    // Update status to processing
    run(`UPDATE recorded_voiceovers
         SET transcription_status = 'processing', updated_at = datetime('now')
         WHERE id = ?`, [recordingId]);

    // Get the OpenAI client
    const client = getOpenAIClient();

    // Verify file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    // Create readable stream
    const audioStream = fs.createReadStream(audioPath);

    // Call Whisper API
    const transcription = await client.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      language: 'en',
      response_format: 'text',
    });

    console.log(`Transcription completed for recording ${recordingId}: ${transcription.substring(0, 100)}...`);

    // Get the recording to find slide_id
    const recording = get('SELECT slide_id FROM recorded_voiceovers WHERE id = ?', [recordingId]);

    if (!recording) {
      throw new Error('Recording not found');
    }

    // Update recording with transcription
    run(`UPDATE recorded_voiceovers
         SET transcription = ?, transcription_status = 'succeeded', updated_at = datetime('now')
         WHERE id = ?`, [transcription, recordingId]);

    // Update slide speaker notes with transcription
    run(`UPDATE slides
         SET speaker_notes = ?, updated_at = datetime('now')
         WHERE id = ?`, [transcription, recording.slide_id]);

    console.log(`Updated speaker notes for slide ${recording.slide_id}`);

    return transcription;
  } catch (error) {
    console.error('Transcription error:', error);

    // Update recording with error
    run(`UPDATE recorded_voiceovers
         SET transcription_status = 'failed',
             transcription_error = ?,
             updated_at = datetime('now')
         WHERE id = ?`, [error.message, recordingId]);

    throw error;
  }
}

/**
 * Get transcription status for a recording
 * @param {number} recordingId - ID from recorded_voiceovers table
 * @returns {object} - Status object with transcription_status, transcription, and error
 */
export function getTranscriptionStatus(recordingId) {
  return get(
    'SELECT transcription_status, transcription, transcription_error FROM recorded_voiceovers WHERE id = ?',
    [recordingId]
  );
}

/**
 * Get all recordings with their transcription status for a slide
 * @param {number} slideId - Slide ID
 * @returns {Array} - Array of recordings with transcription info
 */
export function getRecordingsForSlide(slideId) {
  return all(
    `SELECT id, version_number, audio_asset_id, duration_ms,
            transcription, transcription_status, transcription_error,
            is_active, created_at
     FROM recorded_voiceovers
     WHERE slide_id = ?
     ORDER BY version_number DESC`,
    [slideId]
  );
}
