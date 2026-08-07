import { describe, expect, it } from 'vitest'

import {
  albertiAttacks,
  arpDownAttacks,
  arpUpAttacks,
  arpUpDownAttacks,
  blockAttack,
} from './attackPresets'
import { compileGesturesToNotes } from './compile'
import { CompileCtx, Gesture } from './schemas'

describe('blockAttack', () => {
  it('is a single all-selection down-strum with spreadTicks 0', () => {
    expect(blockAttack()).toEqual([
      {
        offsetTicks: 0,
        selection: { kind: 'all' },
        action: { kind: 'strum', direction: 'down', spreadTicks: 0 },
      },
    ])
  })

  it('spreads options onto the attack', () => {
    expect(blockAttack({ velocity: 70, durationTicks: 999, letRing: true })).toEqual([
      {
        offsetTicks: 0,
        selection: { kind: 'all' },
        action: { kind: 'strum', direction: 'down', spreadTicks: 0 },
        velocity: 70,
        durationTicks: 999,
        letRing: true,
      },
    ])
  })
})

describe('arpUpAttacks', () => {
  it('cycles 0,1,2,3,0,1,2,3,… at consecutive subdivision offsets', () => {
    const attacks = arpUpAttacks({ count: 6, subdivisionTicks: 10 })
    expect(attacks.map((a) => a.offsetTicks)).toEqual([0, 10, 20, 30, 40, 50])
    expect(
      attacks.map((a) =>
        a.selection.kind === 'note-indexes' ? a.selection.indexes[0] : null
      )
    ).toEqual([0, 1, 2, 3, 0, 1])
    expect(attacks.every((a) => a.action.kind === 'pluck')).toBe(true)
  })
})

describe('arpDownAttacks', () => {
  it('cycles 3,2,1,0,3,2,1,0,…', () => {
    const attacks = arpDownAttacks({ count: 5, subdivisionTicks: 8 })
    expect(
      attacks.map((a) =>
        a.selection.kind === 'note-indexes' ? a.selection.indexes[0] : null
      )
    ).toEqual([3, 2, 1, 0, 3])
  })
})

describe('arpUpDownAttacks', () => {
  it('cycles 0,1,2,3,2,1,0,1,…', () => {
    const attacks = arpUpDownAttacks({ count: 8, subdivisionTicks: 4 })
    expect(
      attacks.map((a) =>
        a.selection.kind === 'note-indexes' ? a.selection.indexes[0] : null
      )
    ).toEqual([0, 1, 2, 3, 2, 1, 0, 1])
  })
})

describe('albertiAttacks', () => {
  it('is low-high-middle-high per cycle: [0],[2],[1],[2]', () => {
    const attacks = albertiAttacks({ cycles: 2, subdivisionTicks: 16 })
    expect(attacks).toHaveLength(8)
    expect(
      attacks.map((a) =>
        a.selection.kind === 'note-indexes' ? a.selection.indexes[0] : null
      )
    ).toEqual([0, 2, 1, 2, 0, 2, 1, 2])
    expect(attacks.map((a) => a.offsetTicks)).toEqual([
      0, 16, 32, 48, 64, 80, 96, 112,
    ])
  })
})

describe('presets compile through compileGesturesToNotes (integration with compile-time defense)', () => {
  const ctx: CompileCtx = {
    phaseName: 'verse',
    scaleTonic: 'A',
    scaleName: 'minor',
    barSizeMultiplier: 1,
    octave: '3',
  }

  it('arpUpAttacks over a 4-note voicing plays every cycled index in range', () => {
    const g: Gesture = {
      id: 'g1',
      startStep: 0,
      source: { kind: 'voicing', pitches: ['C3', 'E3', 'G3', 'C4'] },
      mode: 'strum',
      direction: 'down',
      spread: 'tight',
      velocity: 90,
      durationTicks: 128,
      attacks: arpUpAttacks({ count: 4, subdivisionTicks: 8 }),
    }
    const result = compileGesturesToNotes([g], ctx)
    expect(result.errors).toEqual([])
    expect(result.notes.map((n) => n.note)).toEqual(['C3', 'E3', 'G3', 'C4'])
  })

  it('arpUpAttacks cycling an out-of-range index against a smaller voicing errors that gesture non-fatally (single-attack selections have no fallback)', () => {
    const g: Gesture = {
      id: 'g1b',
      startStep: 0,
      source: { kind: 'voicing', pitches: ['C3', 'E3', 'G3'] },
      mode: 'strum',
      direction: 'down',
      spread: 'tight',
      velocity: 90,
      durationTicks: 128,
      // cycle includes index 3, out of range for a 3-note voicing
      attacks: arpUpAttacks({ count: 4, subdivisionTicks: 8 }),
    }
    const result = compileGesturesToNotes([g], ctx)
    expect(result.notes).toEqual([])
    expect(result.errors).toEqual([
      { gestureId: 'g1b', message: 'note-indexes selection is empty after defense' },
    ])
  })

  it('albertiAttacks over a full 4-note voicing plays low-high-middle-high', () => {
    const g: Gesture = {
      id: 'g2',
      startStep: 0,
      source: { kind: 'voicing', pitches: ['C3', 'E3', 'G3', 'C4'] },
      mode: 'strum',
      direction: 'down',
      spread: 'tight',
      velocity: 90,
      durationTicks: 128,
      attacks: albertiAttacks({ cycles: 1, subdivisionTicks: 8 }),
    }
    const result = compileGesturesToNotes([g], ctx)
    expect(result.errors).toEqual([])
    expect(result.notes.map((n) => n.note)).toEqual(['C3', 'G3', 'E3', 'G3'])
  })
})
