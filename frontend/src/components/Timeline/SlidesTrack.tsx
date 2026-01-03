interface Slide {
  id: number
  title: string
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
    <div className="relative h-16 bg-background border-b">
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
          
          return (
            <div
              key={slide.id}
              className={`absolute top-2 bottom-2 rounded-md cursor-pointer transition-all border-2 flex items-center justify-center overflow-hidden ${
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-md'
                  : 'bg-muted hover:bg-muted/80 border-border hover:border-primary/50'
              }`}
              style={{ 
                left: `${left}px`, 
                width: `${Math.max(width - 4, 20)}px` 
              }}
              onClick={() => onSlideClick(slide.id, index)}
            >
              <div className="flex flex-col items-center justify-center px-2 min-w-0">
                <span className="font-semibold text-sm">{index + 1}</span>
                {width > 60 && (
                  <span className={`text-[9px] truncate max-w-full ${
                    isSelected ? 'opacity-80' : 'text-muted-foreground'
                  }`}>
                    {slide.title || 'Untitled'}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

