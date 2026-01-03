import { useRef, useState, useCallback, useEffect } from 'react'

interface AudioClip {
  slideId: number
  url: string
  startTime: number // Start time in ms relative to timeline
  duration: number // Duration in ms
}

interface UseAudioPlaybackOptions {
  onTimeUpdate?: (timeMs: number) => void
  onSlideChange?: (slideId: number) => void
  onPlaybackEnd?: () => void
}

interface UseAudioPlaybackReturn {
  isPlaying: boolean
  currentTime: number
  duration: number
  isLoading: boolean
  loadClips: (clips: AudioClip[]) => Promise<void>
  play: () => void
  pause: () => void
  stop: () => void
  seekTo: (timeMs: number) => void
  playFromTime: (timeMs: number) => void
}

// Singleton AudioContext to avoid multiple contexts
let globalAudioContext: AudioContext | null = null

const getAudioContext = (): AudioContext => {
  if (!globalAudioContext) {
    globalAudioContext = new AudioContext()
  }
  return globalAudioContext
}

export function useAudioPlayback(options: UseAudioPlaybackOptions = {}): UseAudioPlaybackReturn {
  const { onTimeUpdate, onSlideChange, onPlaybackEnd } = options

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  // Audio buffer cache: slideId -> AudioBuffer
  const bufferCache = useRef<Map<number, AudioBuffer>>(new Map())
  
  // Clips metadata
  const clipsRef = useRef<AudioClip[]>([])
  
  // Currently playing sources
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([])
  
  // Gain node for volume control
  const gainNodeRef = useRef<GainNode | null>(null)
  
  // Playback timing
  const playbackStartTimeRef = useRef<number>(0)
  const playbackOffsetRef = useRef<number>(0)
  
  // Animation frame for time updates
  const animationFrameRef = useRef<number | null>(null)
  
  // Current slide tracking
  const currentSlideIdRef = useRef<number | null>(null)

  // Fetch and decode audio file
  const fetchAudioBuffer = useCallback(async (url: string): Promise<AudioBuffer> => {
    const audioContext = getAudioContext()
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    return await audioContext.decodeAudioData(arrayBuffer)
  }, [])

  // Load all audio clips
  const loadClips = useCallback(async (clips: AudioClip[]) => {
    setIsLoading(true)
    clipsRef.current = clips

    // Calculate total duration
    let totalDuration = 0
    for (const clip of clips) {
      totalDuration = Math.max(totalDuration, clip.startTime + clip.duration)
    }
    setDuration(totalDuration)

    // Fetch and cache all audio buffers
    const audioContext = getAudioContext()
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    await Promise.all(
      clips.map(async (clip) => {
        if (!bufferCache.current.has(clip.slideId)) {
          try {
            const buffer = await fetchAudioBuffer(clip.url)
            bufferCache.current.set(clip.slideId, buffer)
          } catch (error) {
            console.error(`Failed to load audio for slide ${clip.slideId}:`, error)
          }
        }
      })
    )

    setIsLoading(false)
  }, [fetchAudioBuffer])

  // Stop all currently playing sources
  const stopAllSources = useCallback(() => {
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop()
        source.disconnect()
      } catch (e) {
        // Source may already be stopped
      }
    })
    activeSourcesRef.current = []
  }, [])

  // Find which slide should be active at a given time
  const getSlideAtTime = useCallback((timeMs: number): number | null => {
    for (const clip of clipsRef.current) {
      if (timeMs >= clip.startTime && timeMs < clip.startTime + clip.duration) {
        return clip.slideId
      }
    }
    return null
  }, [])

  // Time update loop
  const updateTime = useCallback(() => {
    if (!isPlaying) return

    const audioContext = getAudioContext()
    const elapsed = (audioContext.currentTime - playbackStartTimeRef.current) * 1000
    const newTime = playbackOffsetRef.current + elapsed

    if (newTime >= duration) {
      // Playback ended
      setIsPlaying(false)
      setCurrentTime(duration)
      stopAllSources()
      onPlaybackEnd?.()
      return
    }

    setCurrentTime(newTime)
    onTimeUpdate?.(newTime)

    // Check for slide change
    const slideId = getSlideAtTime(newTime)
    if (slideId !== null && slideId !== currentSlideIdRef.current) {
      currentSlideIdRef.current = slideId
      onSlideChange?.(slideId)
    }

    animationFrameRef.current = requestAnimationFrame(updateTime)
  }, [isPlaying, duration, onTimeUpdate, onSlideChange, onPlaybackEnd, getSlideAtTime, stopAllSources])

  // Start playback from a specific time
  const playFromTime = useCallback((timeMs: number) => {
    const audioContext = getAudioContext()
    
    // Resume context if suspended
    if (audioContext.state === 'suspended') {
      audioContext.resume()
    }

    // Stop any currently playing sources
    stopAllSources()

    // Create gain node if needed
    if (!gainNodeRef.current) {
      gainNodeRef.current = audioContext.createGain()
      gainNodeRef.current.connect(audioContext.destination)
    }

    // Schedule all clips that should be playing
    const now = audioContext.currentTime
    playbackStartTimeRef.current = now
    playbackOffsetRef.current = timeMs

    for (const clip of clipsRef.current) {
      const buffer = bufferCache.current.get(clip.slideId)
      if (!buffer) continue

      const clipStart = clip.startTime
      const clipEnd = clip.startTime + clip.duration

      // Skip clips that end before our start time
      if (clipEnd <= timeMs) continue

      // Skip clips that haven't started yet (will be scheduled)
      if (clipStart > timeMs) {
        // Schedule for later
        const delaySeconds = (clipStart - timeMs) / 1000
        const source = audioContext.createBufferSource()
        source.buffer = buffer
        source.connect(gainNodeRef.current!)
        source.start(now + delaySeconds)
        activeSourcesRef.current.push(source)
      } else {
        // Clip is currently playing - start from offset
        const offsetMs = timeMs - clipStart
        const offsetSeconds = offsetMs / 1000
        const source = audioContext.createBufferSource()
        source.buffer = buffer
        source.connect(gainNodeRef.current!)
        source.start(now, offsetSeconds)
        activeSourcesRef.current.push(source)
      }
    }

    setCurrentTime(timeMs)
    setIsPlaying(true)

    // Start the time update loop
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    animationFrameRef.current = requestAnimationFrame(updateTime)
  }, [stopAllSources, updateTime])

  // Play from current position
  const play = useCallback(() => {
    playFromTime(currentTime)
  }, [currentTime, playFromTime])

  // Pause playback
  const pause = useCallback(() => {
    if (!isPlaying) return

    const audioContext = getAudioContext()
    const elapsed = (audioContext.currentTime - playbackStartTimeRef.current) * 1000
    const pausedTime = playbackOffsetRef.current + elapsed

    stopAllSources()
    setIsPlaying(false)
    setCurrentTime(pausedTime)

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [isPlaying, stopAllSources])

  // Stop playback and reset to beginning
  const stop = useCallback(() => {
    stopAllSources()
    setIsPlaying(false)
    setCurrentTime(0)
    playbackOffsetRef.current = 0

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [stopAllSources])

  // Seek to a specific time
  const seekTo = useCallback((timeMs: number) => {
    const clampedTime = Math.max(0, Math.min(timeMs, duration))
    
    if (isPlaying) {
      // If playing, restart from new position
      playFromTime(clampedTime)
    } else {
      // If paused, just update the time
      setCurrentTime(clampedTime)
      playbackOffsetRef.current = clampedTime
    }

    // Update current slide
    const slideId = getSlideAtTime(clampedTime)
    if (slideId !== null && slideId !== currentSlideIdRef.current) {
      currentSlideIdRef.current = slideId
      onSlideChange?.(slideId)
    }
  }, [duration, isPlaying, playFromTime, getSlideAtTime, onSlideChange])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllSources()
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [stopAllSources])

  // Update time loop when playing state changes
  useEffect(() => {
    if (isPlaying && !animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateTime)
    }
  }, [isPlaying, updateTime])

  return {
    isPlaying,
    currentTime,
    duration,
    isLoading,
    loadClips,
    play,
    pause,
    stop,
    seekTo,
    playFromTime,
  }
}

