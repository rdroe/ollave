import { beforeEach, describe, expect, it, vi } from 'vitest'

import { browser } from 'user-tables'

// See multiTrack.test.ts.
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

import { deleteSongAndRelatedTracksAndPhasesBySongId } from '../commands/song/list'
import { loadAndInitSongAndTracks } from './fetch'
import { phaseCountInner } from './util/phaseUtil'
import { BAR_TEMPLATE_TABLE } from './barTemplates/schemas'
import { countRows, resetDb, seedSong } from './util/testSongFixture'
import { compileTracksToNotesByBar } from './util/schemaUtil'

/**
 * Deleting a multi-track song must remove every track and phase, not just the
 * first track's, and must not touch another song's rows.
 */

const del = async (songId: number) =>
  (await deleteSongAndRelatedTracksAndPhasesBySongId.fn!(
    { positionalNonCommands: [songId] } as never,
    undefined as never,
    undefined as never,
    undefined as never
  )) as { formatted: Record<string, unknown> }

describe('deleting a multi-track song', () => {
  beforeEach(async () => {
    await resetDb()
  })

  const twoTrack = {
    name: 'doomed',
    tracks: [
      {
        phases: [
          { name: 'intro', barCount: 1 },
          { name: 'verse', barCount: 1, follows: ['intro'] },
        ],
      },
      { phases: [{ name: 'bassline', barCount: 1 }] },
    ],
  }

  it('removes every track, not only the first', async () => {
    const { songId } = await seedSong(twoTrack)

    await del(songId)

    expect(await countRows('track')).toBe(0)
  })

  it('removes the phases of every track', async () => {
    const { songId } = await seedSong(twoTrack)

    await del(songId)

    expect(await countRows('phase')).toBe(0)
  })

  it('removes the song row', async () => {
    const { songId } = await seedSong(twoTrack)

    await del(songId)

    expect(await countRows('song')).toBe(0)
  })

  it('leaves another song untouched', async () => {
    const { songId } = await seedSong(twoTrack)
    await seedSong({
      name: 'survivor',
      tracks: [{ phases: [{ name: 'other', barCount: 1 }] }],
    })

    await del(songId)

    expect(await countRows('song')).toBe(1)
    expect(await countRows('track')).toBe(1)
    expect(await countRows('phase')).toBe(1)
  })

  it('removes the song bar templates and bar documents', async () => {
    const { songId } = await seedSong(twoTrack)
    await browser.userTables.add(BAR_TEMPLATE_TABLE, {
      data: {
        songId,
        name: 'a template',
        phaseName: 'intro',
        barSizeMultiplier: 1,
        gestures: [],
        compiledNotes: [],
      },
      a: String(songId),
      b: 'intro',
    })
    await browser.userTables.add(BAR_TEMPLATE_TABLE, {
      data: {
        songId,
        name: 'bar intro:0',
        phaseName: 'intro',
        barSizeMultiplier: 1,
        gestures: [],
        compiledNotes: [],
        purpose: 'bar-document',
        barId: 'intro:0',
      },
      a: String(songId),
      b: 'intro',
    })

    await del(songId)

    expect(await countRows(BAR_TEMPLATE_TABLE)).toBe(0)
  })

  it('reports a missing song rather than throwing', async () => {
    const res = await del(999999)
    expect(res.formatted).toHaveProperty('error')
  })
})

/**
 * phaseCountInner is the LEGACY contract used by v1's `phase` command,
 * duplicate, and import. v2 creation lives in songApi.ts precisely so this
 * behavior can stay put; these tests pin it against accidental change.
 */
describe('phaseCountInner legacy contract', () => {
  beforeEach(async () => {
    await resetDb()
  })

  const loadOneTrack = async () => {
    const fixture = await seedSong({
      name: 'legacy',
      tracks: [{ phases: [{ name: 'main', barCount: 1 }] }],
    })
    await loadAndInitSongAndTracks(fixture.songId)
    compileTracksToNotesByBar()
    return fixture
  }

  it('creates a new phase as a ROOT, with no automatic follows edge', async () => {
    await loadOneTrack()

    await phaseCountInner('second', 1, true)

    // v2's createPhaseInTrack would default this to follow 'main'; the legacy
    // path must not, or /ollave and import would silently change meaning.
    expect(mem().phases.second['follows-ids']).toEqual([])
  })

  it('defaults to the first track when given no track id', async () => {
    const { trackIds } = await loadOneTrack()

    await phaseCountInner('second', 1, true)

    const track = mem().tracks.find((t) => t.id === trackIds[0])
    expect(track?.['phase-names']).toContain('second')
  })

  it('honours an explicit track id', async () => {
    const fixture = await seedSong({
      name: 'two track',
      tracks: [
        { phases: [{ name: 'main', barCount: 1 }] },
        { phases: [] },
      ],
    })
    await loadAndInitSongAndTracks(fixture.songId)
    compileTracksToNotesByBar()

    await phaseCountInner('second', 1, true, fixture.trackIds[1])

    expect(
      mem().tracks.find((t) => t.id === fixture.trackIds[1])?.['phase-names']
    ).toEqual(['second'])
    expect(
      mem().tracks.find((t) => t.id === fixture.trackIds[0])?.['phase-names']
    ).toEqual(['main'])
  })

  it('grows a phase to the requested bar count', async () => {
    await loadOneTrack()

    await phaseCountInner('main', 3, true)

    expect(
      Object.keys(mem().notesByBar).filter((b) => b.startsWith('main:')).sort()
    ).toEqual(['main:0', 'main:1', 'main:2'])
  })

  it('shrinks a phase to the requested bar count', async () => {
    await loadOneTrack()
    await phaseCountInner('main', 3, true)

    await phaseCountInner('main', 1, true)

    expect(
      Object.keys(mem().notesByBar).filter((b) => b.startsWith('main:'))
    ).toEqual(['main:0'])
  })

  it('returns the new phase id only when it created one', async () => {
    await loadOneTrack()

    const created = await phaseCountInner('brand-new', 1, true)
    const existing = await phaseCountInner('brand-new', 2, true)

    expect(typeof created).toBe('number')
    expect(existing).toBeNull()
  })
})
