import { describe, expect, it } from 'vitest'
import { Chord, Interval } from 'tonal'

import type { ChordSuggestion } from './chordSuggestion'
import {
  bassOf,
  edgeChord,
  edgeFigure,
  figureArity,
  figureBassIndex,
  figureFitsChord,
  figureLabel,
  figuredRoman,
  FIGURES,
  isFiguredChord,
  parseFigure,
} from './figuredBass'
import type { Figure } from './graphData/types'
import { nextChord, nextChordDetail } from './nextChord'
import { isChordCsvArg, parseChordCsvArg } from './util/barsUtil'
import { figuredVoicings } from './voiceLeading'
import { chordGraphCreate } from './util/graphUtil'

describe('figure -> bass tone mapping (A2)', () => {
  it('maps each figure to the chord tone it puts in the bass', () => {
    // the whole vocabulary, stated once as a table
    expect(figureBassIndex('53')).toBe(0) // root
    expect(figureBassIndex('6')).toBe(1) // third
    expect(figureBassIndex('64')).toBe(2) // fifth
    expect(figureBassIndex('7')).toBe(0) // root
    expect(figureBassIndex('65')).toBe(1) // third
    expect(figureBassIndex('43')).toBe(2) // fifth
    expect(figureBassIndex('42')).toBe(3) // seventh
  })

  it('knows which figures presuppose a seventh chord', () => {
    expect(FIGURES.filter((f) => figureArity(f) === 3)).toEqual([
      '53',
      '6',
      '64',
    ])
    expect(FIGURES.filter((f) => figureArity(f) === 4)).toEqual([
      '7',
      '65',
      '43',
      '42',
    ])
  })

  it('names every figure', () => {
    for (const f of FIGURES) {
      expect(figureLabel(f), f).toBeTruthy()
    }
  })
})

describe('bassOf — spelling is exact in flat AND sharp keys', () => {
  // These are the cases that motivated indexing into `Chord.get().notes`
  // rather than transposing an interval from the root. Every expectation here
  // was PROBED before being pinned; a transposition-based implementation
  // respells several of them enharmonically, which is the bug class that has
  // bitten this codebase repeatedly (see the N6/Aug6 notes in graphh.ts).
  const cases: [chord: string, figure: Figure, bass: string][] = [
    // flat keys — the bass must stay flat, never respell to a sharp
    ['Eb', '6', 'G'],
    ['Eb', '64', 'Bb'],
    ['Gb', '6', 'Bb'],
    ['Gb', '64', 'Db'],
    ['Db7', '65', 'F'],
    ['Db7', '43', 'Ab'],
    ['Db7', '42', 'Cb'], // NOT B
    ['Ab7', '42', 'Gb'], // NOT F#
    // sharp keys — likewise, never respell to a flat
    ['G#7', '65', 'B#'], // NOT C
    ['G#7', '43', 'D#'],
    ['G#7', '42', 'F#'],
    ['F#', '6', 'A#'],
    ['B', '6', 'D#'],
    // double accidentals, which is where naive arithmetic falls over
    ['F##', '6', 'A##'],
    ['F##', '64', 'C##'],
    ['F##dim', '6', 'A#'],
    ['Fbm', '6', 'Abb'],
    ['Fbm', '64', 'Cb'], // NOT B
    // diminished and half-diminished sevenths
    ['G#dim7', '65', 'B'],
    ['G#dim7', '42', 'F'],
    ['Bm7b5', '65', 'D'],
    ['Bm7b5', '42', 'A'],
    // the ordinary cases
    ['C', '6', 'E'],
    ['C', '64', 'G'],
    ['G7', '65', 'B'],
    ['G7', '43', 'D'],
    ['G7', '42', 'F'],
  ]

  it.each(cases)('%s + %s -> %s', (chord, figure, bass) => {
    expect(bassOf(chord, figure)).toBe(bass)
  })

  it('agrees with the chord\'s own note list, by construction', () => {
    // the property the table above samples: bassOf IS an index into the notes
    for (const [chord, figure, bass] of cases) {
      const notes = Chord.get(chord).notes
      expect(notes[figureBassIndex(figure)], `${chord} ${figure}`).toBe(bass)
    }
  })

  it('rejects a seventh-chord figure on a triad rather than guessing', () => {
    // '7' maps to index 0, which EXISTS on a triad — so an index-only check
    // would report that a C major triad in root position is a V7. Arity is
    // checked for exactly this reason. Probed: before the arity check,
    // bassOf('C','7') returned 'C'.
    expect(bassOf('C', '7')).toBeNull()
    expect(bassOf('C', '65')).toBeNull()
    expect(bassOf('C', '43')).toBeNull()
    expect(bassOf('C', '42')).toBeNull()
    // triad figures still work on a seventh chord: the tones are all there
    expect(bassOf('G7', '6')).toBe('B')
  })

  it('returns null for an unresolvable name instead of throwing', () => {
    expect(bassOf('Xq', '6')).toBeNull()
    expect(bassOf('', '6')).toBeNull()
    // chord-FUNCTION names are not tonal chords
    expect(bassOf('V64', '6')).toBeNull()
  })

  it('figureFitsChord is a note-count check, not a style check', () => {
    expect(figureFitsChord('C', '6')).toBe(true)
    expect(figureFitsChord('C', '42')).toBe(false)
    expect(figureFitsChord('G7', '42')).toBe(true)
    expect(figureFitsChord('Xq', '6')).toBe(false)
  })
})

