import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { BrandAssetsManager } from './BrandAssetsManager'
import { Image, Hash, X, ImagePlus } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface BrandAsset {
  id: number
  name: string
  url: string
  default_position: string
  default_size: number
  default_opacity: number
}

interface LogoOverlay {
  brandAssetId: number | null
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  size: number
  opacity: number
  margin: number
}

interface PageNumberOverlay {
  enabled: boolean
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  format: 'number' | 'number-of-total'
  fontSize: number
  color: string
}

interface WatermarkOverlay {
  brandAssetId: number | null
  opacity: number
  size: number
}

export interface DeckOverlays {
  logo?: LogoOverlay
  pageNumber?: PageNumberOverlay
  watermark?: WatermarkOverlay
}

interface OverlaySettingsProps {
  overlays: DeckOverlays
  onOverlaysChange: (overlays: DeckOverlays) => void
  courseId?: number
}

export function OverlaySettings({ overlays, onOverlaysChange, courseId }: OverlaySettingsProps) {
  const { getToken } = useAuth()
  const [showBrandAssets, setShowBrandAssets] = useState(false)
  const [selectingFor, setSelectingFor] = useState<'logo' | 'watermark' | null>(null)
  const [selectedLogoAsset, setSelectedLogoAsset] = useState<BrandAsset | null>(null)
  const [selectedWatermarkAsset, setSelectedWatermarkAsset] = useState<BrandAsset | null>(null)

  // Initialize default values
  const logo: LogoOverlay = overlays.logo || {
    brandAssetId: null,
    position: 'bottom-right',
    size: 10,
    opacity: 1,
    margin: 20
  }

  const pageNumber: PageNumberOverlay = overlays.pageNumber || {
    enabled: false,
    position: 'bottom-right',
    format: 'number',
    fontSize: 24,
    color: '#666666'
  }

  const watermark: WatermarkOverlay = overlays.watermark || {
    brandAssetId: null,
    opacity: 0.1,
    size: 30
  }

  // Fetch brand asset details if we have IDs
  useEffect(() => {
    const fetchAssetDetails = async (assetId: number, setter: (asset: BrandAsset | null) => void) => {
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

    if (logo.brandAssetId && !selectedLogoAsset) {
      fetchAssetDetails(logo.brandAssetId, setSelectedLogoAsset)
    }
    if (watermark.brandAssetId && !selectedWatermarkAsset) {
      fetchAssetDetails(watermark.brandAssetId, setSelectedWatermarkAsset)
    }
  }, [logo.brandAssetId, watermark.brandAssetId, getToken, selectedLogoAsset, selectedWatermarkAsset])

  const updateLogo = (updates: Partial<LogoOverlay>) => {
    onOverlaysChange({
      ...overlays,
      logo: { ...logo, ...updates }
    })
  }

  const updatePageNumber = (updates: Partial<PageNumberOverlay>) => {
    onOverlaysChange({
      ...overlays,
      pageNumber: { ...pageNumber, ...updates }
    })
  }

  const updateWatermark = (updates: Partial<WatermarkOverlay>) => {
    onOverlaysChange({
      ...overlays,
      watermark: { ...watermark, ...updates }
    })
  }

  const handleAssetSelect = (asset: BrandAsset) => {
    if (selectingFor === 'logo') {
      setSelectedLogoAsset(asset)
      updateLogo({
        brandAssetId: asset.id,
        position: asset.default_position as LogoOverlay['position'],
        size: asset.default_size,
        opacity: asset.default_opacity
      })
    } else if (selectingFor === 'watermark') {
      setSelectedWatermarkAsset(asset)
      updateWatermark({
        brandAssetId: asset.id,
        opacity: 0.1,
        size: 30
      })
    }
    setSelectingFor(null)
  }

  const clearLogo = () => {
    setSelectedLogoAsset(null)
    updateLogo({ brandAssetId: null })
  }

  const clearWatermark = () => {
    setSelectedWatermarkAsset(null)
    updateWatermark({ brandAssetId: null })
  }

  return (
    <div className="space-y-6">
      {/* Logo Overlay */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Image className="h-4 w-4" />
          <h3 className="font-medium">Logo</h3>
        </div>

        <div className="space-y-3 pl-6">
          {selectedLogoAsset ? (
            <div className="flex items-center gap-3 p-2 bg-muted rounded-lg">
              <img 
                src={`${API_BASE_URL}${selectedLogoAsset.url}`} 
                alt={selectedLogoAsset.name}
                className="h-10 w-10 object-contain"
              />
              <span className="flex-1 text-sm">{selectedLogoAsset.name}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearLogo}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                setSelectingFor('logo')
                setShowBrandAssets(true)
              }}
            >
              <ImagePlus className="h-4 w-4 mr-2" />
              Select Logo
            </Button>
          )}

          {selectedLogoAsset && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Position</Label>
                  <Select 
                    value={logo.position} 
                    onValueChange={(v) => updateLogo({ position: v as LogoOverlay['position'] })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top-left">Top Left</SelectItem>
                      <SelectItem value="top-right">Top Right</SelectItem>
                      <SelectItem value="bottom-left">Bottom Left</SelectItem>
                      <SelectItem value="bottom-right">Bottom Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Size ({logo.size}%)</Label>
                  <Slider
                    value={[logo.size]}
                    onValueChange={([v]) => updateLogo({ size: v })}
                    min={5}
                    max={25}
                    step={1}
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Opacity ({Math.round(logo.opacity * 100)}%)</Label>
                  <Slider
                    value={[logo.opacity * 100]}
                    onValueChange={([v]) => updateLogo({ opacity: v / 100 })}
                    min={20}
                    max={100}
                    step={5}
                    className="mt-2"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Margin ({logo.margin}px)</Label>
                  <Slider
                    value={[logo.margin]}
                    onValueChange={([v]) => updateLogo({ margin: v })}
                    min={10}
                    max={50}
                    step={5}
                    className="mt-2"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Page Number */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            <h3 className="font-medium">Page Number</h3>
          </div>
          <Switch
            checked={pageNumber.enabled}
            onCheckedChange={(v) => updatePageNumber({ enabled: v })}
          />
        </div>

        {pageNumber.enabled && (
          <div className="space-y-3 pl-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Position</Label>
                <Select 
                  value={pageNumber.position} 
                  onValueChange={(v) => updatePageNumber({ position: v as PageNumberOverlay['position'] })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top-left">Top Left</SelectItem>
                    <SelectItem value="top-right">Top Right</SelectItem>
                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Format</Label>
                <Select 
                  value={pageNumber.format} 
                  onValueChange={(v) => updatePageNumber({ format: v as PageNumberOverlay['format'] })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="number">1, 2, 3...</SelectItem>
                    <SelectItem value="number-of-total">1 / 10</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Font Size ({pageNumber.fontSize}px)</Label>
                <Slider
                  value={[pageNumber.fontSize]}
                  onValueChange={([v]) => updatePageNumber({ fontSize: v })}
                  min={14}
                  max={36}
                  step={2}
                  className="mt-2"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={pageNumber.color}
                    onChange={(e) => updatePageNumber({ color: e.target.value })}
                    className="h-8 w-12 p-1 cursor-pointer"
                  />
                  <Input
                    value={pageNumber.color}
                    onChange={(e) => updatePageNumber({ color: e.target.value })}
                    className="h-8 flex-1 font-mono text-xs"
                    placeholder="#666666"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Watermark */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Image className="h-4 w-4 opacity-50" />
          <h3 className="font-medium">Watermark</h3>
        </div>

        <div className="space-y-3 pl-6">
          {selectedWatermarkAsset ? (
            <div className="flex items-center gap-3 p-2 bg-muted rounded-lg">
              <img 
                src={`${API_BASE_URL}${selectedWatermarkAsset.url}`} 
                alt={selectedWatermarkAsset.name}
                className="h-10 w-10 object-contain opacity-30"
              />
              <span className="flex-1 text-sm">{selectedWatermarkAsset.name}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearWatermark}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                setSelectingFor('watermark')
                setShowBrandAssets(true)
              }}
            >
              <ImagePlus className="h-4 w-4 mr-2" />
              Select Watermark
            </Button>
          )}

          {selectedWatermarkAsset && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Opacity ({Math.round(watermark.opacity * 100)}%)</Label>
                <Slider
                  value={[watermark.opacity * 100]}
                  onValueChange={([v]) => updateWatermark({ opacity: v / 100 })}
                  min={5}
                  max={30}
                  step={5}
                  className="mt-2"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Size ({watermark.size}%)</Label>
                <Slider
                  value={[watermark.size]}
                  onValueChange={([v]) => updateWatermark({ size: v })}
                  min={10}
                  max={50}
                  step={5}
                  className="mt-2"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Brand Assets Selector */}
      <BrandAssetsManager
        courseId={courseId}
        isOpen={showBrandAssets}
        onClose={() => {
          setShowBrandAssets(false)
          setSelectingFor(null)
        }}
        onAssetSelect={handleAssetSelect}
        selectMode={true}
      />
    </div>
  )
}

