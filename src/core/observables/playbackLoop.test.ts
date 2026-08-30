import { describe, expect, it, vi, beforeEach } from 'vitest'

// masterTicksObservable assigns `window.airSpeedRef` at import time, so the
// globals have to exist BEFORE the imports below — hence vi.hoisted.
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

// Tone.js and the audio stack are irrelevant here and refuse to load headless.
vi.mock('../../lib/music', () => ({
  playTriads: () => undefined,
  isReady: () => true,
  TRACK_IDX_IDX: 4,
  DEFAULT_TRACK_IDX: 0,
  isRelativeMusicNote: (note: unknown[]) => typeof note[0] === 'string',
}))

import {
  getPlaybackLoop,
  isInsidePlaybackLoop,
  setPlaybackLoop,
} from './songObservables'

/**
 * The loop region a UI would set for "loop bars 3 and 4" of a 512-tick-per-bar
 * song: start inclusive, end exclusive.
 */
const LOOP = { start: 1024, end: 2048 }

describe('setPlaybackLoop', () => {
  beforeEach(() => setPlaybackLoop(null))

  it('holds the region it is given', () => {
    setPlaybackLoop(LOOP)
    expect(getPlaybackLoop()).toEqual(LOOP)
  })

  it('lifts the constraint when passed null', () => {
    setPlaybackLoop(LOOP)
    setPlaybackLoop(null)
    expect(getPlaybackLoop()).toBeNull()
  })

  it('treats a degenerate region as no region', () => {
    // Otherwise the scheduler would refuse to play anything at all.
    setPlaybackLoop({ start: 1024, end: 1024 })
    expect(getPlaybackLoop()).toBeNull()
  })

  it('treats an inverted region as no region', () => {
    setPlaybackLoop({ start: 2048, end: 1024 })
    expect(getPlaybackLoop()).toBeNull()
  })

  it('copies, so a caller cannot mutate the boundary afterwards', () => {
    const mutable = { start: 1024, end: 2048 }
    setPlaybackLoop(mutable)
    mutable.end = 99
    expect(getPlaybackLoop()).toEqual(LOOP)
  })
})

describe('isInsidePlaybackLoop', () => {
  it('schedules everything when no loop is set', () => {
    expect(isInsidePlaybackLoop(0, 0, null)).toBe(true)
    expect(isInsidePlaybackLoop(999999, 0, null)).toBe(true)
  })

  it('schedules a note inside the region', () => {
    expect(isInsidePlaybackLoop(1500, 1400, LOOP)).toBe(true)
  })

  it('schedules the first tick of the region', () => {
    expect(isInsidePlaybackLoop(LOOP.start, LOOP.start, LOOP)).toBe(true)
  })

  it('schedules the last tick of the region', () => {
    expect(isInsidePlaybackLoop(LOOP.end - 1, LOOP.end - 1, LOOP)).toBe(true)
  })

  // THE BUG. The lookahead reaches the excluded bar's downbeat while the
  // cursor is still inside the loop, and it used to be scheduled there.
  it('refuses the downbeat of the bar the loop excludes', () => {
    const nearTheEnd = LOOP.end - 20
    expect(isInsidePlaybackLoop(LOOP.end, nearTheEnd, LOOP)).toBe(false)
  })

  it('refuses everything further past the end too', () => {
    expect(isInsidePlaybackLoop(LOOP.end + 400, LOOP.end - 5, LOOP)).toBe(false)
  })

  // getSongCursor wraps modulo the song length, so a loop ending at the song's
  // own end sees the horizon come back round onto the opening notes.
  it('refuses notes the horizon wrapped round the song onto', () => {
    expect(isInsidePlaybackLoop(0, LOOP.end - 10, LOOP)).toBe(false)
    expect(isInsidePlaybackLoop(LOOP.start - 1, LOOP.start + 5, LOOP)).toBe(
      false
    )
  })

  // ...but a lead-in from earlier in the song is not the wrap case, and must
  // still sound: the caller only rewinds once the END is passed.
  it('still schedules a lead-in played from before the region', () => {
    expect(isInsidePlaybackLoop(300, 200, LOOP)).toBe(true)
    expect(isInsidePlaybackLoop(LOOP.start - 1, LOOP.start - 40, LOOP)).toBe(
      true
    )
  })

  it('schedules across the boundary into the region on the way in', () => {
    // Cursor before the loop, horizon reaching into it.
    expect(isInsidePlaybackLoop(LOOP.start + 10, LOOP.start - 30, LOOP)).toBe(
      true
    )
  })
})
