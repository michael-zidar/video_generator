import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { useAudioPlayback } from '@/hooks/useAudioPlayback'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft,
  Plus,
  Play,
  Pause,
  Undo2,
  Redo2,
  Settings,
  Share2,
  Download,
  Video,
  Trash2,
  Copy,
  ZoomIn,
  ZoomOut,
  Wand2,
  Mic,
  FileText,
  Subtitles,
  ChevronRight,
  GripVertical,
  MoreVertical,
  FolderTree,
  ChevronDown,
  ChevronUp,
  Grid3X3,
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { RevealPreview } from '@/components/RevealPreview'
import { AIGenerationWizard } from '@/components/AIGenerationWizard'
import { RenderDialog } from '@/components/RenderDialog'
import { Timeline } from '@/components/Timeline'
import { SlideCanvas } from '@/components/Canvas'
import { migrateSlideToElements, isElementBasedFormat } from '@/utils/slideMigration'
import { Presentation, FileDown, Loader2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, PenTool } from 'lucide-react'

interface Course {
  id: number
  name: string
  description: string
  lessons?: Lesson[]
}

interface Lesson {
  id: number
  title: string
  course_id: number
}

interface Deck {
  id: number
  lesson_id: number
  title: string
  aspect_ratio: string
  resolution: string
  theme: object
  intro_scene_enabled: boolean
  outro_scene_enabled: boolean
}

interface SlideBody {
  layout?: string
  text?: string
  bullets?: string[]
  // Quote layout
  quote_text?: string
  quote_author?: string
  // Stats layout
  stats?: Array<{ value: string; label: string }>
  // Comparison layout
  left_label?: string
  right_label?: string
  comparison_left?: string[]
  comparison_right?: string[]
  // Image-text layout
  image_prompt?: string
}

interface Slide {
  id: number
  deck_id: number
  position: number
  title: string
  body: SlideBody
  speaker_notes: string
  slide_asset_id?: number
  duration_ms?: number
  transition?: { type: string }
  background_color?: string
  image_url?: string
  image_position?: string
}

// Sortable slide thumbnail component
interface SortableSlideProps {
  slide: Slide
  index: number
  isSelected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function SortableSlide({ slide, index, isSelected, onSelect, onDuplicate, onDelete }: SortableSlideProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-lg border-2 cursor-pointer transition-all ${
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-transparent hover:border-muted-foreground/20'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-2 p-2">
        <div
          {...attributes}
          {...listeners}
          className="touch-none cursor-grab active:cursor-grabbing mt-1"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground opacity-50 hover:opacity-100" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground mb-1">Slide {index + 1}</div>
          <div
            className="aspect-video rounded bg-muted flex items-center justify-center text-xs overflow-hidden w-full max-w-[180px]"
            style={{ backgroundColor: slide.background_color || '#f4f4f5' }}
          >
            <span className="text-center px-2 truncate text-foreground text-[10px]">
              {slide.title || 'Untitled'}
            </span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function Editor() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const navigate = useNavigate()
  const { token } = useAuthStore()

  const [course, setCourse] = useState<Course | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [deck, setDeck] = useState<Deck | null>(null)
  const [slides, setSlides] = useState<Slide[]>([])
  const [selectedSlide, setSelectedSlide] = useState<Slide | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('slides')
  const [zoom, setZoom] = useState(100)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [expandedCourses, setExpandedCourses] = useState<Set<number>>(new Set())
  const [showNavTree, setShowNavTree] = useState(true)
  const [showSafeAreaGuides, setShowSafeAreaGuides] = useState(false)
  const [showPresentation, setShowPresentation] = useState(false)
  const [canvasEditMode, setCanvasEditMode] = useState(false)
  const [showAIWizard, setShowAIWizard] = useState(false)
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [scriptDuration, setScriptDuration] = useState('30')
  const [voices, setVoices] = useState<Array<{ voice_id: string; name: string; category: string; labels?: { accent?: string; gender?: string } }>>([])
  const [selectedVoice, setSelectedVoice] = useState('56bVxM2zo2S7h5paHHBt') // Zidar voice
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [voiceovers, setVoiceovers] = useState<Map<number, { audio_url: string; duration_ms: number }>>(new Map())
  const [playingAudio, setPlayingAudio] = useState<HTMLAudioElement | null>(null)
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false)
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false)
  const [showRenderDialog, setShowRenderDialog] = useState(false)

  // DnD sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Audio playback hook for timeline
  const handleSlideChangeFromAudio = useCallback((slideId: number) => {
    const slide = slides.find(s => s.id === slideId)
    if (slide && slide.id !== selectedSlide?.id) {
      setSelectedSlide(slide)
    }
  }, [slides, selectedSlide])

  const audioPlayback = useAudioPlayback({
    onSlideChange: handleSlideChangeFromAudio,
    onPlaybackEnd: () => {
      // Stop any preview audio that might be playing
      if (playingAudio) {
        playingAudio.pause()
        setPlayingAudio(null)
      }
    }
  })

  // Load audio clips when voiceovers change
  useEffect(() => {
    if (slides.length === 0) return

    // Build audio clips from slides and voiceovers
    let accumulatedTime = 0
    const clips = slides.map((slide) => {
      const voiceover = voiceovers.get(slide.id)
      const duration = slide.duration_ms || 5000
      const clip = {
        slideId: slide.id,
        url: voiceover?.audio_url || '',
        startTime: accumulatedTime,
        duration: duration,
      }
      accumulatedTime += duration
      return clip
    }).filter(clip => clip.url) // Only include clips with audio

    if (clips.length > 0) {
      audioPlayback.loadClips(clips)
    }
  }, [slides, voiceovers])

  useEffect(() => {
    fetchLesson()
    fetchDeck()
    fetchCourses()
    fetchVoices()
  }, [lessonId])

