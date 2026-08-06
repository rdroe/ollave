import fakeCli from 'peprn/fakeCli'
import { Module } from 'peprn/util'
import { browser } from 'user-tables'
import { z } from 'zod'
import { createStore, useStore } from 'zustand'
import { useShallow } from 'zustand/shallow'

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
  addFileInputIfNotExists,
  clickFileInput,
  downloadJson,
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
import { updateBarDelays } from '../../lib/util/notesUtil'
import { onLoadSongCallbacks } from '../../lib/util/songUtil'
import {
  groupNotesByFirstTagDatum,
  parseNoteTags,
} from '../../lib/util/tagsUtil'

// Specific module, not the barrel — see the note in lib/fetch.ts about the
// import cycle the barrel creates.
import { exportBarTemplatesForSong } from '../../lib/barTemplates/fetch'
import { exportSongAndTracks } from '../../lib/util/schemaUtil'

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
      fn: async () => {
        // Three traps this works around:
        // 1. The old `bars <phase> fill ...` command was never registered, so
        //    this demo silently did nothing.
        // 2. fakeCli's default path collapses newlines to spaces, turning a
        //    multi-line block into one garbage command. isInternal=true skips
        //    that, letting the evaluator's own multiline queue split and run
        //    the lines sequentially.
        // 3. The evaluator is not re-entrant: fakeCli from inside a running
        //    command silently no-ops, so kick it off after this evaluation
        //    completes.
        const lines = [
          'phase aphrodite 10',
          'phase aphrodite scale C major',
          'addChord C,3 --barName aphrodite:0',
          'addChord Dm,3 --barName aphrodite:1',
          'addChord Em,3 --barName aphrodite:2',
          'addChord F,3 --barName aphrodite:3',
          'addChord G,3 --barName aphrodite:4',
          'addChord Am,3 --barName aphrodite:5',
          'addChord Bdim,3 --barName aphrodite:6',
          'arrange phase aphrodite 0th quarter half',
          'song start',
        ].join('\n')
        // Drive the textarea one line at a time with real gaps. peprn's
        // multiline paths (fakeCli isInternal and textarea paste alike) stall
        // after ~3 lines: the dataWait line-sync leaves an unresolved promise
        // that then blocks every later multiline line until reload. The
        // single-line path has no such protocol and is rock solid.
        const cliEl = document.getElementById('cli') as HTMLTextAreaElement
        if (!cliEl) {
          return { formatted: { pasteTheseLines: lines.split('\n') } }
        }
        const lineList = lines.split('\n')
        lineList.forEach((line, idx) => {
          setTimeout(
            () => {
              cliEl.value = line
              cliEl.dispatchEvent(
                new KeyboardEvent('keyup', {
                  key: 'Enter',
                  shiftKey: false,
                  bubbles: true,
                })
              )
            },
            300 + idx * 1500
          )
        })
        return {
          formatted: {
            building: `demo in phase aphrodite over ~${Math.ceil((lineList.length * 1.5))}s (stop: song stop)`,
          },
        }
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
        const loadedSong = mem().song
        if (loadedSong) afterLoadSong(loadedSong)
        const result = await initLoadedSong()
        songInvocation.getState().setReady(true)

        return result
      },
    },
    new: {
      fn: async () => {
        songInvocation.getState().setReady(false)
        await initNewSong()
        const result = await initLoadedSong()
        const newSong = mem().song
        if (newSong) afterLoadSong(newSong)
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
        const duplicatedSong = mem().song
        if (duplicatedSong) afterLoadSong(duplicatedSong)
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
        // same fallback initNewSong uses when the names list is empty
        const shiftedOff = songNames.shift() ?? `song-${Date.now()}`

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
        if (!refetched) {
          throw new Error(`created song ${createdId} not found`)
        }

        const parsedSong = songRecordSchema.parse(refetched.data)

        mem().song = {
          ...parsedSong,
          'track-ids': parsedSong['track-ids'] as [number, number][],
        }

        await fakeCli(`song track init`, 'cli')
        const initializedSong = mem().song
        if (initializedSong) afterLoadSong(initializedSong)
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
            const memSong = mem().song
            if (!memSong) {
              throw new Error('cannot init a track without a song in memory')
            }
            const trackId = await browser.userTables.add('track', {
              data: trackRecord,
            })
            await browser.userTables.update(
              'song',
              {
                id: memSong.id,
                data: {
                  'song-tracks': [[trackId, 0]],
                },
              },
              {}
            )

            const coll = await userTables.where('song', { id: memSong.id })
            const fetched = await coll.first()
            if (!fetched) {
              throw new Error(`song ${memSong.id} not found while creating track`)
            }
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
              afterLoadSong(memSong)
            } else {
              console.error('no tracks for song', memSong.id)
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

        const playSong = mem().song
        if (!playSong) {
          throw new Error('no song in memory')
        }
        const songPause = mem().songPauses[playSong.name]
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
        const downloadableSong = mem().song
        if (!downloadableSong) {
          throw new Error('no song in memory')
        }
        const trackTempo = downloadableSong.tempo
        if (!played) {
          downloadSong(trackTempo, mem().latestMap)
        } else {
          downloadSong(null, mem().playedMap)
        }
      },
    },
    export: {
      fn: async () => {
          const exportedCore = exportSongAndTracks()
          const exportableSong = mem().song
          if (!exportableSong) {
            throw new Error('no song in memory')
          }
          // Bar templates live in their own table and used to be omitted, so
          // an imported song kept its placed (locked) notes but lost the
          // templates behind them — no editing, no propagation.
          const barTemplates = await exportBarTemplatesForSong(exportableSong.id)
          const exported = { ...exportedCore, barTemplates }
          downloadJson([JSON.stringify(exported, null, 2)], `${exported.song.name.replace(/\ \<\-\ /g, '-from-')}.json`)
          return {
              formatted: {
                  exported: {
                      song: exported.song,
                      tracks: exported.tracks,
                      phases: exported.phases,

                  }
              }
          }
      }
  },

  import: {
      fn: async () => {
          addFileInputIfNotExists()
          clickFileInput()
          return Promise.resolve()
      }
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
            n[barId].map((note, idx) => {
              const groupId = note.tagsObj?.groupId?.[0]
              const noteId = note.tagsObj?.noteId?.[0]
              const groupOrNoteIdLabel = groupId ? `group ${groupId}` : noteId ? `note ${noteId}` : `index ${idx}`
              return [
              `${idx} in ${note.tagsObj?.chord?.[0] ?? `${groupOrNoteIdLabel}`}`,
              note.tagsObj.barDelay[0],
            ]
          })
          ),
          size: n[barId].length,
          // unique chords
          chords: [...new Set(n[barId].map((note) => note.tagsObj?.chord?.[0] ?? '-'))],
        }
      }),
    },
  }
}
