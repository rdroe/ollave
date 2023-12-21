import { Module, ParsedCli } from 'peprn/util'
import {
    Abbreviation,
    abbrev,
    isAbbreviation,
    isFraction,
    tickCounts
} from '../phase/observables/masterTicksObservable'
import { isCsvArg, parseCsvArg } from '../bars/utils'
import { NoteByBar, mem } from '../../mem'
import { z } from 'zod'
import { getAllPhaseBarNotes } from 'src/mem-db'
import { parseNoteTags } from 'src/lib/tags'

const isNoteCnt = (str: string | number) => {
    if (typeof str === 'number') return false
    return !!str.match(/[0-9]+x/)
}
const noteByBarSchema = z.object({
    note: z.string(),
    tags: z.array(z.string())
})

const notesByBarSchema = z.array(noteByBarSchema
)
export const isNotesByBar = (obj: unknown): obj is NoteByBar[] => {

    return notesByBarSchema.safeParse(obj).success
}

export const shiftDollarEntity = (dollar: ParsedCli["positionalNonCommands"]) => {

    const err = '"bar" or "phase" or "tag" is required'
    const phaseOrBarOrTag = z.union(
        [
            z.literal('bar',),
            z.literal('phase'),
            z.literal('tag')
        ], {

        required_error: err,
        invalid_type_error: err

    }).parse(dollar.shift())

    return phaseOrBarOrTag
}

export const getNotesByEntity = (
    dollar: ParsedCli["positionalNonCommands"],
    positionalNonCommands: ParsedCli["positionalNonCommands"]
) => {

    const phaseOrBar = shiftDollarEntity(dollar)
    const entityName = z.string().parse(
        dollar.shift()
    )

    if (phaseOrBar === 'bar') {
        return mem().notesByBar[entityName]
    } else if (phaseOrBar === 'phase') {
        if (typeof entityName === 'number') {
            throw new Error(`Found numeric phase argument ${entityName}`)
        }
        const notes = getAllPhaseBarNotes(entityName).flat()

        return notes
    } else if (phaseOrBar === 'tag') {
        const all = Object.values(mem().notesByBar).flat().filter((n) => {
            const parsed = parseNoteTags(n.tags)
            return parsed.find(([tagName, data]) => {
                console.log('matchy', { tagName, data, positionalNonCommands })
                const tagNameMatch = tagName === entityName
                if (!tagNameMatch) return false
                if (positionalNonCommands === undefined || positionalNonCommands.length === 0) return true

                const missingData = positionalNonCommands.find((m) => !data.includes(m))

                return missingData == undefined

            })
        })
        return all
    }
}


const tuplize = (array: (string | number)[]) => {
    const allExceptPossiblyLast = array.reduce(function(r, a, i) {
        if (i % 2) {
            r[r.length - 1].push(a);
        } else {
            r.push([a]);
        }

        return r;
    }, []);

    if (allExceptPossiblyLast[allExceptPossiblyLast.length - 1].length === 1) {
        // when it ends in a number
        allExceptPossiblyLast[allExceptPossiblyLast.length - 1].push(null)
    }

    return allExceptPossiblyLast
}
export const isAbbreviationCsv = (csvOrSingleFract: any) => {
    if (typeof csvOrSingleFract !== 'string') {
        return false
    }
    if (isCsvArg(csvOrSingleFract)) {
        return parseCsvArg(csvOrSingleFract).find((x) => !isAbbreviation(x)) === undefined
    } else if (isAbbreviation(csvOrSingleFract)) {
        return true
    }
    return false
}
export const parseAbbreviationCsv = (csvOrSingleFract: string) => {
    console.log('csvOrSingle', csvOrSingleFract)
    let parsedCsvArg: Abbreviation[] | undefined
    if (csvOrSingleFract === null) {
        parsedCsvArg = []
    } else if (isCsvArg(csvOrSingleFract)) {
        const parsed = parseCsvArg(csvOrSingleFract)
        const filtered: Abbreviation[] = parsed.filter((elem) => isAbbreviation(elem)) as Abbreviation[]

        if (parsed.length !== filtered.length) {
            throw new Error(`Found a non-abbreviation where all elements should have `)
        }
        parsedCsvArg = filtered
    } else if (isAbbreviation(csvOrSingleFract)) {
        parsedCsvArg = [csvOrSingleFract]
    } else {
        throw new Error(`Should be a csv arg of fractions or single fraction: ${csvOrSingleFract}`)
    }
    console.log('returning', parsedCsvArg)
    return parsedCsvArg
}

export const sumAbbreviationCsv = (csv: string) => {
    const arr = parseAbbreviationCsv(csv)
    return arr.reduce((accum: number, elem: (typeof arr)[number]) => {
        if (!isAbbreviation(elem)) {
            throw new Error(`Non-abbreviation found error`)
        }
        const fract = abbrev[elem]
        return accum + tickCounts[fract]
    }, 0)
}

