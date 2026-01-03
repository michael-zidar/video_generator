import { useEffect, useRef, useState } from 'react'
import Reveal from 'reveal.js'
import 'reveal.js/dist/reveal.css'
import 'reveal.js/dist/theme/white.css'

interface SlideBody {
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

interface Slide {
  id: number
  title: string
  body?: SlideBody
  speaker_notes?: string
  background_color?: string
  transition?: { type: string }
  duration_ms?: number
  image_url?: string
}

interface Deck {
  aspect_ratio: string
  resolution: string
  theme?: object
}

interface RevealPreviewProps {
  slides: Slide[]
  deck: Deck | null
  startSlide?: number
  onClose?: () => void
  isFullscreen?: boolean
}

export function RevealPreview({ 
  slides, 
  deck, 
  startSlide = 0, 
  onClose,
  isFullscreen = true 
}: RevealPreviewProps) {
  const deckRef = useRef<HTMLDivElement>(null)
  const revealRef = useRef<Reveal.Api | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!deckRef.current || slides.length === 0) return

    // Initialize Reveal.js
    const reveal = new Reveal(deckRef.current, {
      hash: false,
      history: false,
      controls: true,
      progress: true,
      center: true,
      transition: 'slide',
      width: deck?.aspect_ratio === '9:16' ? 1080 : 1920,
      height: deck?.aspect_ratio === '9:16' ? 1920 : 
              deck?.aspect_ratio === '1:1' ? 1920 : 
              deck?.aspect_ratio === '4:3' ? 1440 : 1080,
      embedded: !isFullscreen,
      keyboard: true,
      overview: true,
      touch: true,
    })

    reveal.initialize().then(() => {
      revealRef.current = reveal
      setIsReady(true)
      
      // Go to start slide
      if (startSlide > 0) {
        reveal.slide(startSlide)
      }
    })

