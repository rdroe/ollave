import { Module, ParsedCli } from 'peprn/util'
import {
    ONE_TWENTY_EIGHTH,
    abbrev,
    isAbbreviation,
    isFraction,
    tickCounts
} from '../phase/observables/masterTicksObservable'
import { isCsvArg, parseCsvArg } from '../bars/utils'
import { mem } from '../../mem'
import { z } from 'zod'
import { getAllPhaseBarNotes } from 'src/mem-db'
import { parseNoteTags } from 'src/lib/tags'

const isNoteCnt = (str: string | number) => {
    if (typeof str === 'number') return false
    return !!str.match(/[0-9]+x/)
}

export const getDollarEntity = (dollar: ParsedCli["positionalNonCommands"]) => {
    const err = '"bar" or "phase" or "tag" is required'
    const phaseOrBarOrTag = z.union(
        [
            z.literal('bar',),
            z.literal('phase'),
            z.literal('tag')
        ], {

        required_error: err,
        invalid_type_error: err

    }).parse(dollar[0])
    return phaseOrBarOrTag
}

export const getNotesByEntity = (
    entityType: ReturnType<typeof getDollarEntity>,
    positionalNonCommands: ParsedCli["positionalNonCommands"]
) => {

    const phaseOrBar = entityType

    if (phaseOrBar === 'bar') {
        const [barName] = positionalNonCommands
        return mem().notesByBar[barName]
    } else if (phaseOrBar === 'phase') {
        const [phaseName] = positionalNonCommands
        if (typeof phaseName === 'number') {
            throw new Error(`Found numeric phase argument ${phaseName}`)
        }
        const notes = getAllPhaseBarNotes(phaseName).flat()

        return notes
    } else {
        const [tag, matchable] = positionalNonCommands
        const all = Object.values(mem().notesByBar).flat().filter((n) => {
            const parsed = parseNoteTags(n.tags)
            return parsed.find(([tagName, data]) => {
                return tagName === tag && (
                    matchable === undefined
                    || data.includes(matchable)
                )
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
        allExceptPossiblyLast[allExceptPossiblyLast.length - 1].push(null)
    }
    return allExceptPossiblyLast
}

export const parseDelayMatrixRow = (pattern: (string | number)[]): {
    [idx: number]: keyof typeof tickCounts
} => {

    const entries: [noteIdx: number, fractions: string[]][] = []

    if (pattern.find(elem => typeof elem === 'string' && isCsvArg(elem))) {

        const tuples: [x: number, str: string][] = tuplize(pattern)

        const entries = tuples.map(([noteNth, csvOrSingleFract]: [noteNth: number, csv: string | null]) => {

            let parsedCsvArg: ReturnType<typeof parseCsvArg> | undefined
            if (csvOrSingleFract === null) {
                parsedCsvArg = []
            } else if (isCsvArg(csvOrSingleFract)) {
                parsedCsvArg = parseCsvArg(csvOrSingleFract)
            } else if (isFraction(csvOrSingleFract)) {
                parsedCsvArg = [csvOrSingleFract]
            } else {
                throw new Error(`Should be a csv arg of fractions or single fraction: ${csvOrSingleFract}`)
            }

            const tagized = parsedCsvArg.map((elem) => {
                if (isAbbreviation(elem)) {
                    const fullName = abbrev[elem]
                    return `${fullName}=1`
                }
                throw new Error(`Should have been a faction abbreviation: ${elem}`)
            })
            return [noteNth, tagized]
        })
        console.log('returning', entries)
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
            fn: async ({ positionalNonCommands }) => {
                const entries = prepDelayMatrix(positionalNonCommands)
                console.log('entries (working "prepped")', entries)
                return parseDelayMatrix(entries)

            }
        },
        'in': {
            fn: async () => { },
            submodules: {
                // bar or phase 
                '$': {
                    fn: async ({ $: dollar, positionalNonCommands }) => {


                        const phaseOrBar = getDollarEntity(dollar)



                        return getNotesByEntity(
                            phaseOrBar,
                            positionalNonCommands
                        )

                    }
                }
            }
        }
    }
} as Module
