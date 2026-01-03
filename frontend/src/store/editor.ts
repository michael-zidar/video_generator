import { create } from 'zustand'

interface Slide {
  id: number
  deck_id: number
  position: number
  title: string
  body: object
  speaker_notes: string
  slide_asset_id?: number
  video_asset_id?: number
  duration_ms?: number
  transition?: object
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

interface TimelineItem {
  id: number
  deck_id: number
  type: 'intro' | 'outro' | 'interstitial'
  asset_id: number
  position: number
  start_time_ms: number
  end_time_ms: number | null
  duration_ms: number
  filename?: string
  storage_path?: string
}

interface EditorState {
  currentDeck: Deck | null
  slides: Slide[]
  timelineItems: TimelineItem[]
  selectedSlideId: number | null
  activeTab: 'slides' | 'script' | 'audio' | 'captions'
  zoom: number
  isPlaying: boolean
  currentTime: number
  setCurrentDeck: (deck: Deck | null) => void
  setSlides: (slides: Slide[]) => void
  addSlide: (slide: Slide) => void
  updateSlide: (id: number, data: Partial<Slide>) => void
  removeSlide: (id: number) => void
  reorderSlides: (fromIndex: number, toIndex: number) => void
  setTimelineItems: (items: TimelineItem[]) => void
  addTimelineItem: (item: TimelineItem) => void
  removeTimelineItem: (id: number) => void
  updateTimelineItem: (id: number, data: Partial<TimelineItem>) => void
  setSelectedSlideId: (id: number | null) => void
  setActiveTab: (tab: 'slides' | 'script' | 'audio' | 'captions') => void
  setZoom: (zoom: number) => void
  setIsPlaying: (playing: boolean) => void
  setCurrentTime: (time: number) => void
  undo: () => void
  redo: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  currentDeck: null,
  slides: [],
  timelineItems: [],
  selectedSlideId: null,
  activeTab: 'slides',
  zoom: 100,
  isPlaying: false,
  currentTime: 0,
  setCurrentDeck: (deck) => set({ currentDeck: deck }),
  setSlides: (slides) => set({ slides }),
  addSlide: (slide) => set((state) => ({ slides: [...state.slides, slide] })),
  updateSlide: (id, data) =>
    set((state) => ({
      slides: state.slides.map((s) => (s.id === id ? { ...s, ...data } : s)),
    })),
  removeSlide: (id) =>
    set((state) => ({
      slides: state.slides.filter((s) => s.id !== id),
      selectedSlideId: state.selectedSlideId === id ? null : state.selectedSlideId,
    })),
  reorderSlides: (fromIndex, toIndex) =>
    set((state) => {
      const newSlides = [...state.slides]
      const [removed] = newSlides.splice(fromIndex, 1)
      newSlides.splice(toIndex, 0, removed)
      return {
        slides: newSlides.map((s, i) => ({ ...s, position: i })),
      }
    }),
  setTimelineItems: (items) => set({ timelineItems: items }),
  addTimelineItem: (item) => set((state) => ({ timelineItems: [...state.timelineItems, item] })),
  removeTimelineItem: (id) =>
    set((state) => ({
      timelineItems: state.timelineItems.filter((i) => i.id !== id),
    })),
  updateTimelineItem: (id, data) =>
    set((state) => ({
      timelineItems: state.timelineItems.map((i) => (i.id === id ? { ...i, ...data } : i)),
    })),
  setSelectedSlideId: (id) => set({ selectedSlideId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setZoom: (zoom) => set({ zoom }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  undo: () => {
    // TODO: Implement undo
  },
  redo: () => {
    // TODO: Implement redo
  },
}))
