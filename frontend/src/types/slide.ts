/**
 * Element-based slide data model for drag-and-drop canvas editing
 */

export interface ElementStyle {
  backgroundColor?: string
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
  opacity?: number
  shadow?: string
  padding?: number
}

export interface BaseSlideElement {
  id: string
  type: 'text' | 'image' | 'shape'
  x: number // X position as percentage (0-100)
  y: number // Y position as percentage (0-100)
  width: number // Width as percentage (0-100)
  height: number // Height as percentage (0-100)
  rotation: number // Rotation in degrees
  locked: boolean
  zIndex: number
  style?: ElementStyle
}

export interface TextElement extends BaseSlideElement {
  type: 'text'
  content: string
  fontSize: number // in px for 1920px base width
  fontFamily: string
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold'
  fontStyle: 'normal' | 'italic'
  textDecoration: 'none' | 'underline' | 'line-through'
  textAlign: 'left' | 'center' | 'right' | 'justify'
  color: string
  lineHeight: number
  letterSpacing: number
}

export interface ImageElement extends BaseSlideElement {
  type: 'image'
  src: string
  alt: string
  fit: 'cover' | 'contain' | 'fill' | 'none'
  position: string // e.g., 'center center', 'top left'
}

export interface ShapeElement extends BaseSlideElement {
  type: 'shape'
  shape: 'rectangle' | 'circle' | 'triangle' | 'line' | 'arrow'
  fill: string
  stroke: string
  strokeWidth: number
}

export type SlideElement = TextElement | ImageElement | ShapeElement

export interface SlideElements {
  elements: SlideElement[]
  version: number // For migration tracking
}

/**
 * Default values for new elements
 */
export const DEFAULT_TEXT_ELEMENT: Omit<TextElement, 'id'> = {
  type: 'text',
  x: 10,
  y: 10,
  width: 80,
  height: 20,
  rotation: 0,
  locked: false,
  zIndex: 0,
  content: 'New text',
  fontSize: 48,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'left',
  color: '#1f2937',
  lineHeight: 1.4,
  letterSpacing: 0,
}

export const DEFAULT_IMAGE_ELEMENT: Omit<ImageElement, 'id'> = {
  type: 'image',
  x: 10,
  y: 10,
  width: 40,
  height: 60,
  rotation: 0,
  locked: false,
  zIndex: 0,
  src: '',
  alt: '',
  fit: 'cover',
  position: 'center center',
}

export const DEFAULT_SHAPE_ELEMENT: Omit<ShapeElement, 'id'> = {
  type: 'shape',
  x: 10,
  y: 10,
  width: 30,
  height: 30,
  rotation: 0,
  locked: false,
  zIndex: 0,
  shape: 'rectangle',
  fill: '#3b82f6',
  stroke: 'transparent',
  strokeWidth: 0,
}

/**
 * Generate a unique element ID
 */
export function generateElementId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Create a new text element with default values
 */
export function createTextElement(overrides: Partial<TextElement> = {}): TextElement {
  return {
    ...DEFAULT_TEXT_ELEMENT,
    id: generateElementId(),
    ...overrides,
  }
}

/**
 * Create a new image element with default values
 */
export function createImageElement(overrides: Partial<ImageElement> = {}): ImageElement {
  return {
    ...DEFAULT_IMAGE_ELEMENT,
    id: generateElementId(),
    ...overrides,
  }
}

/**
 * Create a new shape element with default values
 */
export function createShapeElement(overrides: Partial<ShapeElement> = {}): ShapeElement {
  return {
    ...DEFAULT_SHAPE_ELEMENT,
    id: generateElementId(),
    ...overrides,
  }
}

