import { NoteByBar } from "../lib/schemas";
import { mem, Mem } from "../core/mem";
import {  sortByNumberAfterColon } from "../lib";
import { createStore, useStore } from "zustand";

import equal from 'deep-equal'
import { useShallow } from "zustand/shallow";
import { makeCompilationSubscribe } from "../core/subjects/compilationSubject";

const getBarNoteIdsCsvs = (mem: Mem) => {
    const barIdsToNoteIdCsv: { [barId: string]: string } = {}
    Object.keys(mem.notesByBar).forEach((barId) => {
        barIdsToNoteIdCsv[barId] = mem.notesByBar[barId].map((note) => note.tagsObj.noteId[0]).join(',')
    })
    return barIdsToNoteIdCsv
}

export const subscribeToBarNoteIdsCsvs = () => {
    const subscribe = makeCompilationSubscribe({
        selector: (mem) => {
            const barIdsToNoteIdCsv: { [barId: string]: string } = getBarNoteIdsCsvs(mem)
            return barIdsToNoteIdCsv
        },
        compare: (a, b) => {
            const comparison = equal(a, b, {strict: true})
            if (comparison) {
                return true
            } else {
                return false
            }
        },
        clone: (a) => {
            return structuredClone(a)
        },
        name: 'subscribeToBarNoteIdsCsvs'
    })

    return {subscribe}
}

type BarNoteIdsCsvs = {
    allNoteIdsByBar: { [barId: string]: string }
    setAllNoteIdsByBar: (allNoteIdsByBar: { [barId: string]: string }) => void
    unsubscribe: () => void
}

export const createAllNoteIdsByBarStore = () => {
  let didUnsubscribe = false
  const store = createStore<BarNoteIdsCsvs>((set) => ({
    allNoteIdsByBar: getBarNoteIdsCsvs(mem()),
    setAllNoteIdsByBar: (allNoteIdsByBar: { [barId: string]: string }) => set({ allNoteIdsByBar }),
    unsubscribe: () => {}
  }))

    const unsubscribe = subscribeToBarNoteIdsCsvs().subscribe({
      next: (barNoteIdsCsvs) => {
        store.getState().setAllNoteIdsByBar(barNoteIdsCsvs)
      },
      error: (err) => {
        console.error('error', err)
      },
      complete: () => {
        didUnsubscribe = true
        unsubscribe()
      }
    })

    store.setState({
      allNoteIdsByBar: getBarNoteIdsCsvs(mem()),
      unsubscribe: () => {
        if (!didUnsubscribe) {
            unsubscribe()
            didUnsubscribe = true
        }
      }
    })
    return store
}

export const useBarNoteIdsCsvsStore = () => {
    const store = createAllNoteIdsByBarStore()
    return useStore(store, useShallow(({ allNoteIdsByBar }) => {
        return allNoteIdsByBar
    }))
}
