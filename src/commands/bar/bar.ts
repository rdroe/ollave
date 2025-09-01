import { Module, awaitAll } from 'peprn/util'
import { randId } from '../../lib/helpers'

import { mem } from '../../lib/schemas'

import { isChordCsvArg, makeFulfilledBarNote, parseChordCsvArg } from '../../lib/util/barsUtil'
import { abbrev, isAbbreviation, tickCounts } from '../../core/observables/masterTicksObservable'

import { mapSongToMidiTicks } from '../../lib/mapSongToTicks'
import { setLatestMap } from '../../core/observables'


const cliDelaysToTags = (delay?: string[]): string[] => {
    if (!delay) return []
    const tots: { [Property in keyof typeof tickCounts]?: number } = {}
    delay.forEach((str) => {
        if (isAbbreviation(str)) {
            const fractConst = abbrev[str]
            tots[fractConst] = tots[fractConst] !== undefined ? tots[fractConst] + 1 : 1
        } else {
            console.error(`${str} is not an abbreviation for a fractional note`)
        }
    })

    const tags = Object.entries(tots).map(([tagName, count]: [tn: keyof typeof tickCounts, count: number]) => {
        return `${tagName}=${count}`
    })
    return tags
}
export default {
    fn: async (_, subCalls) => {
        awaitAll({
            ...subCalls,
        }).then(() => {
            setLatestMap(mapSongToMidiTicks())
        })
    },
    submodules: {
        '$': {
            fn: async () => undefined,
            submodules: {
                chord: {
                    fn: async () => undefined,
                    submodules: {
                        '$': {
                            fn: async () => undefined,
                            submodules: {

                                add: {
                                    yargs: {
                                        delay: {
                                            alias: 'd',
                                            type: 'number',
                                            array: true
                                        },
                                    },
                                    // e.g. bar [barTag] chord [chordName] add [tickCnt]
                                    fn: async ({ $: dollar, positionalNonCommands, delay }) => {
                                        const [barTag, chordName] = dollar
                                        if (!isChordCsvArg(chordName)) {
                                            throw new Error(`Chord and octave csv required; instead  "${chordName}"`)
                                        }

                                        const [notes, chordTags] = parseChordCsvArg(chordName)
                                        const [ticks] = positionalNonCommands
                                        let finalTicks: null | number = null  
                                        if (typeof ticks === 'number') {
                                            finalTicks = ticks 
                                        } else {
                                            if (typeof ticks !== 'string') {
                                                throw new Error(`Ticks must be a number or a string`)
                                            }
                                            if (!isAbbreviation(ticks)) { 
                                                throw new Error(`Ticks must be a number or a string`) 
                                            }
                                            finalTicks = tickCounts[abbrev[ticks]]
                                        }
                                        const barNotes = mem().notesByBar[barTag]
                                        const layerTag = `layer=${randId('', 3)}`
                                        const placementTag = `barDelay=${finalTicks}`
                                        const groupIdTag = `groupId=${randId('', 3)}`

                                        const delayTags = cliDelaysToTags(delay)

                                        const addNote = makeFulfilledBarNote(barTag, [groupIdTag, layerTag, placementTag, ...chordTags, ...delayTags])
                                        barNotes.push(...notes.map((n, idx) => {
                                            const initNote = addNote(n)
                                            initNote.tagsObj.groupIndex = [idx]
                                            return {
                                                ...initNote,
                                                tags: [
                                                    ...initNote.tags,
                                                    `groupIndex=${idx}`,
                                                    `chordSize=${notes.length}`,
        
                                                ]
                                            }
                                        }))

                                    }
                                }
                            }
                        },
                    }
                }
            }
        }
    }

} as Module

