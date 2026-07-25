import { useEffect } from 'react'

import { z } from 'zod'
import { createStore, StoreApi, useStore } from 'zustand'
import { useShallow } from 'zustand/shallow'

import { mem, Mem } from '../core/mem'
import { makeCompilationSubscribe } from '../core/subjects/compilationSubject'
import { addSongLoadCallback } from '../lib/util/songUtil'

type NoteAndGroupIds = {
  barsByPhase: {
    [phaseId: string]: string[]
  }
  notesByBar: {
    [barId: string]: string[]
  }
  groupsByBar: {
    [barId: string]: string[]
  }
  barByNoteId: {
    [noteId: string]: string
  }
  barByGroupId: {
    [groupId: string]: string
  }
  notesByGroupId: {
    [groupId: string]: string[]
  }
  groupByNoteId: {
    [noteId: string]: string
  }
  notesByGroupIdCsv: {
    [groupId: string]: string
  }
  notesByBarCsv: {
    [barId: string]: string
  }
  groupsByBarCsv: {
    [barId: string]: string
  }
  barsByPhaseCsv: {
    [phaseId: string]: string
  }
}

const buildGroupsByBar = (mem: Mem) => {
  return Object.keys(mem.notesByBar).reduce(
    (acc, barId) => {
      const allGroupIds = mem.notesByBar[barId].map(
        (note) => note.tagsObj.groupId[0]
      )
      const uniqueGroupIds = [...new Set(allGroupIds)]
      acc[barId] = z.array(z.string()).parse(uniqueGroupIds)
      return acc
    },
    {} as { [barId: string]: string[] }
  )
}
const notesByBar = (mem: Mem) => {
  return Object.keys(mem.notesByBar).reduce(
    (acc, barId) => {
      acc[barId] = z
        .array(z.string())
        .parse(mem.notesByBar[barId].map((note) => note.tagsObj.noteId[0]))
      return acc
    },
    {} as { [barId: string]: string[] }
  )
}
const hashLookup = (lookup: {
  [id: string]: string[]
}): { [id: string]: string } => {
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
  return barIds.reduce(
    (acc, barId) => {
      const phaseId = barId.split(':')[0]
      if (!acc[phaseId]) {
        acc[phaseId] = []
      }
      acc[phaseId].push(barId)
      return acc
    },
    {} as { [phaseId: string]: string[] }
  )
}
const buildNotesByGroupId = (mem: Mem) => {
  return Object.keys(mem.notesByBar).reduce(
    (acc, barId) => {
      mem.notesByBar[barId].forEach((note) => {
        if (!acc[z.string().parse(note.tagsObj.groupId[0])]) {
          acc[z.string().parse(note.tagsObj.groupId[0])] = []
        }
        acc[z.string().parse(note.tagsObj.groupId[0])].push(
          z.string().parse(note.tagsObj.noteId[0])
        )
      })
      return acc
    },
    {} as { [groupId: string]: string[] }
  )
}
const buildNoteAndGroupIdsStore = (mem: Mem): NoteAndGroupIds => {
  const groupsByBar = buildGroupsByBar(mem)
  const notesByBarObj = notesByBar(mem)
  const notesByGroupId = buildNotesByGroupId(mem)
  const barsByPhase = getPhaseBarIds(Object.keys(mem.notesByBar))
  return {
    barsByPhase,
    notesByBar: notesByBarObj,
    groupsByBar,
    barByNoteId: hashLookup(notesByBarObj),
    barByGroupId: hashLookup(groupsByBar),
    notesByGroupId,
    groupByNoteId: hashLookup(notesByGroupId),
    notesByGroupIdCsv: {
      ...Object.keys(notesByGroupId).reduce(
        (acc, groupId) => {
          acc[groupId] = notesByGroupId[groupId].join(',')
          return acc
        },
        {} as { [groupId: string]: string }
      ),
    },
    notesByBarCsv: {
      ...Object.keys(notesByBarObj).reduce(
        (acc, barId) => {
          acc[barId] = notesByBarObj[barId].join(',')
          return acc
        },
        {} as { [barId: string]: string }
      ),
    },
    groupsByBarCsv: {
      ...Object.keys(groupsByBar).reduce(
        (acc, barId) => {
          acc[barId] = groupsByBar[barId].join(',')
          return acc
        },
        {} as { [barId: string]: string }
      ),
    },
    barsByPhaseCsv: {
      ...Object.keys(barsByPhase).reduce(
        (acc, phaseId) => {
          acc[phaseId] = barsByPhase[phaseId].join(',')
          return acc
        },
        {} as { [phaseId: string]: string }
      ),
    },
  }
}

