import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useUser, useClerk } from '@clerk/clerk-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { Plus, Search, Video, BookOpen, FolderOpen, Pin, Archive, MoreVertical, ChevronRight, Settings } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/ui/theme-toggle'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface Course {
  id: number
  name: string
  description: string
  is_pinned: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
  lesson_count?: number
}

export function Dashboard() {
  const [courses, setCourses] = useState<Course[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newCourseName, setNewCourseName] = useState('')
  const [newCourseDescription, setNewCourseDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const { user } = useUser()
  const { signOut } = useClerk()

  const fetchCourses = useCallback(async () => {
    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE_URL}/api/courses`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setCourses(data)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load courses',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    fetchCourses()
  }, [fetchCourses])

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)

    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE_URL}/api/courses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newCourseName,
          description: newCourseDescription,
        }),
      })

      if (response.ok) {
        const newCourse = await response.json()
        setCourses([newCourse, ...courses])
        setIsCreateOpen(false)
        setNewCourseName('')
        setNewCourseDescription('')
        toast({
          title: 'Course created',
          description: `"${newCourse.name}" has been created successfully.`,
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create course',
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handlePinCourse = async (courseId: number, isPinned: boolean) => {
    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE_URL}/api/courses/${courseId}/pin`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_pinned: !isPinned }),
      })

      if (response.ok) {
        setCourses(courses.map(c =>
          c.id === courseId ? { ...c, is_pinned: !isPinned } : c
        ))
        toast({
          title: isPinned ? 'Unpinned' : 'Pinned',
          description: `Course has been ${isPinned ? 'unpinned' : 'pinned'}.`,
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

  const handleArchiveCourse = async (courseId: number, isArchived: boolean) => {
    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE_URL}/api/courses/${courseId}/archive`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_archived: !isArchived }),
      })

      if (response.ok) {
        setCourses(courses.map(c =>
          c.id === courseId ? { ...c, is_archived: !isArchived } : c
        ))
        toast({
          title: isArchived ? 'Restored' : 'Archived',
          description: `Course has been ${isArchived ? 'restored' : 'archived'}.`,
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

  const handleDeleteCourse = async (courseId: number) => {
    if (!confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
      return
    }

    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE_URL}/api/courses/${courseId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        setCourses(courses.filter(c => c.id !== courseId))
        toast({
          title: 'Deleted',
          description: 'Course has been deleted.',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete course',
        variant: 'destructive',
      })
    }
  }

  const filteredCourses = courses.filter(course =>
    course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const pinnedCourses = filteredCourses.filter(c => c.is_pinned && !c.is_archived)
  const regularCourses = filteredCourses.filter(c => !c.is_pinned && !c.is_archived)
  const archivedCourses = filteredCourses.filter(c => c.is_archived)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container px-4 md:px-6 lg:px-8 flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Video className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">CourseVideo Studio</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
              <Settings className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">{user?.fullName || user?.firstName}</span>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 md:px-6 lg:px-8 py-6">
        <div className="flex flex-col gap-6">
          {/* Title and Actions */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Courses</h1>
              <p className="text-muted-foreground">
                Manage your video courses and lessons
              </p>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Course
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Course</DialogTitle>
                  <DialogDescription>
                    Add a new course to organize your video lessons.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateCourse}>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Course Name</Label>
                      <Input
                        id="name"
                        placeholder="e.g., Introduction to Web Development"
                        value={newCourseName}
                        onChange={(e) => setNewCourseName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Brief description of the course..."
                        value={newCourseDescription}
                        onChange={(e) => setNewCourseDescription(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating ? 'Creating...' : 'Create Course'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-pulse text-muted-foreground">Loading courses...</div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && courses.length === 0 && (
            <Card className="p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <FolderOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">No courses yet</h3>
                  <p className="text-muted-foreground mt-1">
                    Create your first course to get started.
                  </p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Course
                </Button>
              </div>
            </Card>
          )}

          {/* Pinned Courses */}
          {pinnedCourses.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Pin className="h-4 w-4" />
                Pinned
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pinnedCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onPin={handlePinCourse}
                    onArchive={handleArchiveCourse}
                    onDelete={handleDeleteCourse}
                    onClick={() => navigate(`/courses/${course.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Regular Courses */}
          {regularCourses.length > 0 && (
            <div className="space-y-3">
              {pinnedCourses.length > 0 && (
                <h2 className="text-lg font-semibold">All Courses</h2>
              )}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {regularCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onPin={handlePinCourse}
                    onArchive={handleArchiveCourse}
                    onDelete={handleDeleteCourse}
                    onClick={() => navigate(`/courses/${course.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Archived Courses */}
          {archivedCourses.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                <Archive className="h-4 w-4" />
                Archived
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {archivedCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onPin={handlePinCourse}
                    onArchive={handleArchiveCourse}
                    onDelete={handleDeleteCourse}
                    onClick={() => navigate(`/courses/${course.id}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function CourseCard({
  course,
  onPin,
  onArchive,
  onDelete,
  onClick,
}: {
  course: Course
  onPin: (id: number, isPinned: boolean) => void
  onArchive: (id: number, isArchived: boolean) => void
  onDelete: (id: number) => void
  onClick: () => void
}) {
  return (
    <Card
      className={`group cursor-pointer transition-all hover:shadow-md ${
        course.is_archived ? 'opacity-60' : ''
      }`}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex-1" onClick={onClick}>
          <CardTitle className="text-lg line-clamp-1 flex items-center gap-2">
            {course.is_pinned ? <Pin className="h-3 w-3 text-primary" /> : null}
            {course.name}
          </CardTitle>
          <CardDescription className="line-clamp-2 mt-1">
            {course.description || 'No description'}
          </CardDescription>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onPin(course.id, course.is_pinned)}>
              <Pin className="mr-2 h-4 w-4" />
              {course.is_pinned ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onArchive(course.id, course.is_archived)}>
              <Archive className="mr-2 h-4 w-4" />
              {course.is_archived ? 'Restore' : 'Archive'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(course.id)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent onClick={onClick}>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {course.lesson_count || 0} lessons
            </span>
          </div>
          <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </CardContent>
    </Card>
  )
}
