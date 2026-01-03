import { SlideThumbnail } from './SlideThumbnail'

interface SlideBody {
  layout?: string
  text?: string
  bullets?: string[]
  quote_text?: string
  quote_author?: string
  stats?: Array<{ value: string; label: string }>
  left_label?: string
  right_label?: string
  comparison_left?: string[]
  comparison_right?: string[]
  image_prompt?: string
}

interface Slide {
  id: number
  title: string
  body?: SlideBody
  background_color?: string
  duration_ms?: number
  position: number
}

interface SlidesTrackProps {
  slides: Slide[]
  selectedSlideId: number | null
  pixelsPerSecond: number
  onSlideClick: (slideId: number, index: number) => void
}

export function SlidesTrack({ slides, selectedSlideId, pixelsPerSecond, onSlideClick }: SlidesTrackProps) {
  // Calculate slide positions based on cumulative durations
  let accumulatedTime = 0
  const slidePositions = slides.map((slide) => {
    const start = accumulatedTime
    const duration = slide.duration_ms || 5000
    accumulatedTime += duration
    return { slide, start, duration }
  })

  return (
    <div className="relative h-24 bg-background border-b">
      {/* Track label */}
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-muted/50 border-r flex items-center justify-center z-10">
        <span className="text-xs font-medium text-muted-foreground">Slides</span>
      </div>

      {/* Slides */}
      <div className="ml-20 h-full relative">
        {slidePositions.map(({ slide, start, duration }, index) => {
          const width = (duration / 1000) * pixelsPerSecond
          const left = (start / 1000) * pixelsPerSecond
          const isSelected = slide.id === selectedSlideId

          // Calculate thumbnail size (maintain 16:9 aspect ratio)
          const thumbnailHeight = 68
          const thumbnailWidth = Math.min(120, Math.max(width - 8, 60))

          return (
            <div
              key={slide.id}
              className="absolute top-2 bottom-2 flex flex-col items-center"
              style={{
                left: `${left}px`,
                width: `${Math.max(width - 4, 60)}px`
              }}
            >
              {/* Slide number badge */}
              <div className={`absolute -top-1 left-1/2 -translate-x-1/2 z-10 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted-foreground/80 text-white'
              }`}>
                {index + 1}
              </div>

              {/* Thumbnail */}
              <div
                className={`cursor-pointer transition-all border-2 rounded-md overflow-hidden ${
                  isSelected
                    ? 'border-primary shadow-lg scale-105'
                    : 'border-border hover:border-primary/50 hover:shadow-md'
                }`}
                onClick={() => onSlideClick(slide.id, index)}
              >
                <SlideThumbnail
                  slide={slide}
                  width={thumbnailWidth}
                  height={thumbnailHeight}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

