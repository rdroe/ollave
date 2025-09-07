import { makeCompilationSubscribe } from "src/core/subjects/compilationSubject"

import { Mem } from "src/core/mem"
import deepEqual from "deep-equal"
import { createStore, useStore } from "zustand"
import { useShallow } from "zustand/shallow"

type NoteAndGroupIds = {
  notesByBar: {
    [barId: string]: string[]
  }
  groupsByBar: {
    [barId: string]: string[]
  },
  barByNoteId: {
    [noteId: string]: string
  },
  barByGroupId: {
    [groupId: string]: string
  }
}

const buildGroupsByBar = (mem: Mem) => {
  return Object.keys(mem.notesByBar).reduce((acc, barId) => {
    const allGroupIds = mem.notesByBar[barId].map((note) => note.tagsObj.groupId[0])
    const uniqueGroupIds = [...new Set(allGroupIds)]
    acc[barId] = uniqueGroupIds
    return acc
  }, {} as { [barId: string]: string[] })
}
const notesByBar = (mem: Mem) => {
  return Object.keys(mem.notesByBar).reduce((acc, barId) => {
    acc[barId] = mem.notesByBar[barId].map((note) => note.tagsObj.noteId[0])
    return acc
  }, {} as { [barId: string]: string[] })
}
const hashLookup = (lookup: { [id: string]: string[] }): { [id: string]: string } => {
    // make an object in which every array element is a property with its key for a value
    const obj: { [id: string]: string } = {}
    Object.keys(lookup).forEach((id) => {
      lookup[id].forEach((elementId) => {
        obj[elementId] = id
      })
    })
    return obj
}
const buildNoteAndGroupIdsStore = (mem: Mem): NoteAndGroupIds => {
  const groupsByBar = buildGroupsByBar(mem)
  const notesByBarObj = notesByBar(mem)
  return {
    notesByBar: notesByBarObj,
    groupsByBar,
    barByNoteId: hashLookup(notesByBarObj),
    barByGroupId: hashLookup(groupsByBar),
  }
}

export const useSubscribeToNoteAndGroupIds = () => {
  const store = createStore<NoteAndGroupIds>((set) => ({
    notesByBar: {},
    groupsByBar: {},
    barByNoteId: {},
    barByGroupId: {}
  }))
  let didUnsubscribe = false
  const unsubscribe = makeCompilationSubscribe({
    selector: (mem: Mem) => {
      return buildNoteAndGroupIdsStore(mem)
    },
    compare: (a, b) => {
      return deepEqual(a, b)
    },
    name: 'useSubscribeToNoteAndGroupIds'
  })({
    next: (noteAndGroupIds) => {
      store.setState(noteAndGroupIds)
    },
    error: (err) => {
      console.error('error', err)
    },
    complete: () => {
      didUnsubscribe = true
      if (!didUnsubscribe) {
        unsubscribe()
      }
    }
  })

  const shallowNotesByBar = useStore(store, useShallow((state) => state.notesByBar))
  const shallowGroupsByBar = useStore(store, useShallow((state) => state.groupsByBar))
  const shallowBarByNoteId = useStore(store, useShallow((state) => state.barByNoteId))
  const shallowBarByGroupId = useStore(store, useShallow((state) => state.barByGroupId))

  return {
    notesByBar: shallowNotesByBar,
    groupsByBar: shallowGroupsByBar,
    barByNoteId: shallowBarByNoteId,
    barByGroupId: shallowBarByGroupId
  }
}
