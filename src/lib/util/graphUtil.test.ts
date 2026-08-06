import { beforeAll, describe, expect, it } from 'vitest'

import {
  chordGraphCreate,
  getPhaseChordNames,
  lookUpGraph,
} from './graphUtil'

const A_MINOR_NODES = [
  'Am',
  'Dm',
  'G',
  'C',
  'F',
  'Bdim',
  'V64',
  'G#dim',
  'E',
  'N6',
  'Aug6',
  'C#dim',
  'A7',
  'F#dim',
  'D7',
  'G7',
  'Edim',
  'C7',
  'D#dim',
  'B',
  // diatonic sevenths, promoted to first-class nodes
  'Am7', // Im7
  'Bm7b5', // IIm7b5 — HALF-diminished supertonic, not Bdim7
  'Dm7', // IVm7
  'E7', // V7
  'G#dim7', // VIIdim7, on the raised seventh degree
]

describe('chordGraphCreate', () => {
  beforeAll(() => {
    chordGraphCreate('A', 'minor')
  })

  it('builds the A minor graph with the expected nodes', () => {
    const graph = chordGraphCreate('A', 'minor')
    expect(Object.keys(graph).sort()).toEqual([...A_MINOR_NODES].sort())
  })

  it('returns the same shape on first build and cache hit', () => {
    // regression: the first build used to return { formatted } while cache
    // hits returned the bare graph. Both shapes must now work on every call.
    const first = chordGraphCreate('E', 'minor')
    const cached = chordGraphCreate('E', 'minor')
    expect(Object.keys(first)).toEqual(Object.keys(cached))
    expect(Object.keys(first)).toContain('Em')
    // legacy { formatted } consumers keep working via a self-reference
    expect(first.formatted).toBe(first)
    expect(cached.formatted).toBe(cached)
    // ...which must not pollute chord-name iteration
    expect(Object.keys(first)).not.toContain('formatted')
  })

  it('exposes roman and translated notes on nodes', () => {
    const graph = chordGraphCreate('A', 'minor')
    expect(graph['Am'].roman).toBe('Im')
    expect(graph['Am'].translatedSource.notes).toEqual(['A3', 'C4', 'E4'])
    expect(graph['Am'].next.map((n) => n.name)).toEqual([
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

  it('keeps dotted (weak) edges', () => {
    const graph = chordGraphCreate('A', 'minor')
    // V resolves to the tonic; the cadential 6/4 and Aug6 now *precede* it
    expect(graph['E'].next.map((n) => n.name)).toEqual(['Am'])
    // the Picardy third stays a dotted (weak) option, joined by the dominant's
    // own seventh, the tonic seventh as arrival colour, and (Stage M-A) the
    // inverted tonic resolution plus the dominant-seventh inversions. Pinned by
    // ROMAN because a name is no longer unique: E7 appears as V7, V65, V43 and
    // V42, which are four different bass notes.
    expect(graph['E'].dotted.map((n) => n.roman)).toEqual([
      'I',
      'V7',
      'Im7',
      'Im6',
      'V65',
      'V43',
      'V42',
    ])
    // every inversion edge is dotted — the blast-radius rule that keeps
    // nextChord byte-identical
    expect(graph['E'].next.every((n) => n.figure === undefined)).toBe(true)
  })

  it('resolves the cadential 6/4 to the dominant', () => {
    // the 6/4 is dominant-function (tonic notes over scale degree 5), so it
    // resolves to V rather than straight to a root-position tonic
    const graph = chordGraphCreate('A', 'minor')
    expect(graph['V64'].next.map((n) => n.name)).toEqual(['E'])
    // the dominant may be taken in its seventh form, as a weaker option
    expect(graph['V64'].dotted.map((n) => n.name)).toEqual(['E7'])
  })

  it('reaches each seventh only over a dotted edge', () => {
    // the promotion rule that keeps `nextChord` output unchanged: sevenths are
    // colour available on top of the principal motion, never in place of it
    const graph = chordGraphCreate('A', 'minor')
    const sevenths = ['Am7', 'Bm7b5', 'Dm7', 'E7', 'G#dim7']
    for (const [name, node] of Object.entries(graph)) {
      for (const edge of node.next) {
        expect(
          sevenths,
          `${name} -> ${edge.name} must not be a strong edge`
        ).not.toContain(edge.name)
      }
    }
  })

  it('gives each seventh its triad-mirroring outgoing edges', () => {
    // a seventh does not change a chord's function, so it leads where its
    // triad leads
    const graph = chordGraphCreate('A', 'minor')
    const names = (n: string) => graph[n].next.map((e) => e.name)
    expect(names('Am7')).toEqual(names('Am'))
    expect(names('Dm7')).toEqual(names('Dm'))
    expect(names('G#dim7')).toEqual(names('G#dim'))
    // V7 resolves to the tonic exactly as V does, Picardy third included
    expect(names('E7')).toEqual(['Am'])
    expect(graph['E7'].dotted.map((e) => e.name)).toContain('A')
  })

  it('routes N6 and Aug6 into the dominant complex', () => {
    // both are predominants: they approach V, optionally via the cadential 6/4
    const graph = chordGraphCreate('A', 'minor')
    expect(graph['N6'].next.map((n) => n.name)).toEqual(['V64', 'E'])
    expect(graph['Aug6'].next.map((n) => n.name)).toEqual(['V64', 'E'])
  })

  it('keeps predominant approaches to the cadential 6/4', () => {
    // arriving at the 6/4 from a predominant is the standard approach and
    // must survive the V64 direction flip
    const graph = chordGraphCreate('A', 'minor')
    expect(graph['Am'].next.map((n) => n.name)).toContain('V64')
    expect(graph['Dm'].next.map((n) => n.name)).toContain('V64')
    expect(graph['Bdim'].next.map((n) => n.name)).toContain('V64')
    expect(graph['D#dim'].next.map((n) => n.name)).toContain('V64')
    expect(graph['B'].next.map((n) => n.name)).toContain('V64')
  })

  it('gives fn edges the same prev-based enabler as their siblings', () => {
    // regression: fn edges (V64/Aug6/N6) used to carry the *current node's own
    // name* as the enabler, which described nothing about arrival context
    const graph = chordGraphCreate('A', 'minor')
    // Dm's dominant-complex edges are the double-box node, gated on its prev
    const v64ViaDm = graph['Dm'].next.find((n) => n.name === 'V64')
    expect(v64ViaDm?.enabler).toEqual(['F', 'Edim', 'C7'])
    // Im has no prev, so its V64 edge is unconditional
    const v64ViaAm = graph['Am'].next.find((n) => n.name === 'V64')
    expect(v64ViaAm?.enabler).toBeNull()
  })

  it('carries the edge roman, which can differ from the target node roman', () => {
    // Bdim is IIdim in its own right, but Dm's dotted edge reaches it as
    // VIIdim/III (the two romans realize to the same chord and are merged)
    const graph = chordGraphCreate('A', 'minor')
    expect(graph['Bdim'].roman).toBe('IIdim')
    const dmToBdim = graph['Dm'].dotted.find((n) => n.name === 'Bdim')
    expect(dmToBdim?.roman).toBe('VIIdim/III')
    // and a plain diatonic edge carries its own roman
    expect(graph['Am'].next.find((n) => n.name === 'E')?.roman).toBe('V')
  })

  it('merges nodes whose romans realize to the same chord', () => {
    // regression: IIdim and VIIdim/III both realize to Bdim in A minor; the
    // later node used to overwrite the earlier, dropping the diatonic
    // IIdim's next options
    const graph = chordGraphCreate('A', 'minor')
    const names = graph['Bdim'].next.map((n) => n.name)
    // from IIdim
    expect(names).toEqual(
      expect.arrayContaining(['D#dim', 'B', 'V64', 'G#dim', 'E'])
    )
    // from VIIdim/III
    expect(names).toEqual(expect.arrayContaining(['Edim', 'C7', 'C']))
  })

  it('produces notes for every node and edge', () => {
    const graph = chordGraphCreate('A', 'minor')
    Object.entries(graph).forEach(([name, node]) => {
      expect(node.translatedSource.notes.length, name).toBeGreaterThan(0)
      node.next.forEach((edge) => {
        expect(edge.notes.length, `${name} -> ${edge.name}`).toBeGreaterThan(0)
      })
    })
  })

  it('dynamic chords carry an octMap for voicing', () => {
    const graph = chordGraphCreate('A', 'minor')
    expect(graph['V64'].translatedSource.notes).toEqual(['E', 'A', 'C'])
    expect(typeof graph['V64'].translatedSource.octMap).toBe('function')
    expect(graph['N6'].translatedSource.notes).toEqual(['D', 'F', 'Bb'])
  })
})

describe('lookUpGraph', () => {
  it('returns null for a graph that was never created', () => {
    expect(lookUpGraph('Gb', 'minor')).toBeNull()
  })

  it('returns the created graph', () => {
    chordGraphCreate('A', 'minor')
    const graph = lookUpGraph('A', 'minor')
    expect(graph).not.toBeNull()
    expect(graph?.['Am'].roman).toBe('Im')
  })
})

describe('getPhaseChordNames', () => {
  it('lists chords of a minor key across minor variants', () => {
    const names = getPhaseChordNames('A', 'minor')
    expect(names).toEqual(
      expect.arrayContaining(['Am', 'Bdim', 'C', 'Dm', 'E', 'G', 'G#dim'])
    )
  })

  it('filters by minor variant', () => {
    const natural = getPhaseChordNames('A', 'minor', 'natural')
    expect(natural).toContain('Em')
    expect(natural).not.toContain('E7')
  })

  it('supports major keys', () => {
    const names = getPhaseChordNames('C', 'major')
    expect(names).toEqual(expect.arrayContaining(['C', 'Dm', 'Em', 'F', 'G']))
  })

  it('throws for unsupported scale types', () => {
    expect(() => getPhaseChordNames('C', 'dorian')).toThrow(
      /Unsupported scale type/
    )
  })
})
