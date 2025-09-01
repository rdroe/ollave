import { Module } from 'peprn/util'
import { mem, songRecordSchema, songRecordSchema_, trackRecordSchema } from '../../lib/schemas'
import { browser } from 'user-tables'
import fakeCli from 'peprn/fakeCli'
const { userTables } = browser
import { startCueObservable, stopCueObservable } from '../../core/observables/songObservables'

import { downloadSong } from '../../lib/download'
import { barsAtMidi, mapSongToMidiTicks, midiAtBar } from '../../lib/mapSongToTicks'
import { trackTempo } from '../../core/observables/masterTicksObservable'
import { getLastChordLayerName } from '../../lib/util/barsUtil'
import { groupNotesByFirstTagDatum, parseNoteTags } from '../../lib/tags'
import { setTrackReceptacleSelector, startPrintingNotes, stopPrintingNotes } from '../../lib/util/songUtil'
import { setLatestMap } from '../../core/observables'
export { init, setTrackReceptacleSelector } from '../../lib/util/songUtil'
const { songNames } = mem()
import { z } from 'zod'
import { loadAndInitSongAndTracks } from 'src/lib/fetch'
import { initLoadedSong, initNewSong } from 'src/lib/helpers'
// kebab-case ids props; camelCase data props
export type SongRecord = z.infer<typeof songRecordSchema_>

export type TrackRecord = z.infer<typeof trackRecordSchema>

export type PhaseRecord = {
    id?: number,
    "follows-ids": number[],
    speed: number,
    barSizeMultiplier: number,
    scaleName: string | null,
    scaleTonic: string | null
}

export default {
    fn: async () => {
        return null
    },
    submodules: {
        test: {
            fn: () => {
                return fakeCli(`
phase aphrodite 10
bars aphrodite fill C,3 Dm,3 Em,3 F,4 G,4 Am,4 Bdim,4
phase aphrodite 20
song start
`, "cli")

            },
        },
        list: {
            fn: async () => {
                const songs = (await (await browser.userTables.where('song', {})).toArray())
                return {
                    formatted: {
                        songs: songs.map(({ id, data }) => ({ id, name: data.name }))
                    }
                }
            }
        },
        load: {

            fn: async ({ positionalNonCommands }) => {
                const [songId] = positionalNonCommands
                if (!z.number().safeParse(songId).success) {
                    return {
                        formatted: {
                            error: 'no song id provided or it is not a number'
                        }
                    }
                }
                stopCueObservable()
                await loadAndInitSongAndTracks(songId)
                return initLoadedSong()
            }
        },
        new: {
            fn: async () => {
                await initNewSong()
                return initLoadedSong()
            }
        },
        init: {
            fn: async () => {
                const shiftedOff = songNames.shift()


                const data: Omit<SongRecord, "id"> = {
                    name: shiftedOff,
                    tempo: 120,
                    "track-ids": []
                }
                const createdId = await browser.userTables.add('song', {
                    data
                })
                const refetched = await (await browser.userTables.where('song', { id: createdId })).first()

                mem().song = songRecordSchema.parse(refetched.data)
                
                await fakeCli(`song track init`, 'cli')
            }
        },
        track: {
            fn: async () => {
                return null
            },
            submodules: {
                printNotes: {
                    fn: async ({ stop = false, selector = '.tags-app-root' }) => {
                        if (stop) {
                            stopPrintingNotes()
                            return
                        }
                            startPrintingNotes()
                            if (selector) {
                                setTrackReceptacleSelector(selector)
                            } else {
                                console.warn('no selector provided for printing notes')
                            }
                        
                    }
                },

                init: {
                    fn: async () => {
                        const trackRecord: Omit<TrackRecord, "id"> = {
                            "phase-ids": [],
                            "phase-names": [],
                            notesByBar: {}
                        }
                        const trackId = await browser.userTables.add('track', { data: trackRecord })
                        await browser.userTables.update('song', {
                            id: mem().song.id,
                            data: {
                                "song-tracks": [[
                                    trackId, 0
                                ]]
                            },
                        }, {})

                        const coll = await (userTables.where('song', { id: mem().song.id }))
                        const fetched = await coll.first()
                        const { "song-tracks": songTracks } = fetched.data

                        if (songTracks) {
                            mem().tracks = [{
                                id: songTracks[0][0],
                                "phase-ids": [],
                                "phase-names": [],
                                notesByBar: {}
                            }]
                        } else {
                            console.error("no tracks for song", mem().song.id)
                        }
                    }
                },
            }
        },
        out: {
            yargs: {
                all: {
                    alias: 'a',
                    type: 'boolean',
                    default: false
                }
            },
            fn: async ({ all = false }) => {
                if (all) {
                    return mem()
                }
                return mem().notesByBar
            }
        },
        start: {
            help: {
                description: 'Start playing the song',
                examples: {
                    '': 'start playing the song'
                }
            },
            fn: async () => {
                setLatestMap(mapSongToMidiTicks())
                const songPause = mem().songPauses[mem().song.name]
                if (!songPause) {
                    return startCueObservable()
                }
                const pauseMidi = midiAtBar(songPause) ?? 0
                return startCueObservable(pauseMidi)
            }
        },
        stop: {
            help: {
                description: 'Stop playing the song',
                examples: {
                    '': 'start playing the song'
                }
            },
            fn: async () => {
                return stopCueObservable()
            }
        },
        dl: {
            yargs: {
                played: {
                    alias: 'p',
                    type: 'boolean',
                    default: false
                }
            },
            fn: async ({ played = false }) => {
                if (!played) {
                    downloadSong(trackTempo, mem().latestMap)
                } else {
                    downloadSong(trackTempo, mem().playedMap)
                }
            }
        },
        
        chord: {
            submodules: {
                last: {
                    fn: async ({ $: dollar, positionalNonCommands, delay }) => {
                        const allNotes = Object.values(mem().notesByBar).flat() 
                        const lastChordLayerName = getLastChordLayerName() 
                        const grouped = groupNotesByFirstTagDatum(allNotes, 'layer').flat().filter((note) => {
                            const tagData = parseNoteTags(note.tags).find(([tagName]) => tagName === "layer")
                            return tagData?.[1][0] === lastChordLayerName
                        })
                        return grouped 
                        
                    }
                }
            }
        }

    }
} as Module
