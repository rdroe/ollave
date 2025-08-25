import { cloneNoteByBar, mem, Mem, NoteByBar, tagsObjSchema } from "../../../lib/mem";
import { makeCompilationSubscribe,  parseNoteTags } from "../../../lib";
import { TagEntries } from "../../../lib/tags";
import { createStore } from "zustand";
import { Subscription } from "rxjs";
import { set } from "zod";
// import { updateTagsObj } from "src/lib/addSlider";
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

export const subscribeToNoteByIdOld = (noteId?: string, barName?: string) => { 
    if (!noteId) {
        throw new Error('noteId is required')
    }
    return makeCompilationSubscribe({
        selector: (mem: Mem) => {
            if (!barName) { 
                const clone = Object.values(mem.notesByBar).flat().find((note) => note.tagsObj.noteId[0] === noteId)
                return clone
            }
            const clone = mem.notesByBar[barName].find((note) => note.tagsObj.noteId[0] === noteId)
            return clone
        },
        compare: (a, b) => {
            return tagEntriesCompare(parseNoteTags(a.tags), parseNoteTags(b?.tags || []))
        }, 
        clone: (a) => {
            return cloneNoteByBar(a)
        }
    }) 
}
export const subscribeToNoteById = (noteId?: string, barName?: string) => { 
    if (!noteId) {
        throw new Error('noteId is required')
    }
    console.log('subscribeToNoteById_', noteId, barName)
    const { store } = singleNoteStore(noteId, barName)
    const subscribe = makeCompilationSubscribe({
        selector: (mem: Mem) => {
            console.log('selector', mem.notesByBar)
            if (!barName) { 
                const clone = Object.values(mem.notesByBar).flat().find((note) => note.tagsObj.noteId[0] === noteId)
                return clone
            }
            const clone = mem.notesByBar[barName].find((note) => note.tagsObj.noteId[0] === noteId)
            return clone
        },
        compare: (a, b) => {
            console.log('compare', a, b)
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
    console.log('singleNoteStore', noteId)
    const initialNote = barName ? mem().notesByBar[barName].find((note) => note.tagsObj.noteId[0] === noteId) : Object.values(mem().notesByBar).flat().find((note) => note.tagsObj.noteId[0] === noteId) 
    console.log('initialNote', initialNote)
    const store = createStore<SingleNoteStore>((set) => ({
        note: initialNote,
        setNote: (note: NoteByBar) => set({ note }),
        unsubscribe: () => {}
    }))

    // const subscription = subscribeToNoteById(noteId, barName)({
    //         next: (num) => {
    //             console.log('next in addNote from lib', num.tagsObj.noteId[0])
    //         },
    //         complete: () => {
    //             console.log('complete')
    //         },
    //         error: (err: any) => {
    //             console.log('error', err)
    //         },
    //     })

    // store.setState({ unsubscribe: subscription })

    return {
        store,
        // updateTagsObj: (tagsObj: z.infer<typeof tagsObjSchema>)  => updateTagsObj(noteId, tagsObj) 
    }
}



const subscribeToNoteById2_ = (noteId?: string, barName?: string) => { 
    if (!noteId) {
        throw new Error('noteId is required')
    }
    console.log('subscribeToNoteById_', noteId, barName)
    console.log('singleNoteStore', noteId)
    const initialNote = barName ? mem().notesByBar[barName].find((note) => note.tagsObj.noteId[0] === noteId) : Object.values(mem().notesByBar).flat().find((note) => note.tagsObj.noteId[0] === noteId) 
    console.log('initialNote', initialNote)
    const store = createStore<SingleNoteStore>((set) => ({
        note: initialNote,
        setNote: (note: NoteByBar) => set({ note }),
        unsubscribe: () => {}
    }))
    return makeCompilationSubscribe({
        selector: (mem: Mem) => {
            console.log('selector', mem.notesByBar)
            if (!barName) { 
                const clone = Object.values(mem.notesByBar).flat().find((note) => note.tagsObj.noteId[0] === noteId)
                return clone
            }
            const clone = mem.notesByBar[barName].find((note) => note.tagsObj.noteId[0] === noteId)
            return clone
        },
        compare: (a, b) => {
            console.log('compare', a, b)
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
}



