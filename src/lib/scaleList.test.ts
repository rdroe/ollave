import { describe, expect, it } from 'vitest'

import {
  conventionalKeys,
  conventionalMajorTonics,
  conventionalMinorTonics,
  dedupeEnharmonicScales,
  isConventionalKeyName,
} from './scaleList'

describe('conventional key data', () => {
  it('has exactly the 15 major and 15 minor keys of the circle of fifths', () => {
    expect(conventionalMajorTonics).toEqual([
      'Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F',
      'C',
      'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
    ])
    expect(conventionalMinorTonics).toEqual([
      'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D',
      'A',
      'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#',
    ])
  })

  it('resolves all 30 keys to real seven-note scales', () => {
    expect(conventionalKeys).toHaveLength(30)
    for (const key of conventionalKeys) {
      expect(key.notes, key.name).toHaveLength(7)
    }
  })

  it('includes Cb major, which the raw note-name list cannot produce', () => {
    // `noteNames` in graphh.ts has no 'Cb', so `allScales` has no Cb major at
    // all — yet it is a conventional key (7 flats, the enharmonic of B major).
    const cb = conventionalKeys.find((k) => k.name === 'Cb major')
    expect(cb?.notes).toEqual(['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb'])
  })

  it('keeps both members of the enharmonic key pairs at the rim', () => {
    // Gb/F# major and Eb/D# minor are both real keys; a curated list must not
    // drop either, even though they sound identical.
    const names = conventionalKeys.map((k) => k.name)
    expect(names).toContain('Gb major')
    expect(names).toContain('F# major')
    expect(names).toContain('Eb minor')
    expect(names).toContain('D# minor')
  })

  it('keeps the sharp keys a min-accidental rule would wrongly discard', () => {
    // C# major (7 sharps) vs Db major (5 flats), A# minor (7) vs Bb minor (5),
    // Ab minor (7) vs G# minor (5): the heavier spelling is still a real key.
    const names = conventionalKeys.map((k) => k.name)
    for (const n of ['C# major', 'Db major', 'A# minor', 'Bb minor', 'Ab minor', 'G# minor']) {
      expect(names, n).toContain(n)
    }
  })

  it('contains no double-accidental tonics', () => {
    const bad = conventionalKeys
      .map((k) => k.name)
      .filter((n) => /bb|##/.test(n.split(' ')[0]))
    expect(bad).toEqual([])
  })
})

describe('isConventionalKeyName', () => {
  it('accepts the real keys', () => {
    expect(isConventionalKeyName('C major')).toBe(true)
    expect(isConventionalKeyName('F# major')).toBe(true)
    expect(isConventionalKeyName('Ab minor')).toBe(true)
  })

  it('rejects double-accidental spelling artifacts', () => {
    expect(isConventionalKeyName('Dbb major')).toBe(false)
    expect(isConventionalKeyName('G## minor')).toBe(false)
    expect(isConventionalKeyName('F## major')).toBe(false)
  })

  it('rejects single-accidental spellings that are not keys', () => {
    // D# major (9 sharps) and Gb minor (9 flats) need double accidentals in
    // their signatures, so they are not notated keys despite looking plausible
    expect(isConventionalKeyName('D# major')).toBe(false)
    expect(isConventionalKeyName('Gb minor')).toBe(false)
  })

  it('rejects modes other than major and minor, and malformed input', () => {
    expect(isConventionalKeyName('D dorian')).toBe(false)
    expect(isConventionalKeyName('C')).toBe(false)
    expect(isConventionalKeyName('')).toBe(false)
  })
})

describe('dedupeEnharmonicScales', () => {
  it('groups by mode as well as pitch, so relative keys both survive', () => {
    // C major and A minor share all seven pitch classes. Grouping by pitch
    // alone would collapse them into one entry and delete half the keys.
    const input = [
      { name: 'C major', notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] },
      { name: 'A minor', notes: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },
    ]
    expect(dedupeEnharmonicScales(input).map((s) => s.name)).toEqual([
      'C major',
      'A minor',
    ])
  })

  it('collapses a conventional key with its double-accidental twin', () => {
    const input = [
      { name: 'Dbb major', notes: ['Dbb', 'Ebb', 'Fb', 'Gbb', 'Abb', 'Bbb', 'Cb'] },
      { name: 'C major', notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] },
    ]
    // C major wins on being conventional, regardless of input order
    expect(dedupeEnharmonicScales(input).map((s) => s.name)).toEqual(['C major'])
  })

  it('prefers the flat spelling when both spellings tie', () => {
    const input = [
      { name: 'F# major', notes: ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'] },
      { name: 'Gb major', notes: ['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F'] },
    ]
    // both are conventional and both carry 6 accidentals, so the documented
    // flat-preferring tie-break decides
    expect(dedupeEnharmonicScales(input).map((s) => s.name)).toEqual(['Gb major'])
  })

  it('falls back to fewest accidentals when no member is conventional', () => {
    const input = [
      { name: 'D# dorian', notes: ['D#', 'E#', 'F#', 'G#', 'A#', 'B#', 'C#'] },
      { name: 'Eb dorian', notes: ['Eb', 'F', 'Gb', 'Ab', 'Bb', 'C', 'Db'] },
    ]
    expect(dedupeEnharmonicScales(input).map((s) => s.name)).toEqual(['Eb dorian'])
  })

  it('leaves a list with no duplicates untouched', () => {
    const input = [
      { name: 'C major', notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] },
      { name: 'G major', notes: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'] },
    ]
    expect(dedupeEnharmonicScales(input).map((s) => s.name)).toEqual([
      'C major',
      'G major',
    ])
  })

  it('handles the empty list', () => {
    expect(dedupeEnharmonicScales([])).toEqual([])
  })
})
