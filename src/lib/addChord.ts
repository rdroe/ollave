import { isChordCsvArg, parseChordCsvArg } from "../commands/bars/utils"
import { mem, NoteByBar } from "../lib/mem"
import { phaseCount } from "../lib/mem-db"
import { isScaleNameWithTonic, phaseScale, randId } from "./helpers"
import { abbrev, isAbbreviation, tickCounts } from "../commands/phase/observables/masterTicksObservable"
import { calcFractionalDelay, parseNoteTags } from "./tags"
import { addNoteToBar } from "./addNote"
import { addSlider } from "./addSlider"

export function addChord(chordCsvArg: string, phaseName: string, barIndex: number, arp: string[], tags: string[], userScaleTonic?: string, userScaleName?: string, doAddSlider: boolean = false): {
    noteIds: string[],
    barName: string,
    commonTags: string[],
    notes: NoteByBar[],
}  {
    if (!isChordCsvArg(chordCsvArg)) {
        throw new Error('Chord must be a valid chord name with comma-separated octave')
    }
    const barTag = `${phaseName}:${barIndex}`
    const [chordName, octave] = chordCsvArg.split(',')
    if (!chordName || !octave) {
        throw new Error('Chord must be a valid chord name with comma-separated octave')
    }
    if (!mem().notesByBar[barTag]) {
        phaseCount(phaseName, barIndex + 1)
    }
    const noteIds: string[] = []

    const groupId = randId('', 3)
    const groupIdTag = `groupId=${groupId}`

    mem().notesByBar[barTag] = mem().notesByBar[barTag] || []

    const newGroupName = randId("", 3)
    const layerTag = `layer=${newGroupName}`
    const phaseTags: string[] = []

    if (userScaleTonic && userScaleName) {
        if (!isScaleNameWithTonic(`${userScaleTonic} ${userScaleName}`)) {
            throw new Error(`Scale ${userScaleTonic} ${userScaleName} not found`)
        }
        phaseScale(phaseName, userScaleName, userScaleTonic)
    }
    
    const currentScale = phaseScale(phaseName)

    if (currentScale.scaleName) {
        phaseTags.push(`scaleName=${currentScale.scaleName}`)
    }

    if (currentScale.scaleTonic) {
        phaseTags.push(`scaleTonic=${currentScale.scaleTonic}`)
    }

    let commonTags = [layerTag].concat(phaseTags).concat(tags).concat([groupIdTag, barTag])

    if (!isChordCsvArg(chordCsvArg)) {
        throw new Error(`Error; ${chordCsvArg} is not a valid chord`)
    }

    const [notes, chordTags] = parseChordCsvArg(chordCsvArg, currentScale.scaleTonic && currentScale.scaleName ? `${currentScale.scaleTonic} ${currentScale.scaleName}` : undefined)
    const allNotes: NoteByBar[] = []
    commonTags = commonTags.concat(chordTags)
    if (notes.length === 0) {
        throw new Error(`Error; ${chordCsvArg} could not be parsed to anything with notes`)
    }

    notes.forEach(async(note, idx) => {
        const delayTagsObj = arp[idx].split(',').reduce((acc, delay) => {
            if (isAbbreviation(delay)) {
                const x = delay
                acc[abbrev[delay]] = acc[abbrev[delay]] ? acc[abbrev[delay]] + 1 : 1
                return acc
            } 
            console.warn(`Error; ${delay} is not a valid fraction`)
            return acc
        }, {} as {
            [key in keyof typeof tickCounts]: number
        })
        // convert to e.g. quarter=1, half=2, etc
        const delayTagStrings: string[] = Object.entries(delayTagsObj).map(([key, value]) => {
            return `${key}=${value}`
        })
        
        const totalDelay = calcFractionalDelay(parseNoteTags(delayTagStrings))

        // const delayTags = Object.entries(delayTagsObj).map(([key, value]) => `${key}=${value}`)
        const noteId = randId('', 3)
        noteIds.push(noteId)
        const noteIdTag = `noteId=${noteId}`
        const allTags = [...commonTags /*, ...delayTags */, noteIdTag , `barDelay=${totalDelay}`]
        const noteObj = await addNoteToBar(note, barTag, parseNoteTags(allTags)) 
        allNotes.push(noteObj)
        if (doAddSlider) {
            addSlider(barTag, noteId)
        }
    })
    
    return {
        noteIds,
        barName: barTag,
        commonTags,
        notes: allNotes,
    }
}
