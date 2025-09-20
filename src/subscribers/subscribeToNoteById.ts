import { useEffect } from 'react'

import { createStore, useStore } from 'zustand'

import { mem, Mem } from '../core/mem'
import { setLatestMap } from '../core/observables/compilationObservable'
import { mapSongToMidiTicks } from '../lib'
import { NoteByBar } from '../lib/schemas'
import { TagData } from '../lib/util/tagsUtil'

const getNoteByBar = (mem: () => Mem, noteId: string) => {
  return Object.values(mem().notesByBar)
    .flat()
    .find((note) => note.tagsObj.noteId[0] === noteId)
}

type NoteStore = {
  notes: {
    [noteId: string]: {
      note: string | null
      tagsObj: {
        [key: string]: TagData
      }
    }
  }
  setNote: (noteId: string, note: NoteByBar) => void
  isStale: boolean
}

const notesStore = createStore<NoteStore>((set, get) => ({
  notes: {},
  setNote: (noteId: string, note: NoteByBar | null) =>
    set({
      notes: note
        ? {
            ...get().notes,
            [noteId]: {
              tagsObj: note.tagsObj,
              note: note.note,
            },
          }
        : {
            ...get().notes,
            [noteId]: {
              note: null,
              tagsObj: {},
            },
          },
    }),
  isStale: false,
}))
setInterval(() => {
  if (notesStore.getState().isStale) {
    notesStore.setState({ isStale: false })
    setLatestMap(mapSongToMidiTicks())
  }
}, 50)
export const updateNoteSilently = (
  noteId: string,
  tagName: string,
  tagValue: TagData
) => {
  notesStore.setState({ isStale: true })
  const memNote = getNoteByBar(mem, noteId)
  memNote.tagsObj[tagName] = tagValue
  notesStore.getState().setNote(noteId, memNote)
}

export const useNote = (noteId: string) => {
  useEffect(() => {
    if (!noteId) {
      return
    }
    if (!notesStore.getState().notes[noteId]) {
      notesStore.getState().setNote(noteId, getNoteByBar(mem, noteId))
    }
  }, [noteId])
  return useStore(notesStore, ({ notes }) => {
    return notes[noteId] || getNoteByBar(mem, noteId)
  })
}

export const useNotes = (noteIds: string[]) => {
  useEffect(() => {
    noteIds.forEach((noteId) => {
      if (!notesStore.getState().notes[noteId]) {
        notesStore.getState().setNote(noteId, getNoteByBar(mem, noteId))
      }
    })
  }, [noteIds])
  return useStore(notesStore, ({ notes }) => {
    return noteIds.map((noteId) => notes[noteId] || getNoteByBar(mem, noteId))
  })
}
