import { useRef, useCallback } from 'react'
import { Video, Plus, Trash2, Film, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface TimelineItem {
  id: number
  deck_id: number
  type: 'intro' | 'outro' | 'interstitial'
  asset_id: number
  position: number
  start_time_ms: number
  end_time_ms: number | null
  duration_ms: number
  filename?: string
  storage_path?: string
}

interface VideoTrackProps {
  timelineItems: TimelineItem[]
  totalSlideDuration: number
  pixelsPerSecond: number
  onAddVideo: (type: 'intro' | 'outro' | 'interstitial', position?: number) => void
  onRemoveVideo: (id: number) => void
  onEditTrim: (item: TimelineItem) => void
}

export function VideoTrack({
  timelineItems,
  totalSlideDuration,
  pixelsPerSecond,
  onAddVideo,
  onRemoveVideo,
  onEditTrim,
}: VideoTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null)

  const introVideo = timelineItems.find((i) => i.type === 'intro')
  const outroVideo = timelineItems.find((i) => i.type === 'outro')
  const interstitials = timelineItems.filter((i) => i.type === 'interstitial')

  // Calculate total width including intro/outro
  const introWidth = introVideo ? (introVideo.duration_ms / 1000) * pixelsPerSecond : 0
  const outroWidth = outroVideo ? (outroVideo.duration_ms / 1000) * pixelsPerSecond : 0
  const slidesWidth = (totalSlideDuration / 1000) * pixelsPerSecond
  const totalWidth = introWidth + slidesWidth + outroWidth

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const renderVideoClip = (
    item: TimelineItem,
    left: number,
    width: number,
    label: string,
    color: string
  ) => (
    <div
      key={item.id}
      className={`absolute top-1 bottom-1 rounded ${color} border border-white/20 flex items-center justify-between px-2 group cursor-pointer transition-all hover:brightness-110`}
      style={{ left: `${left}px`, width: `${Math.max(width - 2, 40)}px` }}
      title={`${label}: ${item.filename || 'Video'} (${formatDuration(item.duration_ms)})`}
    >
      <div className="flex items-center gap-1 min-w-0">
        <Film className="h-3 w-3 shrink-0 text-white/80" />
        <span className="text-[10px] text-white font-medium truncate">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-white/80 hover:text-white hover:bg-white/20"
          onClick={(e) => {
            e.stopPropagation()
            onEditTrim(item)
          }}
        >
          <Scissors className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-white/80 hover:text-red-300 hover:bg-white/20"
          onClick={(e) => {
            e.stopPropagation()
            onRemoveVideo(item.id)
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )

  const renderAddButton = (type: 'intro' | 'outro', position: 'left' | 'right') => {
    const isIntro = type === 'intro'
    const hasVideo = isIntro ? !!introVideo : !!outroVideo
    
    if (hasVideo) return null

    return (
      <button
        onClick={() => onAddVideo(type)}
        className={`absolute ${position === 'left' ? 'left-0' : 'right-0'} top-1 bottom-1 w-12 border-2 border-dashed border-muted-foreground/30 rounded bg-muted/20 hover:bg-muted/40 hover:border-muted-foreground/50 transition-colors flex flex-col items-center justify-center gap-0.5`}
        title={`Add ${isIntro ? 'intro' : 'outro'} video`}
      >
        <Plus className="h-3 w-3 text-muted-foreground" />
        <span className="text-[8px] text-muted-foreground uppercase">
          {isIntro ? 'Intro' : 'Outro'}
        </span>
      </button>
    )
  }

  return (
    <div className="relative h-12 bg-background border-b">
      {/* Track label */}
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-muted/50 border-r flex items-center justify-center z-10">
        <div className="flex items-center gap-1.5">
          <Video className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Video</span>
        </div>
      </div>

      {/* Track content */}
      <div ref={trackRef} className="ml-20 h-full relative" style={{ minWidth: `${totalWidth + 100}px` }}>
        {/* Intro zone */}
        <div 
          className="absolute top-0 bottom-0 bg-violet-500/10 border-r border-violet-500/20"
          style={{ 
            left: 0, 
            width: introVideo ? `${introWidth}px` : '48px'
          }}
        >
          {introVideo ? (
            renderVideoClip(introVideo, 0, introWidth, 'Intro', 'bg-violet-600')
          ) : (
            renderAddButton('intro', 'left')
          )}
        </div>

        {/* Slides zone - just shows where slides are */}
        <div 
          className="absolute top-0 bottom-0"
          style={{ 
            left: introVideo ? `${introWidth}px` : '48px',
            width: `${slidesWidth}px`
          }}
        >
          {/* Interstitial markers would go here */}
          {interstitials.map((item) => {
            // Calculate position based on where the interstitial is positioned
            const positionMs = item.position * 5000 // Approximate position
            const left = (positionMs / 1000) * pixelsPerSecond
            const width = (item.duration_ms / 1000) * pixelsPerSecond
            
            return renderVideoClip(item, left, width, `Clip ${item.position + 1}`, 'bg-cyan-600')
          })}
        </div>

        {/* Outro zone */}
        <div 
          className="absolute top-0 bottom-0 bg-orange-500/10 border-l border-orange-500/20"
          style={{ 
            left: (introVideo ? introWidth : 48) + slidesWidth,
            width: outroVideo ? `${outroWidth}px` : '48px'
          }}
        >
          {outroVideo ? (
            renderVideoClip(outroVideo, 0, outroWidth, 'Outro', 'bg-orange-600')
          ) : (
            renderAddButton('outro', 'right')
          )}
        </div>

        {/* Add interstitial dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Clip
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAddVideo('intro')}>
              <Film className="h-4 w-4 mr-2" />
              Add Intro Video
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddVideo('outro')}>
              <Film className="h-4 w-4 mr-2" />
              Add Outro Video
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddVideo('interstitial', 0)}>
              <Video className="h-4 w-4 mr-2" />
              Add Interstitial Clip
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

