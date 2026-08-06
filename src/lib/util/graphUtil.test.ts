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
    expect(graph['E'].next.map((n) => n.name)).toEqual(['V64', 'Aug6', 'Am'])
    expect(graph['E'].dotted.map((n) => n.name)).toEqual(['A'])
  })

  it('realizes enabler names instead of leaving them roman', () => {
    // regression for the old todo at the fn-chord branch: enablers stayed
    // roman ('V', 'Im') and could never match graph keys
    const graph = chordGraphCreate('A', 'minor')
    const v64ViaE = graph['E'].next.find((n) => n.name === 'V64')
    expect(v64ViaE?.enabler).toEqual(['E'])
    const v64ViaAm = graph['Am'].next.find((n) => n.name === 'V64')
    expect(v64ViaAm?.enabler).toEqual(['Am'])
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
