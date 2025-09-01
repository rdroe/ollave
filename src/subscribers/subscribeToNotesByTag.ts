/**
 * This subscribes to all notes that have a given tag.
 * The tagData is provided and must match exactly using the 
 * 
 * The design is based on other subscribers in the same folder.
 * 
 * The barId is provided (alongside the note property) for every matching note.
 * 
 * 
 */

import { NoteByBar, mem, Mem, cloneNoteByBar } from "../lib/mem";
import {  parseNoteTags } from "../lib";
import { TagEntries } from "../lib/tags";
import { createStore, useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { tagEntriesCompare } from "../lib/tags";
import { makeCompilationSubscribe } from "src/core/subjects/compilationSubject";

type NoteByBarWithBarId = NoteByBar & {
    barId: string
}

export const subscribeToNotesByTag = (tagStrings: string[]) => {
    if (!tagStrings || tagStrings.length === 0) {
        throw new Error('tagStrings array is required and cannot be empty')
    }

    const { store } = createInternalNotesByTagStore(tagStrings)
    // select the notes by tag and data. review ALL notes in the mem.notesByBar.
    const selector = makeSelector(tagStrings)
    // if the note ids or bar ids have changed, this returns false (so that subscribers can be updated) 
    const compare = makeCompare()
    // subscribe using selector, compare, and clone.
    const subscribe = makeCompilationSubscribe({
        selector: (mem: Mem) => {
            return selector(mem)
        },
        compare: (a, b) => {
            const result = compare(a, b) 
            return result
        }, 
        // clone function clones the note after the fashion of the note by id subscriber. 
        // but afterwards, it adds the barId to the note. 
        clone
    })
    return {
        store,
        subscribe
    }
}

type NotesByTagStore = {
    notes: NoteByBarWithBarId[]
    setNotes: (notes: NoteByBarWithBarId[]) => void
    unsubscribe: () => void
}

const createInternalNotesByTagStore = (tagStrings: string[]) => {
    const targetTags = parseNoteTags(tagStrings)
    const initialNotes = selector(mem(), targetTags)
    
    const store = createStore<NotesByTagStore>((set) => ({
        notes: initialNotes,
        setNotes: (notes: NoteByBarWithBarId[]) => set({ notes }),
        unsubscribe: () => {}
    }))

    return {
        store,
    }
}

export const createNotesByTagStore = (tagStrings: string[]) => { 
    if (!tagStrings || tagStrings.length === 0) {
        throw new Error('tagStrings array is required and cannot be empty')
    }
    
    const targetTags = parseNoteTags(tagStrings)
    const { store } = createInternalNotesByTagStore(tagStrings)
    let didUnsubscribe = false
    const compare = makeCompare()
    const subscribe = makeCompilationSubscribe({
        selector: (mem: Mem) => selector(mem, targetTags),
        compare: (a, b) => {
            const result = compare(a, b)  
            return result
        }, 
        clone
    })
    const unsubscribe = subscribe(({
        next: (notes) => {
            store.getState().setNotes(notes)
        },
        complete: () => {
            if (didUnsubscribe) {
                return
            }
            didUnsubscribe = true
        },
        error: (err: any) => {
            console.error('error', err)
        },
    }))

    return {
        store, 
        unsubscribe: () => {
            if (!didUnsubscribe) {
                didUnsubscribe = true
                unsubscribe()
            }
        }
    }
}
// select the notes by tag and data. review ALL notes in the mem.notesByBar.
function selector(mem: Mem, targetTags: TagEntries): NoteByBarWithBarId[] {
    const matchingNotes: NoteByBarWithBarId[] = []
    Object.entries(mem.notesByBar).forEach(([barId, notes]) => {
        notes.forEach((note) => {
            // filter tag entries from note to those matching the target tags.
            const noteTags = parseNoteTags(note.tags).filter(([tagName]) => targetTags.some(([targetTagName]) => targetTagName === tagName))
            if (tagEntriesCompare(targetTags, noteTags)) {
                matchingNotes.push({
                    ...note,
                    barId
                })
            }
        })
    })
    
    return matchingNotes
}
// make the selector function that selects the notes by tag and data.
function makeSelector(tagStrings: string[]) {
    const targetTags = parseNoteTags(tagStrings)
    return function(mem: Mem): NoteByBarWithBarId[] {
        return selector(mem, targetTags)
    }
}
// make the compare function that sees whether the note ids and barIds have changed. 
// if so, return false. never automatically unsubscribe. only return true or false. 
function makeCompare() { 
    return (a: NoteByBarWithBarId[], b: NoteByBarWithBarId[]): boolean  => {
        if (a === null || b === null) {
            return false
        }
        if (a.length !== b.length) {
            return false
        }
        return a.every((note) => b.some((bNote) => bNote.tagsObj.noteId[0] === note.tagsObj.noteId[0] && bNote.barId === note.barId))
            && b.every((note) => a.some((aNote) => aNote.tagsObj.noteId[0] === note.tagsObj.noteId[0] && aNote.barId === note.barId))

    }
}

function clone(notes: NoteByBarWithBarId[]): NoteByBarWithBarId[] { 
    return notes.map((note) => ({
        ...cloneNoteByBar(note),
        barId: note.barId
    }))
}

export const useNotesByTagStore = (tagStrings: string[]) => {
    const { store } = createNotesByTagStore(tagStrings)
    return useStore(store)
}

export const useNoteIdsByTagStore = (tagStrings: string[]) => {
    const { store } = createNotesByTagStore(tagStrings)
    return useStore(
        store,
        useShallow(
            (state) => state.notes.map((note) => note.tagsObj.noteId[0])
        )
    )
}