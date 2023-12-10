import { Module, awaitAll } from 'peprn/util'
import { randId } from 'src/lib/helpers'
import { getAllPhaseBars } from 'src/mem-db'
import { NoteByBar, mem } from '../../mem'
import { mapSongToMidiTicks } from 'src/mapSongToTicks'
import { isChordCsvArg, isNoteCsvArg, isNoteName, isRestArg, makeFulfilledBarNote, parseChordCsvArg } from './utils'
import { Chord } from 'tonal'

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
                chord: {
                    fn: async () => undefined,
                    submodules: {
                        '$': {
                            fn: async () => undefined,
                            submodules: {
                                add: {
                                    // e.g. bar [barTag] chord [chordName] add [tickCnt]
                                    fn: async ({ $: dollar, positionalNonCommands }) => {
                                        const [barTag, chordName] = dollar
                                        if (!isChordCsvArg(chordName)) {
                                            throw new Error(`Chord and octave csv required; instead  "${chordName}"`)
                                        }
                                        const [notes, chordTags] = parseChordCsvArg(chordName)
                                        const [ticks] = positionalNonCommands
                                        const barNotes = mem().notesByBar[barTag]
                                        const layerTag = `layer=${randId('', 3)}`
                                        const delayTag = `barDelay=${ticks}`
                                        const addNote = makeFulfilledBarNote(barTag, [layerTag, delayTag, ...chordTags])
                                        barNotes.push(...notes.map(addNote))
                                        console.log('barNotes after add', barNotes)

                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

} as Module
