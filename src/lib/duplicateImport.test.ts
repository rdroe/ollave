import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

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

import {
  listBarTemplates,
  saveBarDocument,
  saveBarTemplate,
} from './barTemplates/fetch'
import {
  duplicateCurrentSong,
  importSongAndTracks,
  loadAndInitSongAndTracks,
} from './fetch'
import {
  compileTracksToNotesByBar,
  exportSongAndTracks,
} from './util/schemaUtil'
import {
  installStubDocument,
  readSongRow,
  readTrackRow,
  resetDb,
  seedSong,
} from './util/testSongFixture'

// initLoadedSong() clears .note-slider elements, so these suites need a
// document. Scoped here, not in global setup — see installStubDocument.
let restoreDocument: () => void
beforeAll(() => {
  restoreDocument = installStubDocument()
})
afterAll(() => {
  restoreDocument()
})

/**
 * Duplicate and import must preserve multi-track structure.
 *
 * Both used to call phaseCountInner() with no trackId, so every phase of every
 * track was rebuilt onto track 0: a two-track song came back as one track
 * owning everything, and follows edges were remapped through a name hash keyed
 * by the wrong ids.
 */

const twoTrackSpec = {
  name: 'original',
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
      channel: 5,
      phases: [
        { name: 'bassline', barCount: 2, notes: { 0: ['c2'], 1: ['g2'] } },
      ],
    },
  ],
}

const loadFixture = async (spec = twoTrackSpec) => {
  const fixture = await seedSong(spec)
  await loadAndInitSongAndTracks(fixture.songId)
  compileTracksToNotesByBar()
  return fixture
}

/** Track index -> sorted phase names, read back from the stored rows. */
const storedMembership = async (songId: number) => {
  const song = await readSongRow(songId)
  const out: string[][] = []
  for (const [trackId] of song['track-ids'] ?? []) {
    const track = await readTrackRow(trackId)
    out.push([...track['phase-names']].sort())
  }
  return out
}

describe('duplicateCurrentSong', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('preserves track count and order', async () => {
    await loadFixture()

    const newSongId = await duplicateCurrentSong()

    const song = await readSongRow(newSongId)
    expect(song['track-ids']).toHaveLength(2)
  })

  it('keeps each phase on its own track instead of collapsing onto track 0', async () => {
    await loadFixture()

    const newSongId = await duplicateCurrentSong()

    expect(await storedMembership(newSongId)).toEqual([
      ['intro', 'verse'],
      ['bassline'],
    ])
  })

  it('preserves track name and channel', async () => {
    await loadFixture()

    const newSongId = await duplicateCurrentSong()

    const song = await readSongRow(newSongId)
    const tracks = await Promise.all(
      (song['track-ids'] ?? []).map(([id]) => readTrackRow(id))
    )
    expect(tracks.map((t) => t.name)).toEqual(['Lead', 'Bass'])
    expect(tracks.map((t) => t.channel)).toEqual([0, 5])
  })

  it('keeps the reserved second tuple value at 0', async () => {
    await loadFixture()

    const newSongId = await duplicateCurrentSong()

    const song = await readSongRow(newSongId)
    song['track-ids']?.forEach(([, reserved]) => expect(reserved).toBe(0))
  })

  it('carries bar templates and bar documents onto the copy', async () => {
    const fixture = await loadFixture()
    await saveBarTemplate({
      songId: fixture.songId,
      name: 'intro-chord',
      phaseName: 'intro',
      barSizeMultiplier: 1,
      gestures: [],
      compiledNotes: [],
    })
    await saveBarDocument({
      songId: fixture.songId,
      name: 'bar intro:0',
      purpose: 'bar-document',
      barId: 'intro:0',
      phaseName: 'intro',
      barSizeMultiplier: 1,
      gestures: [],
      compiledNotes: [],
    })

    const newSongId = await duplicateCurrentSong()

    const copied = await listBarTemplates(newSongId)
    expect(copied.map((t) => t.name).sort()).toEqual([
      'bar intro:0',
      'intro-chord',
    ])
    // The document must still point at its bar, or the focused editor would
    // resynthesize and quietly discard the user's edits in the copy.
    const doc = copied.find((t) => t.purpose === 'bar-document')
    expect(doc?.barId).toBe('intro:0')
    // and the source song keeps its own rows
    expect(await listBarTemplates(fixture.songId)).toHaveLength(2)
  })

  it('remaps follows edges to the new phase ids', async () => {
    await loadFixture()

    await duplicateCurrentSong()

    const verse = mem().phases.verse
    const intro = mem().phases.intro
    expect(verse['follows-ids']).toEqual([intro.id])
  })

  it('keeps notes on their owning tracks', async () => {
    await loadFixture()

    const newSongId = await duplicateCurrentSong()

    const song = await readSongRow(newSongId)
    const [leadId, bassId] = (song['track-ids'] ?? []).map(([id]) => id)
    expect(Object.keys(await readTrackRow(leadId).then((t) => t.notesByBar)).sort()).toEqual(
      ['intro:0', 'intro:1', 'verse:0']
    )
    expect(Object.keys(await readTrackRow(bassId).then((t) => t.notesByBar)).sort()).toEqual(
      ['bassline:0', 'bassline:1']
    )
  })

  it('preserves per-phase bar counts', async () => {
    await loadFixture()

    await duplicateCurrentSong()

    const bars = Object.keys(mem().notesByBar).sort()
    expect(bars).toEqual([
      'bassline:0',
      'bassline:1',
      'intro:0',
      'intro:1',
      'verse:0',
    ])
  })

  it('preserves scale and barSizeMultiplier per phase', async () => {
    await loadFixture({
      name: 'scaled',
      tracks: [
        {
          phases: [
            {
              name: 'intro',
              barCount: 1,
              barSizeMultiplier: 2,
              scaleTonic: 'D',
              scaleName: 'minor',
            },
          ],
        },
      ],
    })

    await duplicateCurrentSong()

    expect(mem().phases.intro.barSizeMultiplier).toBe(2)
    expect(mem().phases.intro.scaleTonic).toBe('D')
    expect(mem().phases.intro.scaleName).toBe('minor')
  })

  it('duplicates a one-track song exactly as before', async () => {
    await loadFixture({
      name: 'legacy',
      tracks: [
        {
          phases: [
            { name: 'main', barCount: 2, notes: { 0: ['c3'], 1: ['d3'] } },
          ],
        },
      ],
    })

    const newSongId = await duplicateCurrentSong()

    expect(await storedMembership(newSongId)).toEqual([['main']])
    expect(Object.keys(mem().notesByBar).sort()).toEqual(['main:0', 'main:1'])
  })
})

