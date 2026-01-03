import { useState, useRef, useEffect } from 'react'
import { Rnd, RndResizeCallback, RndDragCallback } from 'react-rnd'
import { SlideElement } from '@/types/slide'

interface CanvasElementProps {
  element: SlideElement
  isSelected: boolean
  canvasWidth: number
  canvasHeight: number
  onSelect: (id: string) => void
  onMove: (id: string, x: number, y: number) => void
  onResize: (id: string, width: number, height: number, x: number, y: number) => void
  onDoubleClick?: (id: string) => void
  children: React.ReactNode
}

export function CanvasElement({
  element,
  isSelected,
  canvasWidth,
  canvasHeight,
  onSelect,
  onMove,
  onResize,
  onDoubleClick,
  children,
}: CanvasElementProps) {
  const rndRef = useRef<Rnd>(null)

  // Convert percentage to pixels
  const pixelX = (element.x / 100) * canvasWidth
  const pixelY = (element.y / 100) * canvasHeight
  const pixelWidth = (element.width / 100) * canvasWidth
  const pixelHeight = (element.height / 100) * canvasHeight

  const handleDragStop: RndDragCallback = (_e, data) => {
    // Convert pixels back to percentage
    const newX = (data.x / canvasWidth) * 100
    const newY = (data.y / canvasHeight) * 100
    onMove(element.id, newX, newY)
  }

  const handleResizeStop: RndResizeCallback = (
    _e, 
    _dir, 
    ref, 
    _delta, 
    position
  ) => {
    // Convert pixels back to percentage
    const newWidth = (ref.offsetWidth / canvasWidth) * 100
    const newHeight = (ref.offsetHeight / canvasHeight) * 100
    const newX = (position.x / canvasWidth) * 100
    const newY = (position.y / canvasHeight) * 100
    onResize(element.id, newWidth, newHeight, newX, newY)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(element.id)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDoubleClick?.(element.id)
  }

  return (
    <Rnd
      ref={rndRef}
      position={{ x: pixelX, y: pixelY }}
      size={{ width: pixelWidth, height: pixelHeight }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      disableDragging={element.locked}
      enableResizing={!element.locked && isSelected}
      bounds="parent"
      minWidth={20}
      minHeight={20}
      style={{
        zIndex: element.zIndex,
        transform: element.rotation !== 0 ? `rotate(${element.rotation}deg)` : undefined,
      }}
      resizeHandleStyles={{
        top: { cursor: 'n-resize' },
        right: { cursor: 'e-resize' },
        bottom: { cursor: 's-resize' },
        left: { cursor: 'w-resize' },
        topRight: { cursor: 'ne-resize' },
        bottomRight: { cursor: 'se-resize' },
        bottomLeft: { cursor: 'sw-resize' },
        topLeft: { cursor: 'nw-resize' },
      }}
      resizeHandleComponent={{
        topLeft: isSelected ? <ResizeHandle position="topLeft" /> : undefined,
        topRight: isSelected ? <ResizeHandle position="topRight" /> : undefined,
        bottomLeft: isSelected ? <ResizeHandle position="bottomLeft" /> : undefined,
        bottomRight: isSelected ? <ResizeHandle position="bottomRight" /> : undefined,
      }}
    >
      <div
        className={`w-full h-full relative ${
          isSelected 
            ? 'ring-2 ring-primary ring-offset-1' 
            : 'hover:ring-1 hover:ring-primary/50'
        } ${element.locked ? 'cursor-not-allowed' : 'cursor-move'}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {children}
        
        {/* Lock indicator */}
        {element.locked && (
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-muted rounded-full flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        )}
      </div>
    </Rnd>
  )
}

// Resize handle component
function ResizeHandle({ position }: { position: string }) {
  const positionStyles: Record<string, React.CSSProperties> = {
    topLeft: { top: -4, left: -4 },
    topRight: { top: -4, right: -4 },
    bottomLeft: { bottom: -4, left: -4 },
    bottomRight: { bottom: -4, right: -4 },
  }

  return (
    <div
      className="absolute w-3 h-3 bg-white border-2 border-primary rounded-sm shadow-sm"
      style={positionStyles[position]}
    />
  )
}

