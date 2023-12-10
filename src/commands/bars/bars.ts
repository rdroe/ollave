import { Module, awaitAll } from 'peprn/util'
import { isString, peprnIsNum, randId } from 'src/lib/helpers'
import { SubcommandPatterns, runSubcommandsOrNull } from 'src/lib/subcommands'
import { getAllPhaseBars, lookUpGraph } from 'src/mem-db'
import { NoteByBar, mem } from '../../mem'
import { Chord, Note } from 'tonal'
import { mapSongToMidiTicks } from 'src/mapSongToTicks'

import { chordNameWithNotes } from 'src/lib/graphh'
import { isChordCsvArg, isNoteCsvArg, isNoteName, isRestArg, makeFulfilledBarNote, parseChordCsvArg } from './utils'

const { notesByBar } = mem()

export default {
    fn: async (args, subCalls) => {
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
                                timingTags.push(`8ths=${round}`)
                            }

                            if (isChordCsvArg(str, scaleTonic, scaleName)) {

                                const [notes, tags] = parseChordCsvArg(str, `${scaleTonic} ${scaleName}`)


                                if (notes.length === 0) {
                                    throw new Error(`Error; ${str} could not be parsed to anything with notes`)
                                }
                                const fn = makeFulfilledBarNote(barTag, commonTags.concat(tags))

                                receptacle.push(...notes.map(fn))
                            } else if (isRestArg(str)) {

                                // doing nothing will leave an empty space.
                                // todo: it's here without any tags or timing.
                            } else if (isNoteCsvArg(str)) {
                                const parsed = str.split(',')
                                if (parsed.length === 0) {
                                    throw new Error(`Error; ${str} could not be parsed to anything with notes`)
                                }
                                const fn = makeFulfilledBarNote(barTag, commonTags)
                                receptacle.push(...parsed.map(fn))

                            } else if (isNoteName(str)) {
                                const fn = makeFulfilledBarNote(barTag, commonTags)
                                receptacle.push(fn(str))
                            }
                        })
                    }
                }
            }
        }
    }

} as Module
