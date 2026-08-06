import { describe, expect, it } from 'vitest'

import {
  chromaticNodePivotSource,
  chromaticPivotSources,
  enharmonicPivotSource,
} from './chromaticPivots'
import { enharmonicPivots } from './chromatic'
import {
  pathThroughModulation,
  pivotsBetween,
  type PivotCandidate,
} from './modulation'

/**
 * Stage M-C, C1 and C3 — B4's chromatic vocabulary reaching B2's pathfinder.
 *
 * B2 pinned this contract with a STAND-IN source (see `modulation.test.ts`,
 * "B4 extension point"). These tests use the real ones, and the standard they
 * are held to is the one the plan set: an actual Ger⁶↔V⁷ modulation must route
 * END TO END, not merely enumerate.
 */

describe('C1 — enharmonicPivotSource is a real PivotSource', () => {
  it('satisfies the PivotSource type without any signature change', () => {
    // the contract, checked by the compiler: the stand-in's type and the real
    // one's are the same type
    const candidates: PivotCandidate[] = enharmonicPivotSource(
      'C',
      'major',
      'Db',
      'major'
    )
    expect(candidates.length).toBeGreaterThan(0)
  })

  it('adapts B4 chord-driven output into B2 key-pair-driven candidates', () => {
    // B4 is asked about a CHORD and answers with keys; B2 asks about a KEY PAIR
    // and wants chords. The adapter is the join, and this is the join working:
    // exactly the pivot B4 reports for Ger6 comes back keyed by the key pair.
    const fromB4 = enharmonicPivots('Ger6', 'C', 'major')
    expect(fromB4.map((p) => p.targetKey)).toContain('Db major')

    const adapted = enharmonicPivotSource('C', 'major', 'Db', 'major')
    const ger = adapted.find((p) => p.name === 'Ger6')
    expect(ger).toBeDefined()
    expect(ger!.kind).toBe('enharmonic')
    expect(ger!.romanHere).toBe('Ger6')
    expect(ger!.romanThere).toBe('V7')
  })

  it('carries the two spellings, which is what an enharmonic pivot IS', () => {
    // `name` is the HOME chart's node, `nameThere` the TARGET chart's. One
    // string cannot describe a chord heard two ways — probed before `nameThere`
    // existed, and both single-name forms produced `unreachable-cadence`.
    const ger = enharmonicPivotSource('C', 'major', 'Db', 'major').find(
      (p) => p.name === 'Ger6'
    )!
    expect(ger.name).toBe('Ger6')
    expect(ger.nameThere).toBe('Ab7')
  })

  it("preserves B4's explanation prose rather than dropping it at the boundary", () => {
    const ger = enharmonicPivotSource('C', 'major', 'Db', 'major').find(
      (p) => p.name === 'Ger6'
    )!
    // the fact the romans alone cannot state: WHICH note was respelled
    expect(ger.explanation).toMatch(/respelling F# as Gb/)
    expect(ger.explanation).toMatch(/Ab7/)
    // and it is byte-identical to B4's, not a paraphrase
    const b4 = enharmonicPivots('Ger6', 'C', 'major').find(
      (p) => p.targetKey === 'Db major'
    )!
    expect(ger.explanation).toBe(b4.explanation)
  })

  it('THE HEADLINE: a Ger6 <-> V7 modulation routes end to end', () => {
    // The most famous enharmonic modulation in the common-practice repertoire,
    // as a working four-bar plan. The German sixth of C major (Ab-C-Eb-F#) is
    // respelled Ab-C-Eb-Gb = Ab7, the dominant seventh of Db.
    const r = pathThroughModulation('C', 'PAC', 4, 'C', 'major', 'Db', 'major', {
      extraPivots: chromaticPivotSources,
      pivotKinds: ['enharmonic'],
    })
    expect(r.reason).toBe('exact')
    expect(r.plans.length).toBeGreaterThan(0)

    const plan = r.plans[0]
    expect(plan.summary).toBe('I - IIm - Ger6=V7 - I')
    // the REALIZED chords, which is what a composer plays
    expect(plan.steps.map((s) => s.name)).toEqual(['C', 'Dm', 'Ab7', 'Db'])
    expect(plan.pivot.name).toBe('Ger6')
    expect(plan.pivot.nameThere).toBe('Ab7')
    expect(plan.pivotIndex).toBe(2)
    // the pivot step is spelled as the TARGET key hears it, because from that
    // chord onward the music is in Db
    expect(plan.steps[2].name).toBe('Ab7')
    expect(plan.steps[2].roman).toBe('V7')
    expect(plan.steps[2].function).toBe('D')
    expect(plan.fromKey).toBe('C major')
    expect(plan.toKey).toBe('Db major')
  })

  it('routes a diminished-seventh rotation too', () => {
    // the second of B4's two families. G#dim7 is the leading-tone seventh of A
    // minor; the same four pitches spelled Bdim7 are the leading-tone seventh
    // of C minor. Both romans read VIIdim7 because both readings ARE that — the
    // chord changes key without changing function, which is the device.
    const r = pathThroughModulation('Am', 'PAC', 5, 'A', 'minor', 'C', 'minor', {
      extraPivots: chromaticPivotSources,
      pivotKinds: ['enharmonic'],
    })
    expect(r.reason).toBe('exact')
    const plan = r.plans[0]
    expect(plan.pivot.name).toBe('G#dim7')
    expect(plan.pivot.nameThere).toBe('Bdim7')
    expect(plan.steps.map((s) => s.name)).toEqual(['Am', 'Bdim', 'Bdim7', 'G', 'Cm'])
  })

  it('drops a reinterpretation whose target chart has no node for it', () => {
    // PROBED, and it is why rule 2 exists. B4 correctly reports that G#dim7 is
    // also Ddim7, the leading-tone seventh of Eb — but `Ddim7` is not a node in
    // the Eb major chart, so the second leg would have nowhere to start.
    // Offering it would be a modulation the search cannot walk.
    const fromB4 = enharmonicPivots('G#dim7', 'A', 'minor')
    expect(fromB4.some((p) => p.targetKey === 'Eb major')).toBe(true)
    expect(enharmonicPivotSource('A', 'minor', 'Eb', 'major')).toEqual([])
  })

  it('is scored on the SAME scale as the diatonic pivots', () => {
    // `pivotsBetween` does not recompute a source's cost, so a source scoring
    // itself differently would be a silent misranking. The surcharge table lives
    // in modulation.ts and both sides call `pivotCost`.
    const all = pivotsBetween('C', 'major', 'Db', 'major', {
      extraPivots: chromaticPivotSources,
    })
    const ger = all.find((p) => p.kind === 'enharmonic')!
    // Ger6 is PD at home, V7 is D there: 3 (dominant there) + 0 (PD here)
    // + 3 (the enharmonic surcharge) = 6
    expect(ger.cost).toBe(6)
  })

  it('does NOT outrank a smooth diatonic hinge', () => {
    // the plan's requirement, stated as a test: enharmonic pivots stay
    // reachable "without burying smooth diatonic hinges". A minor -> C major
    // has an ideal diatonic pivot (Dm, iv here and ii there) and this must not
    // displace it.
    const all = pivotsBetween('A', 'minor', 'C', 'major', {
      extraPivots: chromaticPivotSources,
    })
    expect(all[0].kind).toBe('diatonic')
    expect(all[0].name).toBe('Dm')
    for (const p of all.filter((x) => x.kind !== 'diatonic')) {
      expect(p.cost).toBeGreaterThan(all[0].cost)
    }
  })

  it('adds no candidates between two keys with no reinterpretation available', () => {
    // A minor and C major are relative keys full of diatonic pivots and share
    // no enharmonic one; a source that invented one would be padding.
    expect(enharmonicPivotSource('A', 'minor', 'C', 'major')).toEqual([])
  })
})

describe('C3 — N6 and the augmented sixths, spelled properly', () => {
  it('routes N6 as a chromatic pivot, which the diatonic scan cannot', () => {
    // `diatonicPivots` skips N6 because `pivotSuggestions` THROWS on it — it is
    // a chord-FUNCTION node name, not a chord symbol. B2 documented the skip
    // and said these should arrive properly spelled instead. This is that.
    const p = chromaticNodePivotSource('C', 'major', 'Db', 'major')
    expect(p).toHaveLength(1)
    expect(p[0].name).toBe('N6')
    expect(p[0].nameThere).toBe('Db')
    expect(p[0].romanHere).toBe('N6')
    expect(p[0].romanThere).toBe('I')
    expect(p[0].kind).toBe('chromatic')
  })

  it('reads the same Neapolitan differently per target key', () => {
    // ♭II of C major is the Db triad, which is diatonic to six keys. That the
    // roman CHANGES with the target is the pivot doing its work.
    expect(
      chromaticNodePivotSource('C', 'major', 'Ab', 'major')[0].romanThere
    ).toBe('IV')
    expect(
      chromaticNodePivotSource('C', 'major', 'Gb', 'major')[0].romanThere
    ).toBe('V')
    expect(
      chromaticNodePivotSource('C', 'major', 'F', 'minor')[0].romanThere
    ).toBe('VI')
  })

  it('routes an N6 modulation end to end', () => {
    const r = pathThroughModulation('C', 'PAC', 5, 'C', 'major', 'Db', 'major', {
      extraPivots: chromaticPivotSources,
      pivotKinds: ['chromatic'],
    })
    expect(r.reason).toBe('exact')
    const plan = r.plans[0]
    expect(plan.summary).toBe('I - IIm - N6=I - V - I')
    expect(plan.steps.map((s) => s.name)).toEqual(['C', 'Dm', 'Db', 'Ab', 'Db'])
    expect(plan.pivot.explanation).toMatch(/Neapolitan of C major/)
  })

  it('offers NO augmented-sixth pivot, and that is a fact about the chords', () => {
    // An augmented sixth is not tertian: b6-1-#4 with an augmented sixth as its
    // outer interval. There is no key it is DIATONIC to, so it cannot hinge the
    // way N6 does — it hinges by RESPELLING, which is enharmonicPivotSource's
    // job. Routing it here too would offer one modulation twice.
    const p = chromaticNodePivotSource('C', 'major', 'Db', 'major')
    expect(p.map((x) => x.name)).not.toContain('Aug6')
    expect(p.map((x) => x.name)).not.toContain('It6')
    expect(p.map((x) => x.name)).not.toContain('Fr6')
    // and B4 agrees about the generic alias: `Aug6` names the ITALIAN, which
    // has no fifth and so is not a V7 under any respelling
    expect(enharmonicPivots('Aug6', 'C', 'major')).toEqual([])
    expect(enharmonicPivots('It6', 'C', 'major')).toEqual([])
    // only the German, which has one
    expect(enharmonicPivots('Ger6', 'C', 'major').length).toBeGreaterThan(0)
  })

  it('offers no V64 pivot: a cadential 6/4 belongs to one key by definition', () => {
    const names = chromaticPivotSources
      .flatMap((s) => s('C', 'major', 'Db', 'major'))
      .map((p) => p.name)
    expect(names).not.toContain('V64')
  })

  it('filters out unconventional target-key spellings', () => {
    // PROBED: in Eb major, b2 is Fb, and pivotSuggestions offers `Bbb major` —
    // arithmetically correct, musically nonexistent. scaleList.ts is the
    // project's existing answer and this source uses it.
    expect(chromaticNodePivotSource('Eb', 'major', 'Bbb', 'major')).toEqual([])
  })
})

describe('both sources compose without disturbing the diatonic ones', () => {
  it('merges into pivotsBetween in cost order, diatonic first', () => {
    const all = pivotsBetween('C', 'major', 'Db', 'major', {
      extraPivots: chromaticPivotSources,
    })
    // C major and Db major share NO diatonic chord, which is precisely why the
    // chromatic pivots matter here: without them this key pair is unreachable.
    expect(all.every((p) => p.kind !== 'diatonic')).toBe(true)
    expect(all.map((p) => p.name)).toEqual(['N6', 'Ger6'])
    // and they are ordered by cost
    expect(all[0].cost).toBeLessThan(all[1].cost)
  })

  it('leaves the diatonic result untouched when it adds nothing', () => {
    const without = pivotsBetween('A', 'minor', 'C', 'major')
    const with_ = pivotsBetween('A', 'minor', 'C', 'major', {
      extraPivots: chromaticPivotSources,
    })
    expect(JSON.stringify(with_)).toBe(JSON.stringify(without))
  })

  it('never throws on a degenerate key pair', () => {
    for (const source of chromaticPivotSources) {
      expect(() => source('H', 'lydian', 'Q', 'nonsense')).not.toThrow()
      expect(source('H', 'lydian', 'Q', 'nonsense')).toEqual([])
      expect(() => source('C', 'major', 'C', 'major')).not.toThrow()
    }
  })

  it('is deterministic', () => {
    const a = JSON.stringify(
      pathThroughModulation('C', 'PAC', 4, 'C', 'major', 'Db', 'major', {
        extraPivots: chromaticPivotSources,
      })
    )
    const b = JSON.stringify(
      pathThroughModulation('C', 'PAC', 4, 'C', 'major', 'Db', 'major', {
        extraPivots: chromaticPivotSources,
      })
    )
    expect(a).toBe(b)
  })
})
