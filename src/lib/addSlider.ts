import { tickCounts } from "../commands/phase/observables/masterTicksObservable"
import { mem, NoteByBar } from "../lib/mem"
import { peprnIsNum } from "./helpers"
import { mapSongToMidiTicks } from "../lib/mapSongToTicks"

/**
 * Given a note id, add a slider to move the note to a new time within the bar
 * controls-1 is the div that will contain the slider
 * 
 */
export function addSlider (barName: string, noteId: string) {
    const controls1 = document.getElementById('controls-1')
    if (!controls1) {
        throw new Error('controls-1 not found')
    }
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = '0'
    slider.max = `${tickCounts.bar}`
    const noteData = mem().notesByBar[barName].find((note) => note.tags.includes(`noteId=${noteId}`))
    const noteDelay = noteData?.tags.find((tag) => tag.startsWith('barDelay='))?.split('=')[1]
    if (typeof noteDelay !== 'string' || !peprnIsNum(noteDelay)) {
        console.error('barDelay datum should be a number; insteaed got ' + noteDelay)
        console.error('noteData', noteData) 
        console.error('barName', barName)
        console.error('noteId', noteId)
        console.error('bar data', mem().notesByBar[barName])
        return
    }
    slider.value = noteDelay.toString()
    slider.oninput = () => {
        updateBarDelay(noteData, parseInt(slider.value))
    }
    controls1.appendChild(slider)
}

// on the data object, replace the barDelay index by array index value
// also call the mapSongToMidiTicks function to update the midi map, but 
// use native JS setTimeout to debounce to 100ms
export function updateBarDelay (noteData: NoteByBar, newBarDelay: number) {
    const index = noteData.tags.findIndex((tag) => tag.startsWith('barDelay='))
    if (index === -1) {
        throw new Error('barDelay tag not found')
    }
    noteData.tags[index] = `barDelay=${newBarDelay}`
    setTimeout(() => {
        mem().latestMap = mapSongToMidiTicks()
    }, 100)
    return noteData
}
