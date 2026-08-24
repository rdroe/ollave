import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same reason as multiTrack.test.ts: this module's import graph reaches
// lib/music.ts, which builds a Tone.js Piano at module scope and needs Web
// Audio. These tests cover the mem()/persistence half of the mutation, so the
// sounding layer is stubbed and its calls are asserted instead.
const setTrackInstrumentMock = vi.fn()
vi.mock('./music', () => ({
  playTriads: () => undefined,
  isReady: () => true,
  TRACK_IDX_IDX: 4,
  DEFAULT_TRACK_IDX: 0,
  isRelativeMusicNote: (note: unknown[]) => typeof note[0] === 'string',
  setTrackInstruments: () => undefined,
  setTrackInstrument: (trackIdx: number, name: string) =>
    setTrackInstrumentMock(trackIdx, name),
}))

import { mem } from '../core/mem'

import { loadAndInitSongAndTracks } from './fetch'
import { setTrackInstrumentAndSave } from './trackInstruments'
import { readTrackRow, resetDb, seedSong } from './util/testSongFixture'

const twoTrackSpec = {
  name: 'instrument song',
  tracks: [
    {
      name: 'Lead',
      phases: [{ name: 'intro', barCount: 1, notes: { 0: ['c3'] } }],
    },
    {
      name: 'Bass',
      phases: [{ name: 'bassline', barCount: 1, notes: { 0: ['c2'] } }],
    },
  ],
}

describe('setTrackInstrumentAndSave', () => {
  let trackIds: number[] = []

  beforeEach(async () => {
    await resetDb()
    setTrackInstrumentMock.mockClear()
    const seeded = await seedSong(twoTrackSpec)
    trackIds = seeded.trackIds
    await loadAndInitSongAndTracks(seeded.songId)
  })

  it('writes the instrument onto the in-memory track record', async () => {
    await setTrackInstrumentAndSave(trackIds[1], 'guitar-electric')

    expect(mem().tracks[1].instrument).toBe('guitar-electric')
    expect(mem().tracks[0].instrument).toBeUndefined()
  })

  it('applies the choice to live playback by track index, not track id', async () => {
    await setTrackInstrumentAndSave(trackIds[1], 'cello')

    expect(setTrackInstrumentMock).toHaveBeenCalledWith(1, 'cello')
  })

  it('persists the instrument to the stored track row', async () => {
    await setTrackInstrumentAndSave(trackIds[0], 'violin')

    const stored = await readTrackRow(trackIds[0])
    expect(stored.instrument).toBe('violin')
  })

  it('rejects an unknown instrument without touching mem or playback', async () => {
    await expect(
      setTrackInstrumentAndSave(trackIds[0], 'kazoo')
    ).rejects.toThrow(/unknown instrument: kazoo/)

    expect(mem().tracks[0].instrument).toBeUndefined()
    expect(setTrackInstrumentMock).not.toHaveBeenCalled()
  })

  it('rejects an unknown track id', async () => {
    await expect(setTrackInstrumentAndSave(9999, 'violin')).rejects.toThrow(
      /no track with id 9999/
    )

    expect(setTrackInstrumentMock).not.toHaveBeenCalled()
  })

  it('accepts a General MIDI name and persists it verbatim', async () => {
    await setTrackInstrumentAndSave(trackIds[0], 'gm:24')

    expect(mem().tracks[0].instrument).toBe('gm:24')
    expect(setTrackInstrumentMock).toHaveBeenCalledWith(0, 'gm:24')
    expect((await readTrackRow(trackIds[0])).instrument).toBe('gm:24')
  })

  it('accepts both ends of the General MIDI range', async () => {
    await setTrackInstrumentAndSave(trackIds[0], 'gm:0')
    expect(mem().tracks[0].instrument).toBe('gm:0')

    await setTrackInstrumentAndSave(trackIds[0], 'gm:127')
    expect(mem().tracks[0].instrument).toBe('gm:127')
  })

  it('still rejects garbage that only looks like a GM name', async () => {
    await expect(
      setTrackInstrumentAndSave(trackIds[0], 'gm:128')
    ).rejects.toThrow(/unknown instrument: gm:128/)
    await expect(setTrackInstrumentAndSave(trackIds[0], 'gm:')).rejects.toThrow(
      /unknown instrument/
    )
    await expect(
      setTrackInstrumentAndSave(trackIds[0], 'nonsense')
    ).rejects.toThrow(/unknown instrument: nonsense/)

    expect(mem().tracks[0].instrument).toBeUndefined()
    expect(setTrackInstrumentMock).not.toHaveBeenCalled()
  })

  it('accepts piano, the default, as an explicit choice', async () => {
    await setTrackInstrumentAndSave(trackIds[1], 'violin')
    await setTrackInstrumentAndSave(trackIds[1], 'piano')

    expect(mem().tracks[1].instrument).toBe('piano')
    expect((await readTrackRow(trackIds[1])).instrument).toBe('piano')
  })
})
