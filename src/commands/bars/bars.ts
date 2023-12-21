import { Module, awaitAll } from 'peprn/util'
import { randId } from 'src/lib/helpers'
import { getAllPhaseBars } from 'src/mem-db'
import { NoteByBar, mem } from '../../mem'
import { mapSongToMidiTicks } from 'src/mapSongToTicks'
import { isChordCsvArg, isNoteCsvArg, isNoteName, isRestArg, makeFulfilledBarNote, parseChordCsvArg } from './utils'

import { BAR, EIGHTH, tickCounts } from '../phase/observables/masterTicksObservable'

import { calcFractionalDelay, earliestNote, filterDelayTags, groupNotesByFirstTagDatum, parseNoteTags, tagsDeleteMatching1, filterBarDelayTag } from 'src/lib/tags'
import { isAbbreviationCsv, sumAbbreviationCsv } from '../notes/notes'

const { notesByBar } = mem()

export default {
    fn: async (_, subCalls) => {
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
                    help: {
                        description: "Fill a phase with chords or note groupings",
                        examples: {
                            'Em,3 Am,3 [] C3,E3,G#3': `
Put the chord Em in the first bar (octave three), Am in the second, rest in the third bar, and place 3 notes in the fourth bar of aphrodite. An example song would look like this:

phase aphrodite 10
bars aphrodite fill Em,3 Am,3 [] C3,E3,G#3
phase aphrodite 20
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
                                const fn = makeFulfilledBarNote(barTag, [...commonTags, ...timingTags, groupIdTag])
                                receptacle.push(...parsed.map(fn))

                            } else if (isNoteName(str)) {
                                const fn = makeFulfilledBarNote(barTag, [...commonTags, ...timingTags, groupIdTag])
                                receptacle.push(fn(str))
                            }
                        })
                    }
                },
                repack: {
                    yargs: {
                        pack: {
                            alias: 'k',
                            array: true,

                        }
                    },
                    fn: async ({ '$': dollar, pack }) => {

                        const [phaseName] = dollar
                        const phase = mem().phases[phaseName]
                        const barSizeMod = phase.barSizeMultiplier

                        const bars = getAllPhaseBars(phaseName)
                        const detachedBars: NoteByBar[][] = []
                        const notesByBar = mem().notesByBar

                        // strip existing bar tag
                        bars.forEach((barTag) => {
                            detachedBars.push(
                                notesByBar[barTag]
                            )
                            notesByBar[barTag] = []
                        })

                        const abbreviations = pack.filter((elem: number | string) => {
                            return isAbbreviationCsv(elem)
                        })

                        if (abbreviations.length !== 0 && abbreviations.length !== pack.length) {

                            throw new Error(`Plan for packing must be all fractions or all numeric`)
                        }

                        const packPlanType = abbreviations.length === 0 ? "NUMERIC" : "FRACTIONAL"

                        if (packPlanType === "NUMERIC") {

                            bars.forEach((barTag) => {
                                const spl = barTag.split(':')
                                const barIdx = parseInt(spl[1])
                                const packPlanIdx = barIdx % pack.length
                                const packPlan = pack[packPlanIdx]
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
                        } else if (packPlanType === "FRACTIONAL") {

                            const detachedGroups = groupNotesByFirstTagDatum(
                                detachedBars.flat(),
                                'groupId'

                            )
                            console.log('detached', detachedGroups, pack)

                            const absolutizedPackTranslation = pack.reduce((accum: number[], currCsv: string) => {
                                const priorRaw = accum.length === 0 ? 0 : accum[accum.length - 1]
                                const prior: number = typeof priorRaw === 'number' ? priorRaw : 0
                                const newTick = sumAbbreviationCsv(currCsv) + prior
                                return [...accum, newTick]
                            }, [] as number[])

                            const phaseTimedGroups: { [tick: number]: NoteByBar[] } = {}
                            let planExhaustions

                            let prior = 0
                            const barRanges = bars.map((barName, idx) => {
                                const nxt = [prior, prior + tickCounts[BAR]

                                ]
                                prior += tickCounts[BAR]
                                return nxt
                            })

                            const newNotesByBar =
                                Object.fromEntries(

                                    bars.map((bar) => [bar, []] as [bar: string, notes: NoteByBar[]])
                                )


                            absolutizedPackTranslation.forEach((num: number, groupIdx: number) => {

                                const found = barRanges.find(
                                    ([start, end]) => {
                                        return start <= num && end > num
                                    })

                                const foundIdx = barRanges.indexOf(found)

                                if (found) {


                                    const notes = detachedGroups[groupIdx]


                                    newNotesByBar[bars[foundIdx]].push(...notes.map(
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

                            console.log('abso', {
                                absolutizedPackTranslation,
                                newNotesByBar

                            })

                            Object.entries(newNotesByBar).forEach(([key, val]) => {
                                notesByBar[key].push(...val)
                            })
                        }

                    }
                }
            }
        }
    }
} as Module
