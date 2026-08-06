import { describe, expect, it } from 'vitest'

import { mixtureSuggestions } from './mixture'
import { nextChord, nextChordDetail } from './nextChord'
import { rankByVoiceLeading } from './voiceLeading'

describe('nextChord', () => {
  it('builds the graph on first use (no explicit chordGraphCreate needed)', () => {
    // regression: a cache miss used to be the hard error
    // "could not obtain graph for ..."
    expect(nextChord('Dm,3', 'D', 'minor')).toContain('A')
  })

  it('lists compatible next chords for the tonic in A minor', () => {
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

  it('lists compatible next chords for the dominant', () => {
    // V resolves to the tonic; V64/Aug6 approach it rather than follow it
    expect(nextChord('E,3', 'A', 'minor')).toEqual(['Am'])
  })

  it('accepts dynamic chord names', () => {
    // the cadential 6/4 resolves to the dominant
    expect(nextChord('V64,3', 'A', 'minor')).toEqual(['E'])
  })

  it('throws for an unknown scale', () => {
    expect(() => nextChord('Am,3', 'A', 'notascale')).toThrow(
      /Scale notascale not found/
    )
  })

  it('throws for an invalid chord argument', () => {
    expect(() => nextChord('notachord', 'A', 'minor')).toThrow(
      /could not get chord name/
    )
  })

  it('throws for a chord that is not in the graph', () => {
    expect(() => nextChord('Cmaj7,3', 'A', 'minor')).toThrow(
      /could not obtain Cmaj7,3 in graph/
    )
  })
})

describe('nextChordDetail', () => {
  it('shares nextChord validation and graph auto-build', () => {
    expect(() => nextChordDetail('Am,3', 'A', 'notascale')).toThrow(
      /Scale notascale not found/
    )
    expect(() => nextChordDetail('notachord', 'A', 'minor')).toThrow(
      /could not get chord name/
    )
    expect(() => nextChordDetail('Cmaj7,3', 'A', 'minor')).toThrow(
      /could not obtain Cmaj7,3 in graph/
    )
    // builds on cache miss, like nextChord
    expect(nextChordDetail('Bm,3', 'B', 'minor').length).toBeGreaterThan(0)
  })

  it('omits contextMatch entirely when no prev is given', () => {
    const sugs = nextChordDetail('Bdim,3', 'A', 'minor')
    expect(sugs.every((s) => !('contextMatch' in s))).toBe(true)
  })

  it('partitions the merged Bdim node by context without dropping anything', () => {
    // Bdim is both IIdim (gated on arrival from F) and VIIdim/III
    // (unconditional). Context reorders; it must never filter.
    const viaF = nextChordDetail('Bdim,3', 'A', 'minor', { prev: ['F'] })
    const viaAm = nextChordDetail('Bdim,3', 'A', 'minor', { prev: ['Am'] })

    const names = (sugs: typeof viaF) => sugs.map((s) => s.name).sort()
    // BOTH return the full list — same set, different order
    expect(names(viaF)).toEqual(names(viaAm))
    // 8 triad edges plus the two dotted seventh edges of the IIdim node
    expect(viaF).toHaveLength(10)
    expect(viaAm).toHaveLength(10)

    // arriving from F enables the IIdim (dominant-complex) edges
    expect(viaF.every((s) => s.contextMatch)).toBe(true)

    // arriving from Am does not: the unconditional VIIdim/III edges sort first
    expect(viaAm.slice(0, 3).map((s) => s.name)).toEqual(['Edim', 'C7', 'C'])
    expect(viaAm.slice(0, 3).every((s) => s.contextMatch)).toBe(true)
    expect(viaAm.slice(3).every((s) => !s.contextMatch)).toBe(true)
    expect(viaAm.slice(3).map((s) => s.name)).toEqual([
      'D#dim',
      'B',
      'V64',
      'G#dim',
      'E',
      'G#dim7',
      'E7',
    ])
  })

  it('never returns empty for an unannotated but legal arrival', () => {
    // regression (the reason context must not filter): G#dim's only edge is
    // gated on [Dm, Bdim], yet Am legally leads to G#dim. Strict filtering
    // would make this query return nothing.
    const sugs = nextChordDetail('G#dim,3', 'A', 'minor', { prev: ['Am'] })
    // the dominant, plus its seventh as dotted colour
    expect(sugs.map((s) => s.name)).toEqual(['E', 'E7'])
    expect(sugs[0].contextMatch).toBe(false)
    expect(sugs[0].enabledBy).toEqual(['Dm', 'Bdim'])
  })

  it('gates the Dm double-box dominant-complex edges on its predecessors', () => {
    const sugs = nextChordDetail('Dm,3', 'A', 'minor')
    const gated = ['D#dim', 'B', 'V64', 'G#dim', 'E']
    gated.forEach((name) => {
      expect(sugs.find((s) => s.name === name)?.enabledBy, name).toEqual([
        'F',
        'Edim',
        'C7',
      ])
    })
    // the plain IVm -> VII edge is unconditional
    expect(sugs.find((s) => s.name === 'G')?.enabledBy).toBeNull()
  })

  it('includes dotted edges, marked as such', () => {
    const sugs = nextChordDetail('E,3', 'A', 'minor')
    expect(sugs.map((s) => [s.name, s.strength])).toEqual([
      ['Am', 'strong'],
      ['A', 'dotted'], // the Picardy third
      ['E7', 'dotted'], // the dominant's own seventh
      ['Am7', 'dotted'], // the tonic seventh, as arrival colour
    ])
  })

  it('carries the edge roman, not the target node roman', () => {
    // Dm's dotted edge reaches Bdim as VIIdim/III, while the Bdim node's own
    // identity is IIdim
    const sugs = nextChordDetail('Dm,3', 'A', 'minor')
    const bdim = sugs.find((s) => s.name === 'Bdim')
    expect(bdim?.roman).toBe('VIIdim/III')
    expect(bdim?.strength).toBe('dotted')
  })

  it('reports the dominant complex in the classical direction', () => {
    // each still resolves onto the dominant; E7 rides along as dotted colour
    expect(nextChordDetail('V64,3', 'A', 'minor').map((s) => s.name)).toEqual([
      'E',
      'E7',
    ])
    expect(nextChordDetail('N6,3', 'A', 'minor').map((s) => s.name)).toEqual([
      'V64',
      'E',
      'E7',
    ])
    expect(nextChordDetail('Aug6,3', 'A', 'minor').map((s) => s.name)).toEqual([
      'V64',
      'E',
      'E7',
    ])
  })

  it('carries notes for every suggestion', () => {
    const sugs = nextChordDetail('Am,3', 'A', 'minor')
    expect(sugs.length).toBeGreaterThan(0)
    sugs.forEach((s) => {
      expect(s.notes.length, s.name).toBeGreaterThan(0)
    })
  })
})

// Convenience options — sugar over the standalone functions, which remain the
// implementation. Each test asserts the option is EQUIVALENT to hand-composing
// the same call, so these cannot pass by reimplementing the logic.
describe('nextChordDetail convenience options', () => {
  it('preserves existing behavior when opts are absent or only prev is given', () => {
    const bare = nextChordDetail('Am,3', 'A', 'minor')
    expect(nextChordDetail('Am,3', 'A', 'minor', {})).toEqual(bare)
    expect(nextChordDetail('Am,3', 'A', 'minor', { include: [] })).toEqual(bare)

    const withPrev = nextChordDetail('Bdim,3', 'A', 'minor', { prev: ['F'] })
    expect(withPrev.every((s) => s.contextMatch !== undefined)).toBe(true)
    // no suggestion is dropped by context
    expect(withPrev.length).toBe(nextChordDetail('Bdim,3', 'A', 'minor').length)
  })

  it("include: ['mixture'] appends exactly mixtureSuggestions output", () => {
    const graphOnly = nextChordDetail('Am,3', 'A', 'minor')
    const withMixture = nextChordDetail('Am,3', 'A', 'minor', {
      include: ['mixture'],
    })
    expect(withMixture).toEqual([
      ...graphOnly,
      ...mixtureSuggestions('A', 'minor'),
    ])
    // A minor borrows the dorian IV
    expect(withMixture.filter((s) => s.strength === 'mixture')).toEqual([
      expect.objectContaining({ name: 'D', roman: 'IV', enabledBy: null }),
    ])
  })

  it('borrowed chords are unconditional, so prev always marks them matching', () => {
    const sugs = nextChordDetail('Am,3', 'A', 'minor', {
      include: ['mixture'],
      prev: ['E'],
    })
    const borrowed = sugs.filter((s) => s.strength === 'mixture')
    expect(borrowed.length).toBeGreaterThan(0)
    expect(borrowed.every((s) => s.contextMatch === true)).toBe(true)
  })

  it("rankBy: 'voiceLeading' equals hand-composing rankByVoiceLeading", () => {
    const from = ['A3', 'C4', 'E4']
    const viaOpts = nextChordDetail('Am,3', 'A', 'minor', {
      rankBy: 'voiceLeading',
      fromVoicing: from,
    })
    const handComposed = rankByVoiceLeading(
      nextChordDetail('Am,3', 'A', 'minor'),
      from,
      { scale: { tonic: 'A', name: 'minor' } }
    )
    expect(viaOpts.map((s) => s.name)).toEqual(handComposed.map((s) => s.name))
  })

  it('combines mixture and voice-leading ranking in one call', () => {
    const from = ['A3', 'C4', 'E4']
    const viaOpts = nextChordDetail('Am,3', 'A', 'minor', {
      include: ['mixture'],
      rankBy: 'voiceLeading',
      fromVoicing: from,
    })
    const handComposed = rankByVoiceLeading(
      [
        ...nextChordDetail('Am,3', 'A', 'minor'),
        ...mixtureSuggestions('A', 'minor'),
      ],
      from,
      { scale: { tonic: 'A', name: 'minor' } }
    )
    expect(viaOpts.map((s) => s.name)).toEqual(handComposed.map((s) => s.name))
    // ranking is a sort, never a filter
    expect(viaOpts.length).toBe(handComposed.length)
    expect(viaOpts.some((s) => s.strength === 'mixture')).toBe(true)
  })

  it('ranks context matches ahead of merely-smooth moves', () => {
    const sugs = nextChordDetail('Bdim,3', 'A', 'minor', {
      prev: ['F'],
      rankBy: 'voiceLeading',
      fromVoicing: ['B3', 'D4', 'F4'],
    })
    const firstNonMatch = sugs.findIndex((s) => s.contextMatch !== true)
    if (firstNonMatch !== -1) {
      // once a non-match appears, no match may follow it
      expect(
        sugs.slice(firstNonMatch).every((s) => s.contextMatch !== true)
      ).toBe(true)
    }
  })

  it("throws when rankBy is given without fromVoicing", () => {
    expect(() =>
      nextChordDetail('Am,3', 'A', 'minor', { rankBy: 'voiceLeading' })
    ).toThrow(/requires a non-empty opts.fromVoicing/)
    expect(() =>
      nextChordDetail('Am,3', 'A', 'minor', {
        rankBy: 'voiceLeading',
        fromVoicing: [],
      })
    ).toThrow(/requires a non-empty opts.fromVoicing/)
  })

  it('fromVoicing without rankBy is inert', () => {
    expect(
      nextChordDetail('Am,3', 'A', 'minor', { fromVoicing: ['A3', 'C4', 'E4'] })
    ).toEqual(nextChordDetail('Am,3', 'A', 'minor'))
  })
})
