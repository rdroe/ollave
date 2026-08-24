import { beforeEach, describe, expect, it, vi } from 'vitest'

// See multiTrack.test.ts: fetch.ts reaches lib/music.ts through
// songObservables, which builds a Tone.js Piano at module scope.
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

import { loadAndInitSongAndTracks } from './fetch'
import { createPhaseInTrack, createTrack } from './songApi'
import { trackChannel, trackLabel } from './schemas'
import { compileTracksToNotesByBar } from './util/schemaUtil'
import {
  readSongRow,
  readTrackRow,
  readPhaseRow,
  resetDb,
  seedSong,
} from './util/testSongFixture'

/**
 * The v2 current-song track/phase APIs.
 *
 * These are new entry points precisely so the legacy phaseCountInner()
 * contract (v1 / duplicate / import) stays untouched: see phaseUtil.test.ts.
 */

const baseSpec = {
  name: 'api song',
  tracks: [
    {
      name: 'Lead',
      channel: 0,
      phases: [{ name: 'intro', barCount: 2 }],
    },
  ],
}

describe('createTrack', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('appends to track-ids instead of clobbering existing tracks', async () => {
    const { songId, trackIds } = await seedSong(baseSpec)
    await loadAndInitSongAndTracks(songId)

    const newTrackId = await createTrack()

    const song = await readSongRow(songId)
    expect(song['track-ids']).toEqual([
      [trackIds[0], 0],
      [newTrackId, 0],
    ])
  })

  it('keeps the reserved second tuple value at 0', async () => {
    const { songId } = await seedSong(baseSpec)
    await loadAndInitSongAndTracks(songId)

    await createTrack()

    const song = await readSongRow(songId)
    song['track-ids']?.forEach(([, reserved]) => {
      expect(reserved).toBe(0)
    })
  })

  it('backfills the created row id into the track record', async () => {
    const { songId } = await seedSong(baseSpec)
    await loadAndInitSongAndTracks(songId)

    const newTrackId = await createTrack()

    const row = await readTrackRow(newTrackId)
    expect(row.id).toBe(newTrackId)
    expect(row['phase-ids']).toEqual([])
    expect(row['phase-names']).toEqual([])
  })

  it('pushes the new track onto mem().tracks', async () => {
    const { songId } = await seedSong(baseSpec)
    await loadAndInitSongAndTracks(songId)

    const newTrackId = await createTrack()

    expect(mem().tracks).toHaveLength(2)
    expect(mem().tracks[1].id).toBe(newTrackId)
  })

  it('stores an explicit name and channel', async () => {
    const { songId } = await seedSong(baseSpec)
    await loadAndInitSongAndTracks(songId)

    const newTrackId = await createTrack({ name: 'Bass', channel: 3 })

    const row = await readTrackRow(newTrackId)
    expect(row.name).toBe('Bass')
    expect(row.channel).toBe(3)
  })

  it('leaves name and channel absent when not supplied, so defaults derive', async () => {
    const { songId } = await seedSong(baseSpec)
    await loadAndInitSongAndTracks(songId)

    const newTrackId = await createTrack()
    const row = await readTrackRow(newTrackId)

    expect(row.name).toBeUndefined()
    expect(row.channel).toBeUndefined()
    expect(trackLabel(row, 1)).toBe('Track 2')
    expect(trackChannel(row, 1)).toBe(1)
  })

  it('rejects an out-of-range channel before writing anything', async () => {
    const { songId } = await seedSong(baseSpec)
    await loadAndInitSongAndTracks(songId)

    await expect(createTrack({ channel: 16 })).rejects.toThrow()

    const song = await readSongRow(songId)
    expect(song['track-ids']).toHaveLength(1)
  })

  it('throws when no song is loaded', async () => {
    await resetDb()
    await expect(createTrack()).rejects.toThrow(/no song/i)
  })
})