describe('importSongAndTracks', () => {
  beforeEach(async () => {
    await resetDb()
  })

  /** Export the loaded fixture, then wipe and import it into a clean db. */
  const exportThenImport = async (spec = twoTrackSpec) => {
    await loadFixture(spec)
    const payload = exportSongAndTracks()
    await resetDb()
    const newSongId = await importSongAndTracks(payload)
    return newSongId
  }

  it('preserves track count and order', async () => {
    const newSongId = await exportThenImport()

    const song = await readSongRow(newSongId)
    expect(song['track-ids']).toHaveLength(2)
  })

  it('keeps phase-to-track membership', async () => {
    const newSongId = await exportThenImport()

    expect(await storedMembership(newSongId)).toEqual([
      ['intro', 'verse'],
      ['bassline'],
    ])
  })

  it('preserves track name and channel', async () => {
    const newSongId = await exportThenImport()

    const song = await readSongRow(newSongId)
    const tracks = await Promise.all(
      (song['track-ids'] ?? []).map(([id]) => readTrackRow(id))
    )
    expect(tracks.map((t) => t.name)).toEqual(['Lead', 'Bass'])
    expect(tracks.map((t) => t.channel)).toEqual([0, 5])
  })

  it('remaps follows edges to the new phase ids', async () => {
    await exportThenImport()

    expect(mem().phases.verse['follows-ids']).toEqual([mem().phases.intro.id])
  })

  it('keeps notes on their owning tracks', async () => {
    const newSongId = await exportThenImport()

    const song = await readSongRow(newSongId)
    const [leadId, bassId] = (song['track-ids'] ?? []).map(([id]) => id)
    const lead = await readTrackRow(leadId)
    const bass = await readTrackRow(bassId)
    expect(Object.keys(lead.notesByBar).sort()).toEqual([
      'intro:0',
      'intro:1',
      'verse:0',
    ])
    expect(Object.keys(bass.notesByBar).sort()).toEqual([
      'bassline:0',
      'bassline:1',
    ])
  })

  it('imports a one-track legacy export identically to before', async () => {
    const newSongId = await exportThenImport({
      name: 'legacy',
      tracks: [
        {
          phases: [
            { name: 'main', barCount: 2, notes: { 0: ['c3'], 1: ['d3'] } },
          ],
        },
      ],
    })

    expect(await storedMembership(newSongId)).toEqual([['main']])
    expect(Object.keys(mem().notesByBar).sort()).toEqual(['main:0', 'main:1'])
  })

  it('imports an export whose tracks carry no name or channel', async () => {
    const newSongId = await exportThenImport({
      name: 'no metadata',
      tracks: [
        { phases: [{ name: 'a', barCount: 1 }] },
        { phases: [{ name: 'b', barCount: 1 }] },
      ],
    })

    const song = await readSongRow(newSongId)
    expect(song['track-ids']).toHaveLength(2)
    const tracks = await Promise.all(
      (song['track-ids'] ?? []).map(([id]) => readTrackRow(id))
    )
    expect(tracks.map((t) => t.name)).toEqual([undefined, undefined])
  })

  it('preserves a multi-parent join', async () => {
    const newSongId = await exportThenImport({
      name: 'diamond',
      tracks: [
        {
          phases: [
            { name: 'a', barCount: 1 },
            { name: 'b', barCount: 1 },
            { name: 'c', barCount: 1, follows: ['a', 'b'] },
          ],
        },
      ],
    })

    expect(await storedMembership(newSongId)).toEqual([['a', 'b', 'c']])
    const cFollows = mem().phases.c['follows-ids']
    expect(cFollows.sort()).toEqual(
      [mem().phases.a.id, mem().phases.b.id].sort()
    )
  })
})
