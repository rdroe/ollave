import { Module, awaitAll } from 'peprn/util'
import { isString, peprnIsNum, randId } from 'src/lib/helpers'
import { SubcommandPatterns, runSubcommandsOrNull } from 'src/lib/subcommands'
import { getAllPhaseBars, lookUpGraph } from 'src/mem-db'
import { NoteByBar, mem } from '../../mem'
import { Chord, Note } from 'tonal'
import { mapSongToMidiTicks } from 'src/mapSongToTicks'

import { chordNameWithNotes } from 'src/lib/graphh'
import { makeFulfilledBarNote } from './utils'

const { notesByBar } = mem()
const isRestArg = (arg: any) => {
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

const hasOctaveFilter = (noteStrs: string[]) => {
    return noteStrs.map((str) => {
        return Note.get(str).oct ?? null
    }).filter((numOrNull) => {
        return numOrNull !== null
    })
}
const parseChordCsvArg = (str: string, userScaleAndTonic?: string): [notes: string[], tags: string[]] => {
    if (!isCsvArg(str)) throw new Error(`${str} is not a chord csv arg`)
    const csv = parseCsvArg(str)
    if (!csv[0] || csv[0].length < 1) throw new Error(`${csv} is not a non-empty string`)
    if (!peprnIsNum(csv[1])) throw new Error(`${str} is not a chord csv arg; second part is not an octave (number)`)
    // const 
    //   if (!notes) throw new Error(`${str} is not a chord csv arg; could not get notes`)

    const [userTonic, userScale] = userScaleAndTonic.split(' ')
    const graph = lookUpGraph(userTonic, userScale)
    const cnwn = chordNameWithNotes(csv[0], parseInt(csv[1]))
    let notes: string[] | undefined
    const tags: string[] = []

    if (graph) {
        if (graph[csv[0]]) {
            if (graph[csv[0]].translatedSource.notes) {
                const graphChordData = graph[csv[0]]
                notes = graphChordData.translatedSource.notes
                tags.push(`roman=${graphChordData.roman}`)

                if (graphChordData.translatedSource.octMap && hasOctaveFilter(notes).length === 0) {
                    return [graphChordData.translatedSource.octMap(notes, parseInt(csv[1])), tags]
                }
                return [notes, tags]
            }
        }
    }

    if (!notes) {
        notes = cnwn.notes
        return [notes, tags]
    }
    return [[], []]

}

const isChordCsvArg = (str: string, userTonic?: string, userScale?: string) => {

    if (!isCsvArg(str)) return false

    const csv = parseCsvArg(str)

    if (!isChordName(csv[0], userTonic, userScale)) return false

    if (!peprnIsNum(csv[1])) return false

    return true
}

const isNoteCsvArg = (str: string) => {

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

const isChordName = (nm: any, scaleTonic?: string, scaleName?: string) => {

    const initial = isString(nm) && !isNoteName(nm) && !!Chord.get(nm)?.name
    if (initial) return initial
    if (!scaleTonic || !scaleName) {

        return initial
    }

    const graph = lookUpGraph(scaleTonic, scaleName)

    if (!graph) return initial

    return graph[nm] || initial

}

const noteTags = (noteStr: string) => {
    const { oct, acc, letter } = Note.get(noteStr)
    return [`noteLetter=${letter}`, `noteAcc=${acc}`, `noteOct=${oct}`]
}

export default {
    fn: async (args, subCalls) => {
        awaitAll({
            ...subCalls,
        }).then(() => {
            mem().latestMap = mapSongToMidiTicks()
        })
    },
    submodules: {

        '$': {
            fn: async () => undefined,
            submodules: {
                fill: {
                    fn: async ({ $: dollar, positionalNonCommands }) => {
                        const [phaseName] = dollar
                        const rawObjects = positionalNonCommands
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

                        // `noteLetter=${letter}`, `noteAcc=${acc}`, `noteOct=${oct}`,
                        const layerTag = `layer=${newGroupName}`
                        const commonTags = [layerTag].concat(phaseTags)
                        rawObjects.forEach((str: string, objIdx: number) => {

                            const round = Math.trunc(objIdx / bars.length)
                            const barTag = bars[objIdx % bars.length]
                            const receptacle: NoteByBar[] = notesByBar[barTag]
                            const timingTags: string[] = []
                            if (round > 0) {
                                timingTags.push(`8ths=${round}`)
                            }

                            if (isChordCsvArg(str, scaleTonic, scaleName)) {

                                const [notes, tags] = parseChordCsvArg(str, `${scaleTonic} ${scaleName}`)

                                const chord = str.split(',')[0]
                                if (notes.length === 0) {
                                    throw new Error(`Error; ${str} could not be parsed to anything with notes`)
                                }
                                const fn = makeFulfilledBarNote(barTag, commonTags.concat(tags))

                                receptacle.push(...notes.map(fn))
                            } else if (isRestArg(str)) {

                                // doing nothing will leave an empty space.
                                // todo: it's here without any tags or timing.
                            } else if (isNoteCsvArg(str)) {
                                const parsed = str.split(',')
                                if (parsed.length === 0) {
                                    throw new Error(`Error; ${str} could not be parsed to anything with notes`)
                                }
                                const fn = makeFulfilledBarNote(barTag, commonTags)
                                receptacle.push(...parsed.map(fn))

                            } else if (isNoteName(str)) {
                                const fn = makeFulfilledBarNote(barTag, commonTags)
                                receptacle.push(fn(str))
                            }
                        })
                    }
                }
            }
        }
    }

} as Module
