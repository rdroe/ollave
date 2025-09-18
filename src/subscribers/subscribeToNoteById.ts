import { useEffect, useMemo } from 'react'

import { z } from 'zod'
import { createStore, useStore } from 'zustand'
import { useShallow } from 'zustand/shallow'

import { mem, Mem } from '../core/mem'
import { makeCompilationSubscribe } from '../core/subjects/compilationSubject'
import { parseNoteTags } from '../lib'
import { updateNotePitch, updateTagsObj } from '../lib/addSlider'
import { deleteNoteById } from '../lib/deleteNoteById'
import { cloneNoteByBar, NoteByBar, tagsObjSchema } from '../lib/schemas'
import { TagData, tagEntriesCompare } from '../lib/util/tagsUtil'

const getNoteByBar = (mem: () => Mem, noteId: string) => {
  return Object.values(mem().notesByBar)
    .flat()
    .find((note) => note.tagsObj.noteId[0] === noteId)
}

const getNotesLookup = (mem: Mem) => {
  return Object.values(mem.notesByBar)
    .flat()
    .reduce(
      (acc, note) => {
        acc[z.string().parse(note.tagsObj.noteId[0])] = note
        return acc
      },
      {} as { [noteId: string]: NoteByBar }
    )
}
const getNoteIds = (mem: Mem) => {
  return Object.keys(getNotesLookup(mem))
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
}))

export const updateNoteSilently = (
  noteId: string,
  tagName: string,
  tagValue: TagData
) => {
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
  return useStore(
    notesStore,
    useShallow(({ notes }) => {
      return notes[noteId] || getNoteByBar(mem, noteId)
    })
  )
}

export const useNotes = (noteIds: string[]) => {
  useEffect(() => {
    noteIds.forEach((noteId) => {
      if (!notesStore.getState().notes[noteId]) {
        notesStore.getState().setNote(noteId, getNoteByBar(mem, noteId))
      }
    })
  }, [noteIds])
  return useStore(
    notesStore,
    useShallow(({ notes }) => {
      return noteIds.map((noteId) => notes[noteId] || getNoteByBar(mem, noteId))
    })
  )
}

export const subscribeToNoteById = (noteId?: string, barName?: string) => {
  if (!noteId) {
    throw new Error('noteId is required')
  }

  const { store } = singleNoteStore(noteId, barName)
  const selector = makeSelector(noteId, barName)
  const compare = makeCompare(store)
  const subscribe = makeCompilationSubscribe({
    selector: (mem: Mem) => {
      return selector(mem)
    },
    compare: (a, b) => {
      const result = compare(a, b)
      if (result === 'UNSUBSCRIBE') {
        store.getState().unsubscribe()
        return true
      }
      return result
    },
    clone,
    name: 'subscribeToNoteById',
  })
  return {
    store,
    subscribe,
  }
}

type SingleNoteStore = {
  note: NoteByBar
  setNote: (note: NoteByBar) => void
  unsubscribe: () => void
}

const singleNoteStore = (noteId: string, barName?: string) => {
  const initialNote = barName
    ? mem().notesByBar[barName].find(
        (note) => note.tagsObj.noteId[0] === noteId
      )
    : Object.values(mem().notesByBar)
        .flat()
        .find((note) => note.tagsObj.noteId[0] === noteId)
  const store = createStore<SingleNoteStore>((set) => ({
    note: initialNote,
    setNote: (note: NoteByBar) => set({ note }),
    unsubscribe: () => {},
  }))

  return {
    store,
  }
}

export const createNoteStoreById = (noteId?: string, barName?: string) => {
  if (!noteId) {
    throw new Error('noteId is required')
  }
  const { store } = singleNoteStore(noteId, barName)

  let didUnsubscribe = false
  const compare = makeCompare(store)
  const subscribe = makeCompilationSubscribe({
    selector: makeSelector(noteId, barName),
    compare: (a, b) => {
      const result = compare(a, b)
      if (result === 'UNSUBSCRIBE') {
        unsubscribe()
        return true
      }
      return result
    },
    clone,
    name: 'createNoteStoreById',
  })
  const unsubscribe = subscribe({
    next: (note) => {
      store.getState().setNote(note)
    },
    complete: () => {
      if (didUnsubscribe) {
        return
      }
      didUnsubscribe = true
      deleteNoteById(noteId, false)
    },
    error: (err: { message: string }) => {
      console.error('error', err)
    },
  })

  return {
    store,
    updateNotePitch: (note: string, skipSliderSync: boolean = true) => {
      updateNotePitch(noteId, note, skipSliderSync)
    },
    updateTagsObj: (
      tagsObj: z.infer<typeof tagsObjSchema>,
      skipSliderSync: boolean = true
    ) => updateTagsObj(noteId, tagsObj, skipSliderSync),
    unsubscribe: () => {
      if (!didUnsubscribe) {
        didUnsubscribe = true
        unsubscribe()
      }
    },
  }
}

function makeSelector(noteId: string, barName?: string) {
  return function (mem: Mem): NoteByBar | null {
    if (barName && mem.notesByBar[barName]) {
      const clone = mem.notesByBar[barName].find(
        (note) => note.tagsObj.noteId[0] === noteId
      )
      if (clone) {
        return clone
      }
    }
    // try again; as if bar name could be wrong or it's not provided
    const clone = Object.values(mem.notesByBar)
      .flat()
      .find((note) => note.tagsObj.noteId[0] === noteId)
    if (clone) {
      return clone
    }
    return null
  }
}

function makeCompare(store: ReturnType<typeof singleNoteStore>['store']) {
  return (a: NoteByBar, b: NoteByBar): boolean | 'UNSUBSCRIBE' => {
    if (a === null) {
      return 'UNSUBSCRIBE'
    }
    const comparison = tagEntriesCompare(
      parseNoteTags(a.tags),
      parseNoteTags(b?.tags || [])
    )
    const notePropertyCompare = a.note === b?.note
    if (notePropertyCompare && comparison) {
      store.getState().setNote(a)
      return true
    } else {
      return false
    }
  }
}

function clone(noteByBar: NoteByBar) {
  return cloneNoteByBar(noteByBar)
}

export const useNoteStoreById = (noteId: string, barName?: string) => {
  const { store } = useMemo(
    () => createNoteStoreById(noteId, barName),
    [noteId, barName]
  )
  return useStore(store)
}

export const useNoteBarId = (noteId: string) => {
  const { store } = createNoteStoreById(noteId)
  return useStore(
    store,
    useShallow(({ note }) => {
      const noteId = note.tagsObj.noteId[0]
      if (typeof noteId !== 'string') {
        throw new Error('noteId is not a string')
      }
      return getNoteBarId(noteId)
    })
  )
}

const getNoteBarId = (noteId: string) => {
  const barContainingNote = Object.keys(mem().notesByBar).find((barName) =>
    mem().notesByBar[barName].some((note) => note.tagsObj.noteId[0] === noteId)
  )
  return barContainingNote
}
