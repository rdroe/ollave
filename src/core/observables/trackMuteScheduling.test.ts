import { describe, expect, it } from 'vitest'

// Same headless shims as playbackLoop.test.ts: masterTicksObservable assigns
// `window.airSpeedRef` at import time, so the globals must exist first.
import { vi } from 'vitest'

vi.hoisted(() => {
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  if (g.window === undefined) g.window = g
  if (g.document === undefined) {
    g.document = {
      querySelector: () => null,
      querySelectorAll: () => [] as unknown[],
      getElementById: () => null,
      createElement: () => ({ style: {}, remove: () => undefined }),
      body: { appendChild: () => undefined },
    }
  }
})

vi.mock('../../lib/music', () => ({
  playTriads: () => undefined,
  isReady: () => true,
  TRACK_IDX_IDX: 4,
  DEFAULT_TRACK_IDX: 0,
  isRelativeMusicNote: (note: unknown[]) => typeof note[0] === 'string',
}))

import { trackMuted } from '../../lib/schemas'

import { shouldPlayNote } from './songObservables'

/** Tags of an ordinary note: no mute, not the exclusive-play one. */
const PLAIN: string[] = ['barId=velvet:0']

describe('trackMuted', () => {
  it('treats a track with no stored flag as audible', () => {
    // The whole point of the optional field: songs saved before mute existed
    // must play exactly as they did before.
    expect(trackMuted({})).toBe(false)
  })

  it('reads the stored flag when present', () => {
    expect(trackMuted({ muted: true })).toBe(true)
    expect(trackMuted({ muted: false })).toBe(false)
  })
})

describe('shouldPlayNote', () => {
  it('plays an ordinary note on an unmuted track', () => {
    expect(shouldPlayNote(PLAIN, false, false)).toBe(true)
  })

  it('silences every note on a muted track', () => {
    expect(shouldPlayNote(PLAIN, true, false)).toBe(false)
  })

  it('still honours the per-note mute tag on an unmuted track', () => {
    // Track mute is coarser than, and independent of, the note tag.
    expect(shouldPlayNote([...PLAIN, 'muted=true'], false, false)).toBe(false)
  })

  it('keeps a track mute winning over exclusive play', () => {
    // Otherwise "play only this note" would punch through a muted track.
    expect(shouldPlayNote([...PLAIN, 'playExclusively=true'], true, true)).toBe(
      false
    )
  })

  it('leaves exclusive-play behaviour unchanged on an unmuted track', () => {
    expect(shouldPlayNote(PLAIN, false, true)).toBe(false)
    expect(
      shouldPlayNote([...PLAIN, 'playExclusively=true'], false, true)
    ).toBe(true)
  })
})