// One store and one compilation subscription shared by every consumer.
// Previously each useSubscribeToIds call site (one per PhaseControl, plus
// several in BarControls) created its own store and its own subscription, so a
// single compile ran the full build + compare once per mounted component — and
// the subscriptions were never cleaned up on unmount.
let sharedStore: StoreApi<NoteAndGroupIds> | null = null
let sharedUnsubscribe: (() => void) | null = null
let refCount = 0

const getSharedStore = () => {
  if (!sharedStore) {
    sharedStore = createStore<NoteAndGroupIds>(() => ({
      ...buildNoteAndGroupIdsStore(mem()),
    }))
  }
  return sharedStore
}

// The compilation subject only connects to its observable ~1s after module
// load, so a song-load compile can fire into the void; without this, whoever
// subscribed early sits on an empty store until the next compile.
addSongLoadCallback(() => {
  if (sharedStore && refCount > 0) {
    sharedStore.setState(buildNoteAndGroupIdsStore(mem()))
  }
})

const retainSubscription = () => {
  refCount++
  // Re-seed on every retain, not only the first: a late-mounting consumer may
  // arrive after data the subscription never saw (see the song-load race
  // above), and one build per component mount is cheap.
  getSharedStore().setState(buildNoteAndGroupIdsStore(mem()))
  if (refCount > 1) {
    return
  }
  sharedUnsubscribe = makeCompilationSubscribe({
    selector: (mem: Mem) => {
      return buildNoteAndGroupIdsStore(mem)
    },
    name: 'useSubscribeToIds',
  })({
    next: (noteAndGroupIds) => {
      getSharedStore().setState(noteAndGroupIds)
    },
    error: (err) => {
      console.error('error', err)
    },
    complete: () => {
      // completion comes from our own unsubscribe; nothing to do
    },
  })
}

const releaseSubscription = () => {
  refCount--
  if (refCount === 0 && sharedUnsubscribe) {
    sharedUnsubscribe()
    sharedUnsubscribe = null
  }
}

export const useSubscribeToIds = () => {
  const store = getSharedStore()
  useEffect(() => {
    retainSubscription()
    return releaseSubscription
  }, [])

  const shallowNotesByBar = useStore(
    store,
    useShallow((state) => state.notesByBar)
  )
  const shallowGroupsByBar = useStore(
    store,
    useShallow((state) => state.groupsByBar)
  )
  const shallowBarByNoteId = useStore(
    store,
    useShallow((state) => state.barByNoteId)
  )
  const shallowBarByGroupId = useStore(
    store,
    useShallow((state) => state.barByGroupId)
  )
  const shallowBarsByPhase = useStore(
    store,
    useShallow((state) => state.barsByPhase)
  )
  const shallowNotesByGroupId = useStore(
    store,
    useShallow((state) => state.notesByGroupId)
  )
  const shallowGroupByNoteId = useStore(
    store,
    useShallow((state) => state.groupByNoteId)
  )
  const shallowNotesByGroupIdCsv = useStore(
    store,
    useShallow((state) => state.notesByGroupIdCsv)
  )
  const shallowNotesByBarCsv = useStore(
    store,
    useShallow((state) => state.notesByBarCsv)
  )
  const shallowGroupsByBarCsv = useStore(
    store,
    useShallow((state) => state.groupsByBarCsv)
  )
  const shallowBarsByPhaseCsv = useStore(
    store,
    useShallow((state) => state.barsByPhaseCsv)
  )
  return {
    notesByBar: shallowNotesByBar,
    groupsByBar: shallowGroupsByBar,
    barByNoteId: shallowBarByNoteId,
    barByGroupId: shallowBarByGroupId,
    barsByPhase: shallowBarsByPhase,
    notesByGroupId: shallowNotesByGroupId,
    groupByNoteId: shallowGroupByNoteId,
    notesByGroupIdCsv: shallowNotesByGroupIdCsv,
    notesByBarCsv: shallowNotesByBarCsv,
    groupsByBarCsv: shallowGroupsByBarCsv,
    barsByPhaseCsv: shallowBarsByPhaseCsv,
  }
}
