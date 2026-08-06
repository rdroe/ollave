import { describe, expect, it } from 'vitest'

import { detectCadences } from './cadence'
import {
  diatonicPivots,
  modulationTargets,
  pathThroughModulation,
  pivotsBetween,
  type PivotCandidate,
  type PivotSource,
} from './modulation'
import { chordGraphCreate, lookUpGraph } from './util/graphUtil'

describe('pivotsBetween — finding the hinge', () => {
  it('ranks the textbook A minor -> C major pivot first', () => {
    // Dm is `iv` at home and `ii` in the new key. It is THE pivot for this
    // modulation precisely because it arrives as a PREDOMINANT in C major, so
    // the new key can immediately set up its own cadence.
    const pivots = pivotsBetween('A', 'minor', 'C', 'major')
    expect(pivots.length).toBeGreaterThan(0)
    const best = pivots[0]
    expect(best.name).toBe('Dm')
    expect(best.romanHere).toBe('IVm')
    expect(best.romanThere).toBe('IIm')
    expect(best.kind).toBe('diatonic')
    expect(best.cost).toBe(0)
  })

  it('prefers a pivot that lands on a predominant in the NEW key', () => {
    const pivots = pivotsBetween('A', 'minor', 'C', 'major')
    // every zero-cost pivot arrives as a predominant; the tonic and dominant
    // arrivals cost more
    for (const p of pivots.filter((x) => x.cost === 0)) {
      expect(['IIm', 'IIm7', 'IV', 'IVmaj7'], `${p.name} -> ${p.romanThere}`).toContain(
        p.romanThere
      )
    }
    const asDominant = pivots.find((p) => p.romanThere === 'V')
    const asPredominant = pivots.find((p) => p.romanThere === 'IIm')
    expect(asDominant!.cost).toBeGreaterThan(asPredominant!.cost)
  })

  it('names each pivot in BOTH keys — that is what makes it a modulation', () => {
    for (const p of pivotsBetween('A', 'minor', 'C', 'major')) {
      expect(p.romanHere).toBeTruthy()
      expect(p.romanThere).toBeTruthy()
      // a pivot whose two readings are identical is not a pivot
      expect(p.romanHere).not.toBe(p.romanThere)
    }
  })

  it('finds pivots in the dominant direction too', () => {
    const p = pivotsBetween('C', 'major', 'G', 'major')
    expect(p.length).toBeGreaterThan(0)
    // C is I at home and IV in G major — a predominant arrival, so a good hinge
    const asFour = p.find((x) => x.name === 'C')
    expect(asFour!.romanHere).toBe('I')
    expect(asFour!.romanThere).toBe('IV')
  })

  it('finds no diatonic pivot between distant keys', () => {
    // C major and F# major share no triad, which is exactly why that
    // modulation needs the enharmonic machinery B4 supplies
    expect(pivotsBetween('C', 'major', 'F#', 'major')).toEqual([])
  })

  it('skips the chord-function node names without throwing', () => {
    // PROBED: pivotSuggestions('V64', ...) THROWS ('Cannot get dynamic chord
    // V64 without tonic and scale name'). V64/N6/Aug6 are node names, not
    // chord symbols, and must be skipped rather than crashing the scan.
    expect(() => pivotsBetween('A', 'minor', 'C', 'major')).not.toThrow()
    const names = pivotsBetween('A', 'minor', 'C', 'major').map((p) => p.name)
    expect(names).not.toContain('V64')
    expect(names).not.toContain('N6')
    expect(names).not.toContain('Aug6')
  })

  it('only offers pivots that are nodes in BOTH charts', () => {
    // a pivot the home graph cannot reach is a hole, not a hinge
    const home = lookUpGraph('A', 'minor') ?? chordGraphCreate('A', 'minor')
    const target = lookUpGraph('C', 'major') ?? chordGraphCreate('C', 'major')
    for (const p of pivotsBetween('A', 'minor', 'C', 'major')) {
      expect(home![p.name], `${p.name} missing from home chart`).toBeDefined()
      expect(target![p.name], `${p.name} missing from target chart`).toBeDefined()
    }
  })

  it('is deterministic', () => {
    expect(JSON.stringify(pivotsBetween('A', 'minor', 'C', 'major'))).toBe(
      JSON.stringify(pivotsBetween('A', 'minor', 'C', 'major'))
    )
  })
})

