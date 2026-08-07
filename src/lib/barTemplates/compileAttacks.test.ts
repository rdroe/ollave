import { describe, expect, it } from 'vitest'

import { compileGesturesToNotes } from './compile'
import { CompileCtx, CompiledNote, Gesture } from './schemas'

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

const ctx: CompileCtx = {
  phaseName: 'verse',
  scaleTonic: 'A',
  scaleName: 'minor',
  barSizeMultiplier: 1,
  octave: '3',
}

describe('compileGesturesToNotes — attacks branch (O3)', () => {
  it('voicing + single spread-0 attack = chorale (all pitches at base, full remaining bar with letRing)', () => {
    const g: Gesture = {
      id: 'v1',
      startStep: 0,
      source: { kind: 'voicing', pitches: ['C3', 'E3', 'G3', 'C4'] },
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
          letRing: true,
        },
      ],
    }
    const result = compileGesturesToNotes([g], ctx)
    expect(result.errors).toEqual([])
    expect(normalize(result.notes)).toEqual([
      { note: 'C3', tags: ['barDelay=0', 'duration=512', 'velocity=90', 'quantize=0th', 'gestureId=v1'] },
      { note: 'E3', tags: ['barDelay=0', 'duration=512', 'velocity=90', 'quantize=0th', 'gestureId=v1'] },
      { note: 'G3', tags: ['barDelay=0', 'duration=512', 'velocity=90', 'quantize=0th', 'gestureId=v1'] },
      { note: 'C4', tags: ['barDelay=0', 'duration=512', 'velocity=90', 'quantize=0th', 'gestureId=v1'] },
    ])
  })

  it('spread 180 decelerating roll ordering', () => {
    const g: Gesture = {
      id: 'v2',
      startStep: 0,
      source: { kind: 'voicing', pitches: ['C3', 'E3', 'G3', 'C4'] },
      mode: 'strum',
      direction: 'down',
      spread: 'tight',
      velocity: 90,
      durationTicks: 128,
      attacks: [
        {
          offsetTicks: 0,
          selection: { kind: 'all' },
          action: {
            kind: 'strum',
            direction: 'down',
            spreadTicks: 180,
            spreadShape: 'decelerating',
          },
        },
      ],
    }
    const result = compileGesturesToNotes([g], ctx)
    expect(result.errors).toEqual([])
    expect(normalize(result.notes).map((n) => [n.note, n.tags[0]])).toEqual([
      ['C3', 'barDelay=0'],
      ['E3', 'barDelay=11'],
      ['G3', 'barDelay=45'],
      ['C4', 'barDelay=101'],
    ])
  })

  it('pluck bass(1) + strum treble(3) hybrid (the bass-then-brush case)', () => {
    const g: Gesture = {
      id: 'v3',
      startStep: 0,
      source: { kind: 'voicing', pitches: ['C3', 'E3', 'G3', 'C4'] },
      mode: 'strum',
      direction: 'down',
      spread: 'tight',
      velocity: 90,
      durationTicks: 128,
      attacks: [
        {
          offsetTicks: 0,
          selection: { kind: 'bass', count: 1 },
          action: { kind: 'pluck' },
        },
        {
          offsetTicks: 8,
          selection: { kind: 'treble', count: 3 },
          action: { kind: 'strum', direction: 'down', spreadTicks: 12 },
        },
      ],
    }
    const result = compileGesturesToNotes([g], ctx)
    expect(result.errors).toEqual([])
    expect(normalize(result.notes)).toEqual([
      { note: 'C3', tags: ['barDelay=0', 'duration=128', 'velocity=90', 'quantize=0th', 'gestureId=v3'] },
      { note: 'E3', tags: ['barDelay=8', 'duration=128', 'velocity=90', 'quantize=0th', 'gestureId=v3'] },
      { note: 'G3', tags: ['barDelay=12', 'duration=128', 'velocity=90', 'quantize=0th', 'gestureId=v3'] },
      { note: 'C4', tags: ['barDelay=16', 'duration=128', 'velocity=90', 'quantize=0th', 'gestureId=v3'] },
    ])
  })

  it('note-indexes defense to empty -> CompileError for this gesture; other gestures still compile', () => {
    const bad: Gesture = {
      id: 'bad',
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
          selection: { kind: 'note-indexes', indexes: [99, 100] },
          action: { kind: 'pluck' },
        },
      ],
    }
    const good: Gesture = {
      id: 'good',
      startStep: 4,
      source: { kind: 'note', note: 'C4' },
      mode: 'pluck',
      direction: 'down',
      spread: 'tight',
      velocity: 90,
      durationTicks: 128,
    }
    const result = compileGesturesToNotes([bad, good], ctx)
    expect(result.errors).toEqual([
      { gestureId: 'bad', message: 'note-indexes selection is empty after defense' },
    ])
    expect(normalize(result.notes)).toEqual([
      { note: 'C4', tags: ['barDelay=128', 'duration=128', 'velocity=90', 'quantize=0th', 'gestureId=good'] },
    ])
  })

  it('letRing duration math at barSizeMultiplier 1', () => {
    const g: Gesture = {
      id: 'lr1',
      startStep: 4,
      source: { kind: 'voicing', pitches: ['C3'] },
      mode: 'strum',
      direction: 'down',
      spread: 'tight',
      velocity: 90,
      durationTicks: 128,
      attacks: [
        {
          offsetTicks: 10,
          selection: { kind: 'all' },
          action: { kind: 'pluck' },
          letRing: true,
        },
      ],
    }
    const result = compileGesturesToNotes([g], ctx)
    expect(result.errors).toEqual([])
    // gestureStartTick = 4 * stepTicks(1) = 4*32=128; base=128+10=138
    // barTicks = 512*1=512; duration = 512-138=374
    expect(normalize(result.notes)).toEqual([
      { note: 'C3', tags: ['barDelay=138', 'duration=374', 'velocity=90', 'quantize=0th', 'gestureId=lr1'] },
    ])
  })

  it('letRing duration math at barSizeMultiplier 2', () => {
    const g: Gesture = {
      id: 'lr1',
      startStep: 4,
      source: { kind: 'voicing', pitches: ['C3'] },
      mode: 'strum',
      direction: 'down',
      spread: 'tight',
      velocity: 90,
      durationTicks: 128,
      attacks: [
        {
          offsetTicks: 10,
          selection: { kind: 'all' },
          action: { kind: 'pluck' },
          letRing: true,
        },
      ],
    }
    const ctx2 = { ...ctx, barSizeMultiplier: 2 }
    const result = compileGesturesToNotes([g], ctx2)
    expect(result.errors).toEqual([])
    // gestureStartTick = 4 * stepTicks(2) = 4*64=256; base=256+10=266
    // barTicks = 512*2=1024; duration = 1024-266=758
    expect(normalize(result.notes)).toEqual([
      { note: 'C3', tags: ['barDelay=266', 'duration=758', 'velocity=90', 'quantize=0th', 'gestureId=lr1'] },
    ])
  })

  it('chord source still works through the attacks branch (provenance tags from parseChordCsvArg)', () => {
    const g: Gesture = {
      id: 'c1',
      startStep: 0,
      source: { kind: 'chord', chordName: 'Am' },
      mode: 'strum',
      direction: 'down',
      spread: 'tight',
      velocity: 90,
      durationTicks: 128,
      attacks: [
        {
          offsetTicks: 0,
          selection: { kind: 'all' },
          action: { kind: 'pluck' },
        },
      ],
    }
    const result = compileGesturesToNotes([g], ctx)
    expect(result.errors).toEqual([])
    expect(normalize(result.notes).map((n) => n.note)).toEqual(['A3', 'C4', 'E4'])
    expect(result.notes[0].tags).toEqual(
      expect.arrayContaining(['roman=Im', 'chord=Am'])
    )
  })

  it('voicing source with an unparsable pitch -> CompileError, non-fatal', () => {
    const g: Gesture = {
      id: 'bad2',
      startStep: 0,
      source: { kind: 'voicing', pitches: ['not-a-note'] },
      mode: 'strum',
      direction: 'down',
      spread: 'tight',
      velocity: 90,
      durationTicks: 128,
      attacks: [
        { offsetTicks: 0, selection: { kind: 'all' }, action: { kind: 'pluck' } },
      ],
    }
    const result = compileGesturesToNotes([g], ctx)
    expect(result.notes).toEqual([])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].gestureId).toBe('bad2')
  })

  it('per-attack velocity and durationTicks override the gesture defaults', () => {
    const g: Gesture = {
      id: 'v4',
      startStep: 0,
      source: { kind: 'voicing', pitches: ['C3'] },
      mode: 'strum',
      direction: 'down',
      spread: 'tight',
      velocity: 90,
      durationTicks: 128,
      attacks: [
        {
          offsetTicks: 0,
          selection: { kind: 'all' },
          action: { kind: 'pluck' },
          velocity: 50,
          durationTicks: 999,
        },
      ],
    }
    const result = compileGesturesToNotes([g], ctx)
    expect(normalize(result.notes)).toEqual([
      { note: 'C3', tags: ['barDelay=0', 'duration=999', 'velocity=50', 'quantize=0th', 'gestureId=v4'] },
    ])
  })
})
