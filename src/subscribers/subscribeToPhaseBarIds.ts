import equal from 'deep-equal'
import { createStore, useStore } from 'zustand'
import { useShallow } from 'zustand/shallow'

import { mem, Mem } from '../core/mem'
import { makeCompilationSubscribe } from '../core/subjects/compilationSubject'
import { sortByNumberAfterColon } from '../lib'
import { NoteByBar } from '../lib/schemas'

export const subscribeToPhaseBarIds = () => {
  const { store } = phaseBarIdsStore()
  const subscribe = makeCompilationSubscribe({
    selector: () => {
      const phaseBarIds = getPhaseBarIds()

      return phaseBarIds
    },
    compare: (a, b) => {
      const comparison = equal(a, b, { strict: true })
      if (comparison) {
        return true
      } else {
        return false
      }
    },
    clone: (a) => {
      return structuredClone(a)
    },
    name: 'subscribeToPhaseBarIds',
  })

  return {
    store,
    subscribe,
  }
}

type PhaseStructureStore = {
  phaseBarIds: PhaseBarIds
  setPhaseBarIds: (phaseBarIds: PhaseBarIds) => void
  unsubscribe: () => void
}

const getPhaseBarIds = (): PhaseBarIds => {
  return Object.keys(mem().notesByBar).reduce((acc, barId) => {
    const phaseId = barId.split(':')[0]
    if (!acc[phaseId]) {
      acc[phaseId] = []
    }
    acc[phaseId].push(barId)
    return acc
  }, {} as PhaseBarIds)
}

type PhaseBarIds = Record<string, string[]>

export const phaseBarIdsStore = () => {
  const phaseExists = mem().phases
  if (!phaseExists) {
    throw new Error('phases property does not exist')
  }
  const store = createStore<PhaseStructureStore>((set) => ({
    phaseBarIds: getPhaseBarIds(),
    setPhaseBarIds: (phaseBarIds: PhaseBarIds) => set({ phaseBarIds }),
    unsubscribe: () => {},
  }))

  return {
    store,
  }
}

export const createPhaseBarIdsStore = () => {
  const { store } = phaseBarIdsStore()
  let didUnsubscribe = false
  const subscribe = makeCompilationSubscribe({
    selector: (_: Mem) => {
      return getPhaseBarIds()
    },
    compare: (a, b) => {
      const comparison = equal({ bars: a }, { bars: b }, { strict: true })
      if (comparison) {
        return true
      } else {
        return false
      }
    },
    clone: (a) => {
      return structuredClone(a)
    },
    name: 'createPhaseBarIdsStore',
  })
  const unsubscribe = subscribe({
    next: (phaseBarIds) => {
      store.getState().setPhaseBarIds(phaseBarIds)
    },
    complete: () => {
      didUnsubscribe = true
      unsubscribe()
    },
    error: (err: { message: string }) => {
      console.error('error', err)
    },
  })
  return {
    store,
    // todo: move bar to phase, etc.
    unsubscribe: () => {
      if (!didUnsubscribe) {
        unsubscribe()
      }
    },
  }
}

export const usePhaseBarIdsStore = () => {
  const { store } = createPhaseBarIdsStore()
  return useStore(store)
}

export const usePhaseBarIdsCsvStore = () => {
  const { store } = createPhaseBarIdsStore()
  return useStore(
    store,
    useShallow(({ phaseBarIds }) => {
      const sortedBarIdsByPhase: { [phaseName: string]: string } = {}
      Object.entries(phaseBarIds).forEach(([phaseName, phaseBarIds]) => {
        sortedBarIdsByPhase[phaseName] = phaseBarIds
          .sort(sortByNumberAfterColon)
          .join(',')
      })
      return sortedBarIdsByPhase
    })
  )
}
