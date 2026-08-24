import { beforeEach, describe, expect, it, vi } from 'vitest'

// fetch.ts legitimately depends on songObservables for song cue control, and
// that module sounds notes through lib/music.ts, which builds a Tone.js Piano
// at module scope and needs Web Audio. These tests cover persistence and
// scheduling, never audio, so the sounding layer is stubbed rather than
// stubbing enough of Web Audio to satisfy Tone's internal type assertions.
vi.mock('./music', () => ({
  playTriads: () => undefined,
  isReady: () => true,
  TRACK_IDX_IDX: 4,
  DEFAULT_TRACK_IDX: 0,
  setTrackInstruments: () => undefined,
  setTrackInstrument: () => undefined,
  getTrackInstrument: () => 'piano',
  isRelativeMusicNote: (note: unknown[]) => typeof note[0] === 'string',
}))

import { mem } from '../core/mem'

import {
  loadAndInitSongAndTracks,
  fetchSongAndTracks,
} from './fetch'
import { trackChannel, trackLabel, trackRecordSchema } from './schemas'
import {
  readSongRow,
  readTrackRow,
  resetDb,
  seedSong,
} from './util/testSongFixture'
import {
  compileTracksToNotesByBar,
  saveSongAndTracks,
} from './util/schemaUtil'

/**
 * Multi-track load/save regressions.
 *
 * The loader used to do `mem().tracks = [latestSong.tracks[0]]`, silently
 * discarding every track after the first. Because saveSongAndTracks() writes
 * back exactly what is in mem(), loading a two-track song and saving it was a
 * data-loss path for the second track's phases and notes. These tests pin both
 * halves: the load keeps all tracks, and a load/save round trip is lossless.
 */

const twoTrackSpec = {
  name: 'two track song',
  tracks: [
    {
      name: 'Lead',
      channel: 0,
      phases: [
        { name: 'intro', barCount: 2, notes: { 0: ['c3'], 1: ['e3'] } },
        { name: 'verse', barCount: 1, follows: ['intro'], notes: { 0: ['g3'] } },
      ],
    },
    {
      name: 'Bass',
      channel: 1,
      phases: [{ name: 'bassline', barCount: 2, notes: { 0: ['c2'], 1: ['g2'] } }],
    },
  ],
}

describe('multi-track loading', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('fetches every track of a multi-track song', async () => {
    const { songId } = await seedSong(twoTrackSpec)

    const fetched = await fetchSongAndTracks(songId)

    expect(fetched.tracks).toHaveLength(2)
    expect(fetched.phases.map((p) => p.name).sort()).toEqual([
      'bassline',
      'intro',
      'verse',
    ])
  })

  it('puts every track into mem(), not just the first', async () => {
    const { songId, trackIds } = await seedSong(twoTrackSpec)

    await loadAndInitSongAndTracks(songId)

    expect(mem().tracks).toHaveLength(2)
    expect(mem().tracks.map((t) => t.id)).toEqual(trackIds)
  })

  it('keeps phases of every track in mem().phases', async () => {
    const { songId } = await seedSong(twoTrackSpec)

    await loadAndInitSongAndTracks(songId)

    expect(Object.keys(mem().phases).sort()).toEqual([
      'bassline',
      'intro',
      'verse',
    ])
  })

  it('survives a load/save round trip without losing the second track', async () => {
    const { songId, trackIds } = await seedSong(twoTrackSpec)

    await loadAndInitSongAndTracks(songId)
    saveSongAndTracks()

    const secondTrack = await readTrackRow(trackIds[1])
    expect(secondTrack['phase-names']).toEqual(['bassline'])
    expect(Object.keys(secondTrack.notesByBar).sort()).toEqual([
      'bassline:0',
      'bassline:1',
    ])

    const song = await readSongRow(songId)
    expect(song['track-ids']).toHaveLength(2)
  })

  it('flattens notesByBar across tracks, since phase names are song-unique', async () => {
    const { songId } = await seedSong(twoTrackSpec)

    await loadAndInitSongAndTracks(songId)
    // compileTracksToNotesByBar (run by initLoadedSong) is what flattens the
    // per-track maps; calling it directly keeps this test about the flattening
    // rather than about initLoadedSong's observable side effects.
    compileTracksToNotesByBar()

    expect(Object.keys(mem().notesByBar).sort()).toEqual([
      'bassline:0',
      'bassline:1',
      'intro:0',
      'intro:1',
      'verse:0',
    ])
  })
})

describe('one-track backward compatibility', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('loads a legacy one-track song exactly as before', async () => {
    const { songId, trackIds } = await seedSong({
      name: 'legacy',
      tracks: [
        { phases: [{ name: 'main', barCount: 2, notes: { 0: ['c3'] } }] },
      ],
    })

    await loadAndInitSongAndTracks(songId)
    compileTracksToNotesByBar()

    expect(mem().tracks).toHaveLength(1)
    expect(mem().tracks[0].id).toBe(trackIds[0])
    expect(Object.keys(mem().notesByBar).sort()).toEqual(['main:0', 'main:1'])
  })

  it('parses a track row that has no name or channel', async () => {
    // The exact shape of every row written before 0.8.0.
    const legacyRow = {
      id: 7,
      'phase-ids': [1],
      'phase-names': ['main'],
      notesByBar: {},
    }

    const parsed = trackRecordSchema.parse(legacyRow)

    expect(parsed.name).toBeUndefined()
    expect(parsed.channel).toBeUndefined()
  })
})

describe('track metadata defaults', () => {
  it('derives a label from position when name is absent', () => {
    expect(trackLabel({}, 0)).toBe('Track 1')
    expect(trackLabel({}, 3)).toBe('Track 4')
    expect(trackLabel({ name: 'Drums' }, 3)).toBe('Drums')
  })

  it('derives a channel from index, clamped to 15, with no channel-9 skip', () => {
    expect(trackChannel({}, 0)).toBe(0)
    expect(trackChannel({}, 9)).toBe(9)
    expect(trackChannel({}, 20)).toBe(15)
    expect(trackChannel({ channel: 4 }, 0)).toBe(4)
  })

  it('accepts explicit name and channel on a track row', () => {
    const parsed = trackRecordSchema.parse({
      id: 1,
      'phase-ids': [],
      'phase-names': [],
      notesByBar: {},
      name: 'Bass',
      channel: 2,
    })

    expect(parsed.name).toBe('Bass')
    expect(parsed.channel).toBe(2)
  })

  it('rejects an out-of-range channel', () => {
    expect(() =>
      trackRecordSchema.parse({
        id: 1,
        'phase-ids': [],
        'phase-names': [],
        notesByBar: {},
        channel: 16,
      })
    ).toThrow()
  })
})
