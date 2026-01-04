import { useState, useRef, useEffect } from 'react'
import { TimeRuler } from './TimeRuler'
import { Playhead } from './Playhead'
import { SlidesTrack } from './SlidesTrack'
import { AudioTrack } from './AudioTrack'
import { VideoTrack } from './VideoTrack'
import type { TimelineItem } from './VideoTrack'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { 
  Play, 
  Pause, 
  SkipBack, 
  ZoomIn, 
  ZoomOut,
  Volume2,
} from 'lucide-react'

interface Slide {
  id: number
  title: string
  duration_ms?: number
  position: number
}

interface TimelineProps {
  slides: Slide[]
  voiceovers: Map<number, { audio_url: string; duration_ms: number }>
  timelineItems: TimelineItem[]
  selectedSlideId: number | null
  currentTime: number
  isPlaying: boolean
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onSeek: (timeMs: number) => void
  onSlideSelect: (slideId: number) => void
  onAddVideo: (type: 'intro' | 'outro' | 'interstitial', position?: number) => void
  onRemoveVideo: (id: number) => void
  onEditTrim: (item: TimelineItem) => void
}

export function Timeline({
  slides,
  voiceovers,
  timelineItems,
  selectedSlideId,
  currentTime,
  isPlaying,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onSlideSelect,
  onAddVideo,
  onRemoveVideo,
  onEditTrim,
}: TimelineProps) {
  const [pixelsPerSecond, setPixelsPerSecond] = useState(50)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // Calculate total duration (slides only - video track handles its own width)
  const slideDuration = slides.reduce((sum, s) => sum + (s.duration_ms || 5000), 0)
  
  // Include intro/outro in total duration
  const introItem = timelineItems.find(i => i.type === 'intro')
  const outroItem = timelineItems.find(i => i.type === 'outro')
  const introDuration = introItem?.duration_ms || 0
  const outroDuration = outroItem?.duration_ms || 0
  
  const totalDuration = introDuration + slideDuration + outroDuration
  const totalWidth = (totalDuration / 1000) * pixelsPerSecond

  // Format time display
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Auto-scroll to keep playhead in view during playback
  useEffect(() => {
    if (!isPlaying || !scrollContainerRef.current) return
    
    const container = scrollContainerRef.current
    const playheadPosition = (currentTime / 1000) * pixelsPerSecond + 80 // +80 for label width
    const containerWidth = container.clientWidth
    const scrollLeft = container.scrollLeft
    
    // If playhead is near the right edge, scroll to keep it in view
    if (playheadPosition > scrollLeft + containerWidth - 100) {
      container.scrollTo({
        left: playheadPosition - containerWidth / 2,
        behavior: 'smooth'
      })
    }
  }, [currentTime, isPlaying, pixelsPerSecond])

  const handleSlideClick = (slideId: number, index: number) => {
    onSlideSelect(slideId)
    
    // Calculate time at start of this slide
    let time = 0
    for (let i = 0; i < index; i++) {
      time += slides[i].duration_ms || 5000
    }
    onSeek(time)
  }

  const handleZoomIn = () => {
    setPixelsPerSecond(Math.min(200, pixelsPerSecond + 20))
  }

  const handleZoomOut = () => {
    setPixelsPerSecond(Math.max(10, pixelsPerSecond - 20))
  }

  // Height calculations for tracks
  const rulerHeight = 24
  const videoTrackHeight = 48   // h-12
  const slidesTrackHeight = 64  // h-16
  const audioTrackHeight = 48   // h-12
  const totalTrackHeight = rulerHeight + videoTrackHeight + slidesTrackHeight + audioTrackHeight

  // Handle click on the timeline background to seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    // Only seek if clicking on the background, not on interactive elements
    if (target.closest('button') || target.closest('[data-no-seek]')) return
    
    const container = e.currentTarget
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left - 80 // Account for the 80px label width
    if (x < 0) return // Clicked on the label area
    
    const timeMs = (x / pixelsPerSecond) * 1000
    const clampedTime = Math.max(0, Math.min(timeMs, totalDuration))
    onSeek(clampedTime)
  }

  return (
    <div className="h-full flex flex-col bg-muted/30 border-t">
      {/* Transport Controls */}
      <div className="px-4 py-2 border-b bg-background flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8"
            onClick={onStop}
            title="Stop and return to start"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button 
            variant={isPlaying ? "default" : "outline"} 
            size="icon"
            className="h-8 w-8"
            onClick={isPlaying ? onPause : onPlay}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        </div>
        
        {/* Time display */}
        <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-1">
          <span className="text-sm font-mono">
            {formatTime(currentTime)}
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-mono text-muted-foreground">
            {formatTime(totalDuration)}
          </span>
        </div>
        
        <div className="flex-1" />
        
        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleZoomOut}
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <div className="w-24">
            <Slider
              value={[pixelsPerSecond]}
              min={10}
              max={200}
              step={10}
              onValueChange={([value]) => setPixelsPerSecond(value)}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleZoomIn}
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground w-12">
            {pixelsPerSecond}px/s
          </span>
        </div>
        
        {/* Stats */}
        <span className="text-xs text-muted-foreground">
          {slides.length} slide{slides.length !== 1 ? 's' : ''} • {Math.round(totalDuration / 1000)}s
        </span>
      </div>
      
      {/* Timeline tracks */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto overflow-y-auto relative cursor-pointer"
        onClick={handleTimelineClick}
      >
        <div 
          style={{ minWidth: `${totalWidth + 100}px`, minHeight: `${totalTrackHeight}px` }} 
          className="relative"
        >
          {/* Time ruler */}
          <div className="ml-20 h-6 border-b border-border bg-muted/20">
            <TimeRuler
              duration={totalDuration}
              pixelsPerSecond={pixelsPerSecond}
            />
          </div>
          
          {/* Video track */}
          <VideoTrack
            timelineItems={timelineItems}
            totalSlideDuration={slideDuration}
            pixelsPerSecond={pixelsPerSecond}
            onAddVideo={onAddVideo}
            onRemoveVideo={onRemoveVideo}
            onEditTrim={onEditTrim}
          />
          
          {/* Slides track */}
          <SlidesTrack
            slides={slides}
            selectedSlideId={selectedSlideId}
            pixelsPerSecond={pixelsPerSecond}
            onSlideClick={handleSlideClick}
          />
          
          {/* Audio track */}
          <AudioTrack
            slides={slides}
            voiceovers={voiceovers}
            currentTime={currentTime}
            pixelsPerSecond={pixelsPerSecond}
            isPlaying={isPlaying}
            onSeek={onSeek}
          />
          
          {/* Playhead - spans all tracks */}
          <div className="absolute top-0 left-20 pointer-events-auto" style={{ height: `${totalTrackHeight}px` }}>
            <Playhead
              currentTime={currentTime}
              duration={totalDuration}
              pixelsPerSecond={pixelsPerSecond}
              height={totalTrackHeight}
              onSeek={onSeek}
            />
          </div>
        </div>
        
        {/* Empty state */}
        {slides.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm pointer-events-none">
            No slides yet. Add a slide to get started.
          </div>
        )}
      </div>
    </div>
  )
}

