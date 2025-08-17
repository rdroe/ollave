import { Module } from "peprn/util"
import { isNoteName, isStringArray } from "../bars/utils"
import { peprnIsNum } from "src/lib/helpers"
import { phaseCount, phaseExists } from "src/lib/mem-db"
import { parseNoteTags } from "src/lib/tags"
import { addNoteToBar } from "src/lib/addNote"

export default {
    help: {
        description: "",
        examples: {
            "c3 --barName aphrodite:0 --tags x=1 y=2 z=3,4": `Add a c3 note at 0 with these tags`
        },
    },

    fn: async ({ positionalNonCommands, barName = 'default:1', updatePhaseScale, tags }) => { 
        const [note] = positionalNonCommands
        if (!isNoteName(note)) {
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
            phaseCount(phaseName, parseInt(barIndex) + 1)
        }
        if (!Array.isArray(tags) || !isStringArray(tags)) {
            throw new Error('Tags must be a string array')
        }
        const parsedNoteTags = parseNoteTags(tags)
        addNoteToBar(note, barName, parsedNoteTags)

        return {
            positionalNonCommands,
            barIndex,
            barName,
            parsedNoteTags,
        }
    },

} as Module