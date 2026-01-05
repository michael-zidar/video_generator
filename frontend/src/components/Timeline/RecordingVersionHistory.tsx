import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Recording {
  id: number;
  version_number: number;
  audio_url: string;
  duration_ms: number;
  is_active: boolean;
  transcription: string | null;
  transcription_status: string;
  created_at: string;
}

interface RecordingVersionHistoryProps {
  slideId: number;
  isOpen: boolean;
  onClose: () => void;
  onVersionChanged?: () => void;
  onTranscriptToNotes?: (transcript: string) => void;
}

export function RecordingVersionHistory({
  slideId,
  isOpen,
  onClose,
  onVersionChanged,
  onTranscriptToNotes
}: RecordingVersionHistoryProps) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSource, setActiveSource] = useState<'generated' | 'recorded' | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadRecordings();
    }
  }, [isOpen, slideId]);

  const loadRecordings = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch(
        `${API_BASE_URL}/api/ai/voiceover/${slideId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to load recordings');

      const data = await response.json();
      setRecordings(data.all_recordings || []);
      setActiveSource(data.active_source);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load recording history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const setActiveRecording = async (recordingId: number) => {
    try {
      const token = await getToken();
      const response = await fetch(
        `${API_BASE_URL}/api/ai/voiceover/set-active-recording`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ recording_id: recordingId }),
        }
      );

      if (!response.ok) throw new Error('Failed to set active recording');

      toast({
        title: 'Success',
        description: 'Recording activated',
      });

      loadRecordings();
      onVersionChanged?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to activate recording',
        variant: 'destructive',
      });
    }
  };

  const switchToGenerated = async () => {
    try {
      const token = await getToken();
      const response = await fetch(
        `${API_BASE_URL}/api/ai/voiceover/set-active-generated`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ slide_id: slideId }),
        }
      );

      if (!response.ok) throw new Error('Failed to switch to generated audio');

      toast({
        title: 'Success',
        description: 'Switched to generated voiceover',
      });

      loadRecordings();
      onVersionChanged?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to switch audio source',
        variant: 'destructive',
      });
    }
  };

  const deleteRecording = async (recordingId: number) => {
    if (!confirm('Delete this recording? This cannot be undone.')) return;

    try {
      const token = await getToken();
      const response = await fetch(
        `${API_BASE_URL}/api/ai/voiceover/recording/${recordingId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to delete recording');

      toast({
        title: 'Deleted',
        description: 'Recording removed',
      });

      loadRecordings();
      onVersionChanged?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete recording',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Audio Versions</DialogTitle>
          <DialogDescription>
            Manage recorded and generated voiceovers for this slide
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {/* Generated Audio Option */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Generated Voiceover</span>
                      {activeSource === 'generated' && (
                        <span className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                          <Check className="h-3 w-3" />
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      ElevenLabs text-to-speech
                    </p>
                  </div>
                  {activeSource !== 'generated' && (
                    <Button size="sm" onClick={switchToGenerated}>
                      Use This
                    </Button>
                  )}
                </div>
              </div>

              {/* Recorded Versions */}
              {recordings.map((recording) => (
                <div key={recording.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">
                          Recording v{recording.version_number}
                        </span>
                        {recording.is_active && (
                          <span className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                            <Check className="h-3 w-3" />
                            Active
                          </span>
                        )}
                        {recording.transcription_status === 'processing' && (
                          <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                            Transcribing...
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Duration: {formatDuration(recording.duration_ms)}</div>
                        <div>Created: {formatDate(recording.created_at)}</div>
                      </div>

                      {recording.transcription && (
                        <div className="mt-2 space-y-2">
                          <div className="p-2 bg-muted rounded text-sm">
                            {recording.transcription}
                          </div>
                          {onTranscriptToNotes && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                onTranscriptToNotes(recording.transcription!);
                                toast({
                                  title: 'Transcript Saved',
                                  description: 'Transcript has been saved to speaker notes',
                                });
                              }}
                            >
                              Save to Speaker Notes
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <audio
                        src={`${API_BASE_URL}${recording.audio_url}`}
                        controls
                        className="h-10"
                      />

                      {!recording.is_active && (
                        <Button
                          size="sm"
                          onClick={() => setActiveRecording(recording.id)}
                        >
                          Use This
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteRecording(recording.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {recordings.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No recordings yet. Use the record button to create one.
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