describe('createPhaseInTrack', () => {
  beforeEach(async () => {
    await resetDb()
  })

  const loadTwoTracks = async () => {
    const fixture = await seedSong({
      name: 'two track',
      tracks: [
        { name: 'Lead', phases: [{ name: 'intro', barCount: 2 }] },
        { name: 'Bass', phases: [] },
      ],
    })
    await loadAndInitSongAndTracks(fixture.songId)
    // The real load path (initLoadedSong) flattens the per-track bar maps into
    // mem().notesByBar. Without it compilePhasesToTracks() sees no active bars
    // and prunes every existing phase, so this mirrors app behavior.
    compileTracksToNotesByBar()
    return fixture
  }

  it('creates a phase on the requested track, not track 0', async () => {
    const { trackIds } = await loadTwoTracks()

    const phaseId = await createPhaseInTrack({
      trackId: trackIds[1],
      name: 'bassline',
      barCount: 2,
      scaleTonic: 'C',
      scaleName: 'major',
    })

    const bassTrack = await readTrackRow(trackIds[1])
    expect(bassTrack['phase-names']).toEqual(['bassline'])
    expect(bassTrack['phase-ids']).toEqual([phaseId])

    const leadTrack = await readTrackRow(trackIds[0])
    expect(leadTrack['phase-names']).toEqual(['intro'])
  })

  it('creates the requested number of bars', async () => {
    const { trackIds } = await loadTwoTracks()

    await createPhaseInTrack({
      trackId: trackIds[1],
      name: 'bassline',
      barCount: 3,
      scaleTonic: 'C',
      scaleName: 'major',
    })

    expect(Object.keys(mem().notesByBar).filter((b) => b.startsWith('bassline:')).sort()).toEqual([
      'bassline:0',
      'bassline:1',
      'bassline:2',
    ])
  })

  it('defaults follows to the target track last phase', async () => {
    const { trackIds, phaseIdsByName } = await loadTwoTracks()

    const phaseId = await createPhaseInTrack({
      trackId: trackIds[0],
      name: 'verse',
      barCount: 1,
      scaleTonic: 'C',
      scaleName: 'major',
    })

    const row = await readPhaseRow(phaseId)
    expect(row['follows-ids']).toEqual([phaseIdsByName.intro])
    // memory must agree with the DB — the old inner helper wrote ids to the
    // row but [] to mem(), so the two drifted until the next reload.
    expect(mem().phases.verse['follows-ids']).toEqual([phaseIdsByName.intro])
  })

  it('creates a root phase when the target track is empty', async () => {
    const { trackIds } = await loadTwoTracks()

    const phaseId = await createPhaseInTrack({
      trackId: trackIds[1],
      name: 'bassline',
      barCount: 1,
      scaleTonic: 'C',
      scaleName: 'major',
    })

    const row = await readPhaseRow(phaseId)
    expect(row['follows-ids']).toEqual([])
  })

  it('honours explicit followsPhaseIds, including an explicit root', async () => {
    const { trackIds, phaseIdsByName } = await loadTwoTracks()

    const rootId = await createPhaseInTrack({
      trackId: trackIds[0],
      name: 'parallel',
      barCount: 1,
      scaleTonic: 'C',
      scaleName: 'major',
      followsPhaseIds: [],
    })
    expect((await readPhaseRow(rootId))['follows-ids']).toEqual([])

    const joinId = await createPhaseInTrack({
      trackId: trackIds[0],
      name: 'join',
      barCount: 1,
      scaleTonic: 'C',
      scaleName: 'major',
      followsPhaseIds: [phaseIdsByName.intro, rootId],
    })
    expect((await readPhaseRow(joinId))['follows-ids']).toEqual([
      phaseIdsByName.intro,
      rootId,
    ])
  })

  it('stores scale tonic and name', async () => {
    const { trackIds } = await loadTwoTracks()

    const phaseId = await createPhaseInTrack({
      trackId: trackIds[1],
      name: 'bassline',
      barCount: 1,
      scaleTonic: 'D',
      scaleName: 'minor',
    })

    const row = await readPhaseRow(phaseId)
    expect(row.scaleTonic).toBe('D')
    expect(row.scaleName).toBe('minor')
  })

  it('rejects a duplicate phase name song-wide, across tracks', async () => {
    const { trackIds } = await loadTwoTracks()

    // 'intro' already exists on track 0; creating it on track 1 must fail,
    // because bar ids are `${phaseName}:${index}` song-wide.
    await expect(
      createPhaseInTrack({
        trackId: trackIds[1],
        name: 'intro',
        barCount: 1,
        scaleTonic: 'C',
        scaleName: 'major',
      })
    ).rejects.toThrow(/already exists/i)
  })

  it('rejects an unknown track id without creating a phase', async () => {
    await loadTwoTracks()
    const before = Object.keys(mem().phases).length

    await expect(
      createPhaseInTrack({
        trackId: 99999,
        name: 'nope',
        barCount: 1,
        scaleTonic: 'C',
        scaleName: 'major',
      })
    ).rejects.toThrow(/track/i)

    expect(Object.keys(mem().phases)).toHaveLength(before)
  })

  it('rejects a parent id that does not exist', async () => {
    const { trackIds } = await loadTwoTracks()

    await expect(
      createPhaseInTrack({
        trackId: trackIds[1],
        name: 'bassline',
        barCount: 1,
        scaleTonic: 'C',
        scaleName: 'major',
        followsPhaseIds: [424242],
      })
    ).rejects.toThrow(/parent|follow/i)
  })

  it('rejects a barCount below 1', async () => {
    const { trackIds } = await loadTwoTracks()

    await expect(
      createPhaseInTrack({
        trackId: trackIds[1],
        name: 'bassline',
        barCount: 0,
        scaleTonic: 'C',
        scaleName: 'major',
      })
    ).rejects.toThrow(/bar/i)
  })

  it('persists the new phase membership to the track row', async () => {
    const { trackIds } = await loadTwoTracks()

    await createPhaseInTrack({
      trackId: trackIds[1],
      name: 'bassline',
      barCount: 1,
      scaleTonic: 'C',
      scaleName: 'major',
    })

    // The API finishes with one compile/save, so the row is already current.
    const row = await readTrackRow(trackIds[1])
    expect(row['phase-names']).toEqual(['bassline'])
    expect(Object.keys(row.notesByBar)).toEqual(['bassline:0'])
  })
})
