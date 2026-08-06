import { describe, expect, it } from 'vitest'

import type { ChordSuggestion } from './chordSuggestion'
import { nextChord, nextChordDetail } from './nextChord'
import { seventhOf, seventhSuggestions } from './sevenths'

/** compact `roman:name` view for comparing whole palettes */
const shape = (suggestions: ChordSuggestion[]) =>
  suggestions.map((s) => `${s.roman}:${s.name}`)

describe('seventhSuggestions', () => {
  describe('major keys', () => {
    // hand-verified against C major (C D E F G A B):
    // Cmaj7 = C E G B; Dm7 = D F A C; Fmaj7 = F A C E; G7 = G B D F;
    // Bm7b5 = B D F A (half-diminished — the major-key leading-tone seventh)
    it('offers the idiomatic set in C major', () => {
      expect(shape(seventhSuggestions('C', 'major'))).toEqual([
        'Imaj7:Cmaj7',
        'IIm7:Dm7',
        'IVmaj7:Fmaj7',
        'V7:G7',
        'VIIm7b5:Bm7b5',
      ])
    })

    it('realizes the C major sevenths with correct notes', () => {
      const byRoman = new Map(
        seventhSuggestions('C', 'major').map((s) => [s.roman, s.notes])
      )
      expect(byRoman.get('Imaj7')).toEqual(['C3', 'E3', 'G3', 'B3'])
      expect(byRoman.get('IIm7')).toEqual(['D3', 'F3', 'A3', 'C4'])
      expect(byRoman.get('IVmaj7')).toEqual(['F3', 'A3', 'C4', 'E4'])
      expect(byRoman.get('V7')).toEqual(['G3', 'B3', 'D4', 'F4'])
      // half-diminished, NOT fully diminished: the seventh above B is A, not Ab
      expect(byRoman.get('VIIm7b5')).toEqual(['B3', 'D4', 'F4', 'A4'])
    })

    it('spells correctly in a sharp key', () => {
      const byRoman = new Map(
        seventhSuggestions('F#', 'major').map((s) => [s.roman, s.name])
      )
      expect(byRoman.get('Imaj7')).toBe('F#maj7')
      expect(byRoman.get('V7')).toBe('C#7')
      expect(byRoman.get('VIIm7b5')).toBe('E#m7b5')
    })
  })

  describe('minor keys', () => {
    // hand-verified against A minor: Am7 = A C E G; Bm7b5 = B D F A;
    // Dm7 = D F A C; E7 = E G# B D (raised 7th); G#dim7 = G# B D F
    it('offers the idiomatic set in A minor', () => {
      expect(shape(seventhSuggestions('A', 'minor'))).toEqual([
        'Im7:Am7',
        'IIm7b5:Bm7b5',
        'IVm7:Dm7',
        'V7:E7',
        'VIIdim7:G#dim7',
      ])
    })

    it('realizes the A minor sevenths with correct notes', () => {
      const byRoman = new Map(
        seventhSuggestions('A', 'minor').map((s) => [s.roman, s.notes])
      )
      expect(byRoman.get('Im7')).toEqual(['A3', 'C4', 'E4', 'G4'])
      // supertonic seventh in minor is HALF-diminished, not fully
      expect(byRoman.get('IIm7b5')).toEqual(['B3', 'D4', 'F4', 'A4'])
      expect(byRoman.get('IVm7')).toEqual(['D3', 'F3', 'A3', 'C4'])
      // the dominant seventh uses the RAISED seventh degree (G#)
      expect(byRoman.get('V7')).toEqual(['E3', 'G#3', 'B3', 'D4'])
      // fully diminished, on the leading tone — the minor-key characteristic
      expect(byRoman.get('VIIdim7')).toEqual(['G#3', 'B3', 'D4', 'F4'])
    })

    it('builds the leading-tone seventh on the leading tone, not the subtonic', () => {
      // depends on the VII-diminished-family rule in romanChordNameToReal;
      // before that fix this was Gdim7 (G-Bb-Db-Fb) in A minor
      const byRoman = new Map(
        seventhSuggestions('A', 'minor').map((s) => [s.roman, s.name])
      )
      expect(byRoman.get('VIIdim7')).toBe('G#dim7')
      // flat minor key: Eb minor's leading tone is D natural, not Db
      const eb = new Map(
        seventhSuggestions('Eb', 'minor').map((s) => [s.roman, s.name])
      )
      expect(eb.get('VIIdim7')).toBe('Ddim7')
      expect(eb.get('Im7')).toBe('Ebm7')
    })
  })

  describe('strength', () => {
    it('marks V7 strong and every other seventh dotted', () => {
      for (const [tonic, scale] of [
        ['C', 'major'],
        ['A', 'minor'],
      ] as const) {
        for (const s of seventhSuggestions(tonic, scale)) {
          expect(s.strength).toBe(s.roman === 'V7' ? 'strong' : 'dotted')
        }
      }
    })

    it('reuses the existing strength vocabulary', () => {
      // deliberately no new 'seventh' member on the union — widening it would
      // break exhaustive switches in existing consumers
      for (const s of seventhSuggestions('C', 'major')) {
        expect(['strong', 'dotted', 'mixture']).toContain(s.strength)
      }
    })
  })

  describe('scope', () => {
    it('dispatches on scale type, so aliases work', () => {
      expect(shape(seventhSuggestions('C', 'ionian'))).toEqual(
        shape(seventhSuggestions('C', 'major'))
      )
      expect(shape(seventhSuggestions('A', 'aeolian'))).toEqual(
        shape(seventhSuggestions('A', 'minor'))
      )
    })

    it('returns [] for unsupported modes rather than throwing', () => {
      // additive features must degrade, never cost a caller the suggestions
      // it already had (same contract as mixtureSuggestions)
      expect(seventhSuggestions('D', 'dorian')).toEqual([])
      expect(seventhSuggestions('C', 'lydian')).toEqual([])
    })

    it('excludes the non-functional diatonic sevenths', () => {
      // IIIm7 / VIm7 in major, IIImaj7 / VImaj7 / VII7 in minor are legal but
      // carry no distinct function; excluded to keep the palette small
      const major = shape(seventhSuggestions('C', 'major'))
      expect(major).not.toContain('IIIm7:Em7')
      expect(major).not.toContain('VIm7:Am7')
      const minor = shape(seventhSuggestions('A', 'minor'))
      expect(minor.some((s) => s.startsWith('VII7:'))).toBe(false)
      expect(minor.some((s) => s.startsWith('IIImaj7:'))).toBe(false)
    })

    it('is unconditional — sevenths inherit their triad position', () => {
      for (const s of seventhSuggestions('A', 'minor')) {
        expect(s.enabledBy).toBeNull()
      }
    })
  })
})

describe('seventhOf', () => {
  it('finds the seventh of a chord by its realized name', () => {
    expect(seventhOf('E', 'A', 'minor')).toMatchObject({
      name: 'E7',
      roman: 'V7',
      strength: 'strong',
    })
    expect(seventhOf('Dm', 'A', 'minor')).toMatchObject({
      name: 'Dm7',
      roman: 'IVm7',
      strength: 'dotted',
    })
    expect(seventhOf('G', 'C', 'major')).toMatchObject({
      name: 'G7',
      roman: 'V7',
    })
  })

  it('reads the same chord differently in different keys', () => {
    // Bdim is the supertonic of A minor but the leading-tone chord of C major,
    // and takes a different seventh in each
    expect(seventhOf('Bdim', 'A', 'minor')).toMatchObject({
      name: 'Bm7b5',
      roman: 'IIm7b5',
    })
    expect(seventhOf('Bdim', 'C', 'major')).toMatchObject({
      name: 'Bm7b5',
      roman: 'VIIm7b5',
    })
  })

  it('returns null for chords with no seventh in scope', () => {
    expect(seventhOf('F', 'A', 'minor')).toBeNull() // VI
    expect(seventhOf('G', 'A', 'minor')).toBeNull() // subtonic VII
    expect(seventhOf('C', 'A', 'minor')).toBeNull() // III
    expect(seventhOf('Em', 'C', 'major')).toBeNull() // IIIm
    expect(seventhOf('Am', 'C', 'major')).toBeNull() // VIm
  })

  it('returns null for chord functions and unknown chords', () => {
    // V64/N6/Aug6 are defined by voicing and role; stacking a seventh on them
    // is not meaningful in this vocabulary
    expect(seventhOf('V64', 'A', 'minor')).toBeNull()
    expect(seventhOf('N6', 'A', 'minor')).toBeNull()
    expect(seventhOf('Aug6', 'A', 'minor')).toBeNull()
    expect(seventhOf('F#', 'A', 'minor')).toBeNull()
  })

  it('returns null for unsupported modes', () => {
    expect(seventhOf('D', 'D', 'dorian')).toBeNull()
  })
})

describe('additivity — the triad layer is untouched', () => {
  // the whole point of shipping this as an opt-in function rather than chart
  // nodes: existing callers must see byte-for-byte what they saw before
  it('nextChord is unchanged in minor', () => {
    expect(nextChord('Am,3', 'A', 'minor')).toEqual([
      'Am',
      'Dm',
      'G',
      'C',
      'F',
      'Bdim',
      'V64',
      'G#dim',
      'E',
    ])
  })

  it('nextChordDetail emits no seventh chords of its own', () => {
    for (const [chord, tonic, scale] of [
      ['Am,3', 'A', 'minor'],
      ['E,3', 'A', 'minor'],
      ['C,3', 'C', 'major'],
      ['G,3', 'C', 'major'],
    ] as const) {
      for (const s of nextChordDetail(chord, tonic, scale)) {
        expect(s.notes.length).toBeLessThanOrEqual(3)
      }
    }
  })

  it('composes with nextChordDetail by concatenation', () => {
    const graph = nextChordDetail('Am,3', 'A', 'minor')
    const all = [...graph, ...seventhSuggestions('A', 'minor')]
    expect(all.length).toBe(graph.length + 5)
    // and the graph portion is untouched
    expect(all.slice(0, graph.length)).toEqual(graph)
  })
})

describe("nextChordDetail include: ['sevenths']", () => {
  it('is sugar over concatenating the standalone function', () => {
    // the documented equivalence, same contract mixture already has
    expect(
      nextChordDetail('Am,3', 'A', 'minor', { include: ['sevenths'] })
    ).toEqual([
      ...nextChordDetail('Am,3', 'A', 'minor'),
      ...seventhSuggestions('A', 'minor'),
    ])
  })

  it('leaves the result untouched when not requested', () => {
    expect(nextChordDetail('Am,3', 'A', 'minor', {})).toEqual(
      nextChordDetail('Am,3', 'A', 'minor')
    )
  })

  it('combines with mixture in a fixed order regardless of include order', () => {
    const a = nextChordDetail('C,3', 'C', 'major', {
      include: ['mixture', 'sevenths'],
    })
    const b = nextChordDetail('C,3', 'C', 'major', {
      include: ['sevenths', 'mixture'],
    })
    expect(a).toEqual(b)
    // mixture first, then sevenths, both after the graph edges
    const graphLen = nextChordDetail('C,3', 'C', 'major').length
    expect(a.slice(graphLen).map((s) => s.strength)).toEqual([
      ...Array(5).fill('mixture'),
      'dotted',
      'dotted',
      'dotted',
      'strong',
      'dotted',
    ])
  })

  it('ranks sevenths by voice leading alongside everything else', () => {
    const ranked = nextChordDetail('C,3', 'C', 'major', {
      include: ['sevenths'],
      rankBy: 'voiceLeading',
      fromVoicing: ['C4', 'E4', 'G4'],
    })
    expect(ranked.length).toBeGreaterThan(0)
    // Cmaj7 adds a single note to the voicing already held, so it must rank
    // ahead of the dominant seventh, which moves more
    const names = ranked.map((s) => s.name)
    expect(names).toContain('Cmaj7')
    expect(names.indexOf('Cmaj7')).toBeLessThan(names.indexOf('G7'))
  })

  it('degrades to the graph result in an unsupported mode', () => {
    // seventhSuggestions returns [] rather than throwing, so opting in can
    // never cost a caller the suggestions it already had
    expect(seventhSuggestions('D', 'dorian')).toEqual([])
  })
})
