import { Module, awaitAll } from 'peprn/util'
import { isString, peprnIsNum, randId } from 'src/lib/helpers'
import { SubcommandPatterns, runSubcommandsOrNull } from 'src/lib/subcommands'
import { getAllPhaseBars } from 'src/mem-db'
import { mem } from '../../mem'
import { Chord, Note } from 'tonal'
import { mapSongToMidiTicks } from 'src/mapSongToTicks'

const { notesByBar } = mem()
const isRestArg = (arg: any): arg is string => {
    return isString(arg)
        && (
            arg === 'rest'
            || arg === '[]'
            || arg === '~'
            || arg === '_'
        )
}
const isNoteName = (nm: any): nm is string => {
    return isString(nm) && nm.toLocaleLowerCase() === nm && peprnIsNum(nm[nm.length - 1]) && !!Note.get(nm)?.pc
}

const isNoteNameArray = (arr: any[]): arr is string[] => {
    return arr.every((arg) => isNoteName(arg) || isRestArg(arg))
}

const isNoteArray = (arr: any[]): arr is string[] => {
    return arr.every((arg) => isNoteCsvArg || isRestArg(arg))
}

const isChordArray = (arr: any[]): arr is string[] => {
    return arr.every((arg) => isChordCsvArg(arg) || isRestArg(arg))
}

const isCsvArg = (str: string): str is string => {
    return str.includes(',')
}

const parseCsvArg = (str: string): string[] => {
    if (!isCsvArg(str)) return [str]
    return str.split(',')
}

const parseChordCsvArg = (str: string): string[] => {
    if (!isCsvArg(str)) throw new Error(`${str} is not a chord csv arg`)
    const csv = parseCsvArg(str)
    if (!isChordName(csv[0])) throw new Error(`${str} is not a chord csv arg`)
    if (!peprnIsNum(csv[1])) throw new Error(`${str} is not a chord csv arg; second part is not an octave (number)`)
    const notes = Chord.get(csv[0])?.notes
    if (!notes) throw new Error(`${str} is not a chord csv arg; could not get notes`)

    // this is wrong. will give the correct root, but not necessarily correct other notes.
    return notes.map((note) => {
        return `${note}${csv[1]}`
    })
}

const isChordCsvArg = (str: string): str is string => {

    if (!isCsvArg(str)) return false

    const csv = parseCsvArg(str)

    if (!isChordName(csv[0])) return false

    if (!peprnIsNum(csv[1])) return false

    return true
}

const isNoteCsvArg = (str: string): str is string => {

    if (!isCsvArg(str)) return false

    const csv = parseCsvArg(str)

    if (!isNoteNameArray(csv)) return false
    return true
}

const parseNoteCsvArg = (str: string): ReturnType<typeof Note["get"]>[] => {
    if (!isNoteCsvArg(str)) throw new Error(`${str} is not a note csv arg`)
    const csv = parseCsvArg(str)
    return csv.map((note) => {
        return Note.get(note)
    })
}

const isChordName = (nm: any) => {
    return isString(nm) && !isNoteName(nm) && !!Chord.get(nm)?.name
}

const subcommands: SubcommandPatterns = {
    fill: {
        match: (args) => {
            if (args.positionalNonCommands.length < 2) return false
            if (typeof args.positionalNonCommands[1] === "string" && ['fill', 'f'].includes(args.positionalNonCommands[1])) return true
        },
        do: async ({ positionalNonCommands }) => {
            const [phaseName, _, ...rawObjects] = positionalNonCommands
            if (typeof phaseName !== 'string') return 'PHASE NAME IS REQUIRED'
            const phase = mem().phases[phaseName]
            const { scaleTonic, scaleName } = phase
            const bars = getAllPhaseBars(phaseName)
            if (bars.length === 0) throw new Error(`Phase ${phaseName} has no bars`)

            const newGroupName = randId("", 3)
            const phaseTags: string[] = []

            if (scaleTonic) {
                phaseTags.push(`scaleTonic=${scaleTonic}`)
            }

            if (scaleName) {
                phaseTags.push(`scaleName=${scaleName}`)
            }
            const layerTag = `layer=${newGroupName}`
            rawObjects.forEach((str: string, objIdx: number) => {
                const barTag = bars[objIdx % bars.length]
                const receptacle = notesByBar[barTag]

                if (isChordCsvArg(str)) {

                    const parsed = parseChordCsvArg(str)
                    const chord = str.split(',')[0]
                    receptacle.push(
                        ...parsed.map((noteName) => {
                            const noteProperties = Note.get(noteName)
                            const { oct, letter, acc } = noteProperties
                            return {
                                barTag,
                                note: `${letter}${acc}${oct}`,
                                tags: [layerTag, ...phaseTags, `chord:${chord}`]
                            }
                        }))
                } else if (isRestArg(str)) {

                } else if (isNoteCsvArg(str)) {
                    console.log('is note csv arg', str)
                    const parsed = parseNoteCsvArg(str)
                    receptacle.push(
                        ...parsed.map((noteName) => {
                            const noteProperties = Note.get(noteName)
                            const { oct, letter, acc } = noteProperties
                            return {
                                barTag,
                                note: `${letter}${acc}${oct}`,
                                tags: [layerTag, ...phaseTags]
                            }
                        }))
                } else if (isNoteName(str)) {
                    receptacle.push(
                        ...[str].map((noteName) => {
                            const noteProperties = Note.get(noteName)
                            const { oct, letter, acc } = noteProperties
                            return {
                                barTag,
                                note: `${letter}${acc}${oct}`,
                                tags: [layerTag, ...phaseTags]
                            }
                        }))
                }
            })
        }
    },
}

export default {
    fn: async (args, subCalls) => {

        const sc = await runSubcommandsOrNull(subcommands, args)

        awaitAll({
            ...subCalls,
            sc
        }).then(() => {
            mem().latestMap = mapSongToMidiTicks()
        })

    },

} as Module
