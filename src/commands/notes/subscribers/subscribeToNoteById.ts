import { cloneNoteByBar, mem, Mem, NoteByBar, tagsObjSchema } from "../../../lib/mem";
import { makeCompilationSubscribe,  parseNoteTags } from "../../../lib";
import { TagEntries } from "../../../lib/tags";
import { createStore } from "zustand";
import { Subscription } from "rxjs";
import { set } from "zod";
import { updateNotePitch, updateTagsObj } from "../../../lib/addSlider";
import { z } from "zod";

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
    const subscribe = makeCompilationSubscribe({
        selector: (mem: Mem) => {
            if (!barName) { 
                const clone = Object.values(mem.notesByBar).flat().find((note) => note.tagsObj.noteId[0] === noteId)
                return clone
            }
            const clone = mem.notesByBar[barName].find((note) => note.tagsObj.noteId[0] === noteId)
            return clone
        },
        compare: (a, b) => {
            const comparison = tagEntriesCompare(parseNoteTags(a.tags), parseNoteTags(b?.tags || []))
            if (comparison) {
                store.getState().setNote(a) 
                return true
            } else {
                return false
            }
        }, 
        clone: (a) => {
            return cloneNoteByBar(a)
        }
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

export const singleNoteStore = (noteId: string, barName?: string) =>  {
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


export const createNoteStoreById = (noteId?: string, barName?: string) => { 
    if (!noteId) {
        throw new Error('noteId is required')
    }
    const { store } = singleNoteStore(noteId, barName)
    const subscribe = makeCompilationSubscribe({
        selector: (mem: Mem) => {
            if (!barName) { 
                const clone = Object.values(mem.notesByBar).flat().find((note) => note.tagsObj.noteId[0] === noteId)
                return clone
            }
            const clone = mem.notesByBar[barName].find((note) => note.tagsObj.noteId[0] === noteId)
            return clone
        },
        compare: (a, b) => {
            const comparison = tagEntriesCompare(parseNoteTags(a.tags), parseNoteTags(b?.tags || []))
            if (comparison) {
                return true
            } else {
                return false
            }
        }, 
        clone: (a) => {
            return cloneNoteByBar(a)
        }
    }) 
    const unsubscribe = subscribe(({
        next: (note) => {
            store.getState().setNote(note) 
        },
        complete: () => {
            unsubscribe()
        },
        error: (err: any) => {
            console.error('error', err)
        },
    }))

    return {store, 
        updateNotePitch: (note: string) => updateNotePitch(noteId, note),
        updateTagsObj: (tagsObj: z.infer<typeof tagsObjSchema>)  => updateTagsObj(noteId, tagsObj),
        unsubscribe
    }

}

