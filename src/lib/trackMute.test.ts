import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same reason as trackInstruments.test.ts: this module's import graph reaches
// lib/music.ts, which builds a Tone.js Piano at module scope and needs Web
// Audio. Mute has no sounding-layer call of its own (the scheduler re-reads
// mem() every tick), so the stub exists purely to keep the graph loadable.
vi.mock('./music', () => ({
  playTriads: () => undefined,
  isReady: () => true,
  TRACK_IDX_IDX: 4,
  DEFAULT_TRACK_IDX: 0,
  isRelativeMusicNote: (note: unknown[]) => typeof note[0] === 'string',
  setTrackInstruments: () => undefined,
  setTrackInstrument: () => undefined,
}))

import { mem } from '../core/mem'

import { loadAndInitSongAndTracks } from './fetch'
import { setTrackMutedAndSave } from './trackMute'
import { readTrackRow, resetDb, seedSong } from './util/testSongFixture'

const twoTrackSpec = {
  name: 'mute song',
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

describe('setTrackMutedAndSave', () => {
  let trackIds: number[] = []
  let songId = 0

  beforeEach(async () => {
    await resetDb()
    const seeded = await seedSong(twoTrackSpec)
    trackIds = seeded.trackIds
    songId = seeded.songId
    await loadAndInitSongAndTracks(songId)
  })

  it('leaves a freshly seeded track unmuted', async () => {
    // Absent, not `false`: old rows must not be rewritten just to gain the flag.
    expect(mem().tracks[0].muted).toBeUndefined()
    expect((await readTrackRow(trackIds[0])).muted).toBeUndefined()
  })

  it('mutes only the track it is given', async () => {
    await setTrackMutedAndSave(trackIds[1], true)

    expect(mem().tracks[1].muted).toBe(true)
    expect(mem().tracks[0].muted).toBeUndefined()
  })

  it('persists the mute to the stored track row', async () => {
    await setTrackMutedAndSave(trackIds[0], true)

    expect((await readTrackRow(trackIds[0])).muted).toBe(true)
  })

  it('unmutes again, and persists that too', async () => {
    await setTrackMutedAndSave(trackIds[0], true)
    await setTrackMutedAndSave(trackIds[0], false)

    expect(mem().tracks[0].muted).toBe(false)
    expect((await readTrackRow(trackIds[0])).muted).toBe(false)
  })

  it('survives a reload, which is the whole point of persisting it', async () => {
    await setTrackMutedAndSave(trackIds[1], true)

    // Re-init from storage: this is the path a page refresh takes, and it is
    // where an unpersisted flag (or one the schema drops) would vanish.
    await loadAndInitSongAndTracks(songId)

    expect(mem().tracks[1].muted).toBe(true)
    expect(mem().tracks[0].muted).toBeUndefined()
  })

  it('rejects an unknown track id', async () => {
    await expect(setTrackMutedAndSave(9999, true)).rejects.toThrow(
      /no track with id 9999/
    )
  })
})
