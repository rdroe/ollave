import { describe, expect, it } from 'vitest'

import {
  Aug6,
  N6,
  V64,
  allScales,
  chordNameWithNotes,
  conventionalKeys,
  detectAllScales,
  distinctScales,
  makeProgNodeTranslator,
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

  // C2: the root is the lowered second degree, derived by transposing a minor
  // second from the tonic. Flattening the scale's own second degree and
  // simplifying used to respell into the wrong key signature: Eb major's
  // Neapolitan came out E-G#-B instead of Fb-Ab-Cb.
  it('N6 keeps flat-key spelling instead of respelling enharmonically', () => {
    expect(N6('Eb', 'major')[0].notes).toEqual(['Ab', 'Cb', 'Fb'])
    expect(N6('Ab', 'major')[0].notes).toEqual(['Db', 'Fb', 'Bbb'])
    // double flats where they genuinely belong
    expect(N6('Db', 'major')[0].notes).toEqual(['Gb', 'Bbb', 'Ebb'])
  })

  it('N6 is unchanged in keys whose lowered second is a single accidental', () => {
    expect(N6('C', 'major')[0].notes).toEqual(['F', 'Ab', 'Db'])
    expect(N6('C', 'minor')[0].notes).toEqual(['F', 'Ab', 'Db'])
    expect(N6('F#', 'major')[0].notes).toEqual(['B', 'D', 'G'])
    // the Neapolitan root depends only on the tonic, so both modes agree
    expect(N6('A', 'major')[0].notes).toEqual(N6('A', 'minor')[0].notes)
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

  // C1: name matching is primary. Enharmonic spellings of the same pitches are
  // NOT collapsed while a name match exists, because `allScales` is built over
  // a note-name list including double accidentals — matching by pitch would
  // report 'Dbb major' and 'F## major' as containing a C major triad.
  it('matches by name, not by pitch, when a name match exists', () => {
    const names = detectAllScales(['C', 'E', 'G']).map((s) => s.name)
    expect(names).not.toContain('Dbb major')
    expect(names).not.toContain('F## major')
    expect(names).not.toContain('G## minor')
    // the six real keys containing the triad, and no other major/minor key
    const keys = names.filter(
      (n) => n.endsWith(' major') || n.endsWith(' minor')
    )
    expect(keys).toEqual([
      'C major',
      'F major',
      'G major',
      'D minor',
      'E minor',
      'A minor',
    ])
  })

  // C1: ...but a mis-spelled chord used to find NO key at all, which is never
  // a useful answer. The enharmonic fallback runs only when name matching
  // comes up empty.
  it('falls back to enharmonic matching only when no name match exists', () => {
    // an audible C# major triad with its third written F instead of E#
    const names = detectAllScales(['C#', 'F', 'G#']).map((s) => s.name)
    expect(names.length).toBeGreaterThan(0)
    expect(names).toContain('C# major')
    // the flat-spelled equivalent key is reachable too, since the fallback is
    // purely by sounding pitch
    expect(names).toContain('Db major')
  })

  it('correctly spelled input never reaches the fallback', () => {
    // C#-E#-G# is spelled correctly, so only name matches are returned and no
    // flat-spelled key appears
    const names = detectAllScales(['C#', 'E#', 'G#']).map((s) => s.name)
    expect(names).toContain('C# major')
    expect(names).not.toContain('Db major')
  })
})

// C0: the two edge branches used to diverge — only `next` recognized
// chord-function names. `romanChordNameToReal` returns '' for N6/Aug6 and
// mangles 'V64' into 'E64' (its roman pass rewrites the leading V), so every
// dotted edge to a chord function was silently dropped.
describe('makeProgNodeTranslator dotted chord-function edges', () => {
  it('translates chord functions on dotted edges, as it does on next', () => {
    const translate = makeProgNodeTranslator('A', 'minor')
    const node = translate({
      name: 'IV',
      next: ['V'],
      dotted: ['N6', 'Aug6', 'V64'],
    } as never)

    expect(node?.dotted.map((d) => d.name)).toEqual(['N6', 'Aug6', 'V64'])
    // and they carry real notes, not the empty list that got them dropped
    expect(node?.dotted.map((d) => d.notes)).toEqual([
      ['D', 'F', 'Bb'],
      ['F', 'A', 'D#'],
      ['E', 'A', 'C'],
    ])
  })

  it('gives dotted and next branches identical output for the same roman', () => {
    const translate = makeProgNodeTranslator('C', 'major')
    const asNext = translate({ name: 'IV', next: ['N6'] } as never)
    const asDotted = translate({ name: 'IV', next: [], dotted: ['N6'] } as never)
    // octMap is a fresh closure per call, so compare the data fields
    const fields = (e?: { name: string; notes: string[]; roman: string; enabler: string[] | null }) =>
      e && { name: e.name, notes: e.notes, roman: e.roman, enabler: e.enabler }
    expect(fields(asDotted?.dotted[0])).toEqual(fields(asNext?.next[0]))
    expect(typeof asDotted?.dotted[0].octMap).toBe('function')
  })

  it('still drops genuinely untranslatable dotted romans', () => {
    const translate = makeProgNodeTranslator('A', 'minor')
    const node = translate({
      name: 'IV',
      next: [],
      dotted: ['NotARoman'],
    } as never)
    expect(node?.dotted).toEqual([])
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

// C1-followup. `allScales` is public API — consumers may hold stored names
// that resolve against it, and `isScaleName`/`properScaleName` search it — so
// it is deliberately left alone and the curated lists are added alongside.
describe('scale lists', () => {
  it('allScales still holds all 189 entries, duplicates included', () => {
    expect(allScales).toHaveLength(189)
    const names = allScales.map((s) => s.name)
    // the double-accidental spellings remain resolvable for back compat
    expect(names).toContain('Dbb major')
    expect(names).toContain('F## major')
    expect(names).toContain('G## minor')
  })

  it('a picker built from allScales shows 54 major/minor entries', () => {
    // 20 of them are unplayable double-accidental spellings — the bug that
    // motivated the curated lists
    const picker = allScales
      .map((s) => s.name)
      .filter((n) => n.endsWith(' major') || n.endsWith(' minor'))
    expect(picker).toHaveLength(54)
    expect(picker.filter((n) => /bb|##/.test(n.split(' ')[0]))).toHaveLength(20)
  })

  it('distinctScales collapses the 189 to 84 with no double accidentals', () => {
    expect(distinctScales).toHaveLength(84)
    const bad = distinctScales
      .map((s) => s.name)
      .filter((n) => /bb|##/.test(n.split(' ')[0]))
    expect(bad).toEqual([])
  })

  it('distinctScales keeps every mode and both relative keys', () => {
    const names = distinctScales.map((s) => s.name)
    // 7 modes x 12 sounding pitch sets
    expect(new Set(names.map((n) => n.split(' ').slice(1).join(' ')))).toEqual(
      new Set(['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'minor', 'locrian'])
    )
    // relative major/minor share a pitch-class set but must both survive
    expect(names).toContain('C major')
    expect(names).toContain('A minor')
  })

  it('conventionalKeys is the 30-key list a scale picker should use', () => {
    expect(conventionalKeys).toHaveLength(30)
    const names = conventionalKeys.map((s) => s.name)
    expect(names.filter((n) => n.endsWith(' major'))).toHaveLength(15)
    expect(names.filter((n) => n.endsWith(' minor'))).toHaveLength(15)
    // none of the 20 unplayable spellings the raw list would have offered
    expect(names.filter((n) => /bb|##/.test(n.split(' ')[0]))).toEqual([])
  })

  it('conventionalKeys covers keys the raw list spells wrong or omits', () => {
    const names = conventionalKeys.map((s) => s.name)
    // absent from allScales entirely (noteNames has no 'Cb')
    expect(allScales.map((s) => s.name)).not.toContain('Cb major')
    expect(names).toContain('Cb major')
  })
})
