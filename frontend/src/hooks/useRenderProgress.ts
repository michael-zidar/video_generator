import { useState, useCallback, useRef, useEffect } from 'react'

type RenderStatus = 
  | 'idle'
  | 'connecting'
  | 'progress'
  | 'complete'
  | 'error'
  | 'canceled'

interface RenderProgressState {
  status: RenderStatus
  progress: number
  message: string
  step: string
  outputPath: string | null
  fileSize: number | null
  error: string | null
}

interface UseRenderProgressReturn extends RenderProgressState {
  connect: (renderId: number) => void
  disconnect: () => void
  reset: () => void
}

const initialState: RenderProgressState = {
  status: 'idle',
  progress: 0,
  message: '',
  step: '',
  outputPath: null,
  fileSize: null,
  error: null,
}

/**
 * Hook for managing WebSocket connection to render progress updates
 */
export function useRenderProgress(): UseRenderProgressReturn {
  const [state, setState] = useState<RenderProgressState>(initialState)
  const wsRef = useRef<WebSocket | null>(null)
  const renderIdRef = useRef<number | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  // Clean up function
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    renderIdRef.current = null
    reconnectAttemptsRef.current = 0
  }, [])

  // Connect to WebSocket
  const connect = useCallback((renderId: number) => {
    cleanup()
    renderIdRef.current = renderId
    
    setState(prev => ({
      ...prev,
      status: 'connecting',
      progress: 0,
      message: 'Connecting...',
      error: null,
    }))

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = import.meta.env.DEV ? '3001' : window.location.port
    const wsUrl = `${protocol}//${host}:${port}/ws`

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected, subscribing to render:', renderId)
        reconnectAttemptsRef.current = 0
        
        // Subscribe to render updates
        ws.send(JSON.stringify({
          type: 'subscribe',
          renderId,
        }))

        setState(prev => ({
          ...prev,
          status: 'progress',
          message: 'Starting render...',
        }))
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('WebSocket message:', data)

          switch (data.type) {
            case 'subscribed':
              console.log('Subscribed to render:', data.renderId)
              break

            case 'progress':
              setState(prev => ({
                ...prev,
                status: 'progress',
                progress: data.percent || prev.progress,
                message: data.message || prev.message,
                step: data.step || prev.step,
              }))
              break

            case 'complete':
              setState(prev => ({
                ...prev,
                status: 'complete',
                progress: 100,
                message: data.message || 'Render complete!',
                outputPath: data.outputPath,
                fileSize: data.fileSize,
              }))
              cleanup()
              break

            case 'error':
              setState(prev => ({
                ...prev,
                status: 'error',
                error: data.error || 'Render failed',
              }))
              cleanup()
              break

            case 'canceled':
              setState(prev => ({
                ...prev,
                status: 'canceled',
                message: 'Render canceled',
              }))
              cleanup()
              break
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e)
        }
      }

      ws.onerror = (event) => {
        console.error('WebSocket error:', event)
      }

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason)
        
        // Only attempt reconnect if we still have an active render
        if (
          renderIdRef.current && 
          reconnectAttemptsRef.current < maxReconnectAttempts &&
          state.status === 'progress'
        ) {
          reconnectAttemptsRef.current++
          const delay = Math.min(1000 * reconnectAttemptsRef.current, 5000)
          
          console.log(`Attempting reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (renderIdRef.current) {
              connect(renderIdRef.current)
            }
          }, delay)
        }
      }
    } catch (e) {
      console.error('Failed to create WebSocket:', e)
      setState(prev => ({
        ...prev,
        status: 'error',
        error: 'Failed to connect to server',
      }))
    }
  }, [cleanup, state.status])

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe' }))
    }
    cleanup()
  }, [cleanup])

  // Reset state
  const reset = useCallback(() => {
    cleanup()
    setState(initialState)
  }, [cleanup])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  return {
    ...state,
    connect,
    disconnect,
    reset,
  }
}

