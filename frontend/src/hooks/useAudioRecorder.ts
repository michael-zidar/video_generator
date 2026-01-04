import { useState, useRef, useCallback } from 'react';

interface UseAudioRecorderOptions {
  onRecordingComplete?: (blob: Blob) => void;
  onError?: (error: Error) => void;
}

interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}) {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
    audioBlob: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const startRecording = useCallback(async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 44100,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      streamRef.current = stream;

      // Create MediaRecorder with WebM format
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setState(prev => ({ ...prev, audioBlob: blob, isRecording: false }));
        options.onRecordingComplete?.(blob);

        // Stop timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms

      // Start timer
      setState(prev => ({ ...prev, isRecording: true, recordingTime: 0 }));
      timerRef.current = window.setInterval(() => {
        setState(prev => ({ ...prev, recordingTime: prev.recordingTime + 100 }));
      }, 100);

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to start recording');
      options.onError?.(err);
      console.error('Recording error:', err);
    }
  }, [options]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();

      // Stop all tracks
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, [state.isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && !state.isPaused) {
      mediaRecorderRef.current.pause();
      setState(prev => ({ ...prev, isPaused: true }));

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [state.isRecording, state.isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && state.isPaused) {
      mediaRecorderRef.current.resume();
      setState(prev => ({ ...prev, isPaused: false }));

      // Resume timer
      timerRef.current = window.setInterval(() => {
        setState(prev => ({ ...prev, recordingTime: prev.recordingTime + 100 }));
      }, 100);
    }
  }, [state.isRecording, state.isPaused]);

  const clearRecording = useCallback(() => {
    setState({
      isRecording: false,
      isPaused: false,
      recordingTime: 0,
      audioBlob: null,
    });
    chunksRef.current = [];
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
  };
}