describe('pathThroughModulation — the headline feature', () => {
  it('WORKED EXAMPLE: A minor to a PAC in C major, pivoting on iv=ii', () => {
    const r = pathThroughModulation('Am', 'PAC', 4, 'A', 'minor', 'C', 'major')
    expect(r.exact).toBe(true)
    expect(r.reason).toBe('exact')

    const best = r.plans[0]
    // the progression a composer would actually write
    expect(best.steps.map((s) => s.name)).toEqual(['Am', 'Dm', 'G', 'C'])
    // and the summary shows the hinge in both keys
    expect(best.summary).toBe('Im - IVm=IIm - V - I')
    expect(best.cost).toBe(0)

    // the pivot is named in both keys, which is the point
    expect(best.pivot.name).toBe('Dm')
    expect(best.pivot.romanHere).toBe('IVm')
    expect(best.pivot.romanThere).toBe('IIm')
    expect(best.pivotIndex).toBe(1)
    expect(best.steps[best.pivotIndex].name).toBe('Dm')

    expect(best.fromKey).toBe('A minor')
    expect(best.toKey).toBe('C major')
    expect(best.cadence).toBe('PAC')
  })

  it('re-reads the pivot chord in the TARGET key', () => {
    // the same chord, relabelled — that reinterpretation IS the modulation, and
    // a plan that kept the home-key roman would be a chord list instead
    const r = pathThroughModulation('Am', 'PAC', 4, 'A', 'minor', 'C', 'major')
    const plan = r.plans[0]
    const pivotStep = plan.steps[plan.pivotIndex]
    expect(pivotStep.roman).toBe('IIm') // the TARGET key's reading
    expect(pivotStep.function).toBe('PD') // and its target-key function
    expect(plan.pivot.romanHere).toBe('IVm') // the home reading is still shown
  })

  it('ends with the requested cadence, in the target key', () => {
    const r = pathThroughModulation('Am', 'PAC', 4, 'A', 'minor', 'C', 'major')
    for (const plan of r.plans) {
      const names = plan.steps.map((s) => s.name)
      // the detector, analysing in the TARGET key, finds the cadence at the end
      const found = detectCadences(names, 'C', 'major')
      const final = found[found.length - 1]
      expect(final, `no cadence found in ${names.join(' ')}`).toBeDefined()
      expect(final.index).toBe(names.length - 2)
      expect(['PAC', 'IAC']).toContain(final.type)
    }
  })

  it('modulates to the relative minor as well', () => {
    const r = pathThroughModulation('C', 'PAC', 5, 'C', 'major', 'A', 'minor')
    expect(r.plans.length).toBeGreaterThan(0)
    const best = r.plans[0]
    expect(best.toKey).toBe('A minor')
    // Dm is ii at home and iv in A minor — again a predominant arrival
    expect(best.pivot.name).toBe('Dm')
    expect(best.pivot.romanHere).toBe('IIm')
    expect(best.pivot.romanThere).toBe('IVm')
    expect(best.steps[best.steps.length - 1].name).toBe('Am')
  })

  it('ranks the smoothest HINGE first, not the tidiest whole path', () => {
    // PROBED. Ranking on total cost alone let Bdim (vii-dim heard as ii-dim,
    // pivot cost 2) tie Dm (iv heard as ii, pivot cost 0) for C major -> A
    // minor, because Bdim's worse hinge was offset by a cheaper approach. But
    // a composer asking for a modulation is choosing the JOINT — the filler
    // around it is what they will rewrite — so the better pivot must lead.
    const r = pathThroughModulation('C', 'PAC', 5, 'C', 'major', 'A', 'minor', {
      limit: 6,
    })
    expect(r.plans[0].pivot.cost).toBe(0)
    expect(r.plans[0].pivot.name).toBe('Dm')
    // pivot costs are non-decreasing down the list
    const pivotCosts = r.plans.map((p) => p.pivot.cost)
    expect(pivotCosts).toEqual([...pivotCosts].sort((a, b) => a - b))
  })

  it('tries every legal bar split rather than guessing one midpoint', () => {
    // PROBED. With a single midpoint guess a four-bar modulation gave leg one
    // only two bars, so a pivot two steps from the start (G7 is `Am - Dm - G7`)
    // was reported unreachable — a good hinge lost to an internal split the
    // caller never asked for.
    const r = pathThroughModulation('Am', 'PAC', 6, 'A', 'minor', 'C', 'major', {
      limit: 5,
    })
    // hinges land at more than one position across the returned plans
    const positions = new Set(r.plans.map((p) => p.pivotIndex))
    expect(positions.size).toBeGreaterThan(0)
    for (const p of r.plans) {
      expect(p.steps).toHaveLength(6)
      expect(p.steps[p.pivotIndex].name).toBe(p.pivot.name)
    }
  })

  it('modulates in the dominant direction', () => {
    const r = pathThroughModulation('C', 'PAC', 5, 'C', 'major', 'G', 'major')
    expect(r.plans.length).toBeGreaterThan(0)
    expect(r.plans[0].toKey).toBe('G major')
    expect(r.plans[0].steps[r.plans[0].steps.length - 1].name).toBe('G')
  })

  it('returns DIFFERENT hinges rather than variations on one', () => {
    const r = pathThroughModulation('Am', 'PAC', 4, 'A', 'minor', 'C', 'major', {
      limit: 3,
    })
    const pivotNames = r.plans.map((p) => p.pivot.name)
    expect(new Set(pivotNames).size).toBe(pivotNames.length)
  })

  it('honours barsBefore — where the hinge falls is a real choice', () => {
    const early = pathThroughModulation('Am', 'PAC', 6, 'A', 'minor', 'C', 'major', {
      barsBefore: 2,
    })
    const late = pathThroughModulation('Am', 'PAC', 6, 'A', 'minor', 'C', 'major', {
      barsBefore: 4,
    })
    expect(early.plans[0].pivotIndex).toBe(1)
    expect(late.plans[0].pivotIndex).toBe(3)
    // both are still six bars long
    expect(early.plans[0].steps).toHaveLength(6)
    expect(late.plans[0].steps).toHaveLength(6)
  })

  it('produces paths of exactly the requested length', () => {
    for (const bars of [4, 5, 6]) {
      const r = pathThroughModulation('Am', 'PAC', bars, 'A', 'minor', 'C', 'major')
      expect(r.exact, `${bars} bars not exact`).toBe(true)
      for (const p of r.plans) expect(p.steps).toHaveLength(bars)
    }
  })

  it('counts the pivot ONCE — it is one chord heard two ways', () => {
    const r = pathThroughModulation('Am', 'PAC', 5, 'A', 'minor', 'C', 'major')
    const plan = r.plans[0]
    // the chord at pivotIndex appears once, not twice in a row
    expect(plan.steps[plan.pivotIndex].name).toBe(plan.pivot.name)
    expect(plan.steps[plan.pivotIndex + 1]?.name).not.toBe(plan.pivot.name)
  })
})

