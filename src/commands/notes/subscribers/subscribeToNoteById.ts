import { cloneNoteByBar, Mem } from "../../../lib/mem";
import { makeCompilationSubscribe, parseNoteTags } from "../../../lib";
import { TagEntries } from "../../../lib/tags";

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