import { describe, expect, it } from 'vitest'

import { major } from './graphData/major'
import { minor } from './graphData/minor'
import type { ChartEdge, ProgressionChart } from './graphData/types'
import { edgeChord } from './figuredBass'
import {
  functionLabel,
  functionMap,
  functionOf,
  taggedRomans,
  transitionCost,
} from './harmonicFunction'
import { chordGraphCreate, lookUpGraph } from './util/graphUtil'

const graphFor = (tonic: string, scale: string) =>
  lookUpGraph(tonic, scale) ?? chordGraphCreate(tonic, scale)

/** every roman that appears anywhere in a chart, as a node name or on an edge */
const romansInChart = (chart: ProgressionChart): string[] => {
  const out = new Set<string>()
  for (const [nodeName, entries] of Object.entries(chart)) {
    out.add(nodeName)
    for (const entry of entries) {
      out.add(entry.name)
      for (const edge of [...entry.next, ...(entry.dotted ?? [])] as ChartEdge[]) {
        out.add(edgeChord(edge))
      }
      for (const p of entry.prev ?? []) out.add(p)
    }
  }
  return [...out].sort()
}

describe('functionOf — the three tonal functions', () => {
  it('tags the tonic and its substitutes T', () => {
    expect(functionOf('I')).toBe('T')
    expect(functionOf('Im')).toBe('T')
    expect(functionOf('Imaj7')).toBe('T')
    expect(functionOf('Im7')).toBe('T')
    // iii and vi share two notes with the tonic and stand in for it
    expect(functionOf('IIIm')).toBe('T')
    expect(functionOf('VIm')).toBe('T')
    expect(functionOf('III')).toBe('T')
    expect(functionOf('VI')).toBe('T')
  })

  it('tags both predominants and their sevenths PD', () => {
    expect(functionOf('IV')).toBe('PD')
    expect(functionOf('IIm')).toBe('PD')
    expect(functionOf('IVm')).toBe('PD')
    expect(functionOf('IIdim')).toBe('PD')
    expect(functionOf('IIm7')).toBe('PD')
    expect(functionOf('IIm7b5')).toBe('PD')
    expect(functionOf('IVmaj7')).toBe('PD')
    expect(functionOf('IVm7')).toBe('PD')
  })

  it('tags the dominant complex D', () => {
    expect(functionOf('V')).toBe('D')
    expect(functionOf('V7')).toBe('D')
    expect(functionOf('VIIdim')).toBe('D')
    expect(functionOf('VIIdim7')).toBe('D')
    expect(functionOf('VIIm7b5')).toBe('D')
  })

  it('tags the chromatic predominants PD, not D', () => {
    // N6 and Aug6 exist to approach the dominant; the chart gives them exactly
    // a predominant's edges (-> V64, -> V)
    expect(functionOf('N6')).toBe('PD')
    expect(functionOf('Aug6')).toBe('PD')
  })

  // --- the four cases a scale-degree scheme gets WRONG (probed) ------------

  it('tags the cadential 6/4 as DOMINANT, not tonic', () => {
    // V64 spells a tonic triad and functions as a dominant: its sixth and
    // fourth are suspensions over a held dominant bass. Tagging it T would make
    // the search read `V64 - V` as tension-discharging when both chords are
    // the dominant.
    expect(functionOf('V64')).toBe('D')
  })

  it('tags the minor-key subtonic VII as TONIC, not dominant', () => {
    // VII in a minor key is the MAJOR triad on the lowered seventh (G in A
    // minor) and contains no leading tone. The chart routes it to III — the
    // move to the relative major it exists for — not to the tonic.
    expect(functionOf('VII')).toBe('T')
    // pin the premise: it really is the lowered seventh in the chart
    const g = graphFor('A', 'minor')!
    expect(g['G'].roman).toBe('VII')
  })

  it('tags applied dominants OF THE DOMINANT as predominant', () => {
    // locally dominant, functionally predominant in the home key — and the
    // chart agrees: V/V goes exactly where ii and IV go
    expect(functionOf('V/V')).toBe('PD')
    expect(functionOf('VIIdim/V')).toBe('PD')
    const g = graphFor('C', 'major')!
    const vOfV = g['D']
    expect(vOfV.roman).toBe('V/V')
    expect(vOfV.next.map((e) => e.roman)).toContain('V')
  })

  it('tags other applied chords by the function of their target', () => {
    // an applied dominant of ii delivers a predominant, so it sits in the
    // predominant region; one of vi delivers a tonic substitute
    expect(functionOf('V7/IIm')).toBe('PD')
    expect(functionOf('VIIdim/IIm')).toBe('PD')
    expect(functionOf('V7/VIm')).toBe('T')
    expect(functionOf('VIIdim/VIm')).toBe('T')
    expect(functionOf('V7/IIIm')).toBe('T')
    expect(functionOf('V7/IV')).toBe('PD')
    expect(functionOf('V7/III')).toBe('T')
    expect(functionOf('V7/VII')).toBe('T')
  })

  it('is a COUNTER-example to degree-based tagging: A7 in C major', () => {
    // root A = degree 6, which a degree scheme reads as vi (tonic). It is
    // V7/IIm — an applied dominant, predominant in function.
    const g = graphFor('C', 'major')!
    expect(g['A7'].roman).toBe('V7/IIm')
    expect(functionOf(g['A7'].roman)).toBe('PD')
  })

  it('is a COUNTER-example to degree-based tagging: G7 in A minor', () => {
    // root G = degree 7, which a degree scheme reads as a dominant. It is
    // V7/III — it prepares the mediant, not the tonic.
    const g = graphFor('A', 'minor')!
    expect(g['G7'].roman).toBe('V7/III')
    expect(functionOf(g['G7'].roman)).toBe('T')
  })

  it('ignores figures — a figure changes the bass, never the function', () => {
    expect(functionOf('I6')).toBe('T')
    expect(functionOf('V6')).toBe('D')
    expect(functionOf('V65')).toBe('D')
    expect(functionOf('V43')).toBe('D')
    expect(functionOf('V42')).toBe('D')
    expect(functionOf('VIIdim6')).toBe('D')
    expect(functionOf('Im6')).toBe('T')
    // and the figured form agrees with the unfigured one for every roman
    for (const [plain, figured] of [
      ['I', 'I6'],
      ['V', 'V6'],
      ['V7', 'V65'],
      ['V7', 'V43'],
      ['V7', 'V42'],
      ['VIIdim', 'VIIdim6'],
    ] as const) {
      expect(functionOf(figured), `${figured} should match ${plain}`).toBe(
        functionOf(plain)
      )
    }
  })

  it('does not mistake the V64 node name for a figured V', () => {
    // 'V64' ends in '64' but is a NODE NAME, not V with a 6/4 figure. It is
    // looked up directly, so stripping never runs on it.
    expect(functionOf('V64')).toBe('D')
  })

  it('returns null for an unknown roman rather than guessing', () => {
    expect(functionOf('nonsense')).toBeNull()
    expect(functionOf('')).toBeNull()
    expect(functionOf('XI')).toBeNull()
  })
})

describe('chart coverage', () => {
  // If another stream adds a node or edge to a chart, this fails rather than
  // letting the new chord fall silently through to an untagged, unweighted
  // search. B4 in particular adds chromatic nodes.
  it.each([
    ['major', major],
    ['minor', minor],
  ])('tags every roman in the %s chart', (_mode, chart) => {
    const untagged = romansInChart(chart as ProgressionChart).filter(
      (r) => functionOf(r) === null
    )
    expect(
      untagged,
      `untagged romans in the ${_mode} chart — add them to FUNCTION_BY_ROMAN in harmonicFunction.ts`
    ).toEqual([])
  })

  it('tags every node of a realized graph in both modes', () => {
    for (const [tonic, scale] of [
      ['C', 'major'],
      ['A', 'minor'],
      ['F#', 'major'],
      ['Eb', 'minor'],
    ] as const) {
      const g = graphFor(tonic, scale)!
      const map = functionMap(g)
      const nodeNames = Object.keys(g)
      expect(
        nodeNames.filter((n) => !map[n]),
        `untagged nodes in ${tonic} ${scale}`
      ).toEqual([])
    }
  })

  it('functionMap keys by realized name but tags by roman', () => {
    // Bdim is VIIdim (dominant) in C major and IIdim (predominant) in A minor —
    // the same NAME with two functions, which is exactly why the map is built
    // per key rather than baked in as a constant.
    expect(functionMap(graphFor('C', 'major')!)['Bdim']).toBe('D')
    expect(functionMap(graphFor('A', 'minor')!)['Bdim']).toBe('PD')
  })
})

describe('transitionCost — what makes the search goal-directed', () => {
  it('makes the cycle free', () => {
    expect(transitionCost('T', 'PD')).toBe(0)
    expect(transitionCost('PD', 'D')).toBe(0)
    expect(transitionCost('D', 'T')).toBe(0)
  })

  it('charges a little for skipping the predominant', () => {
    // I - V - I is good music, just less shapely than I - IV - V - I
    expect(transitionCost('T', 'D')).toBe(1)
    expect(transitionCost('T', 'D')).toBeGreaterThan(transitionCost('T', 'PD'))
  })

  it('charges more for standing still than for moving forward', () => {
    for (const fn of ['T', 'PD', 'D'] as const) {
      expect(transitionCost(fn, fn)).toBeGreaterThan(0)
    }
    // this is what stops the search answering everything with I - I - I - V - I
    expect(transitionCost('T', 'T')).toBeGreaterThan(transitionCost('T', 'PD'))
  })

  it('charges most for retreating against the cycle, but permits it', () => {
    // V - IV - I exists in the literature; it is just not what to hand someone
    // who asked for a path TO a cadence
    expect(transitionCost('D', 'PD')).toBe(3)
    expect(transitionCost('PD', 'T')).toBe(3)
    expect(transitionCost('D', 'PD')).toBeLessThan(Infinity)
    expect(transitionCost('D', 'PD')).toBeGreaterThan(transitionCost('D', 'D'))
  })

  it('treats an untagged chord neutrally, not punitively', () => {
    // the vocabulary is expected to grow (B4); a punitive default would make
    // every new chromatic node invisible to the search
    expect(transitionCost(null, 'D')).toBe(2)
    expect(transitionCost('T', null)).toBe(2)
    expect(transitionCost(null, null)).toBe(2)
    expect(transitionCost(null, 'D', 7)).toBe(7)
  })

  it('is a total function over the nine pairs', () => {
    for (const a of ['T', 'PD', 'D'] as const) {
      for (const b of ['T', 'PD', 'D'] as const) {
        expect(typeof transitionCost(a, b)).toBe('number')
      }
    }
  })
})

describe('vocabulary and labels', () => {
  it('taggedRomans is sorted and non-empty', () => {
    const r = taggedRomans()
    expect(r.length).toBeGreaterThan(20)
    expect(r).toEqual([...r].sort())
    expect(r).toContain('V64')
    expect(r).toContain('VII')
  })

  it('labels each function for a human', () => {
    expect(functionLabel('T')).toBe('tonic')
    expect(functionLabel('PD')).toBe('predominant')
    expect(functionLabel('D')).toBe('dominant')
  })
})
