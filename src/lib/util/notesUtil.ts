import { ParsedCli } from 'peprn/util'
import {
    Abbreviation,
    abbrev,
    isAbbreviation,
    isFraction,
    tickCounts
} from '../../core/observables/masterTicksObservable'
import { isCsvArg, parseCsvArg } from './barsUtil'
import {  noteByBarSchema } from '../schemas'
import { mem } from '../mem'
import { z } from 'zod'
import { getAllPhaseBarNotes } from './phaseUtil'
import {  parseNoteTags } from '../tags'
import { strjson } from '../helpers'
import { zeroIndexedArr } from '../graphh'

const isNoteCnt = (str: string | number) => {
    if (typeof str === 'number') return false
    return !!str.match(/[0-9]+x/)
}

export const notesByBarArraySchema = z.array(noteByBarSchema)

export const shiftDollarEntity = (dollar: ParsedCli["positionalNonCommands"]) => {
    const err = '"bar" or "phase" or "tag" is required'
    const phaseOrBarOrTag = z.union(
        [
            z.literal('bar',),
            z.literal('phase'),
            z.literal('tag')
        ], {
            error: err
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


export const tuplize = (array: (string | number)[]) => {
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
    let parsedCsvArg: Abbreviation[] | undefined
    if (csvOrSingleFract === null) {
        parsedCsvArg = []
    } else if (isCsvArg(csvOrSingleFract)) {
        const parsed = parseCsvArg(csvOrSingleFract).filter((elem) => {
            // clean up for empty caused by e.g, "16th," (trailing comma)
            if (typeof elem === 'string') return elem.length > 0
            return true
        })
        const filtered: Abbreviation[] = parsed.filter((elem) => isAbbreviation(elem)) as Abbreviation[]

        if (parsed.length !== filtered.length) {
            throw new Error(`Found a non-abbreviation where all elements should have ${strjson({ parsed, filtered })}`)
        }
        parsedCsvArg = filtered
    } else if (isAbbreviation(csvOrSingleFract)) {
        parsedCsvArg = [csvOrSingleFract]
    } else {
        throw new Error(`Should be a csv arg of fractions or single fraction: ${csvOrSingleFract}`)
    }
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
    [idx: number]: (keyof typeof tickCounts)[]
} => {

    const entries: [noteIdx: number, fractions: string[]][] = []
    // non-arp
    // A row like '8th,4th half 4th,16th'
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

    // arp
    pattern.forEach((elem) => {
        if (typeof elem === 'number') {
            entries.push([elem, []])
        }
    })

    let currNum = 0
    pattern.forEach((noteIdxOrFraction: string | number) => {
        if (typeof noteIdxOrFraction === 'number') {
            currNum = noteIdxOrFraction
        }

        if (typeof noteIdxOrFraction === 'string') {
            if (isAbbreviation(noteIdxOrFraction)) {

                entries.forEach(([noteNth, arr]) => {


                    if (currNum <= noteNth) {
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


    return Object.fromEntries(validEntries)
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
const deleteSupernumeraries = (dmRow: ReturnType<typeof parseDelayMatrixRow>, cs: number) => {
    return Object.fromEntries(
        Object.entries(dmRow).filter(([key]) => {
            return parseInt(key) <= cs
        })
    )
}

export const parseDelayMatrix = (entries: [chordSize: string, row: (string | number)[]][]) => {
    return Object.fromEntries(
        entries.map(([cs, r]) => {
            const parsedRow = parseDelayMatrixRow(r)
            const chordSize = parseInt(cs)
            const idxs = zeroIndexedArr(chordSize)
            idxs.forEach((idx) => {
                parsedRow[idx] = parsedRow[idx] ?? []
            })

            return [
                cs,
                deleteSupernumeraries(parsedRow, chordSize)
            ]
        })
    )
}
