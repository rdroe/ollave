import { describe, expect, it } from 'vitest'

import {
  Aug6,
  N6,
  V64,
  chordNameWithNotes,
  detectAllScales,
  noteInversions,
  oneIndexedArr,
  romanChordNameToReal,
  romanFromProgRoman,
  rotations,
  scaleLetters,
  unromanizeSecondaryChords,
  zeroIndexedArr,
} from './graphh'

describe('array helpers', () => {
  it('oneIndexedArr', () => {
    expect(oneIndexedArr(3)).toEqual([1, 2, 3])
    expect(oneIndexedArr(0)).toEqual([])
    expect(oneIndexedArr(-1)).toEqual([])
  })

  it('zeroIndexedArr', () => {
    expect(zeroIndexedArr(3)).toEqual([0, 1, 2])
    expect(zeroIndexedArr(0)).toEqual([])
  })

  it('rotations', () => {
    expect(rotations([1, 2, 3])).toEqual([
      [2, 3, 1],
      [3, 1, 2],
    ])
  })
})

describe('scaleLetters', () => {
  it('returns the seven letters of minor keys', () => {
    expect(scaleLetters('A', 'minor')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
    expect(scaleLetters('E', 'minor')).toEqual(['E', 'F#', 'G', 'A', 'B', 'C', 'D'])
    expect(scaleLetters('C#', 'minor')).toEqual(['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B'])
  })

  it('throws for scales that are not 7 notes', () => {
    expect(() => scaleLetters('C', 'major pentatonic')).toThrow(
      /Cannot get progressions/
    )
  })
})

describe('romanFromProgRoman', () => {
  it('extracts the roman degree from a prog roman', () => {
    expect(romanFromProgRoman('IImdim')).toBe('II')
    expect(romanFromProgRoman('VIIdim')).toBe('VII')
    expect(romanFromProgRoman('bIIIm')).toBe('bIII')
  })
})

describe('romanChordNameToReal', () => {
  it('translates diatonic romans in A minor', () => {
    expect(romanChordNameToReal('A', 'minor', 'Im')).toBe('Am')
    expect(romanChordNameToReal('A', 'minor', 'IIdim')).toBe('Bdim')
    expect(romanChordNameToReal('A', 'minor', 'V')).toBe('E')
    // the subtonic major VII (natural minor) is distinct from vii°
    expect(romanChordNameToReal('A', 'minor', 'VII')).toBe('G')
  })

  it('builds VIIdim on the leading tone, not the subtonic', () => {
    // regression: minor keys used to yield the subtonic dim (Gdim in A minor)
    expect(romanChordNameToReal('A', 'minor', 'VIIdim')).toBe('G#dim')
    expect(romanChordNameToReal('C#', 'minor', 'VIIdim')).toBe('B#dim')
    // major keys were already on the leading tone
    expect(romanChordNameToReal('C', 'major', 'VIIdim')).toBe('Bdim')
  })

  it('translates in sharp keys', () => {
    expect(romanChordNameToReal('C#', 'minor', 'Im')).toBe('C#m')
  })

  it('translates secondary (slash) chords', () => {
    expect(romanChordNameToReal('A', 'minor', 'V7/III')).toBe('G7')
  })

  it('translates accidental romans as lowered/raised degrees', () => {
    // regression: 'bIII' used to come out as the garbage name 'bC' because
    // the plain III entry was replaced before the accidental was considered
    expect(romanChordNameToReal('A', 'minor', 'bII')).toBe('Bb') // Neapolitan root
    expect(romanChordNameToReal('A', 'minor', 'bIII')).toBe('B') // Cb simplified
  })

  it('returns empty string for untranslatable names', () => {
    expect(romanChordNameToReal('A', 'minor', 'xyz')).toBe('')
  })
})

describe('unromanizeSecondaryChords', () => {
  it('resolves the secondary and dominant chords', () => {
    expect(unromanizeSecondaryChords('A', 'minor', 'V7/III')).toEqual(['G7', 'C'])
  })

  it('builds secondary VII chords on the leading tone of minor targets', () => {
    // regression: minor targets used to get the subtonic (Ebdim for Fm)
    expect(unromanizeSecondaryChords('A', 'minor', 'VIIdim/VIm')).toEqual([
      'Edim',
      'Fm',
    ])
  })

  it('keeps VII targets diatonic (subtonic), not leading-tone altered', () => {
    // VIIdim/VII tonicizes the diatonic VII chord (G major in A minor);
    // its leading-tone chord is F#dim
    expect(unromanizeSecondaryChords('A', 'minor', 'VIIdim/VII')).toEqual([
      'F#dim',
      'G',
    ])
  })
})

describe('dynamic chord functions', () => {
  it('N6 in A minor', () => {
    expect(N6('A', 'minor')[0].notes).toEqual(['D', 'F', 'Bb'])
  })

  it('V64 is the cadential 6/4: tonic triad over the dominant bass', () => {
    // regression: this used to be the dominant triad in first inversion
    // (G#-B-E)
    expect(V64('A')[0].notes).toEqual(['E', 'A', 'C'])
    expect(V64('C', 'major')[0].notes).toEqual(['G', 'C', 'E'])
  })

  it('Aug6 uses classical b6-1-#4 intervals from the tonic', () => {
    // regression: minor's already-flat sixth degree used to be flattened
    // again, producing E natural instead of F
    expect(Aug6('A', 'minor')[0].notes).toEqual(['F', 'A', 'D#'])
    // correctly spelled in sharp keys
    expect(Aug6('C#', 'minor')[0].notes).toEqual(['A', 'C#', 'F##'])
  })
})

describe('chordNameWithNotes', () => {
  it('resolves plain chords with a default octave', () => {
    expect(chordNameWithNotes('C')).toEqual({
      name: 'C',
      notes: ['C3', 'E3', 'G3'],
    })
    expect(chordNameWithNotes('Cm', 4)).toEqual({
      name: 'Cm',
      notes: ['C4', 'Eb4', 'G4'],
    })
  })

  it('resolves dynamic chords when tonic and scale are given', () => {
    // regression: this branch was unreachable (lowercased name compared
    // against mixed-case keys) so V64 resolved to no notes
    const v64 = chordNameWithNotes('V64', 3, 'A', 'minor')
    expect(v64?.name).toBe('V64')
    expect(v64?.notes).toEqual(['E', 'A', 'C'])
  })

  it('resolves dynamic chords case-insensitively', () => {
    const v64 = chordNameWithNotes('v64', 3, 'A', 'minor')
    expect(v64?.notes).toEqual(['E', 'A', 'C'])
  })

  it('throws for dynamic chords without tonic and scale', () => {
    expect(() => chordNameWithNotes('V64')).toThrow(/without tonic and scale/)
  })
})

describe('detectAllScales', () => {
  it('returns empty for no notes', () => {
    expect(detectAllScales([])).toEqual([])
  })

  it('detects scales containing the notes regardless of rotation', () => {
    const names = detectAllScales(['C', 'E', 'G']).map((s) => s.name)
    expect(names).toContain('C major')
    expect(names).toContain('A minor')
    // regression: the old ascending-index check rejected scales whose
    // rotation put the notes "out of order"
    expect(names).toContain('D dorian')
    expect(names).toContain('G mixolydian')
  })

  it('excludes scales missing a note', () => {
    const names = detectAllScales(['C', 'E', 'G']).map((s) => s.name)
    expect(names).not.toContain('D major')
  })

  it('handles notes with octaves by reducing to pitch classes', () => {
    const names = detectAllScales(['E4', 'C4', 'G3']).map((s) => s.name)
    expect(names).toContain('C major')
  })
})

describe('noteInversions', () => {
  it('returns root position plus rotations', () => {
    expect(noteInversions('C')).toEqual([
      ['C3', 'E3', 'G3'],
      ['E3', 'G3', 'C3'],
      ['G3', 'C3', 'E3'],
    ])
  })
})