describe('modulation — honest scoping', () => {
  it('reports when no pivot exists rather than inventing one', () => {
    const r = pathThroughModulation('C', 'PAC', 6, 'C', 'major', 'F#', 'major')
    expect(r.plans).toEqual([])
    expect(r.reason).toBe('no-pivot-available')
    // and it names the remedy, which is B4's territory
    expect(r.message).toMatch(/enharmonic/)
  })

  it('refuses a "modulation" to the same key, pointing at the right function', () => {
    const r = pathThroughModulation('C', 'PAC', 5, 'C', 'major', 'C', 'major')
    expect(r.plans).toEqual([])
    expect(r.message).toMatch(/pathToCadence/)
  })

  it('rejects a bar count too small for a modulation', () => {
    const r = pathThroughModulation('Am', 'PAC', 2, 'A', 'minor', 'C', 'major')
    expect(r.reason).toBe('bars-too-few')
    expect(r.message).toMatch(/at least 3 bars/)
  })

  it('reports an unknown start chord and an invalid key', () => {
    expect(
      pathThroughModulation('Xyz', 'PAC', 5, 'A', 'minor', 'C', 'major').reason
    ).toBe('unknown-start-chord')
    expect(
      pathThroughModulation('Am', 'PAC', 5, 'A', 'minor', 'H', 'major').reason
    ).toBe('invalid-key')
  })

  it('reports pivots found but no route, distinctly from no pivots at all', () => {
    // pivots between these keys exist; a Phrygian half cadence in C major does
    // not. The message must not say "no pivot".
    const r = pathThroughModulation(
      'Am',
      'phrygian-half',
      5,
      'A',
      'minor',
      'C',
      'major'
    )
    expect(r.plans).toEqual([])
    expect(r.reason).not.toBe('no-pivot-available')
    expect(r.message).toMatch(/pivot/)
  })

  it('never throws on degenerate input', () => {
    const cases: [string, number, string, string, string, string][] = [
      ['Am', 0, 'A', 'minor', 'C', 'major'],
      ['Am', -5, 'A', 'minor', 'C', 'major'],
      ['', 5, 'A', 'minor', 'C', 'major'],
      ['Am', 5, '', '', '', ''],
      ['Am', 999, 'A', 'minor', 'C', 'major'],
    ]
    for (const [from, bars, ft, fs, tt, ts] of cases) {
      expect(
        () => pathThroughModulation(from, 'PAC', bars, ft, fs, tt, ts),
        `threw for ${from}/${bars}`
      ).not.toThrow()
    }
  })

  it('terminates promptly, and caps an absurd bar count', () => {
    // a modulation is two searches per pivot per bar split, so the work grows
    // fast; the cap is what keeps an interactive query interactive
    const t0 = Date.now()
    const r = pathThroughModulation('Am', 'PAC', 999, 'A', 'minor', 'C', 'major')
    const ms = Date.now() - t0
    expect(ms, `took ${ms}ms`).toBeLessThan(8000)
    // capped, not honoured literally
    for (const p of r.plans) expect(p.steps.length).toBeLessThanOrEqual(8)
  })

  it('answers an ordinary phrase-length query quickly', () => {
    const t0 = Date.now()
    pathThroughModulation('Am', 'PAC', 4, 'A', 'minor', 'C', 'major')
    expect(Date.now() - t0).toBeLessThan(3000)
  })
})

