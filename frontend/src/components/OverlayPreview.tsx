import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import type { DeckOverlays } from './OverlaySettings'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface BrandAsset {
  id: number
  name: string
  url: string
  default_position: string
  default_size: number
  default_opacity: number
}

interface OverlayPreviewProps {
  overlays: DeckOverlays
  slideIndex: number
  totalSlides: number
  containerWidth: number
  containerHeight: number
}

/**
 * Renders a preview of deck overlays (logo, page number, watermark) on top of slides
 */
export function OverlayPreview({ 
  overlays, 
  slideIndex, 
  totalSlides,
  containerWidth,
  containerHeight 
}: OverlayPreviewProps) {
  const { getToken } = useAuth()
  const [logoAsset, setLogoAsset] = useState<BrandAsset | null>(null)
  const [watermarkAsset, setWatermarkAsset] = useState<BrandAsset | null>(null)

  // Fetch brand asset details
  useEffect(() => {
    const fetchAsset = async (assetId: number, setter: (asset: BrandAsset | null) => void) => {
      try {
        const token = await getToken()
        const response = await fetch(`${API_BASE_URL}/api/brand-assets/${assetId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (response.ok) {
          setter(await response.json())
        }
      } catch (error) {
        console.error('Error fetching brand asset:', error)
      }
    }

    if (overlays.logo?.brandAssetId) {
      fetchAsset(overlays.logo.brandAssetId, setLogoAsset)
    } else {
      setLogoAsset(null)
    }

    if (overlays.watermark?.brandAssetId) {
      fetchAsset(overlays.watermark.brandAssetId, setWatermarkAsset)
    } else {
      setWatermarkAsset(null)
    }
  }, [overlays.logo?.brandAssetId, overlays.watermark?.brandAssetId, getToken])

  // Calculate sizes relative to container
  const scaleFactor = containerWidth / 640 // Base design width

  const logo = overlays.logo
  const pageNumber = overlays.pageNumber
  const watermark = overlays.watermark

  // Get position styles
  const getPositionStyles = (position: string, margin: number): React.CSSProperties => {
    const scaledMargin = margin * scaleFactor
    switch (position) {
      case 'top-left':
        return { top: scaledMargin, left: scaledMargin }
      case 'top-right':
        return { top: scaledMargin, right: scaledMargin }
      case 'bottom-left':
        return { bottom: scaledMargin, left: scaledMargin }
      case 'bottom-right':
        return { bottom: scaledMargin, right: scaledMargin }
      default:
        return { bottom: scaledMargin, right: scaledMargin }
    }
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* Watermark (centered background) */}
      {watermark?.brandAssetId && watermarkAsset && (
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            opacity: watermark.opacity || 0.1,
          }}
        >
          <img 
            src={`${API_BASE_URL}${watermarkAsset.url}`}
            alt="Watermark"
            style={{
              width: `${(watermark.size || 30) * scaleFactor * 6}px`,
              height: 'auto',
              maxWidth: '80%',
              objectFit: 'contain',
            }}
          />
        </div>
      )}

      {/* Logo */}
      {logo?.brandAssetId && logoAsset && (
        <div 
          className="absolute"
          style={{
            ...getPositionStyles(logo.position || 'bottom-right', logo.margin || 20),
            opacity: logo.opacity || 1,
          }}
        >
          <img 
            src={`${API_BASE_URL}${logoAsset.url}`}
            alt="Logo"
            style={{
              width: `${(logo.size || 10) * scaleFactor * 6}px`,
              height: 'auto',
              objectFit: 'contain',
            }}
          />
        </div>
      )}

      {/* Page Number */}
      {pageNumber?.enabled && (
        <div 
          className="absolute font-medium"
          style={{
            ...getPositionStyles(pageNumber.position || 'bottom-right', 20),
            fontSize: `${(pageNumber.fontSize || 24) * scaleFactor}px`,
            color: pageNumber.color || '#666666',
          }}
        >
          {pageNumber.format === 'number-of-total' 
            ? `${slideIndex + 1} / ${totalSlides}`
            : slideIndex + 1
          }
        </div>
      )}
    </div>
  )
}

