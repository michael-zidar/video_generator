import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { Save, Trash2, Layout, Loader2, Plus, Check } from 'lucide-react'
import type { SlideElement } from '@/types/slide'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface SlideTemplate {
  id: number
  user_id: string
  course_id: number | null
  name: string
  description: string
  elements: SlideElement[]
  background_color: string
  created_at: string
}

// Accept any slide-like object - using generic type for body to accept various slide formats
interface SlideInput {
  id: number
  title?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any
  background_color?: string
}

interface TemplateManagerProps {
  courseId?: number
  currentSlide?: SlideInput | null
  isOpen: boolean
  onClose: () => void
  onApplyTemplate?: (elements: SlideElement[], backgroundColor: string) => void
  mode?: 'browse' | 'save'
}

export function TemplateManager({
  courseId,
  currentSlide,
  isOpen,
  onClose,
  onApplyTemplate,
  mode = 'browse'
}: TemplateManagerProps) {
  const { getToken } = useAuth()
  const [templates, setTemplates] = useState<SlideTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [applying, setApplying] = useState<number | null>(null)
  
  // Save dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(mode === 'save')
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true)
      const token = await getToken()
      const params = courseId ? `?course_id=${courseId}` : ''
      const response = await fetch(`${API_BASE_URL}/api/templates${params}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to fetch templates')
      
      const data = await response.json()
      setTemplates(data)
    } catch (error) {
      console.error('Error fetching templates:', error)
      toast({
        title: 'Error',
        description: 'Failed to load templates',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [getToken, courseId])

  useEffect(() => {
    if (isOpen) {
      fetchTemplates()
      if (mode === 'save') {
        setShowSaveDialog(true)
        // Pre-fill name from slide title
        if (currentSlide?.title) {
          setTemplateName(`${currentSlide.title} Template`)
        }
      }
    }
  }, [isOpen, fetchTemplates, mode, currentSlide])

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for your template',
        variant: 'destructive'
      })
      return
    }

    if (!currentSlide) {
      toast({
        title: 'No slide selected',
        description: 'Please select a slide to save as a template',
        variant: 'destructive'
      })
      return
    }

    try {
      setSaving(true)
      const token = await getToken()
      
      // Get elements from current slide
      const elements = currentSlide.body?.elements || []
      
      const response = await fetch(`${API_BASE_URL}/api/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: templateName,
          description: templateDescription,
          elements,
          background_color: currentSlide.background_color || '#ffffff',
          course_id: courseId || null
        })
      })
      
      if (!response.ok) throw new Error('Failed to save template')
      
      const newTemplate = await response.json()
      setTemplates(prev => [newTemplate, ...prev])
      
      setShowSaveDialog(false)
      setTemplateName('')
      setTemplateDescription('')
      
      toast({
        title: 'Template saved',
        description: 'Your slide template has been saved successfully'
      })
      
      if (mode === 'save') {
        onClose()
      }
    } catch (error) {
      console.error('Error saving template:', error)
      toast({
        title: 'Error',
        description: 'Failed to save template',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleApplyTemplate = async (template: SlideTemplate) => {
    if (!onApplyTemplate) return

    try {
      setApplying(template.id)
      
      // Apply the template elements and background
      onApplyTemplate(template.elements, template.background_color)
      
      toast({
        title: 'Template applied',
        description: `Applied "${template.name}" to current slide`
      })
      
      onClose()
    } catch (error) {
      console.error('Error applying template:', error)
      toast({
        title: 'Error',
        description: 'Failed to apply template',
        variant: 'destructive'
      })
    } finally {
      setApplying(null)
    }
  }

  const handleDeleteTemplate = async (template: SlideTemplate) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) return

    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE_URL}/api/templates/${template.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to delete template')
      
      setTemplates(prev => prev.filter(t => t.id !== template.id))
      
      toast({
        title: 'Deleted',
        description: 'Template deleted successfully'
      })
    } catch (error) {
      console.error('Error deleting template:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete template',
        variant: 'destructive'
      })
    }
  }

  // Simple preview of template elements
  const renderTemplatePreview = (template: SlideTemplate) => {
    const elements = template.elements || []
    const textElements = elements.filter(el => el.type === 'text').slice(0, 2)
    const imageCount = elements.filter(el => el.type === 'image').length
    const shapeCount = elements.filter(el => el.type === 'shape').length
    
    return (
      <div 
        className="aspect-video rounded-lg flex flex-col items-center justify-center p-2 text-xs"
        style={{ backgroundColor: template.background_color }}
      >
        {textElements.length > 0 ? (
          <div className="space-y-1 text-center">
            {textElements.map((el, i) => (
              <div 
                key={i} 
                className="truncate max-w-full px-1"
                style={{ 
                  fontSize: '0.5rem',
                  fontWeight: el.type === 'text' && (el as { fontWeight?: string }).fontWeight === 'bold' ? 'bold' : 'normal'
                }}
              >
                {el.type === 'text' ? (el as { content?: string }).content?.substring(0, 20) || 'Text' : ''}
              </div>
            ))}
          </div>
        ) : (
          <Layout className="h-6 w-6 text-muted-foreground/30" />
        )}
        <div className="mt-1 text-muted-foreground/50 text-[0.5rem]">
          {elements.length} element{elements.length !== 1 ? 's' : ''}
          {imageCount > 0 && ` • ${imageCount} img`}
          {shapeCount > 0 && ` • ${shapeCount} shape`}
        </div>
      </div>
    )
  }

  return (
    <>
      <Dialog open={isOpen && !showSaveDialog} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Slide Templates</DialogTitle>
            <DialogDescription>
              {onApplyTemplate 
                ? 'Choose a template to apply to your current slide'
                : 'Browse and manage your saved slide templates'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12">
                <Layout className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-lg mb-2">No templates yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Save your slide designs as templates to reuse across lessons
                </p>
                {currentSlide && (
                  <Button onClick={() => setShowSaveDialog(true)}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Current Slide as Template
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <Card 
                    key={template.id} 
                    className={`group relative overflow-hidden ${
                      onApplyTemplate ? 'cursor-pointer hover:ring-2 hover:ring-primary' : ''
                    }`}
                    onClick={() => onApplyTemplate && handleApplyTemplate(template)}
                  >
                    <CardContent className="p-3">
                      {renderTemplatePreview(template)}
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{template.name}</span>
                          {applying === template.id && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                        </div>
                        {template.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {template.description}
                          </p>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {template.course_id ? 'Course' : 'Global'} template
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteTemplate(template)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            {currentSlide && templates.length > 0 && (
              <Button variant="outline" onClick={() => setShowSaveDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Save Current Slide
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={(open) => {
        setShowSaveDialog(open)
        if (!open && mode === 'save') {
          onClose()
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>
              Save the current slide design as a reusable template
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input 
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="My Slide Template"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-description">Description (optional)</Label>
              <Textarea 
                id="template-description"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Describe when to use this template..."
                rows={3}
              />
            </div>

            {currentSlide && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div 
                  className="aspect-video rounded-lg border flex items-center justify-center"
                  style={{ backgroundColor: currentSlide.background_color || '#ffffff' }}
                >
                  <div className="text-center text-sm text-muted-foreground">
                    <Layout className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {currentSlide.body?.elements?.length || 0} elements
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowSaveDialog(false)
                if (mode === 'save') {
                  onClose()
                }
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} disabled={saving || !templateName.trim()}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

