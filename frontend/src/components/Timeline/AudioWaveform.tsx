import { useEffect, useRef, useState } from 'react'

interface AudioWaveformProps {
  audioUrl: string
  width: number
  height: number
  isPlaying?: boolean
  progress?: number // 0 to 1
  primaryColor?: string
  secondaryColor?: string
  onClick?: (progress: number) => void
}

export function AudioWaveform({
  audioUrl,
  width,
  height,
  isPlaying = false,
  progress = 0,
  primaryColor = 'hsl(var(--primary))',
  secondaryColor = 'hsl(var(--muted-foreground) / 0.3)',
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
    
    const barWidth = 2
    const barGap = 1
    const centerY = height / 2
    const progressX = progress * width
    
    peaks.forEach((peak, i) => {
      const x = i * (barWidth + barGap)
      const barHeight = peak * (height - 4)
      
      // Choose color based on playback progress
      ctx.fillStyle = x < progressX ? primaryColor : secondaryColor
      
      // Draw bar (centered)
      ctx.fillRect(
        x,
        centerY - barHeight / 2,
        barWidth,
        barHeight
      )
    })
  }, [peaks, width, height, progress, primaryColor, secondaryColor])

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
        className="flex items-center justify-center bg-muted/30 rounded animate-pulse"
        style={{ width, height }}
      >
        <div className="flex gap-0.5">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="w-0.5 bg-muted-foreground/20 rounded"
              style={{ height: `${20 + Math.random() * 20}px` }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className={`cursor-pointer ${isPlaying ? 'opacity-100' : 'opacity-80'}`}
      onClick={handleClick}
    />
  )
}

