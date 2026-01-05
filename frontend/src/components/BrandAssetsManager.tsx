import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { toast } from '@/hooks/use-toast'
import { Upload, Trash2, Image, Loader2, Star } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface BrandAsset {
  id: number
  user_id: string
  course_id: number | null
  name: string
  type: 'logo' | 'watermark' | 'icon'
  asset_id: number
  default_position: string
  default_size: number
  default_opacity: number
  url: string
  created_at: string
}

interface BrandAssetsManagerProps {
  courseId?: number
  isOpen: boolean
  onClose: () => void
  onAssetSelect?: (asset: BrandAsset) => void
  selectMode?: boolean
}

export function BrandAssetsManager({
  courseId,
  isOpen,
  onClose,
  onAssetSelect,
  selectMode = false
}: BrandAssetsManagerProps) {
  const { getToken } = useAuth()
  const [assets, setAssets] = useState<BrandAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  
  // Upload form state
  const [uploadName, setUploadName] = useState('')
  const [uploadType, setUploadType] = useState<'logo' | 'watermark' | 'icon'>('logo')
  const [uploadPosition, setUploadPosition] = useState('bottom-right')
  const [uploadSize, setUploadSize] = useState(10)
  const [uploadOpacity, setUploadOpacity] = useState(100)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true)
      const token = await getToken()
      const params = courseId ? `?course_id=${courseId}` : ''
      const response = await fetch(`${API_BASE_URL}/api/brand-assets${params}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to fetch brand assets')
      
      const data = await response.json()
      setAssets(data)
    } catch (error) {
      console.error('Error fetching brand assets:', error)
      toast({
        title: 'Error',
        description: 'Failed to load brand assets',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [getToken, courseId])

  useEffect(() => {
    if (isOpen) {
      fetchAssets()
    }
  }, [isOpen, fetchAssets])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadFile(file)
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setUploadPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      
      // Auto-set name from filename if not set
      if (!uploadName) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
        setUploadName(nameWithoutExt)
      }
    }
  }

  const handleUpload = async () => {
    if (!uploadFile || !uploadName) {
      toast({
        title: 'Missing information',
        description: 'Please provide a name and select a file',
        variant: 'destructive'
      })
      return
    }

    try {
      setUploading(true)
      const token = await getToken()
      
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('name', uploadName)
      formData.append('type', uploadType)
      formData.append('default_position', uploadPosition)
      formData.append('default_size', uploadSize.toString())
      formData.append('default_opacity', (uploadOpacity / 100).toString())
      if (courseId) {
        formData.append('course_id', courseId.toString())
      }
      
      const response = await fetch(`${API_BASE_URL}/api/brand-assets`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })
      
      if (!response.ok) throw new Error('Failed to upload brand asset')
      
      const newAsset = await response.json()
      setAssets(prev => [newAsset, ...prev])
      
      // Reset form
      setShowUploadDialog(false)
      setUploadName('')
      setUploadType('logo')
      setUploadPosition('bottom-right')
      setUploadSize(10)
      setUploadOpacity(100)
      setUploadFile(null)
      setUploadPreview(null)
      
      toast({
        title: 'Success',
        description: 'Brand asset uploaded successfully'
      })
    } catch (error) {
      console.error('Error uploading brand asset:', error)
      toast({
        title: 'Error',
        description: 'Failed to upload brand asset',
        variant: 'destructive'
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (asset: BrandAsset) => {
    if (!confirm(`Are you sure you want to delete "${asset.name}"?`)) return

    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE_URL}/api/brand-assets/${asset.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to delete brand asset')
      
      setAssets(prev => prev.filter(a => a.id !== asset.id))
      
      toast({
        title: 'Deleted',
        description: 'Brand asset deleted successfully'
      })
    } catch (error) {
      console.error('Error deleting brand asset:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete brand asset',
        variant: 'destructive'
      })
    }
  }

  const handleSelect = (asset: BrandAsset) => {
    if (selectMode && onAssetSelect) {
      onAssetSelect(asset)
      onClose()
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'logo':
        return <Star className="h-3 w-3" />
      case 'watermark':
        return <Image className="h-3 w-3 opacity-50" />
      case 'icon':
        return <Image className="h-3 w-3" />
      default:
        return <Image className="h-3 w-3" />
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectMode ? 'Select Brand Asset' : 'Brand Assets'}
            </DialogTitle>
            <DialogDescription>
              {selectMode 
                ? 'Choose a brand asset to use'
                : 'Manage your logos, watermarks, and icons that can be reused across lessons'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : assets.length === 0 ? (
              <div className="text-center py-12">
                <Image className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-lg mb-2">No brand assets yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload your logos, watermarks, and icons to reuse across your lessons
                </p>
                <Button onClick={() => setShowUploadDialog(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Asset
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {assets.map((asset) => (
                  <Card 
                    key={asset.id} 
                    className={`group relative overflow-hidden ${
                      selectMode ? 'cursor-pointer hover:ring-2 hover:ring-primary' : ''
                    }`}
                    onClick={() => handleSelect(asset)}
                  >
                    <CardContent className="p-3">
                      <div className="aspect-square bg-muted rounded-lg mb-2 flex items-center justify-center overflow-hidden relative">
                        <img 
                          src={`${API_BASE_URL}${asset.url}`} 
                          alt={asset.name}
                          className="w-full h-full object-contain p-2"
                          onError={(e) => {
                            console.error('Image failed to load:', `${API_BASE_URL}${asset.url}`)
                            // Try to reload the image
                            const target = e.currentTarget
                            if (!target.dataset.retried) {
                              target.dataset.retried = 'true'
                              target.src = target.src + '?' + Date.now()
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          {getTypeIcon(asset.type)}
                          <span className="text-sm font-medium truncate">{asset.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {asset.type} • {asset.default_position.replace('-', ' ')}
                        </div>
                      </div>
                      {!selectMode && (
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(asset)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            {!selectMode && assets.length > 0 && (
              <Button onClick={() => setShowUploadDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload New Asset
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              {selectMode ? 'Cancel' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Brand Asset</DialogTitle>
            <DialogDescription>
              Add a new logo, watermark, or icon to your library
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* File Upload */}
            <div className="space-y-2">
              <Label>Image File</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                {uploadPreview ? (
                  <div className="space-y-2">
                    <img 
                      src={uploadPreview} 
                      alt="Preview" 
                      className="max-h-32 mx-auto object-contain"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setUploadFile(null)
                        setUploadPreview(null)
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      Click to upload or drag and drop
                    </span>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="asset-name">Name</Label>
              <Input 
                id="asset-name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="My Logo"
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={uploadType} onValueChange={(v) => setUploadType(v as typeof uploadType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="logo">Logo</SelectItem>
                  <SelectItem value="watermark">Watermark</SelectItem>
                  <SelectItem value="icon">Icon</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Default Position */}
            <div className="space-y-2">
              <Label>Default Position</Label>
              <Select value={uploadPosition} onValueChange={setUploadPosition}>
                <SelectTrigger>
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

            {/* Default Size */}
            <div className="space-y-2">
              <Label>Default Size ({uploadSize}% of width)</Label>
              <Slider
                value={[uploadSize]}
                onValueChange={([v]) => setUploadSize(v)}
                min={5}
                max={30}
                step={1}
              />
            </div>

            {/* Default Opacity */}
            <div className="space-y-2">
              <Label>Default Opacity ({uploadOpacity}%)</Label>
              <Slider
                value={[uploadOpacity]}
                onValueChange={([v]) => setUploadOpacity(v)}
                min={10}
                max={100}
                step={5}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadName}>
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

