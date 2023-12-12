import { Module } from 'peprn/util'
import { isAbbreviation, isFraction } from '../phase/observables/masterTicksObservable'


const isNoteCnt = (str: string | number) => {
    if (typeof str === 'number') return false
    return !!str.match(/[0-9]+x/)
}

const sortDelays = (pattern: (string | number)[]) => {

    const entries: [noteIdx: number, fractions: string[]][] = []
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
                        arr.push(noteIdxOrFraction)
                    }
                })
                return
            }
            throw new Error(`${noteIdxOrFraction} could not be parsed as a fraction`)
        }
    })
    return entries
}

export default {
    fn: async () => { },
    submodules: {
        arrange: {
            fn: async ({ positionalNonCommands }) => {

                console.log('positional', positionalNonCommands)

                const countArrs = positionalNonCommands.reduce(
                    (accum: number[], curr: string | number, idx: number) => {

                        if (typeof curr === 'string' && isNoteCnt(curr)) {
                            console.log('noteCnt', curr)
                            return [...accum, idx]
                        }
                        return accum

                    }, [] as (string | number)[])


                const entries = countArrs.map((noteIdx: number, idx: number) => {
                    const next = countArrs[idx + 1]
                    console.log('in countarrs', positionalNonCommands, noteIdx, idx, 'next', next)
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
                return sortDelays(entries[0][1].slice())
            }
        }
    }
} as Module
