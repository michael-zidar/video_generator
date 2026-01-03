import { useState, useRef, useCallback, useMemo } from 'react'
import type { SlideElement, TextElement as TextElementType, ImageElement as ImageElementType } from '@/types/slide'
import { createTextElement, createImageElement, generateElementId } from '@/types/slide'
import { CanvasElement } from './CanvasElement'
import { TextElement } from './TextElement'
import { ImageElement } from './ImageElement'
import { ElementToolbar } from './ElementToolbar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, Type, Image, Square } from 'lucide-react'

interface SlideCanvasProps {
  elements: SlideElement[]
  backgroundColor?: string
  backgroundImage?: string
  canvasWidth: number
  canvasHeight: number
  zoom: number
  onElementsChange: (elements: SlideElement[]) => void
  showGrid?: boolean
}

export function SlideCanvas({
  elements,
  backgroundColor = '#ffffff',
  backgroundImage,
  canvasWidth,
  canvasHeight,
  zoom,
  onElementsChange,
  showGrid = false,
}: SlideCanvasProps) {
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [editingElementId, setEditingElementId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Calculate scale for text rendering
  const baseWidth = 1920 // Design width
  const scale = canvasWidth / baseWidth

  // Find selected element
  const selectedElement = useMemo(
    () => elements.find(el => el.id === selectedElementId),
    [elements, selectedElementId]
  )

  // Handle canvas click to deselect
  const handleCanvasClick = useCallback(() => {
    setSelectedElementId(null)
    setEditingElementId(null)
  }, [])

  // Handle element selection
  const handleElementSelect = useCallback((id: string) => {
    setSelectedElementId(id)
    if (editingElementId !== id) {
      setEditingElementId(null)
    }
  }, [editingElementId])

  // Handle element move
  const handleElementMove = useCallback((id: string, x: number, y: number) => {
    const newElements = elements.map(el => 
      el.id === id ? { ...el, x, y } : el
    )
    onElementsChange(newElements)
  }, [elements, onElementsChange])

  // Handle element resize
  const handleElementResize = useCallback((id: string, width: number, height: number, x: number, y: number) => {
    const newElements = elements.map(el => 
      el.id === id ? { ...el, width, height, x, y } : el
    )
    onElementsChange(newElements)
  }, [elements, onElementsChange])

  // Handle element double-click (for editing)
  const handleElementDoubleClick = useCallback((id: string) => {
    const element = elements.find(el => el.id === id)
    if (element?.type === 'text' && !element.locked) {
      setEditingElementId(id)
    }
  }, [elements])

  // Handle text content change
  const handleTextContentChange = useCallback((id: string, content: string) => {
    const newElements = elements.map(el => 
      el.id === id && el.type === 'text' 
        ? { ...el, content } as TextElementType
        : el
    )
    onElementsChange(newElements)
  }, [elements, onElementsChange])

  // Handle element update (from toolbar)
  const handleElementUpdate = useCallback((updates: Partial<SlideElement>) => {
    if (!selectedElementId) return
    const newElements = elements.map(el => 
      el.id === selectedElementId ? { ...el, ...updates } : el
    )
    onElementsChange(newElements)
  }, [elements, selectedElementId, onElementsChange])

  // Handle element delete
  const handleElementDelete = useCallback(() => {
    if (!selectedElementId) return
    const newElements = elements.filter(el => el.id !== selectedElementId)
    onElementsChange(newElements)
    setSelectedElementId(null)
  }, [elements, selectedElementId, onElementsChange])

  // Handle element duplicate
  const handleElementDuplicate = useCallback(() => {
    if (!selectedElement) return
    const newElement: SlideElement = {
      ...selectedElement,
      id: generateElementId(),
      x: selectedElement.x + 2,
      y: selectedElement.y + 2,
    }
    onElementsChange([...elements, newElement])
    setSelectedElementId(newElement.id)
  }, [elements, selectedElement, onElementsChange])

  // Handle layer order
  const handleBringForward = useCallback(() => {
    if (!selectedElementId) return
    const index = elements.findIndex(el => el.id === selectedElementId)
    if (index < elements.length - 1) {
      const newElements = [...elements]
      const temp = newElements[index]
      newElements[index] = newElements[index + 1]
      newElements[index + 1] = temp
      // Update zIndex
      newElements.forEach((el, i) => {
        el.zIndex = i
      })
      onElementsChange(newElements)
    }
  }, [elements, selectedElementId, onElementsChange])

  const handleSendBackward = useCallback(() => {
    if (!selectedElementId) return
    const index = elements.findIndex(el => el.id === selectedElementId)
    if (index > 0) {
      const newElements = [...elements]
      const temp = newElements[index]
      newElements[index] = newElements[index - 1]
      newElements[index - 1] = temp
      // Update zIndex
      newElements.forEach((el, i) => {
        el.zIndex = i
      })
      onElementsChange(newElements)
    }
  }, [elements, selectedElementId, onElementsChange])

  // Add new element
  const handleAddText = useCallback(() => {
    const newElement = createTextElement({
      x: 10,
      y: 40,
      width: 80,
      height: 20,
      content: 'New text',
      zIndex: elements.length,
    })
    onElementsChange([...elements, newElement])
    setSelectedElementId(newElement.id)
  }, [elements, onElementsChange])

  const handleAddImage = useCallback(() => {
    const newElement = createImageElement({
      x: 30,
      y: 30,
      width: 40,
      height: 40,
      zIndex: elements.length,
    })
    onElementsChange([...elements, newElement])
    setSelectedElementId(newElement.id)
  }, [elements, onElementsChange])

  // Render element content based on type
  const renderElementContent = (element: SlideElement) => {
    switch (element.type) {
      case 'text':
        return (
          <TextElement
            element={element}
            isEditing={editingElementId === element.id}
            scale={scale}
            onContentChange={handleTextContentChange}
            onStartEditing={() => setEditingElementId(element.id)}
            onStopEditing={() => setEditingElementId(null)}
          />
        )
      case 'image':
        return <ImageElement element={element} />
      case 'shape':
        // Basic shape rendering
        return (
          <div
            className="w-full h-full"
            style={{
              backgroundColor: element.fill,
              border: element.strokeWidth > 0 ? `${element.strokeWidth}px solid ${element.stroke}` : undefined,
              borderRadius: element.shape === 'circle' ? '50%' : undefined,
            }}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="relative">
      {/* Add Element Button */}
      <div className="absolute -top-10 left-0 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Element
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={handleAddText}>
              <Type className="h-4 w-4 mr-2" />
              Text
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddImage}>
              <Image className="h-4 w-4 mr-2" />
              Image
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative overflow-hidden rounded-lg shadow-lg"
        style={{
          width: canvasWidth,
          height: canvasHeight,
          backgroundColor,
        }}
        onClick={handleCanvasClick}
      >
        {/* Background image */}
        {backgroundImage && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          >
            <div className="absolute inset-0 bg-black/40" />
          </div>
        )}

        {/* Grid overlay */}
        {showGrid && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)',
              backgroundSize: `${canvasWidth / 12}px ${canvasHeight / 12}px`,
            }}
          />
        )}

        {/* Elements */}
        {elements.map(element => (
          <CanvasElement
            key={element.id}
            element={element}
            isSelected={selectedElementId === element.id}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onSelect={handleElementSelect}
            onMove={handleElementMove}
            onResize={handleElementResize}
            onDoubleClick={handleElementDoubleClick}
          >
            {renderElementContent(element)}
          </CanvasElement>
        ))}

        {/* Element toolbar */}
        {selectedElement && !editingElementId && (
          <div 
            className="absolute pointer-events-auto"
            style={{
              left: `${(selectedElement.x / 100) * canvasWidth}px`,
              top: `${(selectedElement.y / 100) * canvasHeight - 48}px`,
            }}
          >
            <ElementToolbar
              element={selectedElement}
              onUpdate={handleElementUpdate}
              onDelete={handleElementDelete}
              onDuplicate={handleElementDuplicate}
              onBringForward={handleBringForward}
              onSendBackward={handleSendBackward}
            />
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-xs text-muted-foreground mt-2 text-center">
        Click to select • Double-click text to edit • Drag to move • Use corners to resize
      </div>
    </div>
  )
}

