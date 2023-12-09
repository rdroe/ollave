import { Module, awaitAll } from 'peprn/util'
import { isString, peprnIsNum, randId } from 'src/lib/helpers'
import { SubcommandPatterns, runSubcommandsOrNull } from 'src/lib/subcommands'
import { getAllPhaseBars, lookUpGraph } from 'src/mem-db'
import { mem } from '../../mem'
import { Chord, Note } from 'tonal'
import { mapSongToMidiTicks } from 'src/mapSongToTicks'
import { z } from 'zod'
import { chordNameWithNotes } from 'src/lib/graphh'
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
    console.log('chord and graph', csv[0], graph)
    if (graph) {
        if (graph[csv[0]]) {
            if (graph[csv[0]].translatedSource.notes) {
                const graphChordData = graph[csv[0]]
                notes = graphChordData.translatedSource.notes
                tags.push(`roman=${graphChordData.roman}`)
                console.log('graph chord data etc', graphChordData, notes, hasOctaveFilter(notes))
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

const isChordCsvArg = (str: string, userTonic?: string, userScale?: string): str is string => {

    if (!isCsvArg(str)) return false

    const csv = parseCsvArg(str)

    if (!isChordName(csv[0], userTonic, userScale)) return false

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

const isChordName = (nm: any, scaleTonic?: string, scaleName?: string) => {
    console.log('isChordName; nm', nm)
    const initial = isString(nm) && !isNoteName(nm) && !!Chord.get(nm)?.name
    if (initial) return initial
    if (!scaleTonic || !scaleName) {
        console.log('isChordName 2')
        return initial
    }
    console.log('isChordName 3')
    const graph = lookUpGraph(scaleTonic, scaleName)

    if (!graph) return initial
    console.log('isChordName 4; nm and graph', { nm, graph })
    return graph[nm] || initial

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
                console.log('isChordCsv???', str, scaleTonic, scaleName, isChordCsvArg(str, scaleTonic, scaleName))
                const round = Math.trunc(objIdx / bars.length)
                const barTag = bars[objIdx % bars.length]
                const receptacle = notesByBar[barTag]
                const timingTags: string[] = []
                if (round > 0) {
                    timingTags.push(`8ths=${round}`)
                }

                if (isChordCsvArg(str, scaleTonic, scaleName)) {

                    const [notes, tags] = parseChordCsvArg(str, `${scaleTonic} ${scaleName}`)
                    const chord = str.split(',')[0]

                    receptacle.push(
                        ...notes.map((noteName) => {
                            const noteProperties = Note.get(noteName)
                            const { oct, letter, acc } = noteProperties

                            return {
                                barTag,
                                note: `${letter}${acc}${oct}`,
                                tags: [...timingTags, layerTag, ...phaseTags, `chord=${chord}`, ...tags, `noteLetter=${letter}`, `noteAcc=${acc}`, `noteOct=${oct}`, `bar=${barTag}`]
                            }
                        }))
                } else if (isRestArg(str)) {
                    // doing nothing will leave an empty space.
                    // todo: it's here without any tags or timing.
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
                                tags: [...timingTags, layerTag, ...phaseTags, `noteLetter=${letter}`, `noteAcc=${acc}`, `noteOct=${oct}`, `bar=${barTag}`]
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
                                tags: [...timingTags, layerTag, ...phaseTags, `noteLetter=${letter}`, `noteAcc=${acc}`, `noteOct=${oct}`]
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
            console.log('latestMap', mem().latestMap)

        })

    },

} as Module
