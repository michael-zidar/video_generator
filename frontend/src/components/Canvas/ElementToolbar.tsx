import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { SlideElement, TextElement, ImageElement } from '@/types/slide'
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  Copy,
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
  Palette,
} from 'lucide-react'

interface ElementToolbarProps {
  element: SlideElement
  onUpdate: (updates: Partial<SlideElement>) => void
  onDelete: () => void
  onDuplicate: () => void
  onBringForward: () => void
  onSendBackward: () => void
}

export function ElementToolbar({
  element,
  onUpdate,
  onDelete,
  onDuplicate,
  onBringForward,
  onSendBackward,
}: ElementToolbarProps) {
  const isTextElement = element.type === 'text'
  const textEl = element as TextElement

  return (
    <div className="absolute -top-12 left-0 flex items-center gap-1 bg-background border rounded-lg shadow-lg p-1 z-50">
      {isTextElement && (
        <>
          {/* Text formatting */}
          <Button
            variant={textEl.fontWeight === 'bold' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => onUpdate({ 
              fontWeight: textEl.fontWeight === 'bold' ? 'normal' : 'bold' 
            } as Partial<TextElement>)}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant={textEl.fontStyle === 'italic' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => onUpdate({ 
              fontStyle: textEl.fontStyle === 'italic' ? 'normal' : 'italic' 
            } as Partial<TextElement>)}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant={textEl.textDecoration === 'underline' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => onUpdate({ 
              textDecoration: textEl.textDecoration === 'underline' ? 'none' : 'underline' 
            } as Partial<TextElement>)}
          >
            <Underline className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          {/* Text alignment */}
          <Button
            variant={textEl.textAlign === 'left' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => onUpdate({ textAlign: 'left' } as Partial<TextElement>)}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={textEl.textAlign === 'center' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => onUpdate({ textAlign: 'center' } as Partial<TextElement>)}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            variant={textEl.textAlign === 'right' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => onUpdate({ textAlign: 'right' } as Partial<TextElement>)}
          >
            <AlignRight className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          {/* Font size */}
          <Select
            value={String(textEl.fontSize)}
            onValueChange={(value) => onUpdate({ fontSize: parseInt(value) } as Partial<TextElement>)}
          >
            <SelectTrigger className="h-8 w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="16">16</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="24">24</SelectItem>
              <SelectItem value="28">28</SelectItem>
              <SelectItem value="32">32</SelectItem>
              <SelectItem value="40">40</SelectItem>
              <SelectItem value="48">48</SelectItem>
              <SelectItem value="56">56</SelectItem>
              <SelectItem value="64">64</SelectItem>
              <SelectItem value="72">72</SelectItem>
            </SelectContent>
          </Select>

          {/* Text color */}
          <div className="relative">
            <Input
              type="color"
              value={textEl.color}
              onChange={(e) => onUpdate({ color: e.target.value } as Partial<TextElement>)}
              className="w-8 h-8 p-0.5 cursor-pointer"
            />
          </div>

          <Separator orientation="vertical" className="h-6" />
        </>
      )}

      {/* Common actions */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onDuplicate}
        title="Duplicate"
      >
        <Copy className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onUpdate({ locked: !element.locked })}
        title={element.locked ? 'Unlock' : 'Lock'}
      >
        {element.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
      </Button>

      <Separator orientation="vertical" className="h-6" />

      {/* Layer order */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onBringForward}
        title="Bring forward"
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onSendBackward}
        title="Send backward"
      >
        <ArrowDown className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={onDelete}
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

