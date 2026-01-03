import { useEffect, useRef, useState } from 'react'

interface AudioWaveformProps {
  audioUrl: string
  width: number
  height: number
  isPlaying?: boolean
  progress?: number // 0 to 1
  onClick?: (progress: number) => void
}

export function AudioWaveform({
  audioUrl,
  width,
  height,
  isPlaying = false,
  progress = 0,
  onClick,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [peaks, setPeaks] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Generate waveform peaks from audio
  useEffect(() => {
    const generatePeaks = async () => {
      try {
        setIsLoading(true)
        
        const audioContext = new AudioContext()
        const response = await fetch(audioUrl)
        const arrayBuffer = await response.arrayBuffer()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        
        // Get raw audio data
        const rawData = audioBuffer.getChannelData(0)
        const samples = Math.floor(width / 2) // One peak per 2 pixels
        const blockSize = Math.floor(rawData.length / samples)
        const peakData: number[] = []
        
        for (let i = 0; i < samples; i++) {
          const start = i * blockSize
          let max = 0
          
          for (let j = 0; j < blockSize; j++) {
            const amplitude = Math.abs(rawData[start + j] || 0)
            if (amplitude > max) {
              max = amplitude
            }
          }
          
          peakData.push(max)
        }
        
        // Normalize peaks
        const maxPeak = Math.max(...peakData, 0.01)
        const normalizedPeaks = peakData.map(p => p / maxPeak)
        
        setPeaks(normalizedPeaks)
        setIsLoading(false)
        
        await audioContext.close()
      } catch (error) {
        console.error('Failed to generate waveform:', error)
        setIsLoading(false)
      }
    }
    
    if (audioUrl) {
      generatePeaks()
    }
  }, [audioUrl, width])

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || peaks.length === 0) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Set canvas size for retina displays
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height)
    
    // Draw background for the waveform area
    ctx.fillStyle = 'rgba(30, 41, 59, 0.5)' // Dark semi-transparent background
    ctx.fillRect(0, 0, width, height)
    
    const barWidth = 2
    const barGap = 1
    const centerY = height / 2
    const progressX = progress * width
    
    peaks.forEach((peak, i) => {
      const x = i * (barWidth + barGap)
      const barHeight = Math.max(peak * (height - 8), 2) // Minimum bar height of 2px
      
      // Choose color based on playback progress - use bright visible colors
      if (x < progressX) {
        // Played portion - bright blue/cyan
        ctx.fillStyle = '#60a5fa' // blue-400
      } else {
        // Unplayed portion - muted gray-blue
        ctx.fillStyle = 'rgba(148, 163, 184, 0.6)' // slate-400 with opacity
      }
      
      // Draw bar (centered)
      ctx.fillRect(
        x,
        centerY - barHeight / 2,
        barWidth,
        barHeight
      )
    })
  }, [peaks, width, height, progress])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onClick || !canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const clickProgress = x / width
    
    onClick(Math.max(0, Math.min(1, clickProgress)))
  }

  if (isLoading) {
    return (
      <div 
        className="flex items-center justify-center rounded animate-pulse"
        style={{ width, height, background: 'rgba(30, 41, 59, 0.5)' }}
      >
        <div className="flex items-center gap-0.5">
          {[...Array(Math.min(Math.floor(width / 4), 40))].map((_, i) => (
            <div
              key={i}
              className="w-0.5 rounded"
              style={{ 
                height: `${4 + Math.sin(i * 0.5) * 12 + Math.random() * 8}px`,
                background: 'rgba(148, 163, 184, 0.4)'
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, borderRadius: '4px' }}
      className={`cursor-pointer ${isPlaying ? 'opacity-100' : 'opacity-90'}`}
      onClick={handleClick}
    />
  )
}

