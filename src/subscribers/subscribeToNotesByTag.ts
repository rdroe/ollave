import { useMemo } from 'react'

import { createStore, useStore } from 'zustand'
import { useShallow } from 'zustand/shallow'

import { mem, Mem } from '../core/mem'
import { makeCompilationSubscribe } from '../core/subjects/compilationSubject'
import { parseNoteTags } from '../lib'
import { NoteByBar, cloneNoteByBar } from '../lib/schemas'
import { TagEntries } from '../lib/util/tagsUtil'
import { tagEntriesCompare } from '../lib/util/tagsUtil'

type NoteByBarWithBarId = NoteByBar & {
  barId: string
}

export const useNotesByTag = (tagStrings: string) => {
  const store = useNotesByTagStore(tagStrings)
  return {
    notes: store.notes,
    didUnsubscribe: store.didUnsubscribe,
    unsubscribe: store.unsubscribe,
  }
}

export const subscribeToNotesByTag = (tagStrings: string[]) => {
  if (!tagStrings || tagStrings.length === 0) {
    throw new Error('tagStrings array is required and cannot be empty')
  }

  let noteObjs: NoteByBarWithBarId[] = []
  let didUnsubscribe = false

  // select the notes by tag and data. review ALL notes in the mem.notesByBar.
  const selector = makeSelector(tagStrings)
  // if the note ids or bar ids have changed, this returns false (so that subscribers can be updated)
  const compare = makeCompare()
  // subscribe using selector, compare, and clone.
  const unsubscribe = makeCompilationSubscribe({
    selector: (mem: Mem) => {
      return selector(mem)
    },
    compare: (a, b) => {
      const result = compare(a, b)

      return result
    },
    // clone function clones the note after the fashion of the note by id subscriber.
    // but afterwards, it adds the barId to the note.
    clone,
    name: 'subscribeToNotesByTag',
  })({
    next: (notes) => {
      noteObjs = notes
    },
    complete: () => {
      didUnsubscribe = true
      if (!didUnsubscribe) {
        unsubscribe()
      }
    },
    error: (err: { message: string }) => {
      console.error('error', err)
    },
  })
  return {
    notes: noteObjs,
    didUnsubscribe,
    unsubscribe: () => {
      didUnsubscribe = true
      if (!didUnsubscribe) {
        unsubscribe()
      }
    },
  }
}

type NotesByTagStore = {
  notes: NoteByBarWithBarId[]
  setNotes: (notes: NoteByBarWithBarId[]) => void
  unsubscribe: () => void
  didUnsubscribe: boolean
}

const createInternalNotesByTagStore = (tagStrings: string[]) => {
  const targetTags = parseNoteTags(tagStrings)
  const initialNotes = selector(mem(), targetTags)

  const store = createStore<NotesByTagStore>((set) => ({
    notes: initialNotes,
    setNotes: (notes: NoteByBarWithBarId[]) => set({ notes }),
    didUnsubscribe: false,
    unsubscribe: () => {},
  }))

  return store
}

export const createNotesByTagStore = (tagStrings: string[]) => {
  if (!tagStrings || tagStrings.length === 0) {
    throw new Error('tagStrings array is required and cannot be empty')
  }
  const targetTags = parseNoteTags(tagStrings)
  const store = createInternalNotesByTagStore(tagStrings)
  const didUnsubscribe = false
  const compare = makeCompare()
  const subscribe = makeCompilationSubscribe({
    selector: (mem: Mem) => selector(mem, targetTags),
    compare: (a, b) => {
      const result = compare(a, b)
      if (result === true) {
        console.log('notes compared true')
      }
      return result
    },
    clone,
    name: 'createNotesByTagStore',
  })
  const unsubscribe = subscribe({
    next: (notes) => {
      store.getState().setNotes(notes)
    },
    complete: () => {
      store.setState({ didUnsubscribe: true, unsubscribe: () => {} })
    },
    error: (err: { message: string }) => {
      console.error('error', err)
    },
  })
  store.setState({
    unsubscribe: () => {
      if (!didUnsubscribe) {
        store.setState({ didUnsubscribe: true, unsubscribe: () => {} })
        unsubscribe()
      }
    },
  })
  return store
}

// select the notes by tag and data. review ALL notes in the mem.notesByBar.
function selector(mem: Mem, targetTags: TagEntries): NoteByBarWithBarId[] {
  const matchingNotes: NoteByBarWithBarId[] = []
  Object.entries(mem.notesByBar).forEach(([barId, notes]) => {
    notes.forEach((note) => {
      // filter tag entries from note to those matching the target tags.
      const noteTags = parseNoteTags(note.tags).filter(([tagName]) =>
        targetTags.some(
          ([targetTagName]: [string, any]) => targetTagName === tagName
        )
      )
      if (tagEntriesCompare(targetTags, noteTags)) {
        matchingNotes.push({
          ...note,
          barId,
        })
      }
    })
  })

  return matchingNotes
}
// make the selector function that selects the notes by tag and data.
function makeSelector(tagStrings: string[]) {
  const targetTags = parseNoteTags(tagStrings)
  return function (mem: Mem): NoteByBarWithBarId[] {
    return selector(mem, targetTags)
  }
}
// make the compare function that sees whether the note ids and barIds have changed.
// if so, return false. never automatically unsubscribe. only return true or false.
function makeCompare() {
  return (a: NoteByBarWithBarId[], b: NoteByBarWithBarId[]): boolean => {
    if (a === null || b === null) {
      return false
    }
    if (a.length !== b.length) {
      return false
    }
    return (
      a.every((note) =>
        b.some(
          (bNote) =>
            bNote.tagsObj.noteId[0] === note.tagsObj.noteId[0] &&
            bNote.barId === note.barId
        )
      ) &&
      b.every((note) =>
        a.some(
          (aNote) =>
            aNote.tagsObj.noteId[0] === note.tagsObj.noteId[0] &&
            aNote.barId === note.barId
        )
      )
    )
  }
}

function clone(notes: NoteByBarWithBarId[]): NoteByBarWithBarId[] {
  return notes.map((note) => ({
    ...cloneNoteByBar(note),
    barId: note.barId,
  }))
}

export const useNotesByTagStore = (tagStrings: string) => {
  const store = useMemo(
    () => createNotesByTagStore(tagStrings.split('|')),
    [tagStrings]
  )
  return useStore(store)
}

export const useNoteIdsByTagStore = (tagStrings: string[]) => {
  const store = createNotesByTagStore(tagStrings)
  return useStore(
    store,
    useShallow((state) => state.notes.map((note) => note.tagsObj.noteId[0]))
  )
}
