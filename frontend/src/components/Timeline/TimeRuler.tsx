import { useMemo } from 'react'

interface TimeRulerProps {
  duration: number // Total duration in ms
  pixelsPerSecond: number
  offset?: number // Scroll offset in pixels
}

export function TimeRuler({ duration, pixelsPerSecond, offset = 0 }: TimeRulerProps) {
  const markers = useMemo(() => {
    const result: { time: number; label: string; isMajor: boolean }[] = []
    const durationSeconds = duration / 1000
    
    // Determine tick interval based on zoom level
    let majorInterval: number
    let minorInterval: number
    
    if (pixelsPerSecond >= 100) {
      majorInterval = 5
      minorInterval = 1
    } else if (pixelsPerSecond >= 50) {
      majorInterval = 10
      minorInterval = 2
    } else if (pixelsPerSecond >= 20) {
      majorInterval = 15
      minorInterval = 5
    } else {
      majorInterval = 30
      minorInterval = 10
    }
    
    for (let t = 0; t <= durationSeconds; t += minorInterval) {
      const isMajor = t % majorInterval === 0
      const minutes = Math.floor(t / 60)
      const seconds = Math.floor(t % 60)
      const label = isMajor ? `${minutes}:${seconds.toString().padStart(2, '0')}` : ''
      
      result.push({ time: t, label, isMajor })
    }
    
    return result
  }, [duration, pixelsPerSecond])

  const totalWidth = (duration / 1000) * pixelsPerSecond

  return (
    <div 
      className="relative h-6 bg-muted/50 border-b select-none"
      style={{ width: `${totalWidth}px`, marginLeft: offset }}
    >
      {markers.map(({ time, label, isMajor }) => (
        <div
          key={time}
          className="absolute top-0 flex flex-col items-center"
          style={{ left: `${time * pixelsPerSecond}px` }}
        >
          <div 
            className={`w-px ${isMajor ? 'h-4 bg-foreground/60' : 'h-2 bg-foreground/30'}`}
            style={{ marginTop: isMajor ? '0' : '8px' }}
          />
          {label && (
            <span className="text-[10px] text-muted-foreground font-mono absolute top-1 left-1">
              {label}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

