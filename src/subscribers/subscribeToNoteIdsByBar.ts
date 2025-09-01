import { mem, Mem } from "../core/mem";

import { createStore, useStore } from "zustand";

import { z } from "zod";
import { useShallow } from "zustand/shallow";
import { makeCompilationSubscribe } from "src/core/subjects/compilationSubject";

export const subscribeToNoteIdsByBar = (barId: string) => {
    const { store } = createBarNoteIdsStore(barId)
    const subscribe = makeCompilationSubscribe({
        selector: (mem: Mem) => {
            if (!mem.notesByBar[barId]) {
                return []
            }
            const noteIdTags = 
            z.array(
                z.tuple([z.string()])).parse(mem.notesByBar[barId].map((tag) => tag.tagsObj.noteId)
            )
            return z.array(z.string()).parse(noteIdTags.map((tag) => tag[0]))
        },
        compare: (a, b) => {
            if (b === null) {
                return false
            }
            return a.every((id) => b.includes(id)) && b.every((id) => a.includes(id))  
        },
        clone: (a) => {
            return  structuredClone(a)
        }
    })
    return {
        store,
        subscribe
    }
}

type BarNoteIdsStore = {
    barNoteIds: string[]
    setBarNoteIds: (barNoteId: string[]) => void
    unsubscribe: () => void
}

export const createBarNoteIdsStore = (barId: string) => {
    const store = createStore<BarNoteIdsStore>((set) => ({
        barNoteIds: [],
        setBarNoteIds: (barNoteIds: string[]) => set({ barNoteIds  }),
        unsubscribe: () => {}
    }))
    let didUnsubscribe = false
    const subscribe = makeCompilationSubscribe({
        selector: (mem: Mem) => {
            if (!mem.notesByBar[barId]) {
                return []
            }
            const noteIdTags = 
            z.array(
                z.tuple([z.string()])).parse(mem.notesByBar[barId].map((tag) => tag.tagsObj.noteId)
            )
            return z.array(z.string()).parse(noteIdTags.map((tag) => tag[0]))
        },
        compare: (a, b) => {
            if (b === null) {
                return false
            }
            return a.every((id) => b.includes(id)) && b.every((id) => a.includes(id))  
        },
        clone: (a) => {
            return  structuredClone(a)
        }
    })
    const unsubscribe = subscribe(({
        next: (barNoteIds) => {
            store.getState().setBarNoteIds(barNoteIds)
        },
        error: (err) => {
            console.error('error', err)
        },
        complete: () => {
            didUnsubscribe = true
            unsubscribe()
        }
    }))
    return {
        store,
        unsubscribe: () => {
            if (!didUnsubscribe) {
                unsubscribe()
            }
        }
    }
}


export const useBarNoteIdsStore = (barId: string) => {
    const { store } = createBarNoteIdsStore(barId)
    return useStore(store)
}

export const useBarNoteIdsCsvStore = (barId: string) => {
    const { store } = createBarNoteIdsStore(barId)
    return useStore(
        store,
        useShallow(({ barNoteIds }) => {
            return barNoteIds.join(',')
        })
    )
}