import { Module, awaitAll } from 'peprn/util'
import { randId } from '../../lib/helpers'
import { getAllPhaseBars, sortByNumberAfterColon } from '../../lib/util/phaseUtil'
import { NoteByBar } from '../../lib/schemas'
import {  mem } from '../../core/mem'
import { isChordCsvArg, isNoteCsvArg, isNoteNameWithOctave, isRestArg, makeFulfilledBarNote, parseChordCsvArg } from '../../lib/util/barsUtil'
import { BAR, EIGHTH, tickCounts } from '../../core/observables/masterTicksObservable'
import { filterDelayTags, groupNotesByFirstTagDatum, filterBarDelayTag, parseNoteTags } from '../../lib/tags'
import { isAbbreviationCsv, sumAbbreviationCsv } from '../../lib/util/notesUtil'
import { mapSongToMidiTicks } from '../../lib/mapSongToTicks'
import { setLatestMap } from '../../core/observables'

const { notesByBar } = mem()

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
            fn: async ({ $, positionalNonCommands }, subCalls) => {
                const longestCall = Math.max(...Object.keys(subCalls).map(sc => sc.length))
                const ownLength = `bars $`.length
                if (ownLength === longestCall) {
                    const [phaseName] = $
                    return Object.fromEntries(Object.entries(mem().notesByBar).filter(([k]) => k.startsWith(`${phaseName}:`)).map(([k, v]: [k: string, v: NoteByBar[]]) => {
                        const allChords = v.reduce((accum: string[], curr: NoteByBar) => {
                            const parsed = Object.fromEntries(parseNoteTags(curr.tags))
                            const [chordName] = parsed.chord
                            if (typeof chordName !== 'string') throw new Error(`Invalid chord identifier ${chordName}`)
                            if (chordName === '') return accum
                            if (accum.includes(chordName)) return accum
                            return [...accum, chordName]
                        }, [] as string[])

                        return [k, allChords]
                    }))
                }

            },
            submodules: {
                fill: {
                    help: {
                        description: "Fill a phase with chords or note groupings",
                        examples: {
                            'Em,3 Am,3 [] C3,E3,G#3': `
Put the chord Em in the first bar (octave three), Am in the second, rest in the third bar, and place 3 notes in the fourth bar of aphrodite. An example song would look like this:

phase aphrodite 10
bars aphrodite fill Em,3 Am,3 [] C3,E3,G#3
song start
`
                        }
                    },
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

                        const layerTag = `layer=${newGroupName}`

                        const commonTags = [layerTag].concat(phaseTags)


                        rawObjects.forEach((str: string, objIdx: number) => {
                            const groupId = randId('', 3)
                            const groupIdTag = `groupId=${groupId}`
                            const round = Math.trunc(objIdx / bars.length)
                            const barTag = bars[objIdx % bars.length]
                            const receptacle: NoteByBar[] = notesByBar[barTag]
                            const timingTags: string[] = []

                            if (round > 0) {
                                timingTags.push(`${EIGHTH}=${round}`)
                            }


                            if (isChordCsvArg(str, scaleTonic, scaleName)) {
                                const [notes, tags] = parseChordCsvArg(str, `${scaleTonic} ${scaleName}`)
                                if (notes.length === 0) {
                                    throw new Error(`Error; ${str} could not be parsed to anything with notes`)
                                }

                                const fn = makeFulfilledBarNote(barTag, [...commonTags, ...tags, ...timingTags, groupIdTag])
                                receptacle.push(...notes.map(fn).map((n, idx) => {
                                    const noteId = randId('', 6)
                                    return {
                                        ...n,
                                        tags: [
                                            ...n.tags,
                                            `groupIndex=${idx}`,
                                            `chordSize=${notes.length}`,
                                            `noteId=${noteId}`,
                                        ]
                                    }
                                }))
                            } else if (isRestArg(str)) {

                                // doing nothing will leave an empty space.
                                // todo: it's here without any tags or timing.
                            } else if (isNoteCsvArg(str)) {
                                const parsed = str.split(',')
                                if (parsed.length === 0) {
                                    throw new Error(`Error; ${str} could not be parsed to anything with notes`)
                                }
                                const fn = makeFulfilledBarNote(barTag, [`groupIndex=0`, `chordSize=1`, ...commonTags, ...timingTags, groupIdTag])
                                receptacle.push(...parsed.map(fn))
                            } else if (isNoteNameWithOctave(str)) {
                                const fn = makeFulfilledBarNote(barTag, [`groupIndex=0`, `chordSize=1`, ...commonTags, ...timingTags, groupIdTag])
                                receptacle.push(fn(str))
                            } else {
                                throw new Error(`Error; ${str} could not be parsed to anything with notes`)
                            }
                        })
                    }
                },
                add: {
                    help: {
                        description: "Add chord bars ore note-group bars to a phrase; like `fill`; but it creates a new phase and tacks it onto the end of the named one",
                        examples: {
                            'Em,3 Am,3 [] C3,E3,G#3': `
Create a new nameless bar; put the chord Em in the first bar (octave three), Am in the second, rest in the third bar, and place 3 notes in the fourth bar. Then tack that onto the titular bar

bars aphrodite add Em,3 Am,3 [] C3,E3,G#3
`
                        }
                    },
                    fn: async ({ $: dollar, positionalNonCommands }) => {


                        const [phaseName] = dollar
                        const rawObjects = positionalNonCommands
                        if (typeof phaseName !== 'string') return 'PHASE NAME IS REQUIRED'

                        const phase = mem().phases[phaseName]
                        const { scaleTonic, scaleName } = phase



                        const bars = getAllPhaseBars(phaseName)
                        const barIdxs = bars.map((barName) => parseInt(barName.split(':')[1]))

                        const maxBarRaw = Math.max(...barIdxs)
                        const maxBar = isNaN(maxBarRaw) ? 0 : maxBarRaw

                        const newGroupName = randId("", 3)
                        const phaseTags: string[] = []

                        if (scaleTonic) {
                            phaseTags.push(`scaleTonic=${scaleTonic}`)
                        }

                        if (scaleName) {
                            phaseTags.push(`scaleName=${scaleName}`)
                        }

                        const layerTag = `layer=${newGroupName}`

                        const commonTags = [layerTag].concat(phaseTags)

                        rawObjects.forEach((str: string, objIdx: number) => {

                            const groupId = randId('', 3)
                            const groupIdTag = `groupId=${groupId}`

                            const barTag = `${phaseName}:${objIdx + 1 + maxBar}`

                            const receptacle: NoteByBar[] = []
                            mem().notesByBar[barTag] = receptacle

                            const timingTags: string[] = []

                            if (isChordCsvArg(str, scaleTonic, scaleName)) {

                                const [notes, tags] = parseChordCsvArg(str, `${scaleTonic} ${scaleName}`)
                                if (notes.length === 0) {
                                    throw new Error(`Error; ${str} could not be parsed to anything with notes`)
                                }

                                const fn = makeFulfilledBarNote(barTag, [`groupIndex=0`, `chordSize=1`, ...commonTags, ...tags, ...timingTags, groupIdTag])
                                receptacle.push(...notes.map(fn).map((n, idx) => {


                                    return {
                                        ...n,
                                        tags: [
                                            ...n.tags,
                                            `groupIndex=${idx}`,
                                            `chordSize=${notes.length}`,

                                        ]
                                    }
                                }))
                            } else if (isRestArg(str)) {

                                // doing nothing will leave an empty space.
                                // todo: it's here without any tags or timing.
                            } else if (isNoteCsvArg(str)) {
                                const parsed = str.split(',')
                                if (parsed.length === 0) {
                                    throw new Error(`Error; ${str} could not be parsed to anything with notes`)
                                }
                                const fn = makeFulfilledBarNote(barTag, [`groupIndex=0`, `chordSize=1`, ...commonTags, ...timingTags, groupIdTag])
                                receptacle.push(...parsed.map(fn))

                            } else if (isNoteNameWithOctave(str)) {
                                const fn = makeFulfilledBarNote(barTag, [`groupIndex=0`, `chordSize=1`, ...commonTags, ...timingTags, groupIdTag])
                                receptacle.push(fn(str))
                            }
                        })
                    }

                },
                remove: {
                    help: {
                        description: "Remove the last bar from the specified phase",
                        examples: {
                            'remove': `Remove the last bar from the dollar-specified phase`
                        }
                    },
                    fn: async ({ $: dollar }) => {


                        const [phaseName] = dollar
                        if (typeof phaseName !== 'string') return 'PHASE NAME IS REQUIRED'


                        const bars = getAllPhaseBars(phaseName)
                        bars.sort(sortByNumberAfterColon)
                        const deleteable = bars[bars.length - 1]

                        mem().notesByBar = {
                            ...Object.fromEntries(Object.entries(mem().notesByBar).filter(([k, v]: [k: string, v: NoteByBar[]]) => {
                                return k !== deleteable
                            }))
                        }
                        if (mem().notesByBar[deleteable]) {
                            throw new Error(`Did not remove ${deleteable} for some reason`)
                        }

                        return { formatted: 'verified removal of ${deleteable}' }

                    }

                },

                repack: {
                    help: {
                        description: `
a pakk pattern works across the entire phase.
a stuff pattern tries to make each bar a microcosm of the phase.

whole number example:
bars aphrodite repack --pack 2 4 6 2

the above line stuffs the existing bars' timing more tightly into  aphrodite's bars. in this example,the  evenly-spaced original bars will be resituatied with  2 to bar 0, 4 to bar 1, 6 to bar 2, 2 to bar 3, then 2 to bar 4, and so on.

fractional example:
bars aphrodite repack --stuff 4th,8th half 4th,16th

this example stuffs the existing bars' timing more tightly into  aphrodite's bars. in this example,the  evenly-spaced original bars will be resituatied with  4th to bar 0, 8th to bar 1, half to bar 2, 4th to bar 3, 16th to bar 4, and so on. 
`
                    },
                    yargs: {
                        pack: {
                            alias: 'k',
                            array: true,
                        },
                        stuff: {
                            alias: 'f',
                            array: true,
                        },
                    },
                    fn: async ({ '$': dollar, pack = [], stuff = [] }) => {

                        const [phaseName] = dollar
                        const phase = mem().phases[phaseName]
                        const barSizeMod = phase.barSizeMultiplier

                        const bars = getAllPhaseBars(phaseName)
                        const detachedBars: NoteByBar[][] = []
                        const notesByBar = mem().notesByBar

                        if (pack.length > 0 && stuff.length > 0) {
                            throw new Error('Either --pack or --stuff is required, but not both')
                        }
                        if (pack.length === 0 && stuff.length === 0) {
                            throw new Error('Either --pack or --stuff is required')
                        }
                        const packOrStuff: 'pack' | 'stuff' = pack.length > 0 ? 'pack' : 'stuff' 
                        const packk = pack.length > 0 ? pack : stuff


                        // strip existing bar tag
                        bars.forEach((barTag) => {
                            detachedBars.push(
                                notesByBar[barTag]
                            )
                            notesByBar[barTag] = []
                        })

                        const abbreviations = packk.filter((elem: number | string) => {
                            return isAbbreviationCsv(elem)
                        })

                        if (abbreviations.length !== 0 && abbreviations.length !== packk.length) {
                            throw new Error(`Plan for packing or stuffing must be all fractions or all numeric`)
                        }

                        const packPlanType: 'NUMERIC' | 'FRACTIONAL' = abbreviations.length === 0 ? "NUMERIC" : "FRACTIONAL"

                        const caseName: "numeric-pack" | "numeric-stuff" | "fractional-pack" | "fractional-stuff" = packOrStuff === 'pack' ? packPlanType === "NUMERIC" ? "numeric-pack" : "fractional-pack" : packPlanType === "NUMERIC" ? "numeric-stuff" : "fractional-stuff"

                        switch (caseName) {
                            case 'numeric-pack':
                                numericPack(bars, packk, detachedBars, barSizeMod)
                                break 
                            case 'numeric-stuff':
                                numericStuff(bars, packk, detachedBars, barSizeMod)
                                break 
                            case 'fractional-pack':
                                throw new Error('--pack cannot be used with a fractional plan; instead whole-number eg "--pack 0 2 4 1" to resequence chords into the whole song')
                            case 'fractional-stuff':
                                fractionalStuff(bars, packk, detachedBars)
                                break 
                            default:
                        }
                    }
                }
            }
        }
    }
} as Module

function numericPack(bars: string[], packk: string[], detachedBars: NoteByBar[][], barSizeMod: number) {
    bars.forEach((barTag) => {
        const spl = barTag.split(':')
        const barIdx = parseInt(spl[1])
        const packPlanIdx = barIdx % packk.length
        const packPlan = packk[packPlanIdx]
        if (typeof packPlan !== 'number') {
            throw new Error(`pack plan was non-number`)
        }
        const nextGroup: NoteByBar[][] = []
        while (nextGroup.length < packPlan) {
            nextGroup.push(
                detachedBars.shift()
            )
        }
        const interim = Math.trunc(
            (tickCounts[BAR] * (barSizeMod || 1))
            /
            nextGroup.length
        )

        nextGroup.forEach((g, groupIdx) => {
            if (!g) return
            g.forEach((note) => {

                filterDelayTags(note)
            })
            g.forEach((nt) => {
                nt.tags.push(`barDelay=${interim * groupIdx}`)
            })
            notesByBar[barTag].push(...g)
        })
    })
}

function numericStuff(bars: string[], packk: string[], detachedBars: NoteByBar[][], barSizeMod: number) {
    throw new Error('--stuff cannot be used with a numeric plan; (what would that even look like?) instead use fractional eg "--stuff 4th,8th half 4th,16th"')
}

