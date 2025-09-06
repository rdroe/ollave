import { isChordCsvArg, parseChordCsvArg } from "./util/barsUtil"
import {  NoteByBar } from "./schemas"
import { mem, Mem } from "../core/mem"

import { phaseCount } from "./util/phaseUtil"
import { phaseScale } from "./helpers"
import { isScaleNameWithTonic } from "./util/scaleUtil"
import { randId } from "./util/common"
import { abbrev, isAbbreviation, tickCounts } from "../core/observables/masterTicksObservable"
import { calcFractionalDelay, parseNoteTags } from "./util/tagsUtil"
import { addNoteToBar } from "./addNote"
import { addSlider } from "./addSlider"
import { makeCompilationSubscribe } from "../core/subjects/compilationSubject"
import { setLatestMap } from "../core/observables"
import { mapSongToMidiTicks } from "./mapSongToTicks"
export const DEFAULT_ARP = ['0th','0th','0th','0th','0th', '0th', '0th']
const DEFAULT_ARP_ZERO = DEFAULT_ARP
const DEFAULT_ARP_ONE = 'quarter'.repeat(7).split('')
const DEFAULT_ARP_TWO = 'half'.repeat(7).split('')
const DEFAULT_ARP_THREE = 'half,quarter'.repeat(7).split('')
export const DEFAULT_CHORD_PLACEMENTS = {
    0: DEFAULT_ARP_ZERO,
    1: DEFAULT_ARP_ONE,
    2: DEFAULT_ARP_TWO,
    3: DEFAULT_ARP_THREE,
}


export function addChord(
    chordCsvArg: string,
    phaseName: string,
    barIndex: number,
    arp: string[] | 0 | 1 | 2 | 3, tags: string[], userScaleTonic: string = 'A', userScaleName: string = 'minor', doAddSlider: boolean = false): {
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
        phaseCount(phaseName, barIndex + 1, true)
    }
    const noteIds: string[] = []

    const groupId = randId('', 6)
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
        const arpArg = typeof arp === 'number' ? DEFAULT_CHORD_PLACEMENTS[arp] : arp[idx]
        const delayTagsObj = (arpArg[idx] ?? DEFAULT_ARP[idx]).split(',').reduce((acc, delay) => {
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
        // convert to e.g. quarter=1, half=2, etc; only leave barDelay
        const delayTagStrings: string[] = Object.entries(delayTagsObj).map(([key, value]) => {
            return `${key}=${value}`
        })

        const totalDelay = calcFractionalDelay(parseNoteTags(delayTagStrings))

        // const delayTags = Object.entries(delayTagsObj).map(([key, value]) => `${key}=${value}`)
        const noteId = randId('', 6)
        noteIds.push(noteId)
        const noteIdTag = `noteId=${noteId}`
        const allTags = [...commonTags /*, ...delayTags */, noteIdTag , `barDelay=${totalDelay}`]

        const noteObj = await addNoteToBar(note, barTag, parseNoteTags(allTags))
        allNotes.push(noteObj)

        if (doAddSlider) {
            addSlider(barTag, noteId)
            makeCompilationSubscribe({
                selector: (memArg: Mem) => {
                    return memArg.notesByBar[barTag].reduce((acc, note) => {
                        if (typeof note.tagsObj.barDelay[0] === 'number') {
                            return acc + note.tagsObj.barDelay[0]
                        }
                        return acc
                    }, 0 as number)
                },

                compare: (a, b) => {
                    return a === b
                },
            })({
                next: (num) => {
                    return num
                },
                complete: () => {

                },
                error: (err: any) => {
                    console.error('error in addChord makeCompilationSubscribe', err)
                },
            })
        }
    })
    setLatestMap(mapSongToMidiTicks())
    return {
        noteIds,
        barName: barTag,
        commonTags,
        notes: allNotes,
    }
}