export const parseDelayMatrixRow = (pattern: (string | number)[]): {
    [idx: number]: keyof typeof tickCounts
} => {

    const entries: [noteIdx: number, fractions: string[]][] = []

    if (pattern.find(elem => typeof elem === 'string' && isCsvArg(elem))) {

        const tuples: [x: number, str: string][] = tuplize(pattern)

        const entries = tuples.map(([noteNth, csvOrSingleFract]: [noteNth: number, csv: string | null]) => {
            const parsedCsvArg = parseAbbreviationCsv(csvOrSingleFract)
            const tagized = parsedCsvArg.map((elem) => {
                if (isAbbreviation(elem)) {
                    const fullName = abbrev[elem]
                    return `${fullName}=1`
                }
                throw new Error(`Should have been a faction abbreviation: ${elem}`)
            })

            return [noteNth, tagized]
        })

        return Object.fromEntries(entries)
    }

    pattern.forEach((elem) => {
        if (typeof elem === 'number') {
            entries.push([elem, []])
        }
    })

    pattern.forEach((noteIdxOrFraction: string | number, idx) => {

        if (typeof noteIdxOrFraction === 'string') {
            if (isAbbreviation(noteIdxOrFraction)) {
                entries.forEach(([noteNth, arr]) => {
                    if (pattern.indexOf(noteNth) > idx) {
                        arr.push(`${abbrev[noteIdxOrFraction]}=1`)
                    }
                })
                return
            }
            throw new Error(`${noteIdxOrFraction} could not be parsed as a fraction`)
        }
    })


    const validEntries = z.array(
        z.tuple([
            z.number(),
            z.array(z.string().refine((elem) => {
                return isFraction(elem.split('=')[0])
            }, 'a fraction is required (entry being returned as matrix'
            ))
        ] //close tuple def
        ) // close tuple call 
    ).parse(entries)


    return Object.fromEntries(validEntries) as {
        [idx: number]: keyof typeof tickCounts
    }
}

export const prepDelayMatrix = (positionalNonCommands: ParsedCli['positionalNonCommands']): [noteIdx: string, row: (string | number)[]][] => {

    const countArrs = positionalNonCommands.reduce(
        (accum: number[], curr: string | number, idx: number) => {
            if (typeof curr === 'string' && isNoteCnt(curr)) {
                return [...accum, idx]
            }
            return accum
        }, [] as (string | number)[])

    const entries = countArrs.map((noteIdx: number, idx: number) => {
        const next = countArrs[idx + 1]
        if (next === undefined) {
            const retvar = positionalNonCommands.slice(noteIdx + 1)
            return [
                positionalNonCommands[noteIdx],
                retvar
            ]
        }
        if (typeof next !== 'number') {
            throw new Error(`next should be a number`)
        }
        const retvar = positionalNonCommands.slice(noteIdx + 1, next)
        return [
            positionalNonCommands[noteIdx],
            retvar
        ]
    })

    return entries as [noteIdx: string, data: (string | number)[]][]
}

export const parseDelayMatrix = (entries: [chordSize: string, row: (string | number)[]][]) => {
    return Object.fromEntries(
        entries.map(([cs, r]) => {
            const parsedRow = parseDelayMatrixRow(r)
            return [
                cs,
                parsedRow
            ]
        })
    )
}

export default {
    fn: async () => { },
    submodules: {
        arrange: {
            fn: async ({ positionalNonCommands: patterns, noteCount }) => {
                /*
                if (!isNoteCnt(noteCount)) {
                    throw new Error(`
Could not get a note count
`)
                }
                const prepped = prepDelayMatrix(patterns as ParsedCli['positionalNonCommands'])
                const delaysPerChordSize = parseDelayMatrix(prepped)
                const noteLookup = delaysPerChordSize[noteCount]

                notes.forEach((nt) => {
                    filterDelayTags(nt, true)
                    const parsed = Object.fromEntries(parseNoteTags(nt.tags))
                    const [chordIdx] = parsed['chordIndex']
                    if (typeof chordIdx !== 'number') {
                        const msg = strjson(nt)
                        throw new Error(`Note lacked a chord index: ${msg}`)
                    }
                    const newTags = noteLookup[chordIdx]
                    nt.tags.push(...newTags)
                })

                mem().latestMap = mapSongToMidiTicks()

                return notes
                */
            }

        },
        'in': {
            fn: async () => { },
            submodules: {
                // bar or phase 
                '$': {
                    fn: async () => { },
                    submodules: {
                        '$': {
                            fn: async ({ $: dollar, positionalNonCommands }) => {
                                return getNotesByEntity(
                                    dollar,
                                    positionalNonCommands
                                )
                            }
                        }
                    }
                }
            }
        }
    }
} as Module
