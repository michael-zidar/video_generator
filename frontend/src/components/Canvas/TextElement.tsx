import { useState, useRef, useEffect } from 'react'
import { TextElement as TextElementType } from '@/types/slide'

interface TextElementProps {
  element: TextElementType
  isEditing: boolean
  scale: number // Canvas scale factor
  onContentChange: (id: string, content: string) => void
  onStartEditing: () => void
  onStopEditing: () => void
}

export function TextElement({
  element,
  isEditing,
  scale,
  onContentChange,
  onStartEditing,
  onStopEditing,
}: TextElementProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [localContent, setLocalContent] = useState(element.content)

  // Update local content when element changes (external update)
  useEffect(() => {
    if (!isEditing) {
      setLocalContent(element.content)
    }
  }, [element.content, isEditing])

  // Focus the editable div when entering edit mode
  useEffect(() => {
    if (isEditing && contentRef.current) {
      contentRef.current.focus()
      // Place cursor at end
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(contentRef.current)
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }, [isEditing])

  const handleBlur = () => {
    if (localContent !== element.content) {
      onContentChange(element.id, localContent)
    }
    onStopEditing()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setLocalContent(element.content) // Revert changes
      onStopEditing()
    }
    // Allow multiline with Enter, commit with Ctrl/Cmd+Enter
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleBlur()
    }
  }

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    setLocalContent(e.currentTarget.innerText || '')
  }

  // Calculate scaled font size
  const scaledFontSize = element.fontSize * scale

  const textStyle: React.CSSProperties = {
    color: element.color,
    fontSize: `${scaledFontSize}px`,
    fontFamily: element.fontFamily,
    fontWeight: element.fontWeight === 'semibold' ? 600 : element.fontWeight,
    fontStyle: element.fontStyle,
    textDecoration: element.textDecoration,
    textAlign: element.textAlign,
    lineHeight: element.lineHeight,
    letterSpacing: `${element.letterSpacing}px`,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    padding: '4px',
    margin: 0,
    backgroundColor: element.style?.backgroundColor || 'transparent',
    borderRadius: element.style?.borderRadius ? `${element.style.borderRadius}px` : undefined,
    opacity: element.style?.opacity ?? 1,
  }

  if (isEditing) {
    return (
      <div
        ref={contentRef}
        contentEditable
        suppressContentEditableWarning
        className="outline-none cursor-text"
        style={textStyle}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
      >
        {localContent}
      </div>
    )
  }

  return (
    <div 
      className="cursor-move select-none" 
      style={textStyle}
      onDoubleClick={() => onStartEditing()}
    >
      {element.content || (
        <span className="text-muted-foreground/50 italic">
          Double-click to edit
        </span>
      )}
    </div>
  )
}

