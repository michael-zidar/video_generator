import {
  SlideElement,
  SlideElements,
  TextElement,
  createTextElement,
  generateElementId,
} from '@/types/slide'

/**
 * Legacy slide body format
 */
interface LegacySlideBody {
  layout?: string
  text?: string
  bullets?: string[]
  quote_text?: string
  quote_author?: string
  stats?: Array<{ value: string; label: string }>
  left_label?: string
  right_label?: string
  comparison_left?: string[]
  comparison_right?: string[]
  image_prompt?: string
}

interface LegacySlide {
  id: number
  title: string
  body: LegacySlideBody
  background_color?: string
}

/**
 * Check if a slide body contains the new element-based format
 */
export function isElementBasedFormat(body: unknown): body is SlideElements {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return Array.isArray(b.elements) && typeof b.version === 'number'
}

/**
 * Check if a slide uses the legacy format
 */
export function isLegacyFormat(body: unknown): boolean {
  if (!body || typeof body !== 'object') return true // Empty body is legacy
  return !isElementBasedFormat(body)
}

/**
 * Get text color based on background for readability
 */
function getTextColorForBackground(bgColor: string): string {
  if (!bgColor || bgColor === '#ffffff' || bgColor === 'white') return '#1f2937'
  try {
    const hex = bgColor.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    return brightness > 128 ? '#1f2937' : '#f9fafb'
  } catch {
    return '#1f2937'
  }
}

/**
 * Migrate a legacy slide body to the element-based format
 */
