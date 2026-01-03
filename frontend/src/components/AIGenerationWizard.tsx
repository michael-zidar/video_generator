import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from '@/hooks/use-toast'
import { Wand2, Sparkles, FileText, Loader2, Check, AlertCircle, ChevronRight, Edit2 } from 'lucide-react'

interface OutlineItem {
  title: string
  keyPoints: string[]
}

interface AIGenerationWizardProps {
  isOpen: boolean
  onClose: () => void
  deckId: number
  token: string
  onSlidesGenerated: () => void
}

type WizardStep = 'input' | 'outline' | 'generating' | 'complete'

export function AIGenerationWizard({ 
  isOpen, 
  onClose, 
  deckId, 
  token,
  onSlidesGenerated 
}: AIGenerationWizardProps) {
  const [step, setStep] = useState<WizardStep>('input')
  const [inputMode, setInputMode] = useState<'prompt' | 'notes'>('prompt')
  const [topic, setTopic] = useState('')
  const [notes, setNotes] = useState('')
  const [numSlides, setNumSlides] = useState('5')
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generatedCount, setGeneratedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const resetWizard = () => {
    setStep('input')
    setTopic('')
    setNotes('')
    setOutline([])
    setProgress(0)
    setGeneratedCount(0)
    setError(null)
  }

  const handleClose = () => {
    resetWizard()
    onClose()
  }

  const handleGenerateOutline = async () => {
    const content = inputMode === 'prompt' ? topic : notes
    if (!content.trim()) {
      toast({
        title: 'Input Required',
        description: 'Please enter a topic or paste your notes.',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/outline/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic: content,
          num_slides: parseInt(numSlides),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate outline')
      }

      const data = await response.json()
      setOutline(data.outline)
      setStep('outline')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate outline'
      setError(message)
      toast({
        title: 'Generation Failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateOutlineItem = (index: number, field: 'title' | 'keyPoints', value: string | string[]) => {
    const newOutline = [...outline]
    if (field === 'title') {
      newOutline[index] = { ...newOutline[index], title: value as string }
    } else {
      newOutline[index] = { ...newOutline[index], keyPoints: value as string[] }
    }
    setOutline(newOutline)
  }

  const handleRemoveOutlineItem = (index: number) => {
    setOutline(outline.filter((_, i) => i !== index))
  }

  const handleAddOutlineItem = () => {
    setOutline([...outline, { title: 'New Slide', keyPoints: ['Point 1'] }])
  }

  const handleGenerateSlides = async () => {
    if (outline.length === 0) {
      toast({
        title: 'No Outline',
        description: 'Please add at least one slide to the outline.',
        variant: 'destructive',
      })
      return
    }

    setStep('generating')
    setProgress(10)
    setIsLoading(true)
    setError(null)

    try {
      // Generate slides from outline
      setProgress(30)
      const response = await fetch('/api/ai/slides/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deck_id: deckId,
          outline: outline,
          topic: inputMode === 'prompt' ? topic : notes.slice(0, 500),
        }),
      })

      setProgress(70)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate slides')
      }

      const data = await response.json()
      setGeneratedCount(data.count)
      setProgress(100)
      setStep('complete')
      
      toast({
        title: 'Slides Generated!',
        description: `Successfully created ${data.count} slides.`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate slides'
      setError(message)
      setStep('outline') // Go back to outline step on error
      toast({
        title: 'Generation Failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleComplete = () => {
    onSlidesGenerated()
    handleClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            AI Slide Generation
          </DialogTitle>
          <DialogDescription>
            {step === 'input' && 'Enter a topic or paste your notes to generate slides'}
            {step === 'outline' && 'Review and edit the outline before generating slides'}
            {step === 'generating' && 'Generating your slides...'}
            {step === 'complete' && 'Your slides are ready!'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Step: Input */}
          {step === 'input' && (
            <div className="space-y-4">
              <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'prompt' | 'notes')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="prompt" className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Topic Prompt
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Paste Notes
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="prompt" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="topic">What's your presentation about?</Label>
                    <Input
                      id="topic"
                      placeholder="e.g., Introduction to Machine Learning, Climate Change Solutions..."
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="notes">Paste your lecture notes or content</Label>
                    <Textarea
                      id="notes"
                      placeholder="Paste your notes, bullet points, or content here..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-[200px]"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex items-center gap-4">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="numSlides">Number of slides</Label>
                  <Select value={numSlides} onValueChange={setNumSlides}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 slides</SelectItem>
                      <SelectItem value="5">5 slides</SelectItem>
                      <SelectItem value="7">7 slides</SelectItem>
                      <SelectItem value="10">10 slides</SelectItem>
                      <SelectItem value="15">15 slides</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleGenerateOutline} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      Generate Outline
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step: Outline Review */}
          {step === 'outline' && (
            <div className="space-y-4">
              <ScrollArea className="h-[350px] pr-4">
                <div className="space-y-3">
                  {outline.map((item, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-sm font-medium text-muted-foreground w-6">
                          {index + 1}.
                        </span>
                        <Input
                          value={item.title}
                          onChange={(e) => handleUpdateOutlineItem(index, 'title', e.target.value)}
                          className="flex-1 font-medium"
                          placeholder="Slide title"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveOutlineItem(index)}
                        >
                          ×
                        </Button>
                      </div>
                      <div className="ml-8 space-y-1">
                        {item.keyPoints.map((point, pointIndex) => (
                          <div key={pointIndex} className="flex items-center gap-2">
                            <span className="text-muted-foreground">•</span>
                            <Input
                              value={point}
                              onChange={(e) => {
                                const newPoints = [...item.keyPoints]
                                newPoints[pointIndex] = e.target.value
                                handleUpdateOutlineItem(index, 'keyPoints', newPoints)
                              }}
                              className="flex-1 h-8 text-sm"
                              placeholder="Key point"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                const newPoints = item.keyPoints.filter((_, i) => i !== pointIndex)
                                handleUpdateOutlineItem(index, 'keyPoints', newPoints)
                              }}
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground"
                          onClick={() => {
                            const newPoints = [...item.keyPoints, '']
                            handleUpdateOutlineItem(index, 'keyPoints', newPoints)
                          }}
                        >
                          + Add point
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Button
                variant="outline"
                size="sm"
                onClick={handleAddOutlineItem}
                className="w-full"
              >
                + Add Slide
              </Button>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep('input')}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit Input
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleGenerateSlides} disabled={isLoading || outline.length === 0}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate {outline.length} Slides
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step: Generating */}
          {step === 'generating' && (
            <div className="py-8 space-y-6">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <Sparkles className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Generating your slides...</p>
                  <p className="text-sm text-muted-foreground">This may take a moment</p>
                </div>
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-center text-sm text-muted-foreground">
                Creating content for {outline.length} slides
              </p>
            </div>
          )}

          {/* Step: Complete */}
          {step === 'complete' && (
            <div className="py-8 space-y-6">
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-lg">Slides Generated!</p>
                  <p className="text-muted-foreground">
                    Successfully created {generatedCount} slides for your deck
                  </p>
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button onClick={handleComplete}>
                  View Slides
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

