import { describe, expect, it } from 'vitest'

import { compileGesturesToNotes } from './compile'
import { CompileCtx, Gesture, CompiledNote } from './schemas'

/**
 * P2 golden legacy-compile capture (see PLAN-HARMONY-UI.md Appendix P2).
 *
 * Captured BEFORE the O3 `attacks` branch was added to compile.ts, by
 * running the CURRENT (legacy-only) code over four fixture gestures — (a)
 * tight strum chord, (b) rolled strum with rollPattern 'decelerating' +
 * scopeSteps 2, (c) pluck with pluckIndex 1, (d) note source — and printing
 * the exact CompiledNote[]. This is the no-regression proof: it must still
 * pass after O3 with `attacks` absent on every gesture.
 *
 * `noteId=`, `groupId=`, `layer=` are randId()-generated (non-deterministic
 * per run) — stripped before comparison via `normalize`. Every other tag,
 * its VALUE, and array order is pinned exactly as captured.
 */

const normalize = (notes: CompiledNote[]): CompiledNote[] =>
  notes.map((n) => ({
    note: n.note,
    tags: n.tags.filter(
      (t) =>
        !t.startsWith('noteId=') &&
        !t.startsWith('groupId=') &&
        !t.startsWith('layer=')
    ),
  }))

describe('compileGesturesToNotes — P2 legacy golden (no attacks)', () => {
  const ctx: CompileCtx = {
    phaseName: 'verse',
    scaleTonic: 'A',
    scaleName: 'minor',
    barSizeMultiplier: 1,
    octave: '3',
  }

  const gestures: Gesture[] = [
    // (a) tight strum chord
    {
      id: 'a',
      startStep: 0,
      source: { kind: 'chord', chordName: 'Am' },
      mode: 'strum',
      direction: 'down',
      spread: 'tight',
      velocity: 90,
      durationTicks: 128,
    },
    // (b) rolled strum, rollPattern decelerating, scopeSteps 2
    {
      id: 'b',
      startStep: 4,
      source: { kind: 'chord', chordName: 'Dm' },
      mode: 'strum',
      direction: 'down',
      spread: 'rolled',
      scopeSteps: 2,
      rollPattern: 'decelerating',
      velocity: 90,
      durationTicks: 128,
    },
    // (c) pluck with pluckIndex 1
    {
      id: 'c',
      startStep: 8,
      source: { kind: 'chord', chordName: 'Em' },
      mode: 'pluck',
      pluckIndex: 1,
      direction: 'down',
      spread: 'tight',
      velocity: 90,
      durationTicks: 128,
    },
    // (d) note source
    {
      id: 'd',
      startStep: 12,
      source: { kind: 'note', note: 'C4' },
      mode: 'pluck',
      direction: 'down',
      spread: 'tight',
      velocity: 90,
      durationTicks: 128,
    },
  ]

  it('matches the captured golden CompiledNote[] at barSizeMultiplier 1', () => {
    const result = compileGesturesToNotes(gestures, ctx)
    expect(result.errors).toEqual([])
    expect(normalize(result.notes)).toEqual([
      {
        note: 'A3',
        tags: [
          'barDelay=0',
          'duration=128',
          'velocity=90',
          'quantize=0th',
          'gestureId=a',
          'roman=Im',
          'chord=Am',
        ],
      },
      {
        note: 'C4',
        tags: [
          'barDelay=4',
          'duration=128',
          'velocity=90',
          'quantize=0th',
          'gestureId=a',
          'roman=Im',
          'chord=Am',
        ],
      },
      {
        note: 'E4',
        tags: [
          'barDelay=8',
          'duration=128',
          'velocity=90',
          'quantize=0th',
          'gestureId=a',
          'roman=Im',
          'chord=Am',
        ],
      },
      {
        note: 'D3',
        tags: [
          'barDelay=128',
          'duration=128',
          'velocity=90',
          'quantize=0th',
          'gestureId=b',
          'roman=IVm',
          'chord=Dm',
        ],
      },
      {
        note: 'F3',
        tags: [
          'barDelay=135',
          'duration=128',
          'velocity=90',
          'quantize=0th',
          'gestureId=b',
          'roman=IVm',
          'chord=Dm',
        ],
      },
      {
        note: 'A3',
        tags: [
          'barDelay=156',
          'duration=128',
          'velocity=90',
          'quantize=0th',
          'gestureId=b',
          'roman=IVm',
          'chord=Dm',
        ],
      },
      {
        note: 'G3',
        tags: [
          'barDelay=256',
          'duration=128',
          'velocity=90',
          'quantize=0th',
          'gestureId=c',
          'chord=Em',
        ],
      },
      {
        note: 'C4',
        tags: [
          'barDelay=384',
          'duration=128',
          'velocity=90',
          'quantize=0th',
          'gestureId=d',
        ],
      },
    ])
  })

  it('matches the captured golden at barSizeMultiplier 2 (rolled gesture only)', () => {
    const ctx2: CompileCtx = { ...ctx, barSizeMultiplier: 2 }
    const gesture: Gesture = {
      id: 'b2',
      startStep: 4,
      source: { kind: 'chord', chordName: 'Dm' },
      mode: 'strum',
      direction: 'down',
      spread: 'rolled',
      scopeSteps: 2,
      rollPattern: 'decelerating',
      velocity: 90,
      durationTicks: 128,
    }
    const result = compileGesturesToNotes([gesture], ctx2)
    expect(result.errors).toEqual([])
    expect(normalize(result.notes)).toEqual([
      {
        note: 'D3',
        tags: [
          'barDelay=256',
          'duration=128',
          'velocity=90',
          'quantize=0th',
          'gestureId=b2',
          'roman=IVm',
          'chord=Dm',
        ],
      },
      {
        note: 'F3',
        tags: [
          'barDelay=270',
          'duration=128',
          'velocity=90',
          'quantize=0th',
          'gestureId=b2',
          'roman=IVm',
          'chord=Dm',
        ],
      },
      {
        note: 'A3',
        tags: [
          'barDelay=313',
          'duration=128',
          'velocity=90',
          'quantize=0th',
          'gestureId=b2',
          'roman=IVm',
          'chord=Dm',
        ],
      },
    ])
  })
})
