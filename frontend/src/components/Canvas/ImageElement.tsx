import type { ImageElement as ImageElementType } from '@/types/slide'
import { ImagePlus } from 'lucide-react'

interface ImageElementProps {
  element: ImageElementType
  onReplace?: () => void
}

export function ImageElement({ element, onReplace }: ImageElementProps) {
  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: element.fit,
    objectPosition: element.position,
    backgroundColor: element.style?.backgroundColor,
    borderRadius: element.style?.borderRadius ? `${element.style.borderRadius}px` : undefined,
    opacity: element.style?.opacity ?? 1,
  }

  if (!element.src) {
    return (
      <div 
        className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors"
        onDoubleClick={onReplace}
      >
        <ImagePlus className="w-8 h-8 text-muted-foreground/50 mb-2" />
        <span className="text-xs text-muted-foreground/50">Double-click to add image</span>
      </div>
    )
  }

  return (
    <img
      src={element.src}
      alt={element.alt}
      style={style}
      draggable={false}
      className="select-none"
    />
  )
}

