import { makeNoteByBar, Mem, mem, NoteByBar } from "../lib/mem"
import { getTagData, TagEntries, unparseTagEntries } from "./tags"


import { randId } from "./helpers"
import { addSlider } from "./addSlider"
import { subscribeToNoteById } from "../commands/notes/subscribers/subscribeToNoteById"

export const addNoteToBar = async (note: string, barName: string, tagsIn: TagEntries, doAddSlider: boolean = false): Promise<NoteByBar> => {
    const barObj = mem().notesByBar[barName]
    const tags = unparseTagEntries(tagsIn)
    if (!barObj) {
        throw new Error(`Bar ${barName} not found`)
    }

    let noteId = getTagData(tagsIn, 'noteId')?.[0]
    if (!noteId) {
        noteId = randId('', 6)
        tags.push(`noteId=${noteId}`)
    }

    if (typeof noteId !== 'string') {
        throw new Error('noteId tag is missing or non-string ' + noteId)
    }


    if (typeof getTagData(tagsIn, 'barDelay')?.[0] !== 'number') {
        tags.push(`barDelay=0`)
    }
    const noteObj = makeNoteByBar(note, tags)
    barObj.push(noteObj)

    if (doAddSlider) {
        addSlider(barName, noteId)
            subscribeToNoteById(noteId)({
                next: (num) => {
                    console.log('next in addNote from lib', noteObj.tagsObj.noteId) 
                },
                complete: () => {
                    console.log('complete')
                },
                error: (err: any) => {
                    console.log('error', err)
                },
            }) 
    }


    return noteObj
}