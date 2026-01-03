import { useState, useRef, useCallback, useEffect } from 'react'

interface PlayheadProps {
  currentTime: number // Current time in ms
  duration: number // Total duration in ms
  pixelsPerSecond: number
  height: number // Total height of tracks
  onSeek: (timeMs: number) => void
}

export function Playhead({ currentTime, duration, pixelsPerSecond, height, onSeek }: PlayheadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragTime, setDragTime] = useState(currentTime)
  const playheadRef = useRef<HTMLDivElement>(null)
  
  const timeToDisplay = isDragging ? dragTime : currentTime
  const position = (timeToDisplay / 1000) * pixelsPerSecond
  
  // Format time as M:SS.s
  const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = (totalSeconds % 60).toFixed(1)
    return `${minutes}:${parseFloat(seconds) < 10 ? '0' : ''}${seconds}`
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    setDragTime(currentTime)
  }, [currentTime])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !playheadRef.current) return
    
    const container = playheadRef.current.parentElement
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const timeMs = (x / pixelsPerSecond) * 1000
    const clampedTime = Math.max(0, Math.min(timeMs, duration))
    
    setDragTime(clampedTime)
  }, [isDragging, pixelsPerSecond, duration])

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      onSeek(dragTime)
      setIsDragging(false)
    }
  }, [isDragging, dragTime, onSeek])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return (
    <div
      ref={playheadRef}
      className="absolute top-0 z-30 cursor-ew-resize group"
      style={{ 
        left: `${position}px`,
        height: `${height}px`,
        transform: 'translateX(-50%)'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Playhead line - thicker and more visible */}
      <div className="w-[3px] h-full bg-red-500 shadow-lg" style={{ boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)' }} />
      
      {/* Playhead handle - triangle at top */}
      <div 
        className="absolute -top-0 left-1/2 -translate-x-1/2"
        style={{
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '10px solid rgb(239 68 68)',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
        }}
      />
      
      {/* Wider hit area for easier dragging */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-full" />
      
      {/* Time tooltip */}
      <div 
        className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-red-500 text-white text-xs font-mono font-bold rounded shadow-lg whitespace-nowrap transition-opacity ${
          isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {formatTime(timeToDisplay)}
      </div>
    </div>
  )
}

