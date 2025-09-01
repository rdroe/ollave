import { Module } from "peprn/util"
import { isNoteNameWithOctave, isStringArray } from "../bars/utils"
import { isScaleNameWithTonic, peprnIsNum, phaseScale } from "../../lib/helpers"
import { phaseCount, phaseExists } from "../../lib/mem-db"
import { parseNoteTags } from "../../lib/tags"
import { addNoteToBar } from "../../lib/addNote"
import { z } from "zod"
import { mapSongToMidiTicks } from "../../lib"
import { setLatestMap } from "../../core/observables"

export default {
    help: {
        description: "",
        examples: {
            "c3 --barName aphrodite:0 --tags x=1 y=2 z=3,4": `Add a c3 note at 0 with these tags`
        },
    },
    yargs: {
        tags: {
            type: 'string',
            alias: 't',
            default: [],
            array: true, 
        },
    },
    fn: async ({ positionalNonCommands, barName = 'default:1', updatePhaseScale, tags, doAddSlider = false }) => { 
        const [note] = positionalNonCommands
        if (!isNoteNameWithOctave(note)) {
            throw new Error('Note must be a valid note name')
        }
        if (typeof barName !== 'string') {
            throw new Error('Bar name must be a string')
        }
        const [phaseName, barIndex] = barName.split(':')
        if (!phaseName || !barIndex || !peprnIsNum(barIndex)) {
            throw new Error('Phase should match phaseName:barIndex; instead got ' + barName)
        }
        if (!phaseExists(phaseName)) {
            phaseCount(phaseName, parseInt(barIndex) + 1, true)
        }
        if (!Array.isArray(tags) || !isStringArray(tags)) {
            throw new Error('Tags must be a string array')
        }
        const phaseScaleArrOrUndefined = z.string().or(z.undefined()).transform((str) => {
            if (!str) {
                return undefined
            }
            const [scaleTonic, scaleName] = str.split(' ')
            if (!isScaleNameWithTonic(str)) {

                throw new Error(`Scale ${str} not found`)
            }
            return [scaleTonic, scaleName]
        }).parse(updatePhaseScale)

        if (phaseScaleArrOrUndefined) {
            const [scaleTonic, scaleName] = phaseScaleArrOrUndefined
            phaseScale(phaseName, scaleName, scaleTonic)
        }
        
        const parsedNoteTags = parseNoteTags(tags)
        const noteObj = await addNoteToBar(note, barName, parsedNoteTags, z.boolean().parse(doAddSlider))
        setLatestMap(
            mapSongToMidiTicks()
        )
        return noteObj
    },

} as Module