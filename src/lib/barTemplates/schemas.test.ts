import { describe, expect, it } from 'vitest'

import {
  attackActionSchema,
  attackSchema,
  Gesture,
  gestureSchema,
  noteSelectionSchema,
} from './schemas'

describe('gestureSchema — additive schema changes do not disturb legacy gestures', () => {
  it('a fixture gesture built with today\'s fields round-trips byte-identically', () => {
    const legacyGesture: Gesture = {
      id: 'g1',
      startStep: 4,
      source: { kind: 'chord', chordName: 'Am' },
      mode: 'strum',
      pluckIndex: 0,
      direction: 'down',
      spread: 'rolled',
      scopeSteps: 2,
      rollPattern: 'decelerating',
      velocity: 90,
      durationTicks: 128,
      octave: 3,
      mutedToneIndices: [1],
      toneOrder: [2, 0, 1],
    }
    const parsed = gestureSchema.parse(legacyGesture)
    expect(parsed).toEqual(legacyGesture)
  })

  it('a note-source legacy gesture round-trips byte-identically', () => {
    const legacyGesture: Gesture = {
      id: 'g2',
      startStep: 0,
      source: { kind: 'note', note: 'C4' },
      mode: 'pluck',
      direction: 'up',
      spread: 'tight',
      velocity: 100,
      durationTicks: 256,
    }
    const parsed = gestureSchema.parse(legacyGesture)
    expect(parsed).toEqual(legacyGesture)
  })

  it('accepts a voicing source', () => {
    const gesture: Gesture = {
      id: 'g3',
      startStep: 0,
      source: {
        kind: 'voicing',
        pitches: ['C3', 'C4', 'E4', 'G4'],
        chord: 'C',
        roman: 'I',
      },
      mode: 'strum',
      direction: 'down',
      spread: 'tight',
      velocity: 90,
      durationTicks: 128,
    }
    expect(gestureSchema.parse(gesture)).toEqual(gesture)
  })

  it('accepts attacks on a gesture', () => {
    const gesture: Gesture = {
      id: 'g4',
      startStep: 0,
      source: { kind: 'voicing', pitches: ['C3', 'E3', 'G3'] },
      mode: 'strum',
      direction: 'down',
      spread: 'tight',
      velocity: 90,
      durationTicks: 128,
      attacks: [
        {
          offsetTicks: 0,
          selection: { kind: 'all' },
          action: { kind: 'strum', direction: 'down', spreadTicks: 0 },
        },
      ],
    }
    expect(gestureSchema.parse(gesture)).toEqual(gesture)
  })

  it('rejects an empty attacks array (min 1)', () => {
    expect(() =>
      gestureSchema.parse({
        id: 'g5',
        startStep: 0,
        source: { kind: 'note', note: 'C4' },
        mode: 'pluck',
        direction: 'up',
        spread: 'tight',
        velocity: 90,
        durationTicks: 128,
        attacks: [],
      })
    ).toThrow()
  })
})

describe('noteSelectionSchema', () => {
  it('parses all four kinds', () => {
    expect(noteSelectionSchema.parse({ kind: 'all' })).toEqual({ kind: 'all' })
    expect(
      noteSelectionSchema.parse({ kind: 'note-indexes', indexes: [0, 2] })
    ).toEqual({ kind: 'note-indexes', indexes: [0, 2] })
    expect(noteSelectionSchema.parse({ kind: 'bass' })).toEqual({
      kind: 'bass',
    })
    expect(noteSelectionSchema.parse({ kind: 'bass', count: 2 })).toEqual({
      kind: 'bass',
      count: 2,
    })
    expect(noteSelectionSchema.parse({ kind: 'treble', count: 3 })).toEqual({
      kind: 'treble',
      count: 3,
    })
  })

  it('rejects empty note-indexes', () => {
    expect(() =>
      noteSelectionSchema.parse({ kind: 'note-indexes', indexes: [] })
    ).toThrow()
  })
})

describe('attackActionSchema', () => {
  it('parses strum and pluck', () => {
    expect(
      attackActionSchema.parse({
        kind: 'strum',
        direction: 'custom',
        spreadTicks: 40,
        spreadShape: 'swung',
        customOrder: [1, 0],
      })
    ).toEqual({
      kind: 'strum',
      direction: 'custom',
      spreadTicks: 40,
      spreadShape: 'swung',
      customOrder: [1, 0],
    })
    expect(attackActionSchema.parse({ kind: 'pluck' })).toEqual({
      kind: 'pluck',
    })
  })
})

describe('attackSchema', () => {
  it('parses a minimal attack', () => {
    const attack = {
      offsetTicks: 0,
      selection: { kind: 'all' as const },
      action: { kind: 'pluck' as const },
    }
    expect(attackSchema.parse(attack)).toEqual(attack)
  })
})
