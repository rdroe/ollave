import { cloneNoteByBar, mem, Mem, NoteByBar, tagsObjSchema } from "../../../lib/mem";
import { makeCompilationSubscribe,  parseNoteTags } from "../../../lib";
import { TagEntries } from "../../../lib/tags";
import { createStore } from "zustand";
import { updateNotePitch, updateTagsObj } from "../../../lib/addSlider";
import { z } from "zod";
import { deleteNoteById } from "../../../lib/deleteNoteById";

export const tagEntriesCompare = (a: TagEntries, b: TagEntries) => {
    if (a.length !== b?.length) {
        return false
    }
    const compared = a.every(([tagName, data]) => {
        return data.every((tagDatum, index2) => {
            const  bData = b.find(([tagName2]) => {
                return tagName === tagName2
            })
            const bDatum = bData?.[1][index2]
            const comparedInner = tagDatum === bDatum
            return comparedInner
        })
    }) 
    return compared
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
            if (result === "UNSUBSCRIBE") {
                store.getState().unsubscribe()
                return true
            }
            return result
        }, 
        clone
    })
    return {
        store,
        subscribe
    }
}

type SingleNoteStore = {
    note: NoteByBar
    setNote: (note: NoteByBar) => void
    unsubscribe: () => void
}

const singleNoteStore = (noteId: string, barName?: string) =>  {
    const initialNote = barName ? mem().notesByBar[barName].find((note) => note.tagsObj.noteId[0] === noteId) : Object.values(mem().notesByBar).flat().find((note) => note.tagsObj.noteId[0] === noteId) 
    const store = createStore<SingleNoteStore>((set) => ({
        note: initialNote,
        setNote: (note: NoteByBar) => set({ note }),
        unsubscribe: () => {}
    }))

    return {
        store,
    }
}

//
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
            if (result === "UNSUBSCRIBE") {
                unsubscribe()
                return true
            }
            return result
        }, 
        clone
    })
    const unsubscribe = subscribe(({
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
        error: (err: any) => {
            console.error('error', err)
        },
    }))

    return {store, 
        updateNotePitch: (note: string, skipSliderSync: boolean = true) => { 
            updateNotePitch(noteId, note, skipSliderSync) 
        },
        updateTagsObj: (tagsObj: z.infer<typeof tagsObjSchema>, skipSliderSync: boolean = true)  => updateTagsObj(noteId, tagsObj, skipSliderSync),
        unsubscribe: () => {
            if (!didUnsubscribe) {
                didUnsubscribe = true
                 unsubscribe()
            }
        }
    }
}

function makeSelector (noteId: string, barName?: string)  { 
    return function (mem: Mem): NoteByBar | null  {
        if (barName && mem.notesByBar[barName]) {
            const clone = mem.notesByBar[barName].find((note) => note.tagsObj.noteId[0] === noteId)
            if (clone) {
                return clone
            }
        }
        // try again; as if bar name could be wrong or it's not provided
        const clone = Object.values(mem.notesByBar).flat().find((note) => note.tagsObj.noteId[0] === noteId)
        if (clone) {
            return clone
        }
        return null
    }
}

function makeCompare (store: ReturnType<typeof singleNoteStore>['store'])  { 
    return (a: NoteByBar, b: NoteByBar): boolean | "UNSUBSCRIBE" => {
        if (a===null) {
            return "UNSUBSCRIBE"
        }
        const comparison = tagEntriesCompare(parseNoteTags(a.tags), parseNoteTags(b?.tags || []))
        const notePropertyCompare = a.note === b?.note
        if (notePropertyCompare && comparison) {
            store.getState().setNote(a)
            return true
        } else {
            return false
        }
    }
}

function clone (noteByBar: NoteByBar)  { 
    return cloneNoteByBar(noteByBar)
}