import { Module } from 'peprn/util'
import { mem } from '../../mem'
import { browser } from 'user-tables'
import { fakeCli } from 'peprn/browser'
import { userTables } from 'user-tables/browser'
import { startCueObservable } from './observables'
import { downloadNotes } from 'src/lib/midi'
import { downloadSong } from 'src/download'
const { songNames } = mem()
// kebab-case ids props; camelCase data props
export type SongRecord = {
    id?: number,
    name: string,
    tempo: number,
    "track-ids": number[]
}

export type TrackRecord = {
    id?: number,
    start: number,
    "phase-ids": number[],
}

export type PhaseRecord = {
    id?: number,
    "follows-ids": number[],
    speed: number,
    barSizeMultiplier: number
}

export default {
    fn: async () => {
        return null
    },
    submodules: {
        init: {
            fn: async () => {
                const shiftedOff = songNames.shift()


                const data: SongRecord = {
                    name: shiftedOff,
                    tempo: 120,
                    "track-ids": []
                }
                const createdId = await browser.userTables.add('song', {
                    data
                })

                mem().song = {
                    id: createdId,
                    ...data
                }
                await fakeCli(`song track init`, 'cli')
            }
        },
        track: {
            fn: async () => {
                return null
            },
            submodules: {
                init: {
                    fn: async () => {


                        const trackRecord: TrackRecord = {
                            "start": 0,
                            "phase-ids": []
                        }
                        const trackId = await browser.userTables.add('track', { data: trackRecord })
                        const songId = await browser.userTables.update('song', {
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
                            mem().track = {
                                id: songTracks[0][0],
                                start: 0,
                                "phase-ids": []
                            }
                        } else {
                            console.error("no tracks for song", mem().song.id)
                        }
                        console.log('currentSongTrack', mem().track.id)
                    }
                },
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
                return startCueObservable()
            }
        },
        dl: {
            fn: async () => {
                return downloadSong()
            }
        }

    }
} as Module
