import fakeCli from 'peprn/fakeCli'
import { Module } from 'peprn/util'
import { browser } from 'user-tables'
import { z } from 'zod'
import { createStore, useStore } from 'zustand'
import { useShallow } from 'zustand/shallow'

import { updateBarDelays } from 'src/lib/util/notesUtil'

import { Mem, mem } from '../../core/mem'
import {
  setLatestMap,
  startRealtimeTick,
  stopRealtimeTick,
} from '../../core/observables'
import {
  startCueObservable,
  stopCueObservable,
} from '../../core/observables/songObservables'
import { downloadSong } from '../../lib/download'
import {
  duplicateCurrentSong,
  initLoadedSong,
  initNewSong,
  loadAndInitSongAndTracks,
} from '../../lib/fetch'
import { mapSongToMidiTicks, midiAtBar } from '../../lib/mapSongToTicks'
import { songRecordSchema } from '../../lib/schemas'
const { userTables } = browser
import { SongRecord, TrackRecord } from '../../lib/types'
import { getLastChordLayerName } from '../../lib/util/barsUtil'
import { onLoadSongCallbacks } from '../../lib/util/songUtil'
import {
  groupNotesByFirstTagDatum,
  parseNoteTags,
} from '../../lib/util/tagsUtil'

export { init } from '../../lib/util/songUtil'
const { songNames } = mem()

// Re-export types for backward compatibility
export type { SongRecord, TrackRecord }

const afterLoadSong = (song: SongRecord) => {
  onLoadSongCallbacks.forEach((callback) => {
    callback(song)
  })
}

type SongInvocation = {
  ready: boolean
  setReady: (ready: boolean) => void
}
export const useSongReady = () => {
  return useStore(
    songInvocation,
    useShallow((store) => {
      return store.ready
    })
  )
}
export const songInvocation = createStore<SongInvocation>((set) => ({
  ready: false,
  setReady: (ready: boolean) => set({ ready }),
}))

