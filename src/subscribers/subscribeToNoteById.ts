import { useEffect } from 'react'

import { Scale, tokenizeNote } from 'tonal'
import { createStore, useStore } from 'zustand'

import { mem } from '../core/mem'
import { setLatestMap } from '../core/observables/compilationObservable'
import { mapSongToMidiTicks } from '../lib'
import { NoteByBar } from '../lib/schemas'
import { getNoteByBar } from '../lib/util/notesUtil'
import { TagData } from '../lib/util/tagsUtil'

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
export const updateOctaveSilently = (noteId: string, change: number) => {
  notesStore.setState({ isStale: true })
  const memNote = getNoteByBar(mem, noteId)
  const [letter, accidental, currOctaveRaw] = tokenizeNote(memNote.note)
  const currOctave = parseInt(currOctaveRaw)
  const newOctave = currOctave + change
  memNote.note = `${letter}${accidental}${newOctave}`
  notesStore.getState().setNote(noteId, memNote)
}
export const updateNoteDegreeSilently = (
  noteId: string,
  changeInDegree: number,
  scaleTonic: string,
  scaleName: string
) => {
  const memNote = getNoteByBar(mem, noteId)
  const note = memNote.note
  const notesInScale = Scale.get(`${scaleTonic} ${scaleName}`).notes

  const [letter, accidental, currOctaveRaw] = tokenizeNote(note)
  const noteIndex = notesInScale.indexOf(`${letter}${accidental}`)
  const newLetterWithAccidental =
    notesInScale[
      (noteIndex + changeInDegree + notesInScale.length) % notesInScale.length
    ]
  const newNote = `${newLetterWithAccidental}${currOctaveRaw}`
  memNote.note = newNote
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

export const setIsStale = () => {
  notesStore.setState({ isStale: true })
}