export function migrateSlideToElements(slide: LegacySlide): SlideElements {
  const elements: SlideElement[] = []
  const body = slide.body || {}
  const layout = body.layout || 'title-body'
  const textColor = getTextColorForBackground(slide.background_color || '#ffffff')
  
  let yPosition = 8 // Start at 8% from top
  
  // Title element (almost all layouts have a title)
  if (slide.title && layout !== 'quote') {
    const titleElement = createTextElement({
      content: slide.title,
      x: 8,
      y: yPosition,
      width: 84,
      height: 15,
      fontSize: layout === 'title-only' || layout === 'centered' ? 72 : 56,
      fontWeight: 'bold',
      textAlign: layout === 'centered' || layout === 'title-only' || layout === 'stats-grid' ? 'center' : 'left',
      color: textColor,
    })
    elements.push(titleElement)
    yPosition += 18
  }

  // Layout-specific elements
  switch (layout) {
    case 'title-only':
      // Just the title, already added
      break

    case 'title-body':
    case 'image-text':
      if (body.text) {
        const bodyElement = createTextElement({
          content: body.text,
          x: 8,
          y: yPosition,
          width: layout === 'image-text' ? 42 : 84,
          height: 60,
          fontSize: 32,
          fontWeight: 'normal',
          textAlign: 'left',
          color: textColor,
        })
        elements.push(bodyElement)
      }
      break

    case 'title-bullets':
      if (body.bullets && body.bullets.length > 0) {
        const bulletsText = body.bullets.map(b => `• ${b}`).join('\n')
        const bulletsElement = createTextElement({
          content: bulletsText,
          x: 8,
          y: yPosition,
          width: 84,
          height: 65,
          fontSize: 32,
          fontWeight: 'normal',
          textAlign: 'left',
          color: textColor,
          lineHeight: 1.8,
        })
        elements.push(bulletsElement)
      }
      break

    case 'two-column':
      if (body.bullets && body.bullets.length > 0) {
        const midpoint = Math.ceil(body.bullets.length / 2)
        const leftBullets = body.bullets.slice(0, midpoint)
        const rightBullets = body.bullets.slice(midpoint)

        if (leftBullets.length > 0) {
          const leftElement = createTextElement({
            content: leftBullets.map(b => `• ${b}`).join('\n'),
            x: 8,
            y: yPosition,
            width: 40,
            height: 65,
            fontSize: 28,
            fontWeight: 'normal',
            textAlign: 'left',
            color: textColor,
            lineHeight: 1.8,
          })
          elements.push(leftElement)
        }

        if (rightBullets.length > 0) {
          const rightElement = createTextElement({
            content: rightBullets.map(b => `• ${b}`).join('\n'),
            x: 52,
            y: yPosition,
            width: 40,
            height: 65,
            fontSize: 28,
            fontWeight: 'normal',
            textAlign: 'left',
            color: textColor,
            lineHeight: 1.8,
          })
          elements.push(rightElement)
        }
      }
      break

    case 'centered':
      if (body.text) {
        const subtitleElement = createTextElement({
          content: body.text,
          x: 10,
          y: yPosition + 5,
          width: 80,
          height: 20,
          fontSize: 36,
          fontWeight: 'normal',
          textAlign: 'center',
          color: textColor,
        })
        elements.push(subtitleElement)
      }
      break

    case 'quote':
      // Context title if exists
      if (slide.title) {
        const contextElement = createTextElement({
          content: slide.title,
          x: 10,
          y: 15,
          width: 80,
          height: 10,
          fontSize: 20,
          fontWeight: 'medium',
          textAlign: 'center',
          color: textColor,
        })
        elements.push(contextElement)
      }

      // Quote text
      if (body.quote_text) {
        const quoteElement = createTextElement({
          content: `"${body.quote_text}"`,
          x: 10,
          y: 30,
          width: 80,
          height: 35,
          fontSize: 40,
          fontWeight: 'medium',
          fontStyle: 'italic',
          textAlign: 'center',
          color: textColor,
          lineHeight: 1.5,
        })
        elements.push(quoteElement)
      }

      // Quote author
      if (body.quote_author) {
        const authorElement = createTextElement({
          content: `— ${body.quote_author}`,
          x: 10,
          y: 70,
          width: 80,
          height: 10,
          fontSize: 24,
          fontWeight: 'normal',
          textAlign: 'center',
          color: textColor,
        })
        elements.push(authorElement)
      }
      break

    case 'stats-grid':
      if (body.stats && body.stats.length > 0) {
        const statCount = body.stats.length
        const statWidth = statCount <= 2 ? 35 : 25
        const totalWidth = statWidth * statCount + (statCount - 1) * 5
        let startX = (100 - totalWidth) / 2

        body.stats.forEach((stat, i) => {
          // Stat value
          const valueElement = createTextElement({
            content: stat.value,
            x: startX + i * (statWidth + 5),
            y: yPosition,
            width: statWidth,
            height: 25,
            fontSize: 64,
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#3b82f6', // Primary color for values
          })
          elements.push(valueElement)

          // Stat label
          const labelElement = createTextElement({
            content: stat.label,
            x: startX + i * (statWidth + 5),
            y: yPosition + 28,
            width: statWidth,
            height: 15,
            fontSize: 20,
            fontWeight: 'normal',
            textAlign: 'center',
            color: textColor,
          })
          elements.push(labelElement)
        })
      }
      break

    case 'comparison':
      // Left column header
      if (body.left_label) {
        const leftHeaderElement = createTextElement({
          content: body.left_label,
          x: 8,
          y: yPosition,
          width: 40,
          height: 10,
          fontSize: 32,
          fontWeight: 'semibold',
          textAlign: 'center',
          color: textColor,
        })
        elements.push(leftHeaderElement)
      }

      // Right column header  
      if (body.right_label) {
        const rightHeaderElement = createTextElement({
          content: body.right_label,
          x: 52,
          y: yPosition,
          width: 40,
          height: 10,
          fontSize: 32,
          fontWeight: 'semibold',
          textAlign: 'center',
          color: textColor,
        })
        elements.push(rightHeaderElement)
      }

      yPosition += 15

      // Left column items
      if (body.comparison_left && body.comparison_left.length > 0) {
        const leftItemsElement = createTextElement({
          content: body.comparison_left.map(b => `• ${b}`).join('\n'),
          x: 8,
          y: yPosition,
          width: 40,
          height: 55,
          fontSize: 24,
          fontWeight: 'normal',
          textAlign: 'left',
          color: textColor,
          lineHeight: 1.8,
        })
        elements.push(leftItemsElement)
      }

      // Right column items
      if (body.comparison_right && body.comparison_right.length > 0) {
        const rightItemsElement = createTextElement({
          content: body.comparison_right.map(b => `• ${b}`).join('\n'),
          x: 52,
          y: yPosition,
          width: 40,
          height: 55,
          fontSize: 24,
          fontWeight: 'normal',
          textAlign: 'left',
          color: textColor,
          lineHeight: 1.8,
        })
        elements.push(rightItemsElement)
      }
      break
  }

  return {
    elements,
    version: 1,
  }
}

/**
 * Convert element-based format back to legacy format for API compatibility
 * This is a lossy conversion - only extracts text content
 */
export function elementsToLegacy(slideElements: SlideElements, layout: string = 'title-body'): LegacySlideBody {
  const textElements = slideElements.elements.filter(
    (el): el is TextElement => el.type === 'text'
  ).sort((a, b) => a.y - b.y) // Sort by vertical position

  // Try to extract title (largest/highest text element)
  // and body content
  let title = ''
  let bodyText = ''
  const bullets: string[] = []

  textElements.forEach((el, i) => {
    if (i === 0 && el.fontSize >= 48) {
      // Likely a title
      title = el.content
    } else if (el.content.includes('\n• ') || el.content.startsWith('• ')) {
      // Bullet points
      const items = el.content.split('\n').map(line => 
        line.replace(/^[•\-]\s*/, '').trim()
      ).filter(Boolean)
      bullets.push(...items)
    } else {
      bodyText += (bodyText ? '\n' : '') + el.content
    }
  })

  return {
    layout,
    text: bodyText || undefined,
    bullets: bullets.length > 0 ? bullets : undefined,
  }
}