function fractionalStuff(bars: string[], packk: string[], detachedBars: NoteByBar[][]) {
    const detachedGroups = groupNotesByFirstTagDatum(
        detachedBars.flat(),
        'groupId'
    )

    const absolutizedPackTranslation = packk.reduce((accum: number[], currCsv: string) => {
        const priorRaw = accum.length === 0 ? 0 : accum[accum.length - 1]
        const prior: number = typeof priorRaw === 'number' ? priorRaw : 0
        const newTick = sumAbbreviationCsv(currCsv) + prior
        return [...accum, newTick]
    }, [] as number[])

    let prior = 0

    // build a list of the tick times that pertain to each bar.
    // in this FRACTIONAL plan, the absolutized fractions each must find its bar
    // note that we are using, as this will be consumed as we fill each bar
    let barRanges = bars.map((barName, idx) => {
        const nxt = [prior, prior + tickCounts[BAR]]
        prior += tickCounts[BAR]
        return nxt
    })
    // receptacle for the re-packed bars 
    const newNotesByBar =
        Object.fromEntries(
            bars.map((bar) => [bar, []] as [bar: string, notes: NoteByBar[]])
        )

    // count the number of times we have iterated the --pack / --stuff argument.
    let packIterations = 0

    // exhausting the list of bars' absolute tick ranges (e.g. [0, 128])....
    while (barRanges.length) {
        let lastFilled = -1

        // for each and every --pack argument ... although --pack is treated relatively in its own plan...
        absolutizedPackTranslation.forEach((numRaw: number, groupIdx: number) => {

            // the packOffset is the first start time in the available barRanges
            // (the barRanges array is sliced and  maintaned ongoingly, but we need the first-available number)
            if (!barRanges.length) return
            const num = numRaw + barRanges[0][0]

            // found a bar in which to insert it
            const found = barRanges.find(
                ([start, end]) => {
                    return start <= num && end > num
                })
            if (found === undefined) {
                barRanges = []
                return
            }
            const foundIdx = barRanges.indexOf(found)
            lastFilled = foundIdx
            if (found) {

                const offset = bars.length - barRanges.length
                const adjustedGroupIdx = (packIterations * absolutizedPackTranslation.length) + groupIdx
                const notes = detachedGroups[adjustedGroupIdx % detachedGroups.length]
                if (!notes) {
                    console.error('Could not get detached notes targeted for repack', {
                        detachedBars, detachedGroups, offset, adjustedGroupIdx, packIterations, absolutizedPackTranslation, groupIdx,
                    })
                }

                newNotesByBar[bars[foundIdx + offset]].push(...notes.map(
                    n => ({
                        ...filterBarDelayTag(n),
                        tags: [
                            ...n.tags,
                            `barDelay=${num - found[0]}`
                        ]
                    })
                ))
            }
        })

        barRanges = barRanges.slice(lastFilled + 1)
        if (barRanges.length) {
        }
        packIterations += 1

    }

    Object.entries(newNotesByBar).forEach(([key, val]) => {
        notesByBar[key].push(...val)
    })
}