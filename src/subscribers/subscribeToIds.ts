import { makeCompilationSubscribe } from "../core/subjects/compilationSubject"

import { mem, Mem } from "src/core/mem"
import deepEqual from "deep-equal"
import { createStore, useStore } from "zustand"
import { useShallow } from "zustand/shallow"

type NoteAndGroupIds = {
  barsByPhase: {
    [phaseId: string]: string[]
  }
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
  },
  notesByGroupId: {
    [groupId: string]: string[]
  },
  groupByNoteId: {
    [noteId: string]: string
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
const getPhaseBarIds = (barIds: string[]): { [phaseId: string]: string[] } => {
  return barIds.reduce((acc, barId) => {
    const phaseId = barId.split(':')[0]
    if (!acc[phaseId]) {
      acc[phaseId] = []
    }
    acc[phaseId].push(barId)
    return acc
  }, {} as { [phaseId: string]: string[] })
}
const buildNotesByGroupId = (mem: Mem) => {
  return Object.keys(mem.notesByBar).reduce((acc, barId) => {
    mem.notesByBar[barId].forEach((note) => {
      if (!acc[note.tagsObj.groupId[0]]) {
        acc[note.tagsObj.groupId[0]] = []
      }
      acc[note.tagsObj.groupId[0]].push(note.tagsObj.noteId[0])
    })
    return acc
  }, {} as { [groupId: string]: string[] })
}
const buildNoteAndGroupIdsStore = (mem: Mem): NoteAndGroupIds => {
  const groupsByBar = buildGroupsByBar(mem)
  const notesByBarObj = notesByBar(mem)
  const notesByGroupId = buildNotesByGroupId(mem)
  return {
    barsByPhase: getPhaseBarIds(Object.keys(mem.notesByBar)),
    notesByBar: notesByBarObj,
    groupsByBar,
    barByNoteId: hashLookup(notesByBarObj),
    barByGroupId: hashLookup(groupsByBar),
    notesByGroupId,
    groupByNoteId: hashLookup(notesByGroupId)
  }
}

export const useSubscribeToIds = () => {
  const store = createStore<NoteAndGroupIds>((set) => ({
    ...buildNoteAndGroupIdsStore(mem())
  }))
  let didUnsubscribe = false
  const unsubscribe = makeCompilationSubscribe({
    selector: (mem: Mem) => {
      return buildNoteAndGroupIdsStore(mem)
    },
    compare: (a, b) => {
      return deepEqual(a, b, { strict: true })
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
  const shallowBarsByPhase = useStore(store, useShallow((state) => state.barsByPhase))
  const shallowNotesByGroupId = useStore(store, useShallow((state) => state.notesByGroupId))
  const shallowGroupByNoteId = useStore(store, useShallow((state) => state.groupByNoteId))

  return {
    notesByBar: shallowNotesByBar,
    groupsByBar: shallowGroupsByBar,
    barByNoteId: shallowBarByNoteId,
    barByGroupId: shallowBarByGroupId,
    barsByPhase: shallowBarsByPhase,
    notesByGroupId: shallowNotesByGroupId,
    groupByNoteId: shallowGroupByNoteId,
    unsubscribe: () => {
      unsubscribe()
    }
  }
}
