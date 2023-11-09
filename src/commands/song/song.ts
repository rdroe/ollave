import { Module } from 'peprn/util'
import { song, track, songNames } from '../../mem'
import { browser } from 'user-tables'
import { fakeCli } from 'peprn/browser'
import { userTables } from 'user-tables/browser'

type SongRecord = {
    name: string,
    tempo: number,
    "track-ids": number[]
}

type TrackRecord = {
    start: number,
    "phase-ids": number[],
}

export type TrackPhaseRecord = {
    name: string,
    "follows-ids": number[],
    speed: number,
    "note-ids": number[],
}

type NoteRecord = {
    note: string,
    "bar-tag": string,
    tags: string[]
}


export default {
    fn: async () => {
        return null
    },
    submodules: {
        init: {
            fn: async () => {
                const shiftedOff = songNames.shift()
                song.name = shiftedOff
                const data: SongRecord = {
                    name: shiftedOff,
                    tempo: 120,
                    "track-ids": []
                }
                song.id = await browser.userTables.add('song', {
                    data
                })
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

                        if (song.id === null) {
                            console.error("Error; no current song")
                            return null
                        }
                        const trackRecord: TrackRecord = {
                            "start": 0,
                            "phase-ids": []
                        }
                        const trackId = await browser.userTables.add('track', { data: trackRecord })
                        const songId = await browser.userTables.update('song', {
                            id: song.id,
                            data: {
                                "song-tracks": [[
                                    trackId, 0
                                ]]
                            },

                        }, {})

                        const coll = await (userTables.where('song', { id: song.id }))
                        const fetched = await coll.first()

                        const { "song-tracks": songTracks } = fetched.data
                        if (songTracks) {
                            track.id = songTracks[0][0]
                        } else {
                            console.error("no tracks for song", song.id)
                        }
                        console.log('currentSongTrack', track)
                    }
                }
            }
        }
    }
} as Module
