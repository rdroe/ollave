import { setLatestMap } from "../core/observables"
import { mapSongToMidiTicks } from "./mapSongToTicks"
import { mem } from "../core/mem"
import { NoteByBar } from "./schemas"

export const deleteNoteById = (noteId: string, skipSliderRemove: boolean = true) => {
    Object.entries(mem().notesByBar).forEach(([barName, notes]: [string, NoteByBar[]]) => {
        const index = notes.findIndex((note) => note.tagsObj.noteId[0] === noteId)
        if (index !== -1) {
            notes.splice(index, 1)
        }
    })
    setLatestMap(mapSongToMidiTicks())
    if (!skipSliderRemove) {
        const slider = document.querySelector(`.slider-${noteId}`)
        if (slider) {
            slider.remove()
        }
    }
}