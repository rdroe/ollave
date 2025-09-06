import { Module, ParsedCli } from 'peprn/util'
import { filterDelayTags, parseNoteTags } from '../../lib/util/tagsUtil'
import { strjson } from '../../lib/helpers'
import { mapSongToMidiTicks } from '../../lib/mapSongToTicks'
import { setLatestMap } from '../../core/observables'
import { getNotesByEntity, notesByBarArraySchema, parseDelayMatrix, prepDelayMatrix } from '../../lib/util/notesUtil'

export default {
    fn: async () => { },
    submodules: {
        arrange: {
            fn: async () => {

            }
        },
        'in': {
            fn: async () => { },
            submodules: {
                // bar or phase 
                '$': {
                    fn: async () => { },
                    submodules: {
                        '$': {
                            fn: async (args, calls) => {
                                const { $: dollar, positionalNonCommands } = args
                                const isGcCall = !!calls['notes in $ $ arrange']
                                if (isGcCall) {

                                    return getNotesByEntity(
                                        args.commands.slice(2),
                                        [...positionalNonCommands]
                                    )
                                }
                                const notes = getNotesByEntity(
                                    dollar,
                                    positionalNonCommands
                                )

                                return notes;
                            },
                            submodules: {
                                arrange: {
                                    fn: async ({ positionalNonCommands: patterns }, calls) => {

                                        const notes1 = await calls['notes in $ $']
                                        const parsed = notesByBarArraySchema.safeParse(notes1)
                                        if (parsed.success === false) {
                                            console.error(parsed.error)
                                            throw new Error(`Incorrectly formatted or empty notes:${strjson(notes1)}`)
                                        }

                                        const prepped = prepDelayMatrix(patterns as ParsedCli['positionalNonCommands'])
                                        const delaysPerChordSize = parseDelayMatrix(prepped)
                                        parsed.data.forEach((nt) => {

                                            const parsed = Object.fromEntries(parseNoteTags(nt.tags))
                                            const [subdataKey] = parsed.chordSize
                                            if (
                                                typeof subdataKey !== 'number'
                                                && typeof subdataKey !== 'string'

                                            ) throw new Error(`note has no chord size`)

                                            const noteLookup = delaysPerChordSize[`${subdataKey}x`]
                                            if (!noteLookup) {
                                                return
                                            }

                                            const [chordIdx] = parsed.groupIndex

                                            if (typeof chordIdx !== 'number') {
                                                const msg = strjson(nt)
                                                throw new Error(`Note lacked a chord index: ${msg}`)
                                            }

                                            const newTags = noteLookup[chordIdx]

                                            if (!newTags) {
                                                console.error('no tags created for note', {
                                                    'note index in chord': chordIdx,
                                                    'chord size': `${subdataKey}x`,
                                                    'note sizing lookup (derived from cli)': delaysPerChordSize
                                                })
                                            }

                                            // only wipte the old tags if the new ones are created

                                            // this is a weird behavior for re-processing or trying multiple combos in a session
                                            if (newTags.length) {
                                                filterDelayTags(nt, true)
                                                nt.tags.push(...(newTags as string[]))
                                            }
                                        })

                                        setLatestMap(mapSongToMidiTicks())
                                        return notes1

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
