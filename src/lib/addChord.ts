import { isChordCsvArg, parseChordCsvArg } from "../commands/bars/utils"
import { mem, NoteByBar } from "../lib/mem"
import { phaseCount } from "../lib/mem-db"
import { randId } from "./helpers"
import { abbrev, isAbbreviation, tickCounts } from "../commands/phase/observables/masterTicksObservable"
import { calcFractionalDelay, parseNoteTags } from "./tags"
import { addNoteToBar } from "./addNote"
import { addSlider } from "./addSlider"

export function addChord(chordCsvArg: string, phaseName: string, barIndex: number, arp: string[], tags: string[], scaleTonic?: string, scaleName?: string)  {
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
    [chordCsvArg].forEach((str: string, objIdx: number) => {

        const groupId = randId('', 3)
        const groupIdTag = `groupId=${groupId}`

        mem().notesByBar[barTag] = mem().notesByBar[barTag] || []

        const newGroupName = randId("", 3)
        const layerTag = `layer=${newGroupName}`
        const phaseTags: string[] = []

        if (scaleTonic) {
            phaseTags.push(`scaleTonic=${scaleTonic}`)
        }

        if (scaleName) {
            phaseTags.push(`scaleName=${scaleName}`)
        }

        const commonTags = [layerTag].concat(phaseTags)

        if (isChordCsvArg(str)) {

            const [notes, chordTags] = parseChordCsvArg(str, scaleTonic && scaleName ? `${scaleTonic} ${scaleName}` : undefined)
            if (notes.length === 0) {
                throw new Error(`Error; ${str} could not be parsed to anything with notes`)
            }
            notes.forEach(async(note, idx) => {
                console.log('note', {
                    note,
                    arpData: arp[idx], 

                })
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

                const delayTags = Object.entries(delayTagsObj).map(([key, value]) => `${key}=${value}`)
                const noteId = randId('', 3)
                const noteIdTag = `noteId=${noteId}`
                console.log("tags", [...commonTags, ...delayTags, ...chordTags, noteIdTag , groupIdTag, `barDelay=${totalDelay}`])
                await addNoteToBar(note, barTag, parseNoteTags([...commonTags /*, ...delayTags */, ...chordTags, noteIdTag , groupIdTag, `barDelay=${totalDelay}`])) 
                addSlider(barTag, noteId)
            })

        } else throw new Error('Chord must be a valid chord name with comma-separated octave')
    })
}
