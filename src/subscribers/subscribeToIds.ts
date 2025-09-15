import { useEffect, useMemo, useState } from 'react'

import deepEqual from 'deep-equal'
import { z } from 'zod'
import { createStore, useStore } from 'zustand'
import { useShallow } from 'zustand/shallow'

import { mem, Mem } from '../core/mem'
import { makeCompilationSubscribe } from '../core/subjects/compilationSubject'

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

export const useSubscribeToIds = () => {
  const store = useMemo(
    () =>
      createStore<NoteAndGroupIds>(() => ({
        ...buildNoteAndGroupIdsStore(mem()),
      })),
    []
  )
  const [didUnsubscribe, setDidUnsubscribe] = useState(false)
  useEffect(() => {
    const unsubscribe = makeCompilationSubscribe({
      selector: (mem: Mem) => {
        return buildNoteAndGroupIdsStore(mem)
      },
      compare: (a, bDefault) => {
        const b = bDefault || buildNoteAndGroupIdsStore(mem())
        // we need to find the mismiatch.
        // do deep equal on all the properties
        const properties = Object.keys(a).filter(
          (property) => property !== 'unsubscribe'
        )
        const comparison = properties.every((property) => {
          const comparison = deepEqual(
            a[property as keyof NoteAndGroupIds],
            b[property as keyof NoteAndGroupIds],
            { strict: true }
          )
          return comparison
        })
        if (comparison) {
          return true
        } else {
          return false
        }
      },
      name: 'useSubscribeToIds',
    })({
      next: (noteAndGroupIds) => {
        store.setState(noteAndGroupIds)
      },
      error: (err) => {
        console.error('error', err)
      },
      complete: () => {
        if (!didUnsubscribe) {
          setDidUnsubscribe(true)
          unsubscribe()
        }
      },
    })
  }, [didUnsubscribe])

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
