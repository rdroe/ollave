import { createStore } from 'zustand'

export const mouseDownNote = createStore<{
  noteId: string | null
  setNoteId: (noteId: string | null) => void
}>((set) => ({
  noteId: null,
  setNoteId: (noteId: string | null) => {
    set({ noteId })
  },
}))
