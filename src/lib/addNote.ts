import { makeNoteByBar, mem, NoteByBar } from "../lib/mem"
import { getTagData, TagEntries, unparseTagEntries } from "./tags"
import { mapSongToMidiTicks } from "../lib/mapSongToTicks"
import { setLatestMap } from "../commands/phase/observables/compilationObservable"

export const addNoteToBar = async (note: string, bar: string, tagsIn: TagEntries): Promise<NoteByBar> => {
    const barObj = mem().notesByBar[bar]
    if (!barObj) {
        throw new Error(`Bar ${bar} not found`)
    }
    if (typeof getTagData(tagsIn, 'barDelay')?.[0] !== 'number') {
        console.warn('barDelay tag is missing')
    }

    if (!['string', 'number'].includes(typeof getTagData(tagsIn, 'noteId')?.[0])) {
        throw new Error('noteId tag is missing')
    }
    const tags = unparseTagEntries(tagsIn)
    barObj.push(makeNoteByBar(note, tags))
    setLatestMap(mapSongToMidiTicks())
    return makeNoteByBar(note, tags)
}
