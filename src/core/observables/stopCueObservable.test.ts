import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

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
vi.mock('../../lib/mapSongToTicks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/mapSongToTicks')>()),
  // Pause bookkeeping is not what these tests are about; the real one needs a
  // compiled map in mem().
  barsAtMidi: () => ['intro:0', 0],
}))

import { mem } from '../mem'

import { stopCueObservable } from './songObservables'

/** A stand-in for an rxjs Subscription that records its unsubscribe. */
const fakeSubscription = () => {
  const s = { unsubscribed: false, unsubscribe: () => (s.unsubscribed = true) }
  return s
}

describe('stopCueObservable', () => {
  let errors: unknown[][]
  let restore: () => void

  beforeEach(() => {
    errors = []
    const original = console.error
    console.error = (...args: unknown[]) => errors.push(args)
    restore = () => {
      console.error = original
    }
    mem().song = { name: 'a song' } as never
    mem().observables = {}
    mem().functions = {}
    mem().songPauses = {}
    mem().isRunning = false
    mem().adjustedCursor = 0
  })

  afterEach(() => restore())

  it('is a silent no-op for a song that was loaded but never played', () => {
    // Every song load stops the outgoing song, so this is the common path —
    // it must not report a failure when nothing is wrong.
    stopCueObservable()

    expect(errors).toEqual([])
    expect(mem().isRunning).toBe(false)
  })

  it('still reports a running song that has no subscriptions', () => {
    mem().isRunning = true

    stopCueObservable()

    expect(errors).toHaveLength(1)
    expect(String(errors[0][0])).toMatch(/no observable found for running song/)
  })

  it('unsubscribes the tick and every per-function subscription', () => {
    const tick = fakeSubscription()
    const fn = fakeSubscription()
    // startCueObservable stores both kinds in this one object.
    mem().observables['a song'] = { tick, myFn: fn } as never
    mem().functions['a song'] = { myFn: () => undefined } as never
    mem().isRunning = true

    stopCueObservable()

    expect(tick.unsubscribed).toBe(true)
    expect(fn.unsubscribed).toBe(true)
    expect(errors).toEqual([])
  })

  it('does not throw when a function is registered but nothing is subscribed', () => {
    // The removed second pass indexed mem().observables[songName] unguarded.
    mem().functions['a song'] = { myFn: () => undefined } as never

    expect(() => stopCueObservable()).not.toThrow()
  })
})
