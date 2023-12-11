import { Module, awaitAll } from 'peprn/util'
import { randId, strjson } from 'src/lib/helpers'
import { getAllPhaseBars } from 'src/mem-db'
import { NoteByBar, mem } from '../../mem'
import { mapSongToMidiTicks } from 'src/mapSongToTicks'
import { isChordCsvArg, isNoteCsvArg, isNoteName, isRestArg, makeFulfilledBarNote, parseChordCsvArg } from './utils'
import { EIGHTH } from '../phase/observables/masterTicksObservable'
import { tagsDeleteMatching2 } from 'src/lib/tags'

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
                                const fn = makeFulfilledBarNote(barTag, [...commonTags, ...tags, ...timingTags])

                                receptacle.push(...notes.map(fn))
                            } else if (isRestArg(str)) {

                                // doing nothing will leave an empty space.
                                // todo: it's here without any tags or timing.
                            } else if (isNoteCsvArg(str)) {
                                const parsed = str.split(',')
                                if (parsed.length === 0) {
                                    throw new Error(`Error; ${str} could not be parsed to anything with notes`)
                                }
                                const fn = makeFulfilledBarNote(barTag, [...commonTags, ...timingTags])
                                receptacle.push(...parsed.map(fn))

                            } else if (isNoteName(str)) {
                                const fn = makeFulfilledBarNote(barTag, [...commonTags, ...timingTags])
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
                            type: 'number'
                        }
                    },
                    fn: async ({ '$': dollar, pack }) => {
                        const [phaseName] = dollar
                        const phase = mem().phases[phaseName]
                        const { scaleTonic, scaleName } = phase

                        const bars = getAllPhaseBars(phaseName)
                        const detachedBars: NoteByBar[][] = []
                        const notesByBar = mem().notesByBar
                        console.log('before stashing', strjson({ notesByBar, detachedBars }))

                        // strip existing bar tag
                        bars.forEach((barTag) => {
                            detachedBars.push(
                                notesByBar[barTag]
                            )
                            notesByBar[barTag] = []
                        })

                        console.log('after stashing', { notesByBar, detachedBars })
                        console.log('mem()', mem())
                    }
                }
            }
        }
    }

} as Module