  const fetchVoices = async () => {
    try {
      const response = await fetch('/api/ai/voices', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setVoices(data.voices || [])
        // Set default voice
        if (data.voices?.length > 0 && !selectedVoice) {
          setSelectedVoice(data.voices[0].voice_id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch voices:', error)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      const currentIndex = selectedSlide ? slides.findIndex(s => s.id === selectedSlide.id) : -1

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          if (currentIndex > 0) {
            setSelectedSlide(slides[currentIndex - 1])
          }
          break
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          if (currentIndex < slides.length - 1) {
            setSelectedSlide(slides[currentIndex + 1])
          }
          break
        case 'Delete':
        case 'Backspace':
          // Only delete if not in an input and there's a selected slide
          if (selectedSlide && slides.length > 1) {
            e.preventDefault()
            handleDeleteSlide(selectedSlide.id)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedSlide, slides])

  const fetchCourses = async () => {
    try {
      const response = await fetch('/api/courses', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        // Fetch lessons for each course
        const coursesWithLessons = await Promise.all(
          data.map(async (course: Course) => {
            const lessonsResponse = await fetch(`/api/courses/${course.id}/lessons`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (lessonsResponse.ok) {
              const lessons = await lessonsResponse.json()
              return { ...course, lessons }
            }
            return { ...course, lessons: [] }
          })
        )
        setCourses(coursesWithLessons)
      }
    } catch (error) {
      console.error('Failed to fetch courses:', error)
    }
  }

  const fetchLesson = async () => {
    try {
      const response = await fetch(`/api/lessons/${lessonId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setLesson(data)
        // Expand the current course
        setExpandedCourses(prev => new Set(prev).add(data.course_id))
        // Fetch course details
        const courseResponse = await fetch(`/api/courses/${data.course_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (courseResponse.ok) {
          const courseData = await courseResponse.json()
          setCourse(courseData)
        }
      }
    } catch (error) {
      console.error('Failed to fetch lesson:', error)
    }
  }

  const toggleCourseExpand = (courseId: number) => {
    setExpandedCourses(prev => {
      const newSet = new Set(prev)
      if (newSet.has(courseId)) {
        newSet.delete(courseId)
      } else {
        newSet.add(courseId)
      }
      return newSet
    })
  }

  const fetchDeck = async () => {
    try {
      const response = await fetch(`/api/lessons/${lessonId}/deck`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setDeck(data)
        fetchSlides(data.id)
      } else if (response.status === 404) {
        // Create a new deck
        const createResponse = await fetch(`/api/lessons/${lessonId}/deck`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: 'Untitled Deck',
            aspect_ratio: '16:9',
            resolution: '1080p',
          }),
        })
        if (createResponse.ok) {
          const newDeck = await createResponse.json()
          setDeck(newDeck)
          setSlides([])
          setIsLoading(false)
        }
      }
    } catch (error) {
      console.error('Failed to fetch deck:', error)
      setIsLoading(false)
    }
  }

  const fetchSlides = async (deckId: number) => {
    try {
      const response = await fetch(`/api/decks/${deckId}/slides`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setSlides(data)
        if (data.length > 0) {
          setSelectedSlide(data[0])
        }
        // Fetch existing voiceovers for all slides
        fetchVoiceovers(data)
      }
    } catch (error) {
      console.error('Failed to fetch slides:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchVoiceovers = async (slidesList: Slide[]) => {
    const newVoiceovers = new Map<number, { audio_url: string; duration_ms: number }>()
    
    for (const slide of slidesList) {
      try {
        const response = await fetch(`/api/ai/voiceover/${slide.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.ok) {
          const data = await response.json()
          if (data.audio_asset_id || data.status === 'succeeded') {
            // Get the audio URL from stored path or construct from asset
            const audioUrl = data.audio_url || `/data/assets/audio/${data.audio_asset_id}`
            newVoiceovers.set(slide.id, {
              audio_url: audioUrl,
              duration_ms: data.duration_ms || slide.duration_ms || 5000,
            })
          }
        }
      } catch (error) {
        // Voiceover not found for this slide, skip
      }
    }
    
    if (newVoiceovers.size > 0) {
      setVoiceovers(newVoiceovers)
    }
  }

  const handleAddSlide = async () => {
    if (!deck) return

    try {
      const response = await fetch(`/api/decks/${deck.id}/slides`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: 'New Slide',
          body: { bullets: [] },
          speaker_notes: '',
          position: slides.length,
        }),
      })

      if (response.ok) {
        const newSlide = await response.json()
        setSlides([...slides, newSlide])
        setSelectedSlide(newSlide)
        toast({
          title: 'Slide added',
          description: 'A new slide has been added to the deck.',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add slide',
        variant: 'destructive',
      })
    }
  }

  const handleUpdateSlide = async (slideId: number, updates: Partial<Slide>) => {
    try {
      const response = await fetch(`/api/slides/${slideId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const updated = await response.json()
        setSlides(slides.map(s => s.id === slideId ? updated : s))
        if (selectedSlide?.id === slideId) {
          setSelectedSlide(updated)
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update slide',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteSlide = async (slideId: number) => {
    if (!confirm('Are you sure you want to delete this slide?')) return

    try {
      const response = await fetch(`/api/slides/${slideId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const newSlides = slides.filter(s => s.id !== slideId)
        setSlides(newSlides)
        if (selectedSlide?.id === slideId) {
          setSelectedSlide(newSlides.length > 0 ? newSlides[0] : null)
        }
        toast({
          title: 'Slide deleted',
          description: 'The slide has been removed.',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete slide',
        variant: 'destructive',
      })
    }
  }

  const handleDuplicateSlide = async (slideId: number) => {
    try {
      const response = await fetch(`/api/slides/${slideId}/duplicate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const duplicated = await response.json()
        const slideIndex = slides.findIndex(s => s.id === slideId)
        const newSlides = [...slides]
        newSlides.splice(slideIndex + 1, 0, duplicated)
        setSlides(newSlides)
        toast({
          title: 'Slide duplicated',
          description: 'A copy of the slide has been created.',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to duplicate slide',
        variant: 'destructive',
      })
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = slides.findIndex((s) => s.id === active.id)
      const newIndex = slides.findIndex((s) => s.id === over.id)

      const newSlides = arrayMove(slides, oldIndex, newIndex)
      setSlides(newSlides)

      // Update on backend
      try {
        const response = await fetch('/api/slides/reorder', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            deck_id: deck?.id,
            slide_ids: newSlides.map((s) => s.id),
          }),
        })

        if (response.ok) {
          toast({
            title: 'Slides reordered',
            description: 'The slide order has been updated.',
          })
        }
      } catch (error) {
        // Revert on error
        setSlides(slides)
        toast({
          title: 'Error',
          description: 'Failed to reorder slides',
          variant: 'destructive',
        })
      }
    }
  }

  const handleUpdateDeckSettings = async (updates: Partial<Deck>) => {
    if (!deck) return

    try {
      const response = await fetch(`/api/decks/${deck.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const updated = await response.json()
        setDeck(updated)
        setIsSettingsOpen(false)
        toast({
          title: 'Settings saved',
          description: 'Deck settings have been updated.',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive',
      })
    }
  }

  // Timeline playback handlers using audio hook
  const handleTimelinePlay = useCallback(() => {
    audioPlayback.play()
  }, [audioPlayback])

  const handleTimelinePause = useCallback(() => {
    audioPlayback.pause()
  }, [audioPlayback])

  const handleTimelineStop = useCallback(() => {
    audioPlayback.stop()
    if (slides.length > 0) {
      setSelectedSlide(slides[0])
    }
  }, [audioPlayback, slides])

  const handleTimelineSeek = useCallback((timeMs: number) => {
    audioPlayback.seekTo(timeMs)
    
    // Find which slide this time falls into
    let accumulatedTime = 0
    for (const slide of slides) {
      const duration = slide.duration_ms || 5000
      if (timeMs < accumulatedTime + duration) {
        if (slide.id !== selectedSlide?.id) {
          setSelectedSlide(slide)
        }
        break
      }
      accumulatedTime += duration
    }
  }, [audioPlayback, slides, selectedSlide])

  const handleTimelineSlideSelect = useCallback((slideId: number) => {
    const slide = slides.find(s => s.id === slideId)
    if (slide) {
      setSelectedSlide(slide)
    }
  }, [slides])

  // Generate audio for a slide
  const handleGenerateAudio = async (slideId: number) => {
    if (!selectedVoice) {
      toast({
        title: 'No Voice Selected',
        description: 'Please select a voice first.',
        variant: 'destructive',
      })
      return
    }

    const slide = slides.find(s => s.id === slideId)
    if (!slide?.speaker_notes) {
      toast({
        title: 'No Script',
        description: 'Add speaker notes first before generating audio.',
        variant: 'destructive',
      })
      return
    }

    setIsGeneratingAudio(true)
    try {
      const response = await fetch('/api/ai/voiceover/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slide_id: slideId,
          voice_id: selectedVoice,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate audio')
      }

      const data = await response.json()
      
      // Update voiceovers map
      setVoiceovers(prev => new Map(prev).set(slideId, {
        audio_url: data.audio_url,
        duration_ms: data.duration_ms,
      }))

      // Update slide duration
      setSlides(slides.map(s => 
        s.id === slideId ? { ...s, duration_ms: data.duration_ms } : s
      ))
      if (selectedSlide?.id === slideId) {
        setSelectedSlide({ ...selectedSlide, duration_ms: data.duration_ms })
      }
      
      toast({
        title: 'Audio Generated',
        description: `Created ${Math.round(data.duration_ms / 1000)}s voiceover.`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate audio'
      toast({
        title: 'Generation Failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingAudio(false)
    }
  }

  // Generate audio for all slides
  const handleGenerateAllAudio = async () => {
    if (!selectedVoice) {
      toast({
        title: 'No Voice Selected',
        description: 'Please select a voice first.',
        variant: 'destructive',
      })
      return
    }

    const slidesWithNotes = slides.filter(s => s.speaker_notes?.trim())
    if (slidesWithNotes.length === 0) {
      toast({
        title: 'No Scripts',
        description: 'Add speaker notes to slides before generating audio.',
        variant: 'destructive',
      })
      return
    }

    setIsGeneratingAudio(true)
    try {
      const response = await fetch('/api/ai/voiceover/generate-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slide_ids: slidesWithNotes.map(s => s.id),
          voice_id: selectedVoice,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate audio')
      }

      const data = await response.json()
      
      // Update voiceovers map
      const newVoiceovers = new Map(voiceovers)
      const durationUpdates = new Map<number, number>()
      
      for (const result of data.results) {
        newVoiceovers.set(result.slide_id, {
          audio_url: result.audio_url,
          duration_ms: result.duration_ms,
        })
        durationUpdates.set(result.slide_id, result.duration_ms)
      }
      
      setVoiceovers(newVoiceovers)

      // Update slide durations
      setSlides(slides.map(s => ({
        ...s,
        duration_ms: durationUpdates.get(s.id) ?? s.duration_ms
      })))
      
      toast({
        title: 'Audio Generated',
        description: `Created voiceovers for ${data.generated_count} slides.`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate audio'
      toast({
        title: 'Generation Failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingAudio(false)
    }
  }

  // Play/pause audio
  const handlePlayAudio = (audioUrl: string) => {
    if (playingAudio) {
      playingAudio.pause()
      setPlayingAudio(null)
    }
    
    const audio = new Audio(audioUrl)
    audio.onended = () => setPlayingAudio(null)
    audio.play()
    setPlayingAudio(audio)
  }

  const handleStopAudio = () => {
    if (playingAudio) {
      playingAudio.pause()
      setPlayingAudio(null)
    }
  }

  // Generate script for a slide using AI
  const handleGenerateScript = async (slideId: number) => {
    setIsGeneratingScript(true)
    try {
      const response = await fetch('/api/ai/scripts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slide_id: slideId,
          target_duration: parseInt(scriptDuration),
          tone: 'professional',
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate script')
      }

      const data = await response.json()
      
      // Update the slide with the new script
      setSlides(slides.map(s => 
        s.id === slideId ? { ...s, speaker_notes: data.speaker_notes } : s
      ))
      if (selectedSlide?.id === slideId) {
        setSelectedSlide({ ...selectedSlide, speaker_notes: data.speaker_notes })
      }
      
      toast({
        title: 'Script Generated',
        description: `Created a ${scriptDuration}-second narration script.`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate script'
      toast({
        title: 'Generation Failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingScript(false)
    }
  }

  // Generate scripts for all slides
  const handleGenerateAllScripts = async () => {
    if (slides.length === 0) return
    
    setIsGeneratingScript(true)
    try {
      const response = await fetch('/api/ai/scripts/generate-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slide_ids: slides.map(s => s.id),
          target_duration: parseInt(scriptDuration),
          tone: 'professional',
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate scripts')
      }

      const data = await response.json()
      
      // Update slides with new scripts
      const scriptMap = new Map<number, string>(data.results.map((r: { slide_id: number, speaker_notes: string }) => 
        [r.slide_id, r.speaker_notes] as [number, string]
      ))
      
      setSlides(slides.map(s => ({
        ...s,
        speaker_notes: scriptMap.get(s.id) ?? s.speaker_notes
      })))
      
      if (selectedSlide && scriptMap.has(selectedSlide.id)) {
        const newNotes = scriptMap.get(selectedSlide.id)
        setSelectedSlide({ 
          ...selectedSlide, 
          speaker_notes: newNotes ?? selectedSlide.speaker_notes 
        })
      }
      
      toast({
        title: 'Scripts Generated',
        description: `Created scripts for ${data.generated_count} slides.`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate scripts'
      toast({
        title: 'Generation Failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingScript(false)
    }
  }

  // Helper function to determine text color based on background
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
    const mutedColor = textColor === '#1f2937' ? '#6b7280' : '#d1d5db'

    switch (layout) {
      case 'title-only':
        return (
          <div className="h-full flex flex-col items-center justify-center p-8">
            <h2 
              className="text-3xl font-bold text-center"
              style={{ color: textColor }}
            >
              {slide.title || 'Slide Title'}
            </h2>
          </div>
        )

      case 'title-bullets':
        return (
          <div className="h-full flex flex-col p-8">
            <h2 
              className="text-2xl font-bold mb-6"
              style={{ color: textColor }}
            >
              {slide.title || 'Slide Title'}
            </h2>
            {slide.body?.bullets && slide.body.bullets.length > 0 ? (
              <ul className="space-y-3 flex-1">
                {slide.body.bullets.map((bullet, i) => (
                  <li 
                    key={i} 
                    className="flex items-start gap-3 text-lg"
                    style={{ color: textColor }}
                  >
                    <span className="text-primary mt-1">•</span>
                    <span>{bullet || 'Bullet point'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm" style={{ color: mutedColor }}>
                Add bullet points in the Properties panel
              </p>
            )}
          </div>
        )

      case 'two-column': {
        const midpoint = Math.ceil((slide.body?.bullets?.length || 0) / 2)
        const leftBullets = slide.body?.bullets?.slice(0, midpoint) || []
        const rightBullets = slide.body?.bullets?.slice(midpoint) || []
        return (
          <div className="h-full flex flex-col p-8">
            <h2 
              className="text-2xl font-bold mb-6"
              style={{ color: textColor }}
            >
              {slide.title || 'Slide Title'}
            </h2>
            <div className="flex-1 grid grid-cols-2 gap-6">
              <ul className="space-y-2">
                {leftBullets.map((bullet, i) => (
                  <li 
                    key={i} 
                    className="flex items-start gap-2"
                    style={{ color: textColor }}
                  >
                    <span className="text-primary mt-1">•</span>
                    <span>{bullet || 'Bullet point'}</span>
                  </li>
                ))}
              </ul>
              <ul className="space-y-2">
                {rightBullets.map((bullet, i) => (
                  <li 
                    key={i} 
                    className="flex items-start gap-2"
                    style={{ color: textColor }}
                  >
                    <span className="text-primary mt-1">•</span>
                    <span>{bullet || 'Bullet point'}</span>
                  </li>
                ))}
              </ul>
            </div>
            {(!slide.body?.bullets || slide.body.bullets.length === 0) && (
              <p className="text-sm text-center" style={{ color: mutedColor }}>
                Add bullet points in the Properties panel
              </p>
            )}
          </div>
        )
      }

      case 'centered':
        return (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <h2 
              className="text-3xl font-bold mb-4"
              style={{ color: textColor }}
            >
              {slide.title || 'Slide Title'}
            </h2>
            {slide.body?.text ? (
              <p 
                className="text-lg max-w-md"
                style={{ color: mutedColor }}
              >
                {slide.body.text}
              </p>
            ) : (
              <p className="text-sm" style={{ color: mutedColor }}>
                Add body text in the Properties panel
              </p>
            )}
          </div>
        )

      case 'quote':
        return (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            {slide.title && (
              <p 
                className="text-sm uppercase tracking-wider mb-6"
                style={{ color: mutedColor }}
              >
                {slide.title}
              </p>
            )}
            <blockquote 
              className="text-2xl italic font-medium max-w-lg leading-relaxed"
              style={{ color: textColor }}
            >
              "{slide.body?.quote_text || 'Add your quote in the Properties panel'}"
            </blockquote>
            {slide.body?.quote_author && (
              <p 
                className="mt-6 text-base"
                style={{ color: mutedColor }}
              >
                — {slide.body.quote_author}
              </p>
            )}
          </div>
        )

      case 'stats-grid':
        return (
          <div className="h-full flex flex-col p-8">
            <h2 
              className="text-2xl font-bold mb-6 text-center"
              style={{ color: textColor }}
            >
              {slide.title || 'Key Statistics'}
            </h2>
            {slide.body?.stats && slide.body.stats.length > 0 ? (
              <div className={`flex-1 grid gap-4 ${
                slide.body.stats.length <= 2 ? 'grid-cols-2' : 
                slide.body.stats.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
              }`}>
                {slide.body.stats.map((stat, i) => (
                  <div 
                    key={i} 
                    className="flex flex-col items-center justify-center p-4 rounded-lg bg-primary/5"
                  >
                    <span 
                      className="text-3xl font-bold text-primary"
                    >
                      {stat.value}
                    </span>
                    <span 
                      className="text-sm mt-2 text-center"
                      style={{ color: mutedColor }}
                    >
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-center" style={{ color: mutedColor }}>
                Add statistics in the Properties panel
              </p>
            )}
          </div>
        )

      case 'comparison':
        return (
          <div className="h-full flex flex-col p-8">
            <h2 
              className="text-2xl font-bold mb-6 text-center"
              style={{ color: textColor }}
            >
              {slide.title || 'Comparison'}
            </h2>
            <div className="flex-1 grid grid-cols-2 gap-6">
              {/* Left column */}
              <div className="flex flex-col">
                <div 
                  className="text-lg font-semibold mb-4 pb-2 border-b text-center"
                  style={{ color: textColor, borderColor: mutedColor }}
                >
                  {slide.body?.left_label || 'Option A'}
                </div>
                <ul className="space-y-2">
                  {(slide.body?.comparison_left || []).map((item, i) => (
                    <li 
                      key={i} 
                      className="flex items-start gap-2 text-sm"
                      style={{ color: textColor }}
                    >
                      <span className="text-primary mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Right column */}
              <div className="flex flex-col">
                <div 
                  className="text-lg font-semibold mb-4 pb-2 border-b text-center"
                  style={{ color: textColor, borderColor: mutedColor }}
                >
                  {slide.body?.right_label || 'Option B'}
                </div>
                <ul className="space-y-2">
                  {(slide.body?.comparison_right || []).map((item, i) => (
                    <li 
                      key={i} 
                      className="flex items-start gap-2 text-sm"
                      style={{ color: textColor }}
                    >
                      <span className="text-primary mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {(!slide.body?.comparison_left?.length && !slide.body?.comparison_right?.length) && (
              <p className="text-sm text-center mt-4" style={{ color: mutedColor }}>
                Add comparison items in the Properties panel
              </p>
            )}
          </div>
        )

      case 'image-text':
        return (
          <div className="h-full flex p-6 gap-6">
            {/* Image placeholder */}
            <div 
              className="flex-1 rounded-lg bg-muted/50 flex items-center justify-center border-2 border-dashed border-muted-foreground/20"
            >
              {slide.image_url ? (
                <img 
                  src={slide.image_url} 
                  alt={slide.title || 'Slide image'} 
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <div className="text-center p-4">
                  <div className="text-muted-foreground/50 text-sm">
                    {slide.body?.image_prompt ? (
                      <>Generate image from prompt</>
                    ) : (
                      <>No image added</>
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* Text content */}
            <div className="flex-1 flex flex-col justify-center">
              <h2 
                className="text-2xl font-bold mb-4"
                style={{ color: textColor }}
              >
                {slide.title || 'Slide Title'}
              </h2>
              {slide.body?.text ? (
                <p 
                  className="text-base"
                  style={{ color: mutedColor }}
                >
                  {slide.body.text}
                </p>
              ) : (
                <p className="text-sm" style={{ color: mutedColor }}>
                  Add body text in the Properties panel
                </p>
              )}
            </div>
          </div>
        )

      case 'title-body':
      default:
        return (
          <div className="h-full flex flex-col p-8">
            <h2 
              className="text-2xl font-bold mb-4"
              style={{ color: textColor }}
            >
              {slide.title || 'Slide Title'}
            </h2>
            {slide.body?.text ? (
              <p 
                className="text-base flex-1"
                style={{ color: mutedColor }}
              >
                {slide.body.text}
              </p>
            ) : (
              <p className="text-sm" style={{ color: mutedColor }}>
                Add body text in the Properties panel
              </p>
            )}
          </div>
        )
    }
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading editor...</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Bar */}
      <header className="h-14 border-b flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/courses/${lesson?.course_id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Video className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <div className="font-semibold text-sm">{lesson?.title || 'Untitled'}</div>
              <div className="text-xs text-muted-foreground">{deck?.title || 'Loading...'}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            title="Undo (Cmd+Z)"
            onClick={() => toast({
              title: 'Undo',
              description: 'Undo functionality coming soon!',
            })}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            title="Redo (Cmd+Shift+Z)"
            onClick={() => toast({
              title: 'Redo',
              description: 'Redo functionality coming soon!',
            })}
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="ghost" size="sm" onClick={() => audioPlayback.isPlaying ? audioPlayback.pause() : audioPlayback.play()}>
            {audioPlayback.isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Preview
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowPresentation(true)}
            disabled={slides.length === 0}
          >
            <Presentation className="h-4 w-4 mr-2" />
            Present
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowRenderDialog(true)}>
                <Video className="mr-2 h-4 w-4" />
                Render Video (MP4)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                if (!deck) return
                window.open(`/api/export/deck/${deck.id}/reveal`, '_blank')
                toast({
                  title: 'Export Started',
                  description: 'Your RevealJS presentation is being downloaded.',
                })
              }}>
                <FileDown className="mr-2 h-4 w-4" />
                Export as RevealJS HTML
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => toast({
                title: 'Export PDF',
                description: 'PDF export coming soon.',
              })}>
                <FileText className="mr-2 h-4 w-4" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              const shareUrl = `${window.location.origin}/share/${deck?.id}`
              navigator.clipboard.writeText(shareUrl)
              toast({
                title: 'Share Link Copied',
                description: 'The share link has been copied to your clipboard.',
              })
            }}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>

          <ThemeToggle />

          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Deck Settings</DialogTitle>
                <DialogDescription>
                  Configure resolution, aspect ratio, and other deck settings.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Resolution</Label>
                  <Select
                    value={deck?.resolution || '1080p'}
                    onValueChange={(value) => handleUpdateDeckSettings({ resolution: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="720p">720p (HD)</SelectItem>
                      <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                      <SelectItem value="4K">4K (Ultra HD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Aspect Ratio</Label>
                  <Select
                    value={deck?.aspect_ratio || '16:9'}
                    onValueChange={(value) => handleUpdateDeckSettings({ aspect_ratio: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
                      <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                      <SelectItem value="1:1">1:1 (Square)</SelectItem>
                      <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Intro Scene</Label>
                  <Button
                    variant={deck?.intro_scene_enabled ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleUpdateDeckSettings({ intro_scene_enabled: !deck?.intro_scene_enabled })}
                  >
                    {deck?.intro_scene_enabled ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Outro Scene</Label>
                  <Button
                    variant={deck?.outro_scene_enabled ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleUpdateDeckSettings({ outro_scene_enabled: !deck?.outro_scene_enabled })}
                  >
                    {deck?.outro_scene_enabled ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Navigation Tree & Slide Thumbnails */}
        <div 
          className={`h-full flex flex-col border-r bg-background transition-all duration-300 ${
            leftSidebarCollapsed ? 'w-12' : 'w-72'
          }`}
        >
          {/* Collapse Toggle */}
          <div className="p-2 border-b flex items-center justify-between">
            {!leftSidebarCollapsed && <span className="text-sm font-medium">Navigator</span>}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
            >
              {leftSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>
          
          {!leftSidebarCollapsed && (
            <>
            {/* Navigation Tree Toggle */}
            <div className="p-2 border-b">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setShowNavTree(!showNavTree)}
              >
                <FolderTree className="h-4 w-4" />
                <span className="text-sm truncate">Navigation</span>
                {showNavTree ? <ChevronUp className="h-4 w-4 ml-auto shrink-0" /> : <ChevronDown className="h-4 w-4 ml-auto shrink-0" />}
              </Button>
            </div>

            {/* Course/Lesson Navigation Tree */}
            {showNavTree && (
              <div className="border-b">
                <ScrollArea className="h-48">
                  <div className="p-2 space-y-1">
                    {courses.map((c) => (
                      <div key={c.id}>
                        <div
                          className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted ${
                            course?.id === c.id ? 'bg-muted' : ''
                          }`}
                          onClick={() => toggleCourseExpand(c.id)}
                        >
                          {expandedCourses.has(c.id) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <Video className="h-4 w-4 text-primary" />
                          <span className="text-sm truncate flex-1">{c.name}</span>
                        </div>
                        {expandedCourses.has(c.id) && c.lessons && (
                          <div className="ml-6 space-y-1">
                            {c.lessons.map((l: Lesson) => (
                              <div
                                key={l.id}
                                className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer hover:bg-muted ${
                                  lesson?.id === l.id ? 'bg-primary/10 text-primary' : ''
                                }`}
                                onClick={() => navigate(`/editor/${l.id}`)}
                              >
                                <FileText className="h-3.5 w-3.5" />
                                <span className="text-xs truncate">{l.title}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {courses.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground text-xs">
                        No courses yet
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Slides Section */}
            <div className="p-3 border-b flex items-center justify-between">
              <span className="text-sm font-medium">Slides ({slides.length})</span>
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setShowAIWizard(true)}
                  title="Generate slides with AI"
                >
                  <Wand2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleAddSlide} title="Add slide">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={slides.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {slides.map((slide, index) => (
                      <SortableSlide
                        key={slide.id}
                        slide={slide}
                        index={index}
                        isSelected={selectedSlide?.id === slide.id}
                        onSelect={() => setSelectedSlide(slide)}
                        onDuplicate={() => handleDuplicateSlide(slide.id)}
                        onDelete={() => handleDeleteSlide(slide.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                {slides.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No slides yet</p>
                    <Button variant="link" size="sm" onClick={handleAddSlide}>
                      Add your first slide
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
            </>
          )}
        </div>

        {/* Center - Canvas and Tabs */}
        <div className="flex-1 h-full flex flex-col overflow-hidden min-w-0">
            {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="border-b px-4">
              <TabsList className="h-10">
                <TabsTrigger value="slides" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Slides
                </TabsTrigger>
                <TabsTrigger value="script" className="gap-2">
                  <Wand2 className="h-4 w-4" />
                  Script
                </TabsTrigger>
                <TabsTrigger value="audio" className="gap-2">
                  <Mic className="h-4 w-4" />
                  Audio
                </TabsTrigger>
                <TabsTrigger value="captions" className="gap-2">
                  <Subtitles className="h-4 w-4" />
                  Captions
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="slides" className="flex-1 m-0 overflow-hidden">
              <div className="h-full flex flex-col">
                {/* Canvas Area */}
                <div className="flex-1 flex items-center justify-center bg-muted/30 p-8 overflow-auto">
                  {selectedSlide ? (
                    canvasEditMode ? (
                      /* Canvas Edit Mode - Drag & Drop Editor */
                      <SlideCanvas
                        elements={(() => {
                          // Get or migrate elements from slide body
                          const body = selectedSlide.body as unknown
                          if (isElementBasedFormat(body)) {
                            return body.elements
                          }
                          // Migrate from legacy format
                          const migrated = migrateSlideToElements({
                            id: selectedSlide.id,
                            title: selectedSlide.title,
                            body: selectedSlide.body,
                            background_color: selectedSlide.background_color,
                          })
                          return migrated.elements
                        })()}
                        backgroundColor={selectedSlide.background_color || '#ffffff'}
                        backgroundImage={selectedSlide.image_position === 'background' ? selectedSlide.image_url : undefined}
                        canvasWidth={(zoom / 100) * 640}
                        canvasHeight={(zoom / 100) * 640 * (deck?.aspect_ratio === '16:9' ? 9/16 : deck?.aspect_ratio === '9:16' ? 16/9 : 1)}
                        zoom={zoom}
                        showGrid={showSafeAreaGuides}
                        onElementsChange={(elements) => {
                          // Save elements back to the slide body
                          handleUpdateSlide(selectedSlide.id, {
                            body: {
                              ...selectedSlide.body,
                              elements,
                              version: 1,
                            } as unknown as SlideBody,
                          })
                        }}
                      />
                    ) : (
                      /* Preview Mode - Static Layout Rendering */
                      <div
                        className="relative bg-white shadow-lg rounded-lg overflow-hidden"
                        style={{
                          width: `${(zoom / 100) * 640}px`,
                          aspectRatio: deck?.aspect_ratio === '16:9' ? '16/9' :
                                       deck?.aspect_ratio === '9:16' ? '9/16' :
                                       deck?.aspect_ratio === '1:1' ? '1/1' : '16/9',
                          backgroundColor: selectedSlide.background_color || 'white',
                        }}
                      >
                        {/* Background image (if image_position is 'background') */}
                        {selectedSlide.image_url && selectedSlide.image_position === 'background' && (
                          <div 
                            className="absolute inset-0 bg-cover bg-center"
                            style={{ backgroundImage: `url(${selectedSlide.image_url})` }}
                          >
                            <div className="absolute inset-0 bg-black/40" />
                          </div>
                        )}

                        {/* Safe Area Guides Overlay */}
                        {showSafeAreaGuides && (
                          <div className="absolute inset-0 pointer-events-none z-10">
                            {/* Outer safe area (10%) */}
                            <div className="absolute inset-[10%] border-2 border-dashed border-blue-500/50 rounded" />
                            {/* Title safe area (5%) */}
                            <div className="absolute inset-[5%] border border-dashed border-red-500/50 rounded" />
                            {/* Center guides */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-green-500/30" />
                            <div className="absolute top-1/2 left-0 right-0 h-px bg-green-500/30" />
                          </div>
                        )}
                        
                        {/* Slide Content with Image (left/right positions) */}
                        {selectedSlide.image_url && selectedSlide.image_position === 'left' ? (
                          <div className="relative z-0 h-full flex">
                            <div className="w-2/5 h-full">
                              <img 
                                src={selectedSlide.image_url} 
                                alt="" 
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="w-3/5">
                              {renderSlideContent(selectedSlide)}
                            </div>
                          </div>
                        ) : selectedSlide.image_url && selectedSlide.image_position === 'right' ? (
                          <div className="relative z-0 h-full flex">
                            <div className="w-3/5">
                              {renderSlideContent(selectedSlide)}
                            </div>
                            <div className="w-2/5 h-full">
                              <img 
                                src={selectedSlide.image_url} 
                                alt="" 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="relative z-0 h-full">
                            {renderSlideContent(selectedSlide)}
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <p>Select a slide or add a new one</p>
                    </div>
                  )}
                </div>

                {/* Zoom Controls */}
                <div className="border-t p-2 flex items-center justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setZoom(Math.max(50, zoom - 10))}
                    title="Zoom out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm w-12 text-center">{zoom}%</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setZoom(Math.min(200, zoom + 10))}
                    title="Zoom in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Separator orientation="vertical" className="h-6 mx-2" />
                  <Button
                    variant={showSafeAreaGuides ? "secondary" : "ghost"}
                    size="icon"
                    onClick={() => setShowSafeAreaGuides(!showSafeAreaGuides)}
                    title="Toggle safe area guides"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={canvasEditMode ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setCanvasEditMode(!canvasEditMode)}
                    title={canvasEditMode ? "Switch to preview mode" : "Switch to edit mode"}
                  >
                    <PenTool className="h-4 w-4 mr-1" />
                    {canvasEditMode ? "Editing" : "Edit Canvas"}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="script" className="flex-1 m-0 p-4 overflow-auto">
              {selectedSlide ? (
                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-semibold">Speaker Notes - Slide {slides.findIndex(s => s.id === selectedSlide.id) + 1}</h3>
                    <div className="flex items-center gap-2">
                      <Select value={scriptDuration} onValueChange={setScriptDuration}>
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 sec</SelectItem>
                          <SelectItem value="30">30 sec</SelectItem>
                          <SelectItem value="60">60 sec</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleGenerateScript(selectedSlide.id)}
                        disabled={isGeneratingScript}
                      >
                        {isGeneratingScript ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-4 w-4 mr-2" />
                            Generate Script
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={handleGenerateAllScripts}
                        disabled={isGeneratingScript || slides.length === 0}
                      >
                        Generate All
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    className="min-h-[300px] resize-none"
                    placeholder="Enter your speaker notes or narration script here..."
                    value={selectedSlide.speaker_notes || ''}
                    onChange={(e) => handleUpdateSlide(selectedSlide.id, { speaker_notes: e.target.value })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Tip: Use markdown formatting for better organization. The script will be used for voiceover generation.
                  </p>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Select a slide to edit its script
                </div>
              )}
            </TabsContent>

            <TabsContent value="audio" className="flex-1 m-0 p-4 overflow-auto">
              {selectedSlide ? (
                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-semibold">Voiceover - Slide {slides.findIndex(s => s.id === selectedSlide.id) + 1}</h3>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleGenerateAudio(selectedSlide.id)}
                        disabled={isGeneratingAudio || !selectedSlide.speaker_notes}
                      >
                        {isGeneratingAudio ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Mic className="h-4 w-4 mr-2" />
                            Generate Audio
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={handleGenerateAllAudio}
                        disabled={isGeneratingAudio}
                      >
                        Generate All
                      </Button>
                    </div>
                  </div>
                  <div className="border rounded-lg p-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Voice</Label>
                      <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select voice" />
                        </SelectTrigger>
                        <SelectContent>
                          {voices.map((voice) => (
                            <SelectItem key={voice.voice_id} value={voice.voice_id}>
                              {voice.name}
                              {voice.labels?.gender && ` (${voice.labels.gender})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Audio Preview */}
                    {voiceovers.get(selectedSlide.id) ? (
                      <div className="space-y-2">
                        <Label>Generated Audio</Label>
                        <div className="h-20 bg-muted rounded-lg flex items-center justify-between px-4">
                          <div className="flex items-center gap-3">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10"
                              onClick={() => {
                                const voiceover = voiceovers.get(selectedSlide.id)
                                if (voiceover) {
                                  if (playingAudio) {
                                    handleStopAudio()
                                  } else {
                                    handlePlayAudio(voiceover.audio_url)
                                  }
                                }
                              }}
                            >
                              {playingAudio ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                            <div>
                              <p className="text-sm font-medium">Voiceover Ready</p>
                              <p className="text-xs text-muted-foreground">
                                Duration: {Math.round((voiceovers.get(selectedSlide.id)?.duration_ms || 0) / 1000)}s
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Simple audio visualization bars */}
                            <div className="flex items-end gap-0.5 h-8">
                              {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.4, 0.7, 0.5].map((h, i) => (
                                <div
                                  key={i}
                                  className={`w-1 bg-primary/60 rounded-full transition-all ${playingAudio ? 'animate-pulse' : ''}`}
                                  style={{ height: `${h * 100}%` }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-20 bg-muted rounded-lg flex items-center justify-center text-sm text-muted-foreground">
                        {!selectedSlide.speaker_notes ? (
                          <span>Add speaker notes first to generate audio</span>
                        ) : (
                          <span>Click "Generate Audio" to create voiceover</span>
                        )}
                      </div>
                    )}

                    {!selectedSlide.speaker_notes && (
                      <p className="text-sm text-muted-foreground">
                        <span className="text-amber-500">⚠</span> Go to the Script tab to add speaker notes before generating audio.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Select a slide to manage its audio
                </div>
              )}
            </TabsContent>

            <TabsContent value="captions" className="flex-1 m-0 p-4 overflow-auto">
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Captions</h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => toast({
                      title: 'Caption Generation',
                      description: 'Generate audio first to create captions. Coming soon!',
                    })}
                  >
                    <Subtitles className="h-4 w-4 mr-2" />
                    Generate Captions
                  </Button>
                </div>
                <div className="border rounded-lg p-6 text-center space-y-3">
                  <Subtitles className="h-10 w-10 mx-auto text-muted-foreground/50" />
                  <p className="text-muted-foreground">Generate audio first to create captions</p>
                  <p className="text-sm text-muted-foreground/70">
                    Captions will be auto-generated from your voiceover audio and can be exported as SRT or VTT files.
                  </p>
                </div>
              </div>
            </TabsContent>
            </Tabs>
        </div>

        {/* Right Sidebar - Properties Inspector */}
        <div 
          className={`h-full flex flex-col border-l bg-background transition-all duration-300 ${
            rightSidebarCollapsed ? 'w-12' : 'w-80'
          }`}
        >
          {/* Collapse Toggle */}
          <div className="p-2 border-b flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
            >
              {rightSidebarCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
            </Button>
            {!rightSidebarCollapsed && <span className="text-sm font-medium">Properties</span>}
          </div>
          {!rightSidebarCollapsed && (
          <ScrollArea className="flex-1">
            {selectedSlide ? (
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label>Slide Title</Label>
                  <Input
                    value={selectedSlide.title || ''}
                    onChange={(e) => handleUpdateSlide(selectedSlide.id, { title: e.target.value })}
                    placeholder="Enter slide title"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Layout</Label>
                  <Select
                    value={selectedSlide.body?.layout || 'title-body'}
                    onValueChange={(value) => handleUpdateSlide(selectedSlide.id, { 
                      body: { ...selectedSlide.body, layout: value } 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="title-only">Title Only</SelectItem>
                      <SelectItem value="title-body">Title + Body</SelectItem>
                      <SelectItem value="title-bullets">Title + Bullets</SelectItem>
                      <SelectItem value="two-column">Two Column</SelectItem>
                      <SelectItem value="centered">Centered</SelectItem>
                      <SelectItem value="quote">Quote</SelectItem>
                      <SelectItem value="stats-grid">Statistics Grid</SelectItem>
                      <SelectItem value="comparison">Comparison</SelectItem>
                      <SelectItem value="image-text">Image + Text</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Body Text - shown for title-body and centered layouts */}
                {(selectedSlide.body?.layout === 'title-body' || 
                  selectedSlide.body?.layout === 'centered' || 
                  !selectedSlide.body?.layout) && (
                  <div className="space-y-2">
                    <Label>Body Text</Label>
                    <Textarea
                      value={selectedSlide.body?.text || ''}
                      onChange={(e) => handleUpdateSlide(selectedSlide.id, { 
                        body: { ...selectedSlide.body, text: e.target.value } 
                      })}
                      placeholder="Enter body text..."
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                )}

                {/* Bullet Points - shown for title-bullets and two-column layouts */}
                {(selectedSlide.body?.layout === 'title-bullets' || 
                  selectedSlide.body?.layout === 'two-column') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Bullet Points</Label>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          const bullets = selectedSlide.body?.bullets || []
                          handleUpdateSlide(selectedSlide.id, { 
                            body: { ...selectedSlide.body, bullets: [...bullets, ''] } 
                          })
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {(selectedSlide.body?.bullets || []).map((bullet, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={bullet}
                            onChange={(e) => {
                              const bullets = [...(selectedSlide.body?.bullets || [])]
                              bullets[index] = e.target.value
                              handleUpdateSlide(selectedSlide.id, { 
                                body: { ...selectedSlide.body, bullets } 
                              })
                            }}
                            placeholder={`Bullet point ${index + 1}`}
                            className="flex-1"
                          />
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => {
                              const bullets = [...(selectedSlide.body?.bullets || [])]
                              bullets.splice(index, 1)
                              handleUpdateSlide(selectedSlide.id, { 
                                body: { ...selectedSlide.body, bullets } 
                              })
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {(!selectedSlide.body?.bullets || selectedSlide.body.bullets.length === 0) && (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          No bullet points yet. Click "Add" to create one.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Quote fields - shown for quote layout */}
                {selectedSlide.body?.layout === 'quote' && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Quote Text</Label>
                      <Textarea
                        value={selectedSlide.body?.quote_text || ''}
                        onChange={(e) => handleUpdateSlide(selectedSlide.id, { 
                          body: { ...selectedSlide.body, quote_text: e.target.value } 
                        })}
                        placeholder="Enter the quote..."
                        className="min-h-[80px] resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Quote Author</Label>
                      <Input
                        value={selectedSlide.body?.quote_author || ''}
                        onChange={(e) => handleUpdateSlide(selectedSlide.id, { 
                          body: { ...selectedSlide.body, quote_author: e.target.value } 
                        })}
                        placeholder="Author name, title"
                      />
                    </div>
                  </div>
                )}

                {/* Stats fields - shown for stats-grid layout */}
                {selectedSlide.body?.layout === 'stats-grid' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Statistics</Label>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          const stats = selectedSlide.body?.stats || []
                          handleUpdateSlide(selectedSlide.id, { 
                            body: { ...selectedSlide.body, stats: [...stats, { value: '', label: '' }] } 
                          })
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Stat
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {(selectedSlide.body?.stats || []).map((stat, index) => (
                        <div key={index} className="flex gap-2 items-start">
                          <div className="flex-1 space-y-1">
                            <Input
                              value={stat.value}
                              onChange={(e) => {
                                const stats = [...(selectedSlide.body?.stats || [])]
                                stats[index] = { ...stats[index], value: e.target.value }
                                handleUpdateSlide(selectedSlide.id, { 
                                  body: { ...selectedSlide.body, stats } 
                                })
                              }}
                              placeholder="Value (e.g., 85%)"
                              className="font-bold"
                            />
                            <Input
                              value={stat.label}
                              onChange={(e) => {
                                const stats = [...(selectedSlide.body?.stats || [])]
                                stats[index] = { ...stats[index], label: e.target.value }
                                handleUpdateSlide(selectedSlide.id, { 
                                  body: { ...selectedSlide.body, stats } 
                                })
                              }}
                              placeholder="Label"
                              className="text-sm"
                            />
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => {
                              const stats = [...(selectedSlide.body?.stats || [])]
                              stats.splice(index, 1)
                              handleUpdateSlide(selectedSlide.id, { 
                                body: { ...selectedSlide.body, stats } 
                              })
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {(!selectedSlide.body?.stats || selectedSlide.body.stats.length === 0) && (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          No statistics yet. Click "Add Stat" to create one.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Comparison fields - shown for comparison layout */}
                {selectedSlide.body?.layout === 'comparison' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>Left Label</Label>
                        <Input
                          value={selectedSlide.body?.left_label || ''}
                          onChange={(e) => handleUpdateSlide(selectedSlide.id, { 
                            body: { ...selectedSlide.body, left_label: e.target.value } 
                          })}
                          placeholder="Before / Pros"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Right Label</Label>
                        <Input
                          value={selectedSlide.body?.right_label || ''}
                          onChange={(e) => handleUpdateSlide(selectedSlide.id, { 
                            body: { ...selectedSlide.body, right_label: e.target.value } 
                          })}
                          placeholder="After / Cons"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {/* Left column items */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Left Items</Label>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => {
                              const items = selectedSlide.body?.comparison_left || []
                              handleUpdateSlide(selectedSlide.id, { 
                                body: { ...selectedSlide.body, comparison_left: [...items, ''] } 
                              })
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        {(selectedSlide.body?.comparison_left || []).map((item, index) => (
                          <div key={index} className="flex gap-1">
                            <Input
                              value={item}
                              onChange={(e) => {
                                const items = [...(selectedSlide.body?.comparison_left || [])]
                                items[index] = e.target.value
                                handleUpdateSlide(selectedSlide.id, { 
                                  body: { ...selectedSlide.body, comparison_left: items } 
                                })
                              }}
                              placeholder={`Item ${index + 1}`}
                              className="text-xs h-8"
                            />
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => {
                                const items = [...(selectedSlide.body?.comparison_left || [])]
                                items.splice(index, 1)
                                handleUpdateSlide(selectedSlide.id, { 
                                  body: { ...selectedSlide.body, comparison_left: items } 
                                })
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      {/* Right column items */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Right Items</Label>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => {
                              const items = selectedSlide.body?.comparison_right || []
                              handleUpdateSlide(selectedSlide.id, { 
                                body: { ...selectedSlide.body, comparison_right: [...items, ''] } 
                              })
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        {(selectedSlide.body?.comparison_right || []).map((item, index) => (
                          <div key={index} className="flex gap-1">
                            <Input
                              value={item}
                              onChange={(e) => {
                                const items = [...(selectedSlide.body?.comparison_right || [])]
                                items[index] = e.target.value
                                handleUpdateSlide(selectedSlide.id, { 
                                  body: { ...selectedSlide.body, comparison_right: items } 
                                })
                              }}
                              placeholder={`Item ${index + 1}`}
                              className="text-xs h-8"
                            />
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => {
                                const items = [...(selectedSlide.body?.comparison_right || [])]
                                items.splice(index, 1)
                                handleUpdateSlide(selectedSlide.id, { 
                                  body: { ...selectedSlide.body, comparison_right: items } 
                                })
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Image-text layout - body text field */}
                {selectedSlide.body?.layout === 'image-text' && (
                  <div className="space-y-2">
                    <Label>Body Text</Label>
                    <Textarea
                      value={selectedSlide.body?.text || ''}
                      onChange={(e) => handleUpdateSlide(selectedSlide.id, { 
                        body: { ...selectedSlide.body, text: e.target.value } 
                      })}
                      placeholder="Enter body text..."
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                )}

                <Separator className="my-4" />

                <div className="space-y-2">
                  <Label>Background Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={selectedSlide.background_color || '#ffffff'}
                      onChange={(e) => handleUpdateSlide(selectedSlide.id, { background_color: e.target.value })}
                      className="w-12 h-9 p-1 cursor-pointer"
                    />
                    <Input
                      value={selectedSlide.background_color || '#ffffff'}
                      onChange={(e) => handleUpdateSlide(selectedSlide.id, { background_color: e.target.value })}
                      placeholder="#ffffff"
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Slide Image Section */}
                <div className="space-y-3 pt-2">
                  <Label>Slide Image</Label>
                  
                  {/* Image preview */}
                  {selectedSlide.image_url ? (
                    <div className="relative">
                      <img 
                        src={selectedSlide.image_url} 
                        alt="Slide image" 
                        className="w-full h-24 object-cover rounded-md border"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={async () => {
                          try {
                            await fetch(`/api/ai/image/${selectedSlide.id}`, {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${token}` },
                            });
                            handleUpdateSlide(selectedSlide.id, { image_url: undefined, image_position: 'none' });
                            toast({ title: 'Image removed' });
                          } catch {
                            toast({ title: 'Failed to remove image', variant: 'destructive' });
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-20 border-2 border-dashed rounded-md flex items-center justify-center text-muted-foreground text-sm">
                      No image
                    </div>
                  )}

                  {/* Image position selector */}
                  {selectedSlide.image_url && (
                    <div className="space-y-2">
                      <Label className="text-xs">Image Position</Label>
                      <Select
                        value={selectedSlide.image_position || 'none'}
                        onValueChange={async (value) => {
                          await fetch(`/api/ai/image/${selectedSlide.id}/position`, {
                            method: 'PUT',
                            headers: { 
                              Authorization: `Bearer ${token}`,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ position: value }),
                          });
                          handleUpdateSlide(selectedSlide.id, { image_position: value });
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None (hidden)</SelectItem>
                          <SelectItem value="background">Background</SelectItem>
                          <SelectItem value="left">Left side</SelectItem>
                          <SelectItem value="right">Right side</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Generate image buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={async () => {
                        try {
                          toast({ title: 'Generating image...', description: 'This may take a moment' });
                          const response = await fetch('/api/ai/image/generate-from-content', {
                            method: 'POST',
                            headers: { 
                              Authorization: `Bearer ${token}`,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ slide_id: selectedSlide.id }),
                          });
                          if (!response.ok) {
                            const err = await response.json();
                            throw new Error(err.error || 'Failed to generate image');
                          }
                          const data = await response.json();
                          handleUpdateSlide(selectedSlide.id, { 
                            image_url: data.image_url, 
                            image_position: 'background' 
                          });
                          toast({ title: 'Image generated!', description: 'Image added as background' });
                        } catch (e) {
                          toast({ title: 'Failed to generate image', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
                        }
                      }}
                    >
                      <Wand2 className="h-3 w-3 mr-1" />
                      Auto-generate
                    </Button>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  <Label>Transition</Label>
                  <Select
                    value={selectedSlide.transition?.type || 'fade'}
                    onValueChange={(value) => handleUpdateSlide(selectedSlide.id, { transition: { type: value } })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="fade">Fade</SelectItem>
                      <SelectItem value="push">Push</SelectItem>
                      <SelectItem value="dissolve">Dissolve</SelectItem>
                      <SelectItem value="wipe">Wipe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Duration (seconds)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="300"
                    value={(selectedSlide.duration_ms || 5000) / 1000}
                    onChange={(e) => handleUpdateSlide(selectedSlide.id, { duration_ms: parseFloat(e.target.value) * 1000 })}
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                <p className="text-sm">Select a slide to edit its properties</p>
              </div>
            )}
          </ScrollArea>
          )}
        </div>
      </div>

      {/* RevealJS Presentation Mode */}
      {showPresentation && (
        <RevealPreview
          slides={slides}
          deck={deck}
          startSlide={selectedSlide ? slides.findIndex(s => s.id === selectedSlide.id) : 0}
          onClose={() => setShowPresentation(false)}
          isFullscreen={true}
        />
      )}

      {/* AI Generation Wizard */}
      {deck && (
        <AIGenerationWizard
          isOpen={showAIWizard}
          onClose={() => setShowAIWizard(false)}
          deckId={deck.id}
          token={token || ''}
          onSlidesGenerated={() => {
            // Refresh slides
            fetchSlides(deck.id)
          }}
        />
      )}

      {/* Render Dialog */}
      <RenderDialog
        open={showRenderDialog}
        onOpenChange={setShowRenderDialog}
        deckId={deck?.id || null}
        deckTitle={lesson?.title || deck?.title}
      />

      {/* Bottom Timeline */}
      <div className="h-44 shrink-0">
        <Timeline
          slides={slides}
          voiceovers={voiceovers}
          selectedSlideId={selectedSlide?.id || null}
          currentTime={audioPlayback.currentTime}
          isPlaying={audioPlayback.isPlaying}
          onPlay={handleTimelinePlay}
          onPause={handleTimelinePause}
          onStop={handleTimelineStop}
          onSeek={handleTimelineSeek}
          onSlideSelect={handleTimelineSlideSelect}
        />
      </div>
    </div>
  )
}
