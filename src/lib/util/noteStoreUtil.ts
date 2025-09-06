import { NoteByBar } from "../schemas"
import { mem } from "../../core/mem"
import { parseNoteTags, TagEntries } from "./noteParsingUtil"
import { tagsDeleteMatching1 } from "./tagsUtil"
import { BehaviorSubject } from "rxjs"

export const createNoteStoreById = (noteId: string) => {
    const note = Object.values(mem().notesByBar).flat().find((note) => note.tags.includes(`noteId=${noteId}`))
    if (!note) {
        throw new Error(`Note with id ${noteId} not found`)
    }

    const noteSubject = new BehaviorSubject<NoteByBar>(note)
    const noteObservable = noteSubject.asObservable()

    const updateTagsObj = (newTagsObj: { [key: string]: any }) => {
        const currentNote = noteSubject.value
        const updatedTags = Object.entries(newTagsObj).map(([key, value]) => `${key}=${value.join(',')}`)
        currentNote.tags = tagsDeleteMatching1((tagEntry) => !Object.keys(newTagsObj).includes(tagEntry[0]), parseNoteTags(currentNote.tags)).map(([k, v]) => `${k}=${v.join(',')}`).concat(updatedTags)
        noteSubject.next(currentNote)
    }

    const updateNotePitch = (newPitch: string) => {
        const currentNote = noteSubject.value
        currentNote.note = newPitch
        noteSubject.next(currentNote)
    }

    const unsubscribe = () => {
        // No explicit unsubscribe for BehaviorSubject, but can be used to clean up other subscriptions
    }

    return { store: noteObservable, updateTagsObj, updateNotePitch, unsubscribe }
}