describe('parseFigure — ASCII is stored, unicode is input sugar', () => {
  it('round-trips every stored figure', () => {
    for (const f of FIGURES) {
      expect(parseFigure(f)).toBe(f)
    }
  })

  it('accepts the unicode spellings a score would print', () => {
    expect(parseFigure('⁶')).toBe('6')
    expect(parseFigure('⁶₄')).toBe('64')
    expect(parseFigure('⁷')).toBe('7')
    expect(parseFigure('⁶₅')).toBe('65')
    expect(parseFigure('⁴₃')).toBe('43')
    expect(parseFigure('⁴₂')).toBe('42')
    expect(parseFigure('⁵₃')).toBe('53')
  })

  it('accepts the alternative and empty spellings of root position and 4/2', () => {
    expect(parseFigure('2')).toBe('42') // the other current spelling
    expect(parseFigure('')).toBe('53') // root position is usually unfigured
    expect(parseFigure('5')).toBe('53')
    expect(parseFigure('3')).toBe('53')
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseFigure('  6 ')).toBe('6')
  })

  it('returns null for a non-figure rather than throwing', () => {
    expect(parseFigure('x')).toBeNull()
    expect(parseFigure('9')).toBeNull()
    expect(parseFigure('653')).toBeNull()
  })
})

describe('figuredRoman — how a composer writes it', () => {
  it('appends a triad figure', () => {
    expect(figuredRoman('I', '6')).toBe('I6')
    expect(figuredRoman('VIIdim', '6')).toBe('VIIdim6')
    expect(figuredRoman('IV', '64')).toBe('IV64')
  })

  it('absorbs the 7 of a seventh chord into the figure', () => {
    // V65, never V765: the figure already says "seventh chord", so keeping the
    // 7 is redundant AND unreadable. Probed — naive concatenation produced
    // 'V765' and 'V742'.
    expect(figuredRoman('V7', '65')).toBe('V65')
    expect(figuredRoman('V7', '43')).toBe('V43')
    expect(figuredRoman('V7', '42')).toBe('V42')
    expect(figuredRoman('VIIdim7', '65')).toBe('VIIdim65')
  })

  it('drops the root-position figures, which add nothing', () => {
    expect(figuredRoman('I', '53')).toBe('I')
    expect(figuredRoman('V7', '7')).toBe('V7')
    expect(figuredRoman('I', null)).toBe('I')
  })
})

describe('ChartEdge — a bare string is still the normal form', () => {
  it('reads a bare string as an unfigured chord', () => {
    expect(isFiguredChord('V')).toBe(false)
    expect(edgeChord('V')).toBe('V')
    // NULL, not '53': "unfigured" and "explicitly root position" stay
    // distinguishable, which is what keeps the change additive
    expect(edgeFigure('V')).toBeNull()
  })

  it('reads an object edge as a figured chord', () => {
    const edge = { chord: 'V7', figure: '65' } as const
    expect(isFiguredChord(edge)).toBe(true)
    expect(edgeChord(edge)).toBe('V7')
    expect(edgeFigure(edge)).toBe('65')
  })
})

