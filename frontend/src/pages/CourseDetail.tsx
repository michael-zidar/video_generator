import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { Plus, ArrowLeft, Video, MoreVertical, ChevronRight, GripVertical, Copy, Trash2, Pencil } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Course {
  id: number
  name: string
  description: string
}

interface Lesson {
  id: number
  course_id: number
  title: string
  description: string
  position: number
  created_at: string
}

interface SortableLessonProps {
  lesson: Lesson
  index: number
  onNavigate: (id: number) => void
  onEdit: (lesson: Lesson) => void
  onDuplicate: (id: number) => void
  onDelete: (id: number) => void
}

function SortableLesson({ lesson, index, onNavigate, onEdit, onDuplicate, onDelete }: SortableLessonProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="group cursor-pointer transition-all hover:shadow-md"
    >
      <CardContent className="flex items-center p-4">
        <div className="flex items-center gap-3 mr-4 text-muted-foreground">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4 hover:text-foreground" />
          </div>
          <span className="text-sm font-medium w-6">{index + 1}</span>
        </div>
        <div
          className="flex-1"
          onClick={() => onNavigate(lesson.id)}
        >
          <h3 className="font-medium">{lesson.title}</h3>
          {lesson.description && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              {lesson.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ChevronRight
            className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onNavigate(lesson.id)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onNavigate(lesson.id)}>
                Open Editor
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(lesson)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(lesson.id)}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(lesson.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}

export function CourseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { token } = useAuthStore()

  const [course, setCourse] = useState<Course | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [newLessonTitle, setNewLessonTitle] = useState('')
  const [newLessonDescription, setNewLessonDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [editingCourseName, setEditingCourseName] = useState('')
  const [editingCourseDescription, setEditingCourseDescription] = useState('')
  const [isEditLessonOpen, setIsEditLessonOpen] = useState(false)
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)
  const [editingLessonTitle, setEditingLessonTitle] = useState('')
  const [editingLessonDescription, setEditingLessonDescription] = useState('')

  // Drag and drop sensors
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

  useEffect(() => {
    fetchCourse()
    fetchLessons()
  }, [id])

  const fetchCourse = async () => {
    try {
      const response = await fetch(`/api/courses/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setCourse(data)
        setEditingCourseName(data.name)
        setEditingCourseDescription(data.description || '')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load course',
        variant: 'destructive',
      })
    }
  }

  const fetchLessons = async () => {
    try {
      const response = await fetch(`/api/courses/${id}/lessons`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setLessons(data)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load lessons',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)

    try {
      const response = await fetch(`/api/courses/${id}/lessons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newLessonTitle,
          description: newLessonDescription,
        }),
      })

      if (response.ok) {
        const newLesson = await response.json()
        setLessons([...lessons, newLesson])
        setIsCreateOpen(false)
        setNewLessonTitle('')
        setNewLessonDescription('')
        toast({
          title: 'Lesson created',
          description: `"${newLesson.title}" has been created.`,
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create lesson',
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await fetch(`/api/courses/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editingCourseName,
          description: editingCourseDescription,
        }),
      })

      if (response.ok) {
        const updated = await response.json()
        setCourse(updated)
        setIsEditOpen(false)
        toast({
          title: 'Course updated',
          description: 'Course details have been saved.',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update course',
        variant: 'destructive',
      })
    }
  }

  const handleEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson)
    setEditingLessonTitle(lesson.title)
    setEditingLessonDescription(lesson.description || '')
    setIsEditLessonOpen(true)
  }

  const handleUpdateLesson = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingLesson) return

    try {
      const response = await fetch(`/api/lessons/${editingLesson.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editingLessonTitle,
          description: editingLessonDescription,
        }),
      })

      if (response.ok) {
        const updated = await response.json()
        setLessons(lessons.map(l => l.id === updated.id ? updated : l))
        setIsEditLessonOpen(false)
        setEditingLesson(null)
        toast({
          title: 'Lesson updated',
          description: 'Lesson details have been saved.',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update lesson',
        variant: 'destructive',
      })
    }
  }

  const handleDuplicateLesson = async (lessonId: number) => {
    try {
      const response = await fetch(`/api/lessons/${lessonId}/duplicate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const duplicated = await response.json()
        setLessons([...lessons, duplicated])
        toast({
          title: 'Lesson duplicated',
          description: 'A copy of the lesson has been created.',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to duplicate lesson',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteLesson = async (lessonId: number) => {
    if (!confirm('Are you sure you want to delete this lesson?')) {
      return
    }

    try {
      const response = await fetch(`/api/lessons/${lessonId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        setLessons(lessons.filter(l => l.id !== lessonId))
        toast({
          title: 'Lesson deleted',
          description: 'The lesson has been removed.',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete lesson',
        variant: 'destructive',
      })
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = lessons.findIndex(l => l.id === active.id)
    const newIndex = lessons.findIndex(l => l.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newLessons = arrayMove(lessons, oldIndex, newIndex)
      setLessons(newLessons)

      // Send reorder request to backend
      try {
        const response = await fetch('/api/lessons/reorder', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            course_id: parseInt(id!),
            lesson_ids: newLessons.map(l => l.id),
          }),
        })

        if (!response.ok) {
          // Revert on failure
          setLessons(lessons)
          toast({
            title: 'Error',
            description: 'Failed to reorder lessons',
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Lessons reordered',
            description: 'Lesson order has been updated.',
          })
        }
      } catch (error) {
        setLessons(lessons)
        toast({
          title: 'Error',
          description: 'Failed to reorder lessons',
          variant: 'destructive',
        })
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading course...</div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Course not found</h2>
          <Button variant="link" onClick={() => navigate('/dashboard')}>
            Return to dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container px-4 md:px-6 lg:px-8 flex h-14 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Video className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">{course.name}</span>
          </div>
          <div className="flex-1" />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 md:px-6 lg:px-8 py-6">
        <div className="flex flex-col gap-6">
          {/* Course Info */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{course.name}</h1>
              <p className="text-muted-foreground mt-1">
                {course.description || 'No description'}
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Edit Course</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Course</DialogTitle>
                    <DialogDescription>
                      Update course name and description.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleUpdateCourse}>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-name">Course Name</Label>
                        <Input
                          id="edit-name"
                          value={editingCourseName}
                          onChange={(e) => setEditingCourseName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-description">Description</Label>
                        <Textarea
                          id="edit-description"
                          value={editingCourseDescription}
                          onChange={(e) => setEditingCourseDescription(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Save Changes</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Lesson
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Lesson</DialogTitle>
                    <DialogDescription>
                      Add a new lesson to this course.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateLesson}>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="lesson-title">Lesson Title</Label>
                        <Input
                          id="lesson-title"
                          placeholder="e.g., Getting Started with React"
                          value={newLessonTitle}
                          onChange={(e) => setNewLessonTitle(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lesson-description">Description</Label>
                        <Textarea
                          id="lesson-description"
                          placeholder="Brief description of the lesson..."
                          value={newLessonDescription}
                          onChange={(e) => setNewLessonDescription(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isCreating}>
                        {isCreating ? 'Creating...' : 'Create Lesson'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Edit Lesson Dialog */}
              <Dialog open={isEditLessonOpen} onOpenChange={setIsEditLessonOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Lesson</DialogTitle>
                    <DialogDescription>
                      Update lesson title and description.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleUpdateLesson}>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-lesson-title">Lesson Title</Label>
                        <Input
                          id="edit-lesson-title"
                          value={editingLessonTitle}
                          onChange={(e) => setEditingLessonTitle(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-lesson-description">Description</Label>
                        <Textarea
                          id="edit-lesson-description"
                          value={editingLessonDescription}
                          onChange={(e) => setEditingLessonDescription(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsEditLessonOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Save Changes</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Lessons List */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Lessons ({lessons.length})</h2>

            {lessons.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Video className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">No lessons yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Create your first lesson to start building your course.
                    </p>
                  </div>
                  <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Lesson
                  </Button>
                </div>
              </Card>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={lessons.map(l => l.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {lessons.map((lesson, index) => (
                      <SortableLesson
                        key={lesson.id}
                        lesson={lesson}
                        index={index}
                        onNavigate={(id) => navigate(`/editor/${id}`)}
                        onEdit={handleEditLesson}
                        onDuplicate={handleDuplicateLesson}
                        onDelete={handleDeleteLesson}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
