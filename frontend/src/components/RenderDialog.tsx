import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import {
  Video,
  Download,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Play,
} from 'lucide-react'
import { useRenderProgress } from '@/hooks/useRenderProgress'
import { toast } from '@/hooks/use-toast'

interface RenderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deckId: number | null
  deckTitle?: string
}

type RenderQuality = 'preview' | 'final'

interface QualityOption {
  id: RenderQuality
  label: string
  description: string
  resolution: string
}

const qualityOptions: QualityOption[] = [
  {
    id: 'preview',
    label: 'Preview',
    description: 'Fast rendering for review',
    resolution: '1280×720 (720p)',
  },
  {
    id: 'final',
    label: 'Final',
    description: 'High quality for publishing',
    resolution: '1920×1080 (1080p)',
  },
]

export function RenderDialog({
  open,
  onOpenChange,
  deckId,
  deckTitle,
}: RenderDialogProps) {
  const [quality, setQuality] = useState<RenderQuality>('preview')
  const [renderId, setRenderId] = useState<number | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  const {
    status,
    progress,
    message,
    outputPath,
    error,
    connect,
    disconnect,
    reset,
  } = useRenderProgress()

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      // Give a moment before resetting to show final state
      const timer = setTimeout(() => {
        setRenderId(null)
        setIsStarting(false)
        reset()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [open, reset])

  // Start rendering
  const handleStartRender = useCallback(async () => {
    if (!deckId) return

    setIsStarting(true)
    try {
      const response = await fetch('/api/renders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          deck_id: deckId,
          kind: quality,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start render')
      }

      const data = await response.json()
      const newRenderId = data.render.id

      setRenderId(newRenderId)
      connect(newRenderId)

      toast({
        title: 'Render Started',
        description: `${quality === 'final' ? 'Final' : 'Preview'} render has been queued.`,
      })
    } catch (err) {
      console.error('Failed to start render:', err)
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to start render',
        variant: 'destructive',
      })
    } finally {
      setIsStarting(false)
    }
  }, [deckId, quality, connect])

  // Cancel render
  const handleCancelRender = useCallback(async () => {
    if (!renderId) return

    try {
      const response = await fetch(`/api/renders/${renderId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to cancel render')
      }

      toast({
        title: 'Render Canceled',
        description: 'The render has been canceled.',
      })

      disconnect()
    } catch (err) {
      console.error('Failed to cancel render:', err)
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to cancel render',
        variant: 'destructive',
      })
    }
  }, [renderId, disconnect])

  // Download rendered video
  const handleDownload = useCallback(() => {
    if (!renderId) return
    window.open(`/api/renders/${renderId}/download`, '_blank')
  }, [renderId])

  // Preview video in new tab
  const handlePreview = useCallback(() => {
    if (!outputPath) return
    window.open(outputPath, '_blank')
  }, [outputPath])

  const isRendering = status === 'progress' || status === 'connecting'
  const isComplete = status === 'complete'
  const hasError = status === 'error'
  const isCanceled = status === 'canceled'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Render Video
          </DialogTitle>
          <DialogDescription>
            {deckTitle
              ? `Export "${deckTitle}" as an MP4 video.`
              : 'Export your presentation as an MP4 video.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Quality Selection - only show when not rendering */}
          {!renderId && (
            <div className="space-y-3">
              <Label>Quality</Label>
              <div className="grid grid-cols-2 gap-3">
                {qualityOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setQuality(option.id)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      quality === option.id
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {option.resolution}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Render Progress */}
          {renderId && (
            <div className="space-y-4">
              {/* Status Icon */}
              <div className="flex items-center justify-center py-4">
                {isRendering && (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">
                      Rendering {quality === 'final' ? 'final' : 'preview'} video...
                    </span>
                  </div>
                )}
                {isComplete && (
                  <div className="flex flex-col items-center gap-3">
                    <CheckCircle className="h-12 w-12 text-green-500" />
                    <span className="text-sm text-muted-foreground">
                      Render complete!
                    </span>
                  </div>
                )}
                {hasError && (
                  <div className="flex flex-col items-center gap-3">
                    <AlertCircle className="h-12 w-12 text-destructive" />
                    <span className="text-sm text-destructive">
                      {error || 'Render failed'}
                    </span>
                  </div>
                )}
                {isCanceled && (
                  <div className="flex flex-col items-center gap-3">
                    <X className="h-12 w-12 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Render canceled
                    </span>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {isRendering && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{message || 'Processing...'}</span>
                    <span>{progress}%</span>
                  </div>
                </div>
              )}

              {/* Action Buttons for Complete State */}
              {isComplete && (
                <div className="flex gap-3">
                  <Button onClick={handlePreview} variant="outline" className="flex-1">
                    <Play className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                  <Button onClick={handleDownload} className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3">
          {!renderId && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleStartRender}
                disabled={isStarting || !deckId}
              >
                {isStarting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4 mr-2" />
                    Start Render
                  </>
                )}
              </Button>
            </>
          )}

          {isRendering && (
            <Button variant="destructive" onClick={handleCancelRender}>
              <X className="h-4 w-4 mr-2" />
              Cancel Render
            </Button>
          )}

          {(isComplete || hasError || isCanceled) && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

