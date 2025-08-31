import { mem, Mem, NoteByBar } from "../lib/mem";
import { makeCompilationSubscribe, sortByNumberAfterColon } from "../lib";
import { createStore, useStore } from "zustand";

import equal from 'deep-equal'
import { useShallow } from "zustand/shallow";

export const subscribeToPhaseBarIds = () => {
    const { store } = phaseBarIdsStore()
    const subscribe = makeCompilationSubscribe({
        selector: () => {
            return getPhaseBarIds()
        },
            compare: (a, b) => {
            const comparison = equal(a, b)
            if (comparison) {
                return true
            } else {
                return false
            }
        }, 
        clone: (a) => {
            return structuredClone(a)
        }
    })

    return {
        store,
        subscribe
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

export const phaseBarIdsStore = () =>  {
    const phaseExists = mem().phases
    if (!phaseExists) {
        throw new Error('phases property does not exist')
    }
    const store = createStore<PhaseStructureStore>((set) => ({
        phaseBarIds: getPhaseBarIds(),
        setPhaseBarIds: (phaseBarIds: PhaseBarIds) => set({ phaseBarIds }),
        unsubscribe: () => {}
    }))

    return {
        store,
    }
}

export const createPhaseBarIdsStore = () => { 
    const { store } = phaseBarIdsStore()
    let didUnsubscribe = false
    const subscribe = makeCompilationSubscribe({
        selector: (mem: Mem) => {
            return getPhaseBarIds()
        },
        compare: (a, b) => {
            const comparison = equal({bars: a}, {bars:b}, {strict: true})
            if (comparison) {
                return true
            } else {
                return false
            }
        }, 
        clone: (a) => {
            return structuredClone(a)
        }
    })
    const unsubscribe = subscribe(({
        next: (phaseBarIds) => {
            store.getState().setPhaseBarIds(phaseBarIds) 
        },
        complete: () => {
            didUnsubscribe = true
            unsubscribe()
        },
        error: (err: any) => {
            console.error('error', err)
        },
    }))
    return {store,
        // todo: move bar to phase, etc.
        unsubscribe: () => {
            if (!didUnsubscribe) {
                unsubscribe()
            }
        }
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
                sortedBarIdsByPhase[phaseName] = phaseBarIds.sort(sortByNumberAfterColon).join(',')
            })
            return sortedBarIdsByPhase
        })
    )
}

export const useAllBarNoteIdCsvStore = () => {
    const { store } = createPhaseBarIdsStore()
    return useStore(
        store,
        useShallow(({ phaseBarIds }) => {
            //return a map in which keys are barIds (regardless of phase) and values are the csv of note ids in that bar
            const barNoteIdCsvs: { [barId: string]: string } = {}
            Object.values(phaseBarIds).forEach((phaseBarIds) => {
                const currentNotesByBar = mem().notesByBar
                phaseBarIds.forEach((barId) => {
                    barNoteIdCsvs[barId] = getBarNoteIdCsvs(currentNotesByBar, barId)
                })
            })
            return barNoteIdCsvs
        })
    )
}

function getBarNoteIdCsvs(currentNotesByBar: { [barId: string]: NoteByBar[] }, barId: string): string {
        return  currentNotesByBar[barId].map((note) => note.tagsObj.noteId[0]).join(',')
}