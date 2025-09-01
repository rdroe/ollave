import { isStringArray } from "../../lib/util/barsUtil"
import { Module } from "peprn/util"
import { isChordCsvArg } from "../../lib/util/barsUtil"
import { peprnIsNum } from "../../lib/helpers"
import { phaseCount, phaseExists } from "../../lib/util/phaseUtil"
import { addChord, DEFAULT_ARP } from "../../lib/addChord"
import { z } from "zod"
export default {
    help: {
        description: "Add a chord to a phase and bar",
        examples: {
            "Cm,3 --arp 0th half,eigth half,quarter --barName aphrodite:0 --tags x=1 y=2 z=3,4": `Add a Cm chord at 0 arpeggiated so that the first note is played at 0, the second at 1/2, the third at a halfplus an eigth, and with the added tags`
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
    fn: async ({positionalNonCommands, arp = DEFAULT_ARP, barName = 'default:1', tags = [], scaleTonic, scaleName, addSlider = false }) => {
        const [chordName] = positionalNonCommands
        if (typeof chordName !== 'string' || !isChordCsvArg(chordName)) {
            throw new Error('Chord must be a valid chord name with comma-separated octave')
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
        if (!Array.isArray(arp) || !isStringArray(arp)) {
            throw new Error('Arp must be a string array')
        }
        if (!['string', 'undefined'].includes(typeof scaleTonic) || !['string', 'undefined'].includes(typeof scaleName)) {
            throw new Error('Scale tonic and scale name must be strings')
        }

        const retVar = addChord(chordName, phaseName, parseInt(barIndex), arp, tags, z.string().or(z.undefined()).parse(scaleTonic), z.string().or(z.undefined()).parse(scaleName), z.boolean().or(z.undefined()).parse(addSlider) ?? false)

        return retVar
    },

} as Module