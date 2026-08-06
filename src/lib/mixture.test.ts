import { describe, expect, it } from 'vitest'

import type { MixtureSuggestion } from './mixture'
import { mixtureSuggestions } from './mixture'
import { nextChordDetail } from './nextChord'

/** compact `roman:name` view for comparing whole palettes */
const shape = (suggestions: MixtureSuggestion[]) =>
  suggestions.map((s) => `${s.roman}:${s.name}`)

describe('mixtureSuggestions', () => {
  describe('into major', () => {
    // hand-verified against the parallel minor (C minor: C D Eb F G Ab Bb).
    // iv = F Ab C; ii° = D F Ab; bIII = Eb G Bb; bVI = Ab C Eb; bVII = Bb D F.
    it('borrows the parallel-minor set in C major', () => {
      expect(shape(mixtureSuggestions('C', 'major'))).toEqual([
        'iv:Fm',
        'ii°:Ddim',
        'bIII:Eb',
        'bVI:Ab',
        'bVII:Bb',
      ])
    })

    it('realizes the C major borrowings with correct notes', () => {
      const byRoman = new Map(
        mixtureSuggestions('C', 'major').map((s) => [s.roman, s.notes])
      )
      expect(byRoman.get('iv')).toEqual(['F3', 'Ab3', 'C4'])
      expect(byRoman.get('ii°')).toEqual(['D3', 'F3', 'Ab3'])
      expect(byRoman.get('bIII')).toEqual(['Eb3', 'G3', 'Bb3'])
      expect(byRoman.get('bVI')).toEqual(['Ab3', 'C4', 'Eb4'])
      expect(byRoman.get('bVII')).toEqual(['Bb3', 'D4', 'F4'])
    })

    it('tags every borrowed chord as mixture, unconditionally available', () => {
      for (const sug of mixtureSuggestions('C', 'major')) {
        expect(sug.strength).toBe('mixture')
        expect(sug.enabledBy).toBeNull()
      }
    })
  })

  describe('into minor', () => {
    // the dorian raised sixth only: in A minor the sixth degree F is raised to
    // F#, making IV major (D F# A).
    it('borrows only the dorian IV in A minor', () => {
      expect(shape(mixtureSuggestions('A', 'minor'))).toEqual(['IV:D'])
      expect(mixtureSuggestions('A', 'minor')[0].notes).toEqual([
        'D3',
        'F#3',
        'A3',
      ])
    })

    it('does not duplicate the Picardy third already in the minor chart', () => {
      // the chart gives V ⇢ I as a dotted edge (graphData/minor.ts), so the
      // major tonic is already offered and must not be emitted again
      const picardy = nextChordDetail('E,3', 'A', 'minor').find(
        (s) => s.name === 'A' && s.strength === 'dotted'
      )
      expect(picardy).toBeDefined()
      expect(picardy?.roman).toBe('I')

      const mixture = mixtureSuggestions('A', 'minor')
      expect(mixture.map((s) => s.name)).not.toContain('A')
      expect(mixture.map((s) => s.roman)).not.toContain('I')
    })
  })

  describe('spelling in awkward keys', () => {
    // roots come from interval transposition, not scale-degree lookup, so they
    // stay correctly spelled where degree lookup would double-flatten
    it('spells a sharp key (F# major) without enharmonic drift', () => {
      expect(shape(mixtureSuggestions('F#', 'major'))).toEqual([
        'iv:Bm',
        'ii°:G#dim',
        'bIII:A',
        'bVI:D',
        'bVII:E',
      ])
    })

    it('spells a flat key (Db major), double flats included', () => {
      // bVI of Db is genuinely Bbb (not A): the sixth degree Bb, lowered
      expect(shape(mixtureSuggestions('Db', 'major'))).toEqual([
        'iv:Gbm',
        'ii°:Ebdim',
        'bIII:Fb',
        'bVI:Bbb',
        'bVII:Cb',
      ])
      const bVI = mixtureSuggestions('Db', 'major').find(
        (s) => s.roman === 'bVI'
      )
      expect(bVI?.notes).toEqual(['Bbb3', 'Db4', 'Fb4'])
    })

    it('spells awkward minor keys', () => {
      expect(shape(mixtureSuggestions('C#', 'minor'))).toEqual(['IV:F#'])
      expect(shape(mixtureSuggestions('Eb', 'minor'))).toEqual(['IV:Ab'])
    })

    it('never returns a suggestion with empty notes', () => {
      const keys: [string, string][] = [
        ['C', 'major'],
        ['F#', 'major'],
        ['Db', 'major'],
        ['Gb', 'major'],
        ['B', 'major'],
        ['Eb', 'major'],
        ['A', 'minor'],
        ['C#', 'minor'],
        ['Eb', 'minor'],
        ['G#', 'minor'],
      ]
      for (const [tonic, scale] of keys) {
        const suggestions = mixtureSuggestions(tonic, scale)
        expect(suggestions.length).toBeGreaterThan(0)
        for (const sug of suggestions) {
          expect(sug.notes.length).toBeGreaterThan(0)
          expect(sug.name).not.toBe('')
        }
      }
    })
  })

  describe('mode dispatch', () => {
    // dispatch is on Scale.get(...).type, so aliases resolve for free
    it('treats ionian as major and aeolian as minor', () => {
      expect(shape(mixtureSuggestions('C', 'ionian'))).toEqual(
        shape(mixtureSuggestions('C', 'major'))
      )
      expect(shape(mixtureSuggestions('A', 'aeolian'))).toEqual(
        shape(mixtureSuggestions('A', 'minor'))
      )
    })

    it('returns an empty palette for modes with no defined mixture', () => {
      expect(mixtureSuggestions('D', 'dorian')).toEqual([])
      expect(mixtureSuggestions('E', 'phrygian')).toEqual([])
      expect(mixtureSuggestions('C', 'lydian')).toEqual([])
    })

    it('returns an empty palette rather than throwing on nonsense input', () => {
      expect(() => mixtureSuggestions('C', 'not-a-scale')).not.toThrow()
      expect(mixtureSuggestions('C', 'not-a-scale')).toEqual([])
    })
  })

  describe('composition with nextChordDetail', () => {
    it('concatenates into a single sane suggestion list', () => {
      const graph = nextChordDetail('Am,3', 'A', 'minor')
      const combined: MixtureSuggestion[] = [
        ...graph,
        ...mixtureSuggestions('A', 'minor'),
      ]

      expect(combined.length).toBe(graph.length + 1)

      // graph suggestions survive untouched
      expect(combined.slice(0, graph.length)).toEqual(graph)

      // every entry, from either source, is a well-formed suggestion
      for (const sug of combined) {
        expect(typeof sug.name).toBe('string')
        expect(typeof sug.roman).toBe('string')
        expect(sug.notes.length).toBeGreaterThan(0)
        expect(['strong', 'dotted', 'mixture']).toContain(sug.strength)
      }

      // the borrowed chord is present and distinguishable by strength
      const borrowed = combined.filter((s) => s.strength === 'mixture')
      expect(borrowed.map((s) => s.name)).toEqual(['D'])

      // and it is genuinely additive: Dm (diatonic iv) is still there
      expect(
        combined.some((s) => s.name === 'Dm' && s.strength === 'strong')
      ).toBe(true)
    })

    it('adds five borrowed options to a major-key list', () => {
      const mixture = mixtureSuggestions('C', 'major')
      expect(mixture).toHaveLength(5)
      // no borrowed chord collides with another borrowed chord
      expect(new Set(mixture.map((s) => s.name)).size).toBe(5)
    })
  })
})