describe('figuredVoicings — built on the existing inversion machinery', () => {
  it('keeps only the arrangements whose lowest note is the figured bass', () => {
    expect(figuredVoicings('C', '6', { minOctave: 3, maxOctave: 3 })).toEqual([
      ['E3', 'G3', 'C4'],
    ])
    expect(figuredVoicings('C', '64', { minOctave: 3, maxOctave: 3 })).toEqual([
      ['G3', 'C4', 'E4'],
    ])
    expect(figuredVoicings('G7', '42', { minOctave: 3, maxOctave: 3 })).toEqual([
      ['F3', 'G3', 'B3', 'D4'],
    ])
  })

  it('keeps flat spellings flat', () => {
    expect(figuredVoicings('Ebm', '6', { minOctave: 3, maxOctave: 3 })).toEqual([
      ['Gb3', 'Bb3', 'Eb4'],
    ])
  })

  it('returns [] rather than throwing when the figure does not apply', () => {
    expect(figuredVoicings('C', '42')).toEqual([])
    expect(figuredVoicings('Xq', '6')).toEqual([])
  })
})

describe('the Figure union is mirrored exactly in ChordSuggestion', () => {
  it('has the same members in both places', () => {
    // chordSuggestion.ts is deliberately ZERO-IMPORT (it is what breaks the
    // nextChord/voiceLeading cycle), so it spells the union out rather than
    // importing `Figure`. This test is what stops the two from drifting.
    const fromSuggestion: NonNullable<ChordSuggestion['figure']>[] = [
      '53',
      '6',
      '64',
      '7',
      '65',
      '43',
      '42',
    ]
    // assignable in BOTH directions, which is only true if the unions match
    const asFigures: Figure[] = fromSuggestion
    const backAgain: NonNullable<ChordSuggestion['figure']>[] = asFigures
    expect(backAgain).toEqual([...FIGURES])
  })
})

describe('figured chart edges reach nextChordDetail (A1/A5)', () => {
  it('carries figure, bass and the figured roman — and keeps the plain name', () => {
    const sugs = nextChordDetail('C,3', 'C', 'major')
    const i6 = sugs.find((s) => s.roman === 'I6')
    expect(i6).toBeDefined()
    // the NAME is the plain chord symbol, because the name is the graph's key
    expect(i6?.name).toBe('C')
    expect(i6?.figure).toBe('6')
    expect(i6?.bass).toBe('E')
    expect(i6?.strength).toBe('dotted')
  })

  it('reports the dominant-seventh inversions with the right bass', () => {
    const sugs = nextChordDetail('C,3', 'C', 'major')
    const byRoman = (r: string) => sugs.find((s) => s.roman === r)
    expect(byRoman('V65')?.bass).toBe('B') // third — the leading tone
    expect(byRoman('V43')?.bass).toBe('D') // fifth
    expect(byRoman('V42')?.bass).toBe('F') // seventh
    expect(byRoman('V65')?.name).toBe('G7')
    expect(byRoman('V42')?.name).toBe('G7')
  })

  it('works in a minor key, with the leading tone raised', () => {
    const sugs = nextChordDetail('Am,3', 'A', 'minor')
    const byRoman = (r: string) => sugs.find((s) => s.roman === r)
    expect(byRoman('Im6')?.bass).toBe('C')
    // the leading-tone triad in A minor is G#dim, so its third is B
    expect(byRoman('VIIdim6')?.name).toBe('G#dim')
    expect(byRoman('VIIdim6')?.bass).toBe('B')
    // V6's bass is the raised leading tone G#, not the subtonic G
    expect(byRoman('V6')?.bass).toBe('G#')
  })

  it('leaves an unfigured suggestion byte-identical — no extra keys at all', () => {
    const sugs = nextChordDetail('C,3', 'C', 'major')
    const plain = sugs.find((s) => s.roman === 'I')
    expect(Object.keys(plain!).sort()).toEqual([
      'enabledBy',
      'name',
      'notes',
      'roman',
      'strength',
    ])
    // an explicit `undefined` would serialize differently and break toEqual
    expect('figure' in plain!).toBe(false)
    expect('bass' in plain!).toBe(false)
  })

  it('never collapses a chord with its own inversion in the dedupe', () => {
    // Am appears as Im AND as Im6 — same name, different bass, different
    // musical object. Keying the dedupe on name alone would lose one.
    const sugs = nextChordDetail('Am,3', 'A', 'minor')
    const ams = sugs.filter((s) => s.name === 'Am')
    expect(ams.map((s) => s.roman)).toEqual(['Im', 'Im6'])
  })

  it('produces NO true duplicates across a sample of nodes in both keys', () => {
    for (const [chord, tonic, scale] of [
      ['Am', 'A', 'minor'],
      ['E', 'A', 'minor'],
      ['Bdim', 'A', 'minor'],
      ['C', 'C', 'major'],
      ['F', 'C', 'major'],
      ['G', 'C', 'major'],
    ] as const) {
      const sugs = nextChordDetail(`${chord},3`, tonic, scale)
      const keys = sugs.map((s) => `${s.name}|${s.figure ?? ''}|${s.strength}`)
      expect(new Set(keys).size, `${chord} in ${tonic} ${scale}`).toBe(
        keys.length
      )
    }
  })
})

describe('BLAST RADIUS — nextChord is unchanged by the inversions', () => {
  it('emits no figured edge on the strong layer, in either chart', () => {
    // THE rule that keeps `nextChord` stable: an inversion arrives on a dotted
    // edge unless musically principal, and none of the Stage M-A edges is.
    for (const [tonic, scale] of [
      ['A', 'minor'],
      ['C', 'major'],
    ] as const) {
      const graph = chordGraphCreate(tonic, scale)
      for (const [name, node] of Object.entries(graph)) {
        for (const edge of node.next) {
          expect(
            edge.figure,
            `${name} -> ${edge.roman} must not be a strong figured edge`
          ).toBeUndefined()
        }
      }
    }
  })

  it('pins nextChord output for every node in A minor', () => {
    // Captured by probe BEFORE the inversion edges were authored and diffed
    // after: byte-identical across all 25 nodes. Same guarantee the sevenths
    // promotion shipped under.
    const graph = chordGraphCreate('A', 'minor')
    const actual = Object.keys(graph)
      .sort()
      .map((n) => `${n}: ${nextChord(`${n},3`, 'A', 'minor').join(' ')}`)
    expect(actual).toEqual([
      'A7: F#dim D7',
      'Am: Am Dm G C F Bdim V64 G#dim E',
      'Am7: Am Dm G C F Bdim V64 G#dim E',
      'Aug6: V64 E',
      'B: V64 G#dim',
      'Bdim: D#dim B V64 G#dim E Edim C7 C',
      'Bm7b5: D#dim B V64 G#dim E',
      'C: Edim C7 F',
      'C#dim: F#dim D7',
      'C7: Dm Bdim F',
      'D#dim: V64 G#dim',
      'D7: Bdim G7 G',
      'Dm: G D#dim B V64 G#dim E',
      'Dm7: G D#dim B V64 G#dim E',
      'E: Am',
      'E7: Am',
      'Edim: Dm Bdim F',
      'F: Bdim Dm',
      'F#dim: Bdim G7 G',
      // Stage M-B (B4): three ADDED nodes. Every line above is byte-identical
      // to the pre-B4 capture — no pre-existing node's strong edges changed.
      // Ger6 reaches only V64: its perfect fifth would make Ger6 -> V parallel
      // fifths, so the direct resolution is dotted.
      'Fr6: V64 E',
      'G: C',
      'G#dim: E',
      'G#dim7: E',
      'G7: Edim C7 C',
      'Ger6: V64',
      'It6: V64 E',
      'N6: V64 E',
      'V64: E',
    ])
  })

  it('pins nextChord output for every node in C major', () => {
    const graph = chordGraphCreate('C', 'major')
    const actual = Object.keys(graph)
      .sort()
      .map((n) => `${n}: ${nextChord(`${n},3`, 'C', 'major').join(' ')}`)
    expect(actual).toEqual([
      'A7: Dm',
      'Am: F Dm',
      'Aug6: V64 G',
      'B7: Em',
      'Bdim: C G',
      'Bm7b5: C G',
      'C: C Em Am F Dm V64 Bdim G',
      'C#dim: Dm',
      'C7: F',
      'Cmaj7: C Em Am F Dm V64 Bdim G',
      'D: V64 Bdim G',
      'D#dim: Em',
      'Dm: V64 Bdim G F#dim D N6 Aug6',
      'Dm7: V64 Bdim G F#dim D N6 Aug6',
      'E7: Am',
      'Edim: F',
      'Em: Am F Dm',
      'F: Dm V64 Bdim G F#dim D N6 Aug6',
      'F#dim: V64 Bdim G',
      'Fmaj7: Dm V64 Bdim G F#dim D N6 Aug6',
      // Stage M-B (B4): three ADDED nodes, same as in minor. Every line above
      // is byte-identical to the pre-B4 capture.
      'Fr6: V64 G',
      'G: C',
      'G#dim: Am',
      'G7: C',
      'Ger6: V64',
      'It6: V64 G',
      'N6: V64 G',
      'V64: G',
    ])
  })
})

describe('A7 — one alias policy for V64, N6 and Aug6', () => {
  // ALL THREE STAY as documented aliases. The policy is decided once for the
  // set, not three times; the reasoning is in docs/chord-theory.md §4.

  it('keeps all three live as user-facing input', () => {
    // retiring any of them is a BREAKING change: these are accepted CLI args
    // and appear in saved songs, not internal identifiers
    for (const name of ['V64', 'N6', 'Aug6']) {
      expect(isChordCsvArg(`${name},3`), name).toBe(true)
    }
    // and case-insensitively, as they always have been
    expect(isChordCsvArg('v64,3')).toBe(true)
  })

  it('V64 and N6 ARE expressible in figured terms', () => {
    // V64 is the tonic triad with the fifth in the bass = I64
    expect(figuredVoicings('C', '64', { minOctave: 3, maxOctave: 3 })).toEqual([
      ['G3', 'C4', 'E4'],
    ])
    expect(bassOf('C', '64')).toBe('G') // the dominant, in the bass

    // N6 is the lowered second in first inversion = bII6. In A minor the
    // Neapolitan is Bb, and its first inversion is D-F-Bb — which is exactly
    // what the N6 function node produces.
    expect(figuredVoicings('Bb', '6', { minOctave: 3, maxOctave: 3 })).toEqual([
      ['D3', 'F3', 'Bb3'],
    ])
    expect(figuredRoman('bII', '6')).toBe('bII6')
  })

  it('Aug6 is NOT expressible, which is what settles the policy', () => {
    // The augmented sixth is not a tertian chord: in A minor it is F-A-D#,
    // whose intervals from the bass are 1P 3M 6A — a major third and an
    // AUGMENTED SIXTH, with no fifth. There is no root to invert and so no
    // chord tone for a figure to select; the '6' in its name is an interval
    // above the bass, not an inversion label.
    const augSix = ['F', 'A', 'D#']
    expect(Interval.distance('F', augSix[1])).toBe('3M')
    expect(Interval.distance('F', augSix[2])).toBe('6A') // NOT a seventh
    // asking tonal to name it gives the WRONG analysis — it respells D# as Eb
    // and turns an outward-resolving chord into a dominant seventh
    expect(Chord.detect(augSix)).toEqual(['F7no5'])
    // so no figure applies to the sonority as a chord
    expect(bassOf('Aug6', '6')).toBeNull()
  })

  it('all three still resolve to the right pitches, in flat and sharp keys', () => {
    // the alias policy is only honest if the aliases keep working
    const cases: [string, string, string, string[]][] = [
      ['A', 'minor', 'V64', ['E3', 'A3', 'C3']],
      ['A', 'minor', 'N6', ['D3', 'F3', 'Bb3']],
      ['A', 'minor', 'Aug6', ['F3', 'A3', 'D#3']],
      // flat key: the Neapolitan must NOT respell to naturals/sharps
      ['Eb', 'major', 'N6', ['Ab3', 'Cb3', 'Fb3']],
      ['Eb', 'major', 'Aug6', ['Cb3', 'Eb3', 'A3']],
      // sharp key
      ['F#', 'minor', 'V64', ['C#3', 'F#3', 'A3']],
      ['F#', 'minor', 'Aug6', ['D3', 'F#3', 'B#3']],
    ]
    for (const [tonic, scale, name, notes] of cases) {
      chordGraphCreate(tonic, scale)
      const [got] = parseChordCsvArg(`${name},3`, `${tonic} ${scale}`)
      expect(got, `${name} in ${tonic} ${scale}`).toEqual(notes)
    }
  })
})

describe('parseChordCsvArg with a figure (A3)', () => {
  it('places the chord with the figured bass, and tags it', () => {
    chordGraphCreate('C', 'major')
    expect(
      parseChordCsvArg('C,3', 'C major', undefined, { figure: '6' })
    ).toEqual([
      ['E3', 'G3', 'C4'],
      ['roman=I', 'chord=C', 'figure=6', 'bass=E'],
    ])
    expect(
      parseChordCsvArg('C,3', 'C major', undefined, { figure: '64' })
    ).toEqual([
      ['G3', 'C4', 'E4'],
      ['roman=I', 'chord=C', 'figure=64', 'bass=G'],
    ])
  })

  it('places the seventh-chord inversions', () => {
    chordGraphCreate('C', 'major')
    expect(
      parseChordCsvArg('G7,3', 'C major', undefined, { figure: '42' })
    ).toEqual([
      ['F3', 'G3', 'B3', 'D4'],
      ['roman=V7', 'chord=G7', 'figure=42', 'bass=F'],
    ])
  })

  it('accepts the unicode spelling', () => {
    chordGraphCreate('C', 'major')
    const [notes, tags] = parseChordCsvArg('C,3', 'C major', undefined, {
      figure: '⁶',
    })
    expect(notes).toEqual(['E3', 'G3', 'C4'])
    expect(tags).toContain('figure=6') // normalized to ASCII
  })

  it('works without a scale', () => {
    const [notes, tags] = parseChordCsvArg('C,3', undefined, undefined, {
      figure: '6',
    })
    expect(notes).toEqual(['E3', 'G3', 'C4'])
    expect(tags).toEqual(['chord=C', 'figure=6', 'bass=E'])
  })

  it('falls back to the default placement for an inapplicable figure', () => {
    chordGraphCreate('C', 'major')
    // '42' needs a seventh; a triad has none. Losing the chord over an
    // authoring slip would be worse than ignoring the figure.
    expect(
      parseChordCsvArg('C,3', 'C major', undefined, { figure: '42' })
    ).toEqual(parseChordCsvArg('C,3', 'C major'))
    // an unparseable figure likewise
    expect(
      parseChordCsvArg('C,3', 'C major', undefined, { figure: 'zzz' })
    ).toEqual(parseChordCsvArg('C,3', 'C major'))
  })

  it('lets the figure outrank smooth voicing, then smooths within it', () => {
    chordGraphCreate('C', 'major')
    // a figure is an explicit compositional decision about the bass; smoothing
    // is a convenience, so the figure decides WHICH inversion and prevNotes
    // only chooses among its octaves
    const [notes, tags] = parseChordCsvArg('C,3', 'C major', ['B3', 'D4', 'G4'], {
      figure: '6',
    })
    expect(notes[0]).toBe('E4') // still first inversion, octave chosen for smoothness
    expect(tags).toContain('bass=E')
  })

  it('leaves the two-argument default path completely untouched', () => {
    // the proof that A3 is additive; barsUtil.test.ts pins this too and passes
    // UNCHANGED, which is the real evidence
    chordGraphCreate('A', 'minor')
    expect(parseChordCsvArg('Am,3', 'A minor')).toEqual([
      ['A3', 'C4', 'E4'],
      ['roman=Im', 'chord=Am'],
    ])
    expect(parseChordCsvArg('Am,3', 'A minor', undefined, {})).toEqual([
      ['A3', 'C4', 'E4'],
      ['roman=Im', 'chord=Am'],
    ])
  })
})
