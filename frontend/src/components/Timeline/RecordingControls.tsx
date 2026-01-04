import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Play, Pause, Trash2, Upload, Loader2 } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAuth } from '@clerk/clerk-react';
import { useToast } from '@/hooks/use-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface RecordingControlsProps {
  slideId: number;
  onUploadComplete?: () => void;
}

export function RecordingControls({ slideId, onUploadComplete }: RecordingControlsProps) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
  } = useAudioRecorder({
    onError: (error) => {
      toast({
        title: 'Recording Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Create preview URL when blob is available
  const previewUrl = audioBlob ? URL.createObjectURL(audioBlob) : null;

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleUpload = async () => {
    if (!audioBlob) return;

    setIsUploading(true);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('slide_id', slideId.toString());

      const response = await fetch(`${API_BASE_URL}/api/ai/voiceover/upload-recording`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();

      toast({
        title: 'Recording Uploaded',
        description: `Version ${data.version_number} saved. Transcribing...`,
      });

      clearRecording();
      onUploadComplete?.();
    } catch (error) {
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload recording',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const togglePreviewPlayback = () => {
    if (!audioRef.current) return;

    if (isPlayingPreview) {
      audioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      audioRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-background/50 rounded-md border">
      {!isRecording && !audioBlob && (
        <Button
          size="sm"
          variant="outline"
          onClick={startRecording}
          className="gap-2"
        >
          <Mic className="h-4 w-4" />
          Record
        </Button>
      )}

      {isRecording && (
        <>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-mono">{formatTime(recordingTime)}</span>
          </div>

          {!isPaused ? (
            <Button size="sm" variant="ghost" onClick={pauseRecording}>
              <Pause className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={resumeRecording}>
              <Play className="h-4 w-4" />
            </Button>
          )}

          <Button size="sm" variant="destructive" onClick={stopRecording}>
            <Square className="h-4 w-4" />
          </Button>
        </>
      )}

      {audioBlob && !isRecording && (
        <>
          <audio
            ref={audioRef}
            src={previewUrl || undefined}
            onEnded={() => setIsPlayingPreview(false)}
          />

          <Button size="sm" variant="ghost" onClick={togglePreviewPlayback}>
            {isPlayingPreview ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>

          <span className="text-sm text-muted-foreground">
            {formatTime(recordingTime)}
          </span>

          <Button
            size="sm"
            variant="default"
            onClick={handleUpload}
            disabled={isUploading}
            className="gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Save
              </>
            )}
          </Button>

          <Button size="sm" variant="ghost" onClick={clearRecording}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
