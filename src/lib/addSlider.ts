import { tickCounts } from "../commands/phase/observables/masterTicksObservable"
import { mem, NoteByBar, tagsObjSchema } from "../lib/mem"
import { peprnIsNum } from "./helpers"
import { mapSongToMidiTicks } from "../lib/mapSongToTicks"
import { setLatestMap } from "../commands/phase/observables/compilationObservable"
import { z } from "zod"
import { isNoteNameWithOctave } from "../commands/bars/utils"


// as after a barDelay change, update the slider value, finding it in the dom via noteId
const syncSliderValue = (noteId: string) => {
    const slider = document.querySelector(`input.slider-${noteId}`)
    if (!slider) {
        throw new Error('slider not found')
    }
    const newVal = Object.values( mem().notesByBar).flat().find((note) => note.tags.includes(`noteId=${noteId}`))?.tagsObj.barDelay[0]
    if (typeof newVal !== 'number') {
        throw new Error('newVal is not a number')
    }
    (slider as HTMLInputElement).value = newVal.toString()
}

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
    slider.setAttribute('class', `slider-${noteId} note-slider`)
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
        updateBarDelay(noteData, parseInt(slider.value), false)
    }
    controls1.appendChild(slider)
}
let updateBarDelayTimeout: null | ReturnType<typeof setTimeout> = null
// on the data object, replace the barDelay index by array index value
// also call the mapSongToMidiTicks function to update the midi map, but 
// use native JS setTimeout to debounce to 100ms
export function updateBarDelay (noteData: NoteByBar, newBarDelay: number, skipSliderSync: boolean = true) {
    const index = noteData.tags.findIndex((tag) => tag.startsWith('barDelay='))
    if (index === -1) {
        throw new Error('barDelay tag not found')
    }
    noteData.tagsObj['barDelay'] = [newBarDelay]
    if (updateBarDelayTimeout) {
        clearTimeout(updateBarDelayTimeout)
    }
    updateBarDelayTimeout = setTimeout(() => {
        setLatestMap(mapSongToMidiTicks())
        if (!skipSliderSync) {
            syncSliderValue(noteData.tagsObj.noteId[0].toString())
        }
    }, 50)
    return noteData
}
let updateTagsObjTimeout: null | ReturnType<typeof setTimeout> = null
export function updateTagsObj (id: string, tagsObj: z.infer<typeof tagsObjSchema>, skipSliderSync: boolean = true) {
    const noteData = Object.values(mem().notesByBar).flat().find((note) => note.tags.includes(`noteId=${id}`))
    if (!noteData) {
        throw new Error('note not found')
    }
    Object.keys(tagsObj).forEach((key) => {
        noteData.tagsObj[key] = tagsObj[key]
    })
    if (updateTagsObjTimeout) {
        clearTimeout(updateTagsObjTimeout)
    }
    updateTagsObjTimeout = setTimeout(() => {
        setLatestMap(mapSongToMidiTicks())
        if (!skipSliderSync) {
            syncSliderValue(noteData.tagsObj.noteId[0].toString())
        }
    }, 50)
    return noteData
}

let updateNotePitchTimeout: null | ReturnType<typeof setTimeout> = null
export function updateNotePitch (id: string, note: string, skipSliderSync: boolean = true) {
    if (!isNoteNameWithOctave(note)) {
        throw new Error('note is not a valid note name with octave')
    }
    const noteData = Object.values(mem().notesByBar).flat().find((note) => note.tags.includes(`noteId=${id}`))
    if (!noteData) {
        throw new Error('note not found')
    }
    if (updateNotePitchTimeout) {
        clearTimeout(updateNotePitchTimeout)
    }
    updateNotePitchTimeout = setTimeout(() => {
        setLatestMap(mapSongToMidiTicks())
        if (!skipSliderSync) {
            syncSliderValue(noteData.tagsObj.noteId[0].toString())
        }
    }, 50)
    noteData.note = note.replace(/,/g, '')

    return noteData
}