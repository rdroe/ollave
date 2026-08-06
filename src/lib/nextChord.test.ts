import { describe, expect, it } from 'vitest'

import { nextChord, nextChordDetail } from './nextChord'

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
    expect(viaF).toHaveLength(8)
    expect(viaAm).toHaveLength(8)

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
    ])
  })

  it('never returns empty for an unannotated but legal arrival', () => {
    // regression (the reason context must not filter): G#dim's only edge is
    // gated on [Dm, Bdim], yet Am legally leads to G#dim. Strict filtering
    // would make this query return nothing.
    const sugs = nextChordDetail('G#dim,3', 'A', 'minor', { prev: ['Am'] })
    expect(sugs).toHaveLength(1)
    expect(sugs[0].name).toBe('E')
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
    expect(nextChordDetail('V64,3', 'A', 'minor').map((s) => s.name)).toEqual([
      'E',
    ])
    expect(nextChordDetail('N6,3', 'A', 'minor').map((s) => s.name)).toEqual([
      'V64',
      'E',
    ])
    expect(nextChordDetail('Aug6,3', 'A', 'minor').map((s) => s.name)).toEqual([
      'V64',
      'E',
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
