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

// Trailing debounce, replacing a 50ms staleness-poll interval. The old
// interval re-ran setLatestMap (full remap of every note + a whole-song
// IndexedDB write, on the main thread) every 50ms for as long as updates kept
// arriving — so dragging a note slider recompiled the song up to 20x/second,
// which is what made dragging crawl and playback stutter on long songs. Now a
// burst of updates compiles once, when the user pauses.
let staleTimeout: ReturnType<typeof setTimeout> | null = null
const RECOMPILE_IDLE_MS = 150
const scheduleRecompile = () => {
  notesStore.setState({ isStale: true })
  if (staleTimeout) {
    clearTimeout(staleTimeout)
  }
  staleTimeout = setTimeout(() => {
    staleTimeout = null
    notesStore.setState({ isStale: false })
    setLatestMap(mapSongToMidiTicks())
  }, RECOMPILE_IDLE_MS)
}
export const updateNoteSilently = (
  noteId: string,
  tagName: string,
  tagValue: TagData
) => {
  scheduleRecompile()
  const memNote = getNoteByBar(mem, noteId)
  memNote.tagsObj[tagName] = tagValue
  notesStore.getState().setNote(noteId, memNote)
}
export const updateOctaveSilently = (noteId: string, change: number) => {
  scheduleRecompile()
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
  scheduleRecompile()
}