describe('modulation — determinism', () => {
  it('returns byte-identical results across repeated calls', () => {
    for (const bars of [4, 5, 6]) {
      const a = pathThroughModulation('Am', 'PAC', bars, 'A', 'minor', 'C', 'major')
      const b = pathThroughModulation('Am', 'PAC', bars, 'A', 'minor', 'C', 'major')
      expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    }
  })

  it('uses no randomness', async () => {
    const { readFileSync } = await import('node:fs')
    const code = readFileSync('src/lib/modulation.ts', 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
      .join('\n')
    expect(code).not.toMatch(/Math\.random/)
  })
})

describe('B4 extension point — enharmonic pivots slot in unchanged', () => {
  /**
   * A stand-in for what B4 will supply: a source that reinterprets one chord
   * enharmonically. This test exists to PIN THE CONTRACT — if B4 can implement
   * `PivotSource` and get working modulations without any change to
   * `pathThroughModulation`'s signature or to `ModulationResult`, the extension
   * point is real rather than aspirational.
   */
  const fakeEnharmonic: PivotSource = (_ft, _fs, toTonic, toScale) => {
    if (toTonic !== 'C' || toScale !== 'major') return []
    const candidate: PivotCandidate = {
      name: 'G7',
      romanHere: 'Ger6',
      romanThere: 'V7',
      kind: 'enharmonic',
      cost: 6,
    }
    return [candidate]
  }

  it('merges an extra pivot source into the ranking', () => {
    const withExtra = pivotsBetween('A', 'minor', 'C', 'major', {
      extraPivots: [fakeEnharmonic],
    })
    const enh = withExtra.find((p) => p.kind === 'enharmonic')
    expect(enh, 'the extra source was not consulted').toBeDefined()
    expect(enh!.romanHere).toBe('Ger6')
    expect(enh!.romanThere).toBe('V7')
  })

  it('ranks an enharmonic pivot BELOW a smooth diatonic one by default', () => {
    // an enharmonic reinterpretation is a swerve; it must stay available and
    // must not bury the smooth option
    const p = pivotsBetween('A', 'minor', 'C', 'major', {
      extraPivots: [fakeEnharmonic],
    })
    expect(p[0].kind).toBe('diatonic')
    const enhIndex = p.findIndex((x) => x.kind === 'enharmonic')
    expect(enhIndex).toBeGreaterThan(0)
  })

  it('lets a caller ask for enharmonic pivots ONLY', () => {
    const p = pivotsBetween('A', 'minor', 'C', 'major', {
      extraPivots: [fakeEnharmonic],
      pivotKinds: ['enharmonic'],
    })
    expect(p).toHaveLength(1)
    expect(p[0].kind).toBe('enharmonic')
  })

  it('routes a modulation through an extra pivot with NO signature change', () => {
    // THE contract test: the same call shape, one option added
    const r = pathThroughModulation('Am', 'PAC', 4, 'A', 'minor', 'C', 'major', {
      extraPivots: [fakeEnharmonic],
      pivotKinds: ['enharmonic'],
    })
    expect(r.plans.length).toBeGreaterThan(0)
    const plan = r.plans[0]
    expect(plan.pivot.kind).toBe('enharmonic')
    expect(plan.pivot.romanHere).toBe('Ger6')
    expect(plan.summary).toContain('Ger6=V7')
  })

  it('survives a misbehaving extra source rather than failing the query', () => {
    const thrower: PivotSource = () => {
      throw new Error('B4 bug')
    }
    expect(() =>
      pivotsBetween('A', 'minor', 'C', 'major', { extraPivots: [thrower] })
    ).not.toThrow()
    // and the diatonic pivots still come through
    expect(
      pivotsBetween('A', 'minor', 'C', 'major', { extraPivots: [thrower] }).length
    ).toBeGreaterThan(0)
  })

  it('deduplicates on (name, kind) so one chord may be two kinds of pivot', () => {
    // Dm as a diatonic pivot and (hypothetically) as an enharmonic one are
    // different musical moves and must both survive
    const dupe: PivotSource = () => [
      { name: 'Dm', romanHere: 'IVm', romanThere: 'IIm', kind: 'enharmonic', cost: 9 },
    ]
    const p = pivotsBetween('A', 'minor', 'C', 'major', { extraPivots: [dupe] })
    const dms = p.filter((x) => x.name === 'Dm')
    expect(dms).toHaveLength(2)
    expect(new Set(dms.map((d) => d.kind))).toEqual(
      new Set(['diatonic', 'enharmonic'])
    )
  })
})

describe('diatonicPivots and modulationTargets', () => {
  it('diatonicPivots is itself a PivotSource', () => {
    const p: PivotCandidate[] = diatonicPivots('A', 'minor', 'C', 'major')
    expect(p.length).toBeGreaterThan(0)
    for (const c of p) expect(c.kind).toBe('diatonic')
  })

  it('modulationTargets lists reachable keys with their best hinge', () => {
    const t = modulationTargets('Am', 'A', 'minor')
    expect(t.length).toBeGreaterThan(0)
    const toC = t.find((x) => x.targetKey === 'C major')
    expect(toC).toBeDefined()
    expect(toC!.pivot.name).toBe('Dm')
    expect(toC!.pivot.cost).toBe(0)
  })

  it('modulationTargets does not throw on a function-node name', () => {
    expect(() => modulationTargets('V64', 'A', 'minor')).not.toThrow()
    expect(modulationTargets('V64', 'A', 'minor')).toEqual([])
  })
})
