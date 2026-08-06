import { beforeAll, describe, expect, it } from 'vitest'

import { nextChordDetail } from '../nextChord'
import { chordGraphCreate } from './graphUtil'

// Characterization of the real major-key graph. Before this existed,
// chordGraphCreate('C', 'major') silently built the MINOR chart on major
// letters and returned Cm as the "tonic" of C major.
const C_MAJOR_NODES = [
  'C', // I
  'Em', // iii
  'Am', // vi
  'F', // IV
  'Dm', // ii
  'V64', // cadential 6/4
  'Bdim', // vii°
  'G', // V
  'N6',
  'Aug6',
  'A7', // V7/ii
  'C#dim', // vii°/ii
  'B7', // V7/iii
  'D#dim', // vii°/iii
  'C7', // V7/IV
  'Edim', // vii°/IV
  'D', // V/V
  'F#dim', // vii°/V
  'E7', // V7/vi
  'G#dim', // vii°/vi
  // diatonic sevenths, promoted to first-class nodes
  'Cmaj7', // Imaj7
  'Dm7', // IIm7
  'Fmaj7', // IVmaj7
  'G7', // V7
  'Bm7b5', // VIIm7b5 — HALF-diminished in major
]

describe('major chord graph', () => {
  beforeAll(() => {
    chordGraphCreate('C', 'major')
  })

  it('builds the C major graph with the expected nodes', () => {
    const graph = chordGraphCreate('C', 'major')
    expect(Object.keys(graph).sort()).toEqual([...C_MAJOR_NODES].sort())
  })

  it('roots the graph on a MAJOR tonic, not the borrowed-minor chart', () => {
    // regression for the original bug: 'C major' produced the minor chart's
    // nodes (Cm, Fm, B, E, ...) with Cm as tonic
    const graph = chordGraphCreate('C', 'major')
    expect(Object.keys(graph)).toContain('C')
    expect(Object.keys(graph)).not.toContain('Cm')
    expect(graph['C'].roman).toBe('I')
    expect(graph['C'].translatedSource.notes).toEqual(['C3', 'E3', 'G3'])
  })

  it('uses minor triads on degrees 2, 3 and 6', () => {
    // in major, ii/iii/vi are minor triads — spelling degree 2 as the minor
    // chart's IIdim would wrongly give Ddim in C
    const graph = chordGraphCreate('C', 'major')
    expect(graph['Dm'].roman).toBe('IIm')
    expect(graph['Em'].roman).toBe('IIIm')
    expect(graph['Am'].roman).toBe('VIm')
    expect(Object.keys(graph)).not.toContain('Ddim')
  })

  it('flows I -> tonic substitutes / predominants / dominant', () => {
    const graph = chordGraphCreate('C', 'major')
    expect(graph['C'].next.map((n) => n.name)).toEqual([
      'C',
      'Em',
      'Am',
      'F',
      'Dm',
      'V64',
      'Bdim',
      'G',
    ])
  })

  it('flows the predominant region toward the dominant', () => {
    const graph = chordGraphCreate('C', 'major')
    // iii and vi descend into the predominants
    expect(graph['Em'].next.map((n) => n.name)).toEqual(['Am', 'F', 'Dm'])
    expect(graph['Am'].next.map((n) => n.name)).toEqual(['F', 'Dm'])
    // IV reaches ii and the whole dominant complex
    expect(graph['F'].next.map((n) => n.name)).toEqual([
      'Dm',
      'V64',
      'Bdim',
      'G',
      'F#dim',
      'D',
      'N6',
      'Aug6',
    ])
    // the plagal cadence stays a weaker option, now alongside the seventh
    // forms of the chords IV already reaches
    expect(graph['F'].dotted.map((n) => n.name)).toEqual([
      'C',
      'Dm7',
      'Bm7b5',
      'G7',
      'Cmaj7',
    ])
  })

  it('resolves the cadential 6/4 to the dominant, not to the tonic', () => {
    // same classical direction the minor chart was flipped to: the 6/4 is
    // dominant-function (tonic notes over scale degree 5)
    const graph = chordGraphCreate('C', 'major')
    expect(graph['V64'].next.map((n) => n.name)).toEqual(['G'])
    // the dominant may be taken in its seventh form, as a weaker option
    expect(graph['V64'].dotted.map((n) => n.name)).toEqual(['G7'])
    // V64 in major takes scale degrees 5, 1, 3 — it needs 'major' passed through
    expect(graph['V64'].translatedSource.notes).toEqual(['G', 'C', 'E'])
  })

  it('routes N6 and Aug6 into the dominant complex', () => {
    const graph = chordGraphCreate('C', 'major')
    expect(graph['N6'].next.map((n) => n.name)).toEqual(['V64', 'G'])
    expect(graph['Aug6'].next.map((n) => n.name)).toEqual(['V64', 'G'])
    // Aug6 = b6, 1, #4 (absolute intervals, so mode-independent)
    expect(graph['Aug6'].translatedSource.notes).toEqual(['Ab', 'C', 'F#'])
    // N6 = the major triad on b2, in first inversion
    expect(graph['N6'].translatedSource.notes).toEqual(['F', 'Ab', 'Db'])
  })

  it('reaches the chromatic predominants only from the predominant region', () => {
    // N6/Aug6 are borrowed from the parallel minor: available as a
    // predominant substitution, but never offered straight from the tonic
    const graph = chordGraphCreate('C', 'major')
    expect(graph['F'].next.map((n) => n.name)).toContain('N6')
    expect(graph['Dm'].next.map((n) => n.name)).toContain('N6')
    expect(graph['C'].next.map((n) => n.name)).not.toContain('N6')
    expect(graph['C'].dotted.map((n) => n.name)).not.toContain('N6')
  })

  it('keeps predominant approaches to the cadential 6/4', () => {
    const graph = chordGraphCreate('C', 'major')
    for (const predominant of ['C', 'F', 'Dm', 'F#dim', 'D']) {
      expect(graph[predominant].next.map((n) => n.name)).toContain('V64')
    }
  })

  it('makes the deceptive cadence a dotted edge', () => {
    const graph = chordGraphCreate('C', 'major')
    expect(graph['G'].next.map((n) => n.name)).toEqual(['C'])
    // V -> vi evades the promised resolution, so it is offered as weaker,
    // now alongside the dominant's own seventh and the tonic seventh
    expect(graph['G'].dotted.map((n) => n.name)).toEqual(['Am', 'G7', 'Cmaj7'])
    const deceptive = graph['G'].dotted.find((n) => n.name === 'Am')
    expect(deceptive?.roman).toBe('VIm')
  })

  it('reaches each seventh only over a dotted edge', () => {
    // the promotion rule that keeps `nextChord` output unchanged
    const graph = chordGraphCreate('C', 'major')
    const sevenths = ['Cmaj7', 'Dm7', 'Fmaj7', 'G7', 'Bm7b5']
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
    const graph = chordGraphCreate('C', 'major')
    const names = (n: string) => graph[n].next.map((e) => e.name)
    expect(names('Cmaj7')).toEqual(names('C'))
    expect(names('Dm7')).toEqual(names('Dm'))
    expect(names('Fmaj7')).toEqual(names('F'))
    expect(names('Bm7b5')).toEqual(names('Bdim'))
    // V7 resolves to I exactly as V does, deceptive cadence included
    expect(names('G7')).toEqual(['C'])
    expect(graph['G7'].dotted.map((e) => e.name)).toContain('Am')
  })

  it('puts the diatonic vii° on the leading tone and resolves it to I', () => {
    const graph = chordGraphCreate('C', 'major')
    expect(graph['Bdim'].roman).toBe('VIIdim')
    expect(graph['Bdim'].translatedSource.notes).toEqual(['B3', 'D4', 'F4'])
    expect(graph['Bdim'].next.map((n) => n.name)).toEqual(['C', 'G'])
  })

  it('spells secondary dominants and leading-tone chords correctly', () => {
    const graph = chordGraphCreate('C', 'major')
    const spelled: [string, string][] = [
      ['A7', 'V7/IIm'],
      ['C#dim', 'VIIdim/IIm'],
      ['B7', 'V7/IIIm'],
      ['D#dim', 'VIIdim/IIIm'],
      ['C7', 'V7/IV'],
      ['Edim', 'VIIdim/IV'],
      ['D', 'V/V'],
      ['F#dim', 'VIIdim/V'],
      ['E7', 'V7/VIm'],
      ['G#dim', 'VIIdim/VIm'],
    ]
    for (const [name, roman] of spelled) {
      expect(graph[name], `${roman} should realize to ${name}`).toBeDefined()
      expect(graph[name].roman).toBe(roman)
    }
    // the two called out in the plan
    expect(graph['F#dim'].translatedSource.notes).toEqual(['F#3', 'A3', 'C4'])
    expect(graph['E7'].translatedSource.notes).toEqual(['E3', 'G#3', 'B3', 'D4'])
  })

  it('resolves each secondary chord to its target', () => {
    const graph = chordGraphCreate('C', 'major')
    expect(graph['A7'].next.map((n) => n.name)).toEqual(['Dm'])
    expect(graph['C#dim'].next.map((n) => n.name)).toEqual(['Dm'])
    expect(graph['B7'].next.map((n) => n.name)).toEqual(['Em'])
    expect(graph['C7'].next.map((n) => n.name)).toEqual(['F'])
    expect(graph['E7'].next.map((n) => n.name)).toEqual(['Am'])
    // V/V and vii°/V are predominants: they lead into the dominant complex
    expect(graph['D'].next.map((n) => n.name)).toEqual(['V64', 'Bdim', 'G'])
    expect(graph['F#dim'].next.map((n) => n.name)).toEqual(['V64', 'Bdim', 'G'])
  })

  it('annotates arrival context as the edge enabler', () => {
    const graph = chordGraphCreate('C', 'major')
    // ii records that the chart reaches it from I, iii, vi and IV
    const v64ViaDm = graph['Dm'].next.find((n) => n.name === 'V64')
    expect(v64ViaDm?.enabler).toEqual(['C', 'Em', 'Am', 'F'])
    // the tonic has no arrival context, so its edges are unconditional
    const v64ViaC = graph['C'].next.find((n) => n.name === 'V64')
    expect(v64ViaC?.enabler).toBeNull()
  })

  it('resolves every node and every edge to non-empty notes', () => {
    for (const key of ['C', 'G', 'F#', 'Eb', 'A', 'Db']) {
      const graph = chordGraphCreate(key, 'major')
      expect(Object.keys(graph)).toHaveLength(25)
      for (const [name, node] of Object.entries(graph)) {
        expect(
          node.translatedSource.notes.length,
          `${key} major: node ${name} has no notes`
        ).toBeGreaterThan(0)
        for (const edge of [...node.next, ...node.dotted]) {
          expect(
            edge.notes.length,
            `${key} major: edge ${name} -> ${edge.name} (${edge.roman}) has no notes`
          ).toBeGreaterThan(0)
        }
      }
    }
  })

  it('spells sharp and flat keys with their own accidentals', () => {
    // sharp key: the secondary leading-tone chords need double sharps
    const fSharp = chordGraphCreate('F#', 'major')
    expect(fSharp['F#'].roman).toBe('I')
    expect(fSharp['C#'].roman).toBe('V')
    expect(fSharp['E#dim'].roman).toBe('VIIdim')
    expect(fSharp['C##dim'].roman).toBe('VIIdim/VIm')
    expect(fSharp['A#m'].translatedSource.notes).toEqual(['A#3', 'C#4', 'E#4'])

    // flat key: no stray sharps in the diatonic chords
    const eFlat = chordGraphCreate('Eb', 'major')
    expect(eFlat['Eb'].roman).toBe('I')
    expect(eFlat['Bb'].roman).toBe('V')
    expect(eFlat['Ab'].roman).toBe('IV')
    expect(eFlat['Fm'].roman).toBe('IIm')
    expect(eFlat['Ddim'].roman).toBe('VIIdim')
    expect(eFlat['Ddim'].translatedSource.notes).toEqual(['D3', 'F3', 'Ab3'])
    expect(eFlat['G7'].roman).toBe('V7/VIm')
  })
})

describe('mode dispatch', () => {
  it('builds the major chart for a major key', () => {
    const graph = chordGraphCreate('G', 'major')
    expect(graph['G'].roman).toBe('I')
    expect(Object.keys(graph)).not.toContain('Gm')
  })

  it('builds the minor chart for a minor key', () => {
    const graph = chordGraphCreate('A', 'minor')
    expect(graph['Am'].roman).toBe('Im')
  })

  it('dispatches the ionian alias to the major chart', () => {
    // dispatch is on Scale.get(...).type, so aliases resolve for free
    const graph = chordGraphCreate('C', 'ionian')
    expect(graph['C'].roman).toBe('I')
    expect(Object.keys(graph).sort()).toEqual([...C_MAJOR_NODES].sort())
  })

  it('dispatches the aeolian alias to the minor chart', () => {
    const graph = chordGraphCreate('A', 'aeolian')
    expect(graph['Am'].roman).toBe('Im')
  })

  it('keeps the raw input string as the cache key', () => {
    // 'C ionian' and 'C major' resolve to the same chart but stay separate
    // cache entries — existing behavior, deliberately unchanged
    const viaAlias = chordGraphCreate('C', 'ionian')
    const viaName = chordGraphCreate('C', 'major')
    expect(viaAlias).not.toBe(viaName)
    expect(Object.keys(viaAlias).sort()).toEqual(Object.keys(viaName).sort())
  })

  it('throws for modes that have no chart instead of guessing', () => {
    // previously dorian et al. silently got the borrowed-minor graph
    expect(() => chordGraphCreate('D', 'dorian')).toThrow(/dorian/)
    expect(() => chordGraphCreate('G', 'mixolydian')).toThrow(/mixolydian/)
    expect(() => chordGraphCreate('C', 'lydian')).toThrow(
      /chord graphs exist only for major and minor/
    )
  })

  it('throws for an unrecognized scale name', () => {
    expect(() => chordGraphCreate('C', 'not-a-scale')).toThrow(/Unrecognized/)
  })
})

describe('nextChordDetail in a major key', () => {
  it('suggests the diatonic continuations of the tonic', () => {
    const suggestions = nextChordDetail('C,3', 'C', 'major')
    const byName = suggestions.map((s) => s.name)
    // the triads are the strong motions; the sevenths follow as dotted colour
    expect(byName).toEqual([
      'C',
      'Em',
      'Am',
      'F',
      'Dm',
      'V64',
      'Bdim',
      'G',
      'Cmaj7',
      'Fmaj7',
      'Dm7',
      'Bm7b5',
      'G7',
    ])
    expect(suggestions.filter((s) => s.strength === 'strong')).toHaveLength(8)
    for (const s of suggestions) {
      expect(s.notes.length).toBeGreaterThan(0)
      expect(s.enabledBy).toBeNull()
    }
    expect(suggestions.find((s) => s.name === 'G')?.roman).toBe('V')
    expect(suggestions.find((s) => s.name === 'G7')?.strength).toBe('dotted')
  })

  it('includes the deceptive resolution as a dotted suggestion of V', () => {
    const suggestions = nextChordDetail('G,3', 'C', 'major')
    const deceptive = suggestions.find((s) => s.name === 'Am')
    expect(deceptive?.strength).toBe('dotted')
    expect(deceptive?.roman).toBe('VIm')
    expect(suggestions.find((s) => s.name === 'C')?.strength).toBe('strong')
  })
})
