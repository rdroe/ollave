import { mem } from "src/mem"
import { getTagData, TagData, TagEntries, unparseTagEntries } from "./tags"
import { mapSongToMidiTicks } from "src/mapSongToTicks"

export const addNoteToBar = async (note: string, bar: string, tags: TagEntries) => {
    const barObj = mem().notesByBar[bar]
    if (!barObj) {
        throw new Error(`Bar ${bar} not found`)
    }
    if (typeof getTagData(tags, 'barDelay')?.[0] !== 'number') {
        console.warn('barDelay tag is missing')
    }
    if (typeof getTagData(tags, 'noteId')?.[0] !== 'string') {
        throw new Error('noteId tag is missing')
    }
    barObj.push({
        note,
        tags: unparseTagEntries(tags),
    })
    mem().latestMap = mapSongToMidiTicks()
}
