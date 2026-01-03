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
  background_color?: string
}

interface SlideThumbnailProps {
  slide: Slide
  width?: number
  height?: number
}

export function SlideThumbnail({ slide, width = 120, height = 68 }: SlideThumbnailProps) {
  const bgColor = slide.background_color || '#ffffff'
  const layout = slide.body?.layout || 'title-body'

  // Get text color based on background brightness
  const getTextColor = (bgColor: string) => {
    if (!bgColor) return '#1f2937'
    const hex = bgColor.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    return brightness > 128 ? '#1f2937' : '#f9fafb'
  }

  const textColor = getTextColor(bgColor)
  const subtleColor = textColor === '#1f2937' ? '#9ca3af' : '#6b7280'

  // Render layout-specific content
  const renderContent = () => {
    switch (layout) {
      case 'title-only':
        return (
          <div className="flex items-center justify-center h-full px-2">
            <div
              className="text-center font-bold truncate"
              style={{
                color: textColor,
                fontSize: '6px',
                lineHeight: '1.2'
              }}
            >
              {slide.title}
            </div>
          </div>
        )

      case 'title-bullets':
      case 'title-body':
        return (
          <div className="flex flex-col h-full px-1.5 py-1">
            <div
              className="font-semibold truncate mb-0.5"
              style={{
                color: textColor,
                fontSize: '5px',
                lineHeight: '1.1'
              }}
            >
              {slide.title}
            </div>
            <div className="flex-1 overflow-hidden">
              {slide.body?.bullets ? (
                <div className="space-y-0.5">
                  {slide.body.bullets.slice(0, 3).map((bullet, i) => (
                    <div
                      key={i}
                      className="truncate flex items-start"
                      style={{
                        color: subtleColor,
                        fontSize: '3.5px',
                        lineHeight: '1'
                      }}
                    >
                      <span className="mr-0.5">•</span>
                      <span className="flex-1 truncate">{bullet}</span>
                    </div>
                  ))}
                </div>
              ) : slide.body?.text ? (
                <div
                  className="line-clamp-3"
                  style={{
                    color: subtleColor,
                    fontSize: '3.5px',
                    lineHeight: '1.2'
                  }}
                >
                  {slide.body.text}
                </div>
              ) : null}
            </div>
          </div>
        )

      case 'centered':
        return (
          <div className="flex flex-col items-center justify-center h-full px-2 text-center">
            <div
              className="font-bold truncate mb-0.5"
              style={{
                color: textColor,
                fontSize: '5px',
                lineHeight: '1.2'
              }}
            >
              {slide.title}
            </div>
            {slide.body?.text && (
              <div
                className="truncate"
                style={{
                  color: subtleColor,
                  fontSize: '3.5px',
                  lineHeight: '1'
                }}
              >
                {slide.body.text}
              </div>
            )}
          </div>
        )

      case 'quote':
        return (
          <div className="flex flex-col items-center justify-center h-full px-2">
            {slide.body?.quote_text && (
              <div
                className="text-center italic line-clamp-2 mb-0.5"
                style={{
                  color: textColor,
                  fontSize: '4px',
                  lineHeight: '1.2'
                }}
              >
                "{slide.body.quote_text}"
              </div>
            )}
            {slide.body?.quote_author && (
              <div
                className="text-center truncate"
                style={{
                  color: subtleColor,
                  fontSize: '3px',
                  lineHeight: '1'
                }}
              >
                — {slide.body.quote_author}
              </div>
            )}
          </div>
        )

      case 'stats-grid':
        return (
          <div className="flex flex-col h-full px-1.5 py-1">
            <div
              className="font-semibold truncate mb-0.5"
              style={{
                color: textColor,
                fontSize: '5px',
                lineHeight: '1.1'
              }}
            >
              {slide.title}
            </div>
            <div className="flex-1 grid grid-cols-2 gap-0.5">
              {slide.body?.stats?.slice(0, 4).map((stat, i) => (
                <div key={i} className="text-center">
                  <div
                    className="font-bold truncate"
                    style={{
                      color: textColor,
                      fontSize: '4px',
                      lineHeight: '1'
                    }}
                  >
                    {stat.value}
                  </div>
                  <div
                    className="truncate"
                    style={{
                      color: subtleColor,
                      fontSize: '2.5px',
                      lineHeight: '1'
                    }}
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case 'comparison':
      case 'two-column':
        return (
          <div className="flex flex-col h-full px-1.5 py-1">
            <div
              className="font-semibold truncate mb-0.5"
              style={{
                color: textColor,
                fontSize: '5px',
                lineHeight: '1.1'
              }}
            >
              {slide.title}
            </div>
            <div className="flex-1 grid grid-cols-2 gap-1">
              <div className="space-y-0.5 overflow-hidden">
                {layout === 'comparison' && slide.body?.left_label && (
                  <div
                    className="font-medium truncate"
                    style={{
                      color: textColor,
                      fontSize: '3.5px',
                      lineHeight: '1'
                    }}
                  >
                    {slide.body.left_label}
                  </div>
                )}
                {slide.body?.comparison_left?.slice(0, 3).map((item, i) => (
                  <div
                    key={i}
                    className="truncate"
                    style={{
                      color: subtleColor,
                      fontSize: '3px',
                      lineHeight: '1'
                    }}
                  >
                    • {item}
                  </div>
                ))}
              </div>
              <div className="space-y-0.5 overflow-hidden border-l pl-1" style={{ borderColor: subtleColor }}>
                {layout === 'comparison' && slide.body?.right_label && (
                  <div
                    className="font-medium truncate"
                    style={{
                      color: textColor,
                      fontSize: '3.5px',
                      lineHeight: '1'
                    }}
                  >
                    {slide.body.right_label}
                  </div>
                )}
                {slide.body?.comparison_right?.slice(0, 3).map((item, i) => (
                  <div
                    key={i}
                    className="truncate"
                    style={{
                      color: subtleColor,
                      fontSize: '3px',
                      lineHeight: '1'
                    }}
                  >
                    • {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case 'image-text':
        return (
          <div className="flex h-full">
            <div className="w-1/2 flex items-center justify-center" style={{ backgroundColor: subtleColor, opacity: 0.3 }}>
              <div style={{ color: textColor, fontSize: '4px' }}>🖼️</div>
            </div>
            <div className="w-1/2 flex flex-col justify-center px-1 py-0.5">
              <div
                className="font-semibold truncate mb-0.5"
                style={{
                  color: textColor,
                  fontSize: '4px',
                  lineHeight: '1.1'
                }}
              >
                {slide.title}
              </div>
              {slide.body?.text && (
                <div
                  className="line-clamp-2"
                  style={{
                    color: subtleColor,
                    fontSize: '3px',
                    lineHeight: '1.2'
                  }}
                >
                  {slide.body.text}
                </div>
              )}
            </div>
          </div>
        )

      default:
        return (
          <div className="flex items-center justify-center h-full px-2">
            <div
              className="text-center truncate"
              style={{
                color: textColor,
                fontSize: '5px'
              }}
            >
              {slide.title}
            </div>
          </div>
        )
    }
  }

  return (
    <div
      className="rounded overflow-hidden shadow-sm"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: bgColor,
      }}
    >
      {renderContent()}
    </div>
  )
}