export default {
  fn: async () => {
    return null
  },
  submodules: {
    test: {
      fn: () => {
        return fakeCli(
          `
phase aphrodite 10
bars aphrodite fill C,3 Dm,3 Em,3 F,4 G,4 Am,4 Bdim,4
phase aphrodite 20
song start
`,
          'cli'
        )
      },
    },
    list: {
      fn: async () => {
        const songs = await (
          await browser.userTables.where('song', {})
        ).toArray()
        return {
          formatted: {
            songs: songs.map(({ id, data }) => ({ id, name: data.name })),
          },
        }
      },
    },
    load: {
      fn: async ({ positionalNonCommands }) => {
        console.log('load song', positionalNonCommands)
        songInvocation.getState().setReady(false)
        const [songId] = positionalNonCommands
        if (!z.number().safeParse(songId).success) {
          return {
            formatted: {
              error: 'no song id provided or it is not a number',
            },
          }
        }
        stopCueObservable()
        await loadAndInitSongAndTracks(songId)
        afterLoadSong(mem().song)
        console.log('after load song', positionalNonCommands)
        const result = await initLoadedSong()
        songInvocation.getState().setReady(true)
        console.log('after init loaded song', positionalNonCommands)
        return result
      },
    },
    new: {
      fn: async () => {
        songInvocation.getState().setReady(false)
        await initNewSong()
        const result = await initLoadedSong()
        afterLoadSong(mem().song)
        songInvocation.getState().setReady(true)
        return result
      },
    },
    duplicate: {
      fn: async () => {
        songInvocation.getState().setReady(false)
        stopCueObservable()
        const newSongId = await duplicateCurrentSong()
        await loadAndInitSongAndTracks(newSongId)
        afterLoadSong(mem().song)
        songInvocation.getState().setReady(true)
        return mem().song
      },
    },
    realtimePause: {
      fn: async () => {
        stopRealtimeTick()
      },
    },
    realtimeResume: {
      fn: async () => {
        startRealtimeTick()
      },
    },
    init: {
      fn: async () => {
        songInvocation.getState().setReady(false)
        const shiftedOff = songNames.shift()

        const data: Omit<SongRecord, 'id'> = {
          name: shiftedOff,
          tempo: 120,
          'track-ids': [],
        }
        const createdId = await browser.userTables.add('song', {
          data,
        })
        const refetched = await (
          await browser.userTables.where('song', { id: createdId })
        ).first()

        const parsedSong = songRecordSchema.parse(refetched.data)

        mem().song = {
          ...parsedSong,
          'track-ids': parsedSong['track-ids'] as [number, number][],
        }

        await fakeCli(`song track init`, 'cli')
        afterLoadSong(mem().song)
        songInvocation.getState().setReady(true)
        return mem().song
      },
    },
    track: {
      fn: async () => {
        return null
      },
      submodules: {
        init: {
          fn: async () => {
            const trackRecord: Omit<TrackRecord, 'id'> = {
              'phase-ids': [],
              'phase-names': [],
              notesByBar: {},
            }
            const trackId = await browser.userTables.add('track', {
              data: trackRecord,
            })
            await browser.userTables.update(
              'song',
              {
                id: mem().song.id,
                data: {
                  'song-tracks': [[trackId, 0]],
                },
              },
              {}
            )

            const coll = await userTables.where('song', { id: mem().song.id })
            const fetched = await coll.first()
            const { 'song-tracks': songTracks } = fetched.data

            if (songTracks) {
              mem().tracks = [
                {
                  id: songTracks[0][0],
                  'phase-ids': [],
                  'phase-names': [],
                  notesByBar: {},
                },
              ]
              afterLoadSong(mem().song)
            } else {
              console.error('no tracks for song', mem().song.id)
            }
          },
        },
      },
    },
    updateBarDelays: {
      fn: async ({ positionalNonCommands }) => {
        const [note, barDelay] = positionalNonCommands
        const updatedNotes = updateBarDelays(
          z.string().parse(note),
          z.number().parse(barDelay)
        )
        return {
          formatted: {
            notes: updatedNotes,
          },
        }
      },
    },
    out: {
      yargs: {
        all: {
          alias: 'a',
          type: 'boolean',
          default: false,
        },
      },
      fn: async ({ all = false }) => {
        if (all) {
          return mem()
        }
        return printSong(mem())
      },
    },
    start: {
      help: {
        description: 'Start playing the song',
        examples: {
          '': 'start playing the song',
        },
      },
      fn: async () => {
        setLatestMap(mapSongToMidiTicks())

        const songPause = mem().songPauses[mem().song.name]
        if (!songPause) {
          return startCueObservable()
        }
        const pauseMidi = midiAtBar(songPause) ?? 0
        return startCueObservable(pauseMidi)
      },
    },
    stop: {
      help: {
        description: 'Stop playing the song',
        examples: {
          '': 'start playing the song',
        },
      },
      fn: async () => {
        return stopCueObservable()
      },
    },
    moveCursorTo: {
      fn: async ({ positionalNonCommands }) => {
        const tick = z.number().parse(positionalNonCommands[0])
        stopCueObservable()
        startCueObservable(tick)
      },
    },
    dl: {
      yargs: {
        played: {
          alias: 'p',
          type: 'boolean',
          default: false,
        },
      },
      fn: async ({ played = false }) => {
        const trackTempo = mem().song.tempo
        if (!played) {
          downloadSong(trackTempo, mem().latestMap)
        } else {
          downloadSong(null, mem().playedMap)
        }
      },
    },

    chord: {
      submodules: {
        last: {
          fn: async () => {
            const allNotes = Object.values(mem().notesByBar).flat()
            const lastChordLayerName = getLastChordLayerName()
            const grouped = groupNotesByFirstTagDatum(allNotes, 'layer')
              .flat()
              .filter((note) => {
                const tagData = parseNoteTags(note.tags).find(
                  ([tagName]) => tagName === 'layer'
                )
                return tagData?.[1][0] === lastChordLayerName
              })
            return grouped
          },
        },
      },
    },
  },
} as Module

function printSong(m: Mem) {
  const tracks = m.tracks.map((track) => {
    return {
      ...track,
      notesByBar: formatNotesByBar(track.notesByBar).sizes,
    }
  })
  return {
    formatted: {
      song: m.song,
      tracks,
      phases: m.phases,
      notesByBar: formatNotesByBar(m.notesByBar),
    },
  }
}

function formatNotesByBar(n: Mem['notesByBar']) {
  return {
    sizes: Object.fromEntries(
      Object.keys(n).map((barId) => {
        return [barId, n[barId].length]
      })
    ),
    abbreviated: {
      notesByBar: Object.keys(n).map((barId) => {
        return {
          barId,
          notes: Object.fromEntries(
            n[barId].map((note, idx) => [
              `${idx} in ${note.tagsObj.chord[0]} (${idx})`,
              note.tagsObj.barDelay[0],
            ])
          ),
          size: n[barId].length,
          // unique chords
          chords: [...new Set(n[barId].map((note) => note.tagsObj.chord[0]))],
        }
      }),
    },
  }
}
