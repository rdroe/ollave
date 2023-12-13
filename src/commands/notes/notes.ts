import { Module, ParsedCli } from 'peprn/util'
import {
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
    return array.reduce(function(r, a, i) {
        if (i % 2) {
            r[r.length - 1].push(a);
        } else {
            r.push([a]);
        }
        return r;
    }, []);
}

export const parseDelayMatrix = (pattern: (string | number)[]) => {
    const entries: [noteIdx: number, fractions: string[]][] = []
    console.log('pattern', {
        pattern
    })
    if (pattern.find(elem => typeof elem === 'string' && isCsvArg(elem))) {

        const tuples: [x: number, str: string][] = tuplize(pattern)
        const entries = tuples.map(([noteNth, csvOrSingleFract]: [noteNth: number, csv: string]) => {

            let parsedCsvArg: ReturnType<typeof parseCsvArg> | undefined
            if (isCsvArg(csvOrSingleFract)) {
                parsedCsvArg = parseCsvArg(csvOrSingleFract)
            } else if (isFraction(csvOrSingleFract)) {
                parsedCsvArg = [csvOrSingleFract]
            } else {
                throw new Error(`Should be a csv arg of fractions or single fraction: ${csvOrSingleFract}`)
            }
            console.log('parsedCsvArg', { parsedCsvArg })
            const tagized = parsedCsvArg.map((elem) => {
                if (isAbbreviation(elem)) {
                    const fullName = abbrev[elem]
                    return `${fullName}=1`
                }
                throw new Error(`Should have been a faction abbreviation: ${elem}`)
            })

            console.log('pattern return; after entries; noteNth + csvOrSingleFract', noteNth, parsedCsvArg)

            return [noteNth, tagized]
        })
        console.log('completed entries early', entries)
        return Object.fromEntries(entries)
    }
    console.log('pattern being LATE returned', pattern)
    pattern.forEach((elem) => {
        if (typeof elem === 'number') {
            entries.push([elem, []])
        }
    })

    pattern.forEach((noteIdxOrFraction: string | number, idx) => {
        console.log('noteIdxOrFraction', noteIdxOrFraction)
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

    console.log('late return', validEntries)

    return Object.fromEntries(validEntries) as {
        [idx: number]: keyof typeof tickCounts
    }
}

export default {
    fn: async () => { },
    submodules: {
        arrange: {
            fn: async ({ positionalNonCommands }) => {

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

                    const retvar = positionalNonCommands.slice(noteIdx + 1, next)
                    return [
                        positionalNonCommands[noteIdx],
                        retvar
                    ]
                })

                console.log('entries', entries)
                return Object.fromEntries(
                    entries.map(([cs, r]: [chordSize: string, row: (string | number)[]]) => {
                        console.log('cs2 in', r)
                        const parsedRow = parseDelayMatrix(r)
                        console.log('cs2 out', parsedRow)
                        console.log('')
                        return [
                            cs,
                            parsedRow
                        ]
                    })
                )

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
