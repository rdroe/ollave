import { Module } from 'peprn/util'
import { abbrev, isAbbreviation, isFraction } from '../phase/observables/masterTicksObservable'
import { isCsvArg, parseCsvArg } from '../bars/utils'
import { NoteByBar, mem } from '../../mem'
import { z, ParseParams } from 'zod'
import { getAllPhaseBarNotes } from 'src/mem-db'
import { parseNoteTags } from 'src/lib/tags'
const isNoteCnt = (str: string | number) => {
    if (typeof str === 'number') return false
    return !!str.match(/[0-9]+x/)
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

const sortDelays = (pattern: (string | number)[]) => {

    const entries: [noteIdx: number, fractions: string[]][] = []
    if (pattern.find(elem => typeof elem === 'string' && isCsvArg(elem))) {
        const tuples: [x: number, str: string][] = tuplize(pattern)
        const entries = tuples.map(([noteNth, csv]: [noteNth: number, csv: string]) => {
            if (!isCsvArg(csv)) {
                throw new Error(`Should be a csv arg: ${csv}`)
            }
            const parsedCsv = parseCsvArg(csv).map((elem) => {
                if (isAbbreviation(elem)) {
                    const fullName = abbrev[elem]
                    return `${fullName}=1`
                }
                throw new Error(`Should have been a faction abbreviation: ${elem}`)
            })

            return [noteNth, parsedCsv]
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
    return Object.fromEntries(entries)
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
                return Object.fromEntries(
                    entries.map(([cs, r]: [chordSize: string, row: (string | number)[]]) => {
                        return [
                            cs,
                            sortDelays(r)
                        ]
                    })
                )

            }
        },
        from: {
            fn: async () => { },
            submodules: {
                // bar or phase 
                '$': {
                    fn: async ({ $: dollar, positionalNonCommands }) => {

                        const err = '"bar" or "phase" is required'
                        const phaseOrBar = z.union(
                            [z.literal('bar',),
                            z.literal('phase'),
                            z.literal('tag')
                            ], {
                            required_error: err,
                            invalid_type_error: err
                        }
                        ).parse(dollar[0])
                        if (phaseOrBar === 'bar') {
                            const [barName] = positionalNonCommands
                            return mem().notesByBar[barName]
                        } else if (phaseOrBar === 'phase') {
                            const [phaseName] = positionalNonCommands
                            return getAllPhaseBarNotes(phaseName).flat()
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
                },

            }
        }
    }
} as Module