    // Handle escape key to close
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (revealRef.current) {
        revealRef.current.destroy()
        revealRef.current = null
      }
    }
  }, [slides, deck, startSlide, isFullscreen, onClose])

  // Helper to get text color based on background
  const getTextColor = (bgColor: string) => {
    if (!bgColor) return '#1f2937'
    const hex = bgColor.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    return brightness > 128 ? '#1f2937' : '#f9fafb'
  }

  // Render slide content based on layout
  const renderSlideContent = (slide: Slide) => {
    const layout = slide.body?.layout || 'title-body'
    const textColor = getTextColor(slide.background_color || '#ffffff')
    const subtitleColor = textColor === '#1f2937' ? '#6b7280' : '#d1d5db'

    switch (layout) {
      case 'title-only':
        return (
          <h2 style={{ color: textColor, fontSize: '3rem', fontWeight: 'bold' }}>
            {slide.title || 'Untitled Slide'}
          </h2>
        )

      case 'title-bullets':
        return (
          <>
            <h2 style={{ color: textColor, fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              {slide.title || 'Untitled Slide'}
            </h2>
            {slide.body?.bullets && slide.body.bullets.length > 0 && (
              <ul style={{ textAlign: 'left', fontSize: '1.5rem', color: textColor }}>
                {slide.body.bullets.map((bullet, i) => (
                  <li key={i} style={{ marginBottom: '0.5rem' }}>{bullet}</li>
                ))}
              </ul>
            )}
          </>
        )

      case 'two-column': {
        const midpoint = Math.ceil((slide.body?.bullets?.length || 0) / 2)
        const leftBullets = slide.body?.bullets?.slice(0, midpoint) || []
        const rightBullets = slide.body?.bullets?.slice(midpoint) || []
        return (
          <>
            <h2 style={{ color: textColor, fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              {slide.title || 'Untitled Slide'}
            </h2>
            <div style={{ display: 'flex', gap: '2rem', textAlign: 'left' }}>
              <ul style={{ flex: 1, fontSize: '1.25rem', color: textColor }}>
                {leftBullets.map((bullet, i) => (
                  <li key={i} style={{ marginBottom: '0.5rem' }}>{bullet}</li>
                ))}
              </ul>
              <ul style={{ flex: 1, fontSize: '1.25rem', color: textColor }}>
                {rightBullets.map((bullet, i) => (
                  <li key={i} style={{ marginBottom: '0.5rem' }}>{bullet}</li>
                ))}
              </ul>
            </div>
          </>
        )
      }

      case 'centered':
        return (
          <>
            <h2 style={{ color: textColor, fontSize: '3rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              {slide.title || 'Untitled Slide'}
            </h2>
            {slide.body?.text && (
              <p style={{ color: subtitleColor, fontSize: '1.5rem', maxWidth: '80%', margin: '0 auto' }}>
                {slide.body.text}
              </p>
            )}
          </>
        )

      case 'quote':
        return (
          <div style={{ textAlign: 'center', maxWidth: '80%' }}>
            {slide.title && (
              <p style={{ color: subtitleColor, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2rem' }}>
                {slide.title}
              </p>
            )}
            <blockquote style={{ color: textColor, fontSize: '2rem', fontStyle: 'italic', fontWeight: 500, lineHeight: 1.5 }}>
              "{slide.body?.quote_text || 'Quote text'}"
            </blockquote>
            {slide.body?.quote_author && (
              <p style={{ color: subtitleColor, fontSize: '1.25rem', marginTop: '2rem' }}>
                — {slide.body.quote_author}
              </p>
            )}
          </div>
        )

      case 'stats-grid':
        return (
          <>
            <h2 style={{ color: textColor, fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '2rem', textAlign: 'center' }}>
              {slide.title || 'Key Statistics'}
            </h2>
            {slide.body?.stats && slide.body.stats.length > 0 && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: `repeat(${Math.min(slide.body.stats.length, 3)}, 1fr)`, 
                gap: '2rem',
                width: '100%',
                maxWidth: '900px'
              }}>
                {slide.body.stats.map((stat, i) => (
                  <div key={i} style={{ 
                    textAlign: 'center', 
                    padding: '1.5rem', 
                    backgroundColor: 'rgba(0,0,0,0.05)', 
                    borderRadius: '0.5rem' 
                  }}>
                    <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#3b82f6' }}>
                      {stat.value}
                    </div>
                    <div style={{ fontSize: '1rem', color: subtitleColor, marginTop: '0.5rem' }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )

      case 'comparison':
        return (
          <>
            <h2 style={{ color: textColor, fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '2rem', textAlign: 'center' }}>
              {slide.title || 'Comparison'}
            </h2>
            <div style={{ display: 'flex', gap: '3rem', width: '100%', maxWidth: '900px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 600, 
                  color: textColor, 
                  marginBottom: '1rem', 
                  paddingBottom: '0.5rem', 
                  borderBottom: `2px solid ${subtitleColor}`,
                  textAlign: 'center'
                }}>
                  {slide.body?.left_label || 'Option A'}
                </div>
                <ul style={{ textAlign: 'left', fontSize: '1.25rem', color: textColor }}>
                  {(slide.body?.comparison_left || []).map((item, i) => (
                    <li key={i} style={{ marginBottom: '0.5rem' }}>{item}</li>
                  ))}
                </ul>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 600, 
                  color: textColor, 
                  marginBottom: '1rem', 
                  paddingBottom: '0.5rem', 
                  borderBottom: `2px solid ${subtitleColor}`,
                  textAlign: 'center'
                }}>
                  {slide.body?.right_label || 'Option B'}
                </div>
                <ul style={{ textAlign: 'left', fontSize: '1.25rem', color: textColor }}>
                  {(slide.body?.comparison_right || []).map((item, i) => (
                    <li key={i} style={{ marginBottom: '0.5rem' }}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )

      case 'image-text':
        return (
          <div style={{ display: 'flex', gap: '2rem', width: '100%', height: '100%', alignItems: 'center' }}>
            <div style={{ flex: 1, height: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {slide.image_url ? (
                <img 
                  src={slide.image_url} 
                  alt={slide.title || ''} 
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '0.5rem' }}
                />
              ) : (
                <div style={{ 
                  width: '100%', 
                  height: '100%', 
                  backgroundColor: 'rgba(0,0,0,0.05)', 
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: subtitleColor
                }}>
                  Image placeholder
                </div>
              )}
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <h2 style={{ color: textColor, fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                {slide.title || 'Untitled Slide'}
              </h2>
              {slide.body?.text && (
                <p style={{ color: subtitleColor, fontSize: '1.25rem' }}>
                  {slide.body.text}
                </p>
              )}
            </div>
          </div>
        )

      case 'title-body':
      default:
        return (
          <>
            <h2 style={{ color: textColor, fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              {slide.title || 'Untitled Slide'}
            </h2>
            {slide.body?.text && (
              <p style={{ color: subtitleColor, fontSize: '1.25rem', textAlign: 'left' }}>
                {slide.body.text}
              </p>
            )}
          </>
        )
    }
  }

  // Map our transitions to Reveal.js transitions
  const getTransition = (type?: string) => {
    switch (type) {
      case 'fade': return 'fade'
      case 'push': return 'slide'
      case 'dissolve': return 'fade'
      case 'wipe': return 'slide'
      case 'none': return 'none'
      default: return 'slide'
    }
  }

  if (slides.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-black text-white">
        <p>No slides to present</p>
      </div>
    )
  }

  return (
    <div 
      className={`reveal-container ${isFullscreen ? 'fixed inset-0 z-50' : 'w-full h-full'}`}
      style={{ background: '#000' }}
    >
      {/* Close button for fullscreen mode */}
      {isFullscreen && onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-[60] bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg backdrop-blur-sm transition-colors"
          style={{ fontSize: '14px' }}
        >
          Press ESC or click to exit
        </button>
      )}

      <div className="reveal" ref={deckRef} style={{ height: '100%' }}>
        <div className="slides">
          {slides.map((slide) => (
            <section
              key={slide.id}
              data-transition={getTransition(slide.transition?.type)}
              data-background-color={slide.background_color || '#ffffff'}
              style={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '2rem',
              }}
            >
              {renderSlideContent(slide)}
              
              {/* Speaker notes (hidden, for presenter view) */}
              {slide.speaker_notes && (
                <aside className="notes">
                  {slide.speaker_notes}
                </aside>
              )}
            </section>
          ))}
        </div>
      </div>

      {/* Loading indicator */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-white text-lg">Loading presentation...</div>
        </div>
      )}
    </div>
  )
}

// Utility function to generate standalone HTML export
export function generateRevealHTML(slides: Slide[], deck: Deck | null, title: string): string {
  const getTextColor = (bgColor: string) => {
    if (!bgColor) return '#1f2937'
    const hex = bgColor.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    return brightness > 128 ? '#1f2937' : '#f9fafb'
  }

  const getTransition = (type?: string) => {
    switch (type) {
      case 'fade': return 'fade'
      case 'push': return 'slide'
      case 'dissolve': return 'fade'
      case 'wipe': return 'slide'
      case 'none': return 'none'
      default: return 'slide'
    }
  }

  const renderSlideHTML = (slide: Slide) => {
    const layout = slide.body?.layout || 'title-body'
    const textColor = getTextColor(slide.background_color || '#ffffff')
    const subtitleColor = textColor === '#1f2937' ? '#6b7280' : '#d1d5db'

    let content = ''
    
    switch (layout) {
      case 'title-only':
        content = `<h2 style="color: ${textColor}; font-size: 3rem; font-weight: bold;">${slide.title || 'Untitled Slide'}</h2>`
        break

      case 'title-bullets':
        content = `<h2 style="color: ${textColor}; font-size: 2.5rem; font-weight: bold; margin-bottom: 1rem;">${slide.title || 'Untitled Slide'}</h2>`
        if (slide.body?.bullets && slide.body.bullets.length > 0) {
          content += `<ul style="text-align: left; font-size: 1.5rem; color: ${textColor};">`
          slide.body.bullets.forEach(bullet => {
            content += `<li style="margin-bottom: 0.5rem;">${bullet}</li>`
          })
          content += '</ul>'
        }
        break

      case 'centered':
        content = `<h2 style="color: ${textColor}; font-size: 3rem; font-weight: bold; margin-bottom: 1rem;">${slide.title || 'Untitled Slide'}</h2>`
        if (slide.body?.text) {
          content += `<p style="color: ${subtitleColor}; font-size: 1.5rem; max-width: 80%; margin: 0 auto;">${slide.body.text}</p>`
        }
        break

      case 'quote':
        content = `<div style="text-align: center; max-width: 80%;">`
        if (slide.title) {
          content += `<p style="color: ${subtitleColor}; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2rem;">${slide.title}</p>`
        }
        content += `<blockquote style="color: ${textColor}; font-size: 2rem; font-style: italic; font-weight: 500; line-height: 1.5;">"${slide.body?.quote_text || ''}"</blockquote>`
        if (slide.body?.quote_author) {
          content += `<p style="color: ${subtitleColor}; font-size: 1.25rem; margin-top: 2rem;">— ${slide.body.quote_author}</p>`
        }
        content += `</div>`
        break

      case 'stats-grid':
        content = `<h2 style="color: ${textColor}; font-size: 2.5rem; font-weight: bold; margin-bottom: 2rem; text-align: center;">${slide.title || 'Key Statistics'}</h2>`
        if (slide.body?.stats && slide.body.stats.length > 0) {
          const cols = Math.min(slide.body.stats.length, 3)
          content += `<div style="display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 2rem; width: 100%; max-width: 900px;">`
          slide.body.stats.forEach(stat => {
            content += `<div style="text-align: center; padding: 1.5rem; background-color: rgba(0,0,0,0.05); border-radius: 0.5rem;">
              <div style="font-size: 3rem; font-weight: bold; color: #3b82f6;">${stat.value}</div>
              <div style="font-size: 1rem; color: ${subtitleColor}; margin-top: 0.5rem;">${stat.label}</div>
            </div>`
          })
          content += `</div>`
        }
        break

      case 'comparison':
        content = `<h2 style="color: ${textColor}; font-size: 2.5rem; font-weight: bold; margin-bottom: 2rem; text-align: center;">${slide.title || 'Comparison'}</h2>`
        content += `<div style="display: flex; gap: 3rem; width: 100%; max-width: 900px;">`
        content += `<div style="flex: 1;"><div style="font-size: 1.5rem; font-weight: 600; color: ${textColor}; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid ${subtitleColor}; text-align: center;">${slide.body?.left_label || 'Option A'}</div><ul style="text-align: left; font-size: 1.25rem; color: ${textColor};">`
        ;(slide.body?.comparison_left || []).forEach(item => {
          content += `<li style="margin-bottom: 0.5rem;">${item}</li>`
        })
        content += `</ul></div>`
        content += `<div style="flex: 1;"><div style="font-size: 1.5rem; font-weight: 600; color: ${textColor}; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid ${subtitleColor}; text-align: center;">${slide.body?.right_label || 'Option B'}</div><ul style="text-align: left; font-size: 1.25rem; color: ${textColor};">`
        ;(slide.body?.comparison_right || []).forEach(item => {
          content += `<li style="margin-bottom: 0.5rem;">${item}</li>`
        })
        content += `</ul></div></div>`
        break

      case 'image-text':
        content = `<div style="display: flex; gap: 2rem; width: 100%; height: 100%; align-items: center;">`
        content += `<div style="flex: 1; height: 80%; display: flex; align-items: center; justify-content: center;">`
        if (slide.image_url) {
          content += `<img src="${slide.image_url}" alt="${slide.title || ''}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 0.5rem;">`
        } else {
          content += `<div style="width: 100%; height: 100%; background-color: rgba(0,0,0,0.05); border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; color: ${subtitleColor};">Image placeholder</div>`
        }
        content += `</div><div style="flex: 1; text-align: left;">`
        content += `<h2 style="color: ${textColor}; font-size: 2.5rem; font-weight: bold; margin-bottom: 1rem;">${slide.title || 'Untitled Slide'}</h2>`
        if (slide.body?.text) {
          content += `<p style="color: ${subtitleColor}; font-size: 1.25rem;">${slide.body.text}</p>`
        }
        content += `</div></div>`
        break

      default:
        content = `<h2 style="color: ${textColor}; font-size: 2.5rem; font-weight: bold; margin-bottom: 1rem;">${slide.title || 'Untitled Slide'}</h2>`
        if (slide.body?.text) {
          content += `<p style="color: ${subtitleColor}; font-size: 1.25rem; text-align: left;">${slide.body.text}</p>`
        }
    }

    return content
  }

  const slidesHTML = slides.map(slide => {
    const transition = getTransition(slide.transition?.type)
    const bgColor = slide.background_color || '#ffffff'
    const notes = slide.speaker_notes ? `<aside class="notes">${slide.speaker_notes}</aside>` : ''
    
    return `
      <section data-transition="${transition}" data-background-color="${bgColor}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 2rem;">
        ${renderSlideHTML(slide)}
        ${notes}
      </section>`
  }).join('\n')

  const width = deck?.aspect_ratio === '9:16' ? 1080 : 1920
  const height = deck?.aspect_ratio === '9:16' ? 1920 : 
                 deck?.aspect_ratio === '1:1' ? 1920 : 
                 deck?.aspect_ratio === '4:3' ? 1440 : 1080

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/white.min.css">
  <style>
    body { margin: 0; padding: 0; }
    .reveal { font-family: system-ui, -apple-system, sans-serif; }
    .reveal h2 { text-transform: none; }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
${slidesHTML}
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.min.js"></script>
  <script>
    Reveal.initialize({
      hash: true,
      history: true,
      controls: true,
      progress: true,
      center: true,
      transition: 'slide',
      width: ${width},
      height: ${height},
    });
  </script>
</body>
</html>`
}
