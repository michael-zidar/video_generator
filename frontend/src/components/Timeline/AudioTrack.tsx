import { AudioWaveform } from './AudioWaveform'

interface Voiceover {
  slideId: number
  audioUrl: string
  durationMs: number
}

interface Slide {
  id: number
  duration_ms?: number
}

interface AudioTrackProps {
  slides: Slide[]
  voiceovers: Map<number, { audio_url: string; duration_ms: number }>
  currentTime: number
  pixelsPerSecond: number
  isPlaying: boolean
  onSeek: (timeMs: number) => void
}

export function AudioTrack({
  slides,
  voiceovers,
  currentTime,
  pixelsPerSecond,
  isPlaying,
  onSeek
}: AudioTrackProps) {
  // Calculate audio clip positions based on slide timings
  let accumulatedTime = 0
  const audioClips = slides.map((slide) => {
    const start = accumulatedTime
    const duration = slide.duration_ms || 5000
    accumulatedTime += duration

    const voiceover = voiceovers.get(slide.id)

    return {
      slideId: slide.id,
      start,
      duration,
      hasAudio: !!voiceover,
      audioUrl: voiceover?.audio_url,
      audioDuration: voiceover?.duration_ms,
    }
  })

  const handleWaveformClick = (clipStart: number, clipDuration: number, progress: number) => {
    const timeInClip = progress * clipDuration
    const absoluteTime = clipStart + timeInClip
    onSeek(absoluteTime)
  }

  return (
    <div className="relative h-12 bg-background">
      {/* Track label */}
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-muted/50 border-r flex items-center justify-center z-10">
        <span className="text-xs font-medium text-muted-foreground">Audio</span>
      </div>
      
      {/* Audio clips */}
      <div className="ml-20 h-full relative">
        {audioClips.map(({ slideId, start, duration, hasAudio, audioUrl }) => {
          const width = (duration / 1000) * pixelsPerSecond
          const left = (start / 1000) * pixelsPerSecond
          
          // Calculate progress within this clip
          let clipProgress = 0
          if (currentTime >= start && currentTime < start + duration) {
            clipProgress = (currentTime - start) / duration
          } else if (currentTime >= start + duration) {
            clipProgress = 1
          }
          
          return (
            <div
              key={slideId}
              className="absolute top-1 bottom-1 rounded overflow-hidden"
              style={{ 
                left: `${left}px`, 
                width: `${Math.max(width - 2, 20)}px` 
              }}
            >
              {hasAudio && audioUrl ? (
                <AudioWaveform
                  audioUrl={audioUrl}
                  width={Math.max(width - 2, 20)}
                  height={40}
                  isPlaying={isPlaying}
                  progress={clipProgress}
                  onClick={(progress) => handleWaveformClick(start, duration, progress)}
                />
              ) : (
                <div className="w-full h-full bg-muted/30 rounded flex items-center justify-center border border-dashed border-muted-foreground/20">
                  <span className="text-[10px] text-muted-foreground/50">No audio</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

