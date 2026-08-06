import { describe, expect, it } from 'vitest'

import {
  barTicksOf,
  cadentialSixFourMetricFit,
  ENGINE_BAR_TICKS,
  METER_NAMES,
  METRIC_LEVEL_WEIGHT,
  meterSpec,
  metricStrength,
  metricStronger,
  metricWeight,
  spanMetricFit,
  suggestHarmonicRhythm,
} from './harmonicRhythm'
import { spanById } from './spans'
import { tickCounts, ppq } from './util/constantsUtil'
import type { HarmonicSpan } from './graphData/types'

// The tick values every expectation below is pinned to were PROBED on this
// tree before any of them was written (ppq 128): tickCounts.bar = 512,
// quarter = 128, eighth = 64, sixteenth = 32; and a chord added on each of
// addChord's four default placements carries barDelay 0 / 128 / 256 / 384.
// This first block re-pins those so that a change to ppq fails HERE, loudly,
// rather than silently shifting every metric reading in the module.
describe('the tick constants this module is built on', () => {
  it('matches the probed values', () => {
    expect(ppq).toBe(128)
    expect(tickCounts.bar).toBe(512)
    expect(tickCounts.quarter).toBe(128)
    expect(tickCounts.eighth).toBe(64)
    expect(tickCounts.sixteenth).toBe(32)
    expect(ENGINE_BAR_TICKS).toBe(512)
  })

  it('derives beat length from tickCounts rather than hardcoding it', () => {
    expect(meterSpec('4/4').beatTicks).toBe(tickCounts.quarter)
    // compound: the beat is the DOTTED quarter, quarter + eighth
    expect(meterSpec('6/8').beatTicks).toBe(
      tickCounts.quarter + tickCounts.eighth
    )
    expect(meterSpec('6/8').beatTicks).toBe(192)
  })
})

describe('barTicksOf — the meter length, not the engine container', () => {
  it('4/4 coincides with the engine bar', () => {
    expect(barTicksOf('4/4')).toBe(512)
    expect(barTicksOf('4/4')).toBe(ENGINE_BAR_TICKS)
  })

  it('3/4 is SHORTER than the engine container', () => {
    // the distinction the module doc calls out: using tickCounts.bar here
    // would put the next downbeat at 512 instead of 384
    expect(barTicksOf('3/4')).toBe(384)
    expect(barTicksOf('3/4')).toBeLessThan(ENGINE_BAR_TICKS)
  })

  it('compound meters come out right', () => {
    expect(barTicksOf('6/8')).toBe(384) // 2 * 192
    expect(barTicksOf('9/8')).toBe(576) // 3 * 192
    expect(barTicksOf('12/8')).toBe(768) // 4 * 192
    expect(barTicksOf('2/4')).toBe(256)
  })
})

describe('metricWeight in 4/4 — the dot grid', () => {
  // The grid documented on metricWeight, pinned tick by tick:
  //   tick   0    64   128  192  256  320  384  448
  //   height 4    1    2    1    3    1    2    1
  const expected: [number, string, number][] = [
    [0, 'downbeat', 4],
    [64, 'division', 1],
    [128, 'beat', 2],
    [192, 'division', 1],
    [256, 'secondary', 3],
    [320, 'division', 1],
    [384, 'beat', 2],
    [448, 'division', 1],
  ]

  it.each(expected)('tick %i is %s (weight %i)', (tick, level, weight) => {
    const p = metricWeight(tick, '4/4')
    expect(p.level).toBe(level)
    expect(p.level_).toBe(weight)
  })

  it('ranks downbeat > beat 3 > beats 2 and 4 > offbeats', () => {
    // the ordering the plan asked for, stated as one chain
    const w = (t: number) => metricWeight(t, '4/4').level_
    expect(w(0)).toBeGreaterThan(w(256)) // downbeat > beat 3
    expect(w(256)).toBeGreaterThan(w(128)) // beat 3 > beat 2
    expect(w(256)).toBeGreaterThan(w(384)) // beat 3 > beat 4
    expect(w(128)).toBe(w(384)) // beats 2 and 4 are equal
    expect(w(128)).toBeGreaterThan(w(64)) // any beat > an offbeat
  })

  it('reports the beat index and onBeat', () => {
    expect(metricWeight(0, '4/4').beat).toBe(0)
    expect(metricWeight(384, '4/4').beat).toBe(3)
    expect(metricWeight(0, '4/4').onBeat).toBe(true)
    expect(metricWeight(64, '4/4').onBeat).toBe(false)
    expect(metricWeight(64, '4/4').beat).toBeNull()
  })

  it('distinguishes a subdivision from a division', () => {
    // a sixteenth (32) is finer than the eighth-level division
    expect(metricWeight(32, '4/4').level).toBe('subdivision')
    expect(metricWeight(32, '4/4').level_).toBe(0)
    expect(metricWeight(64, '4/4').level).toBe('division')
  })

  it('defaults to 4/4', () => {
    expect(metricWeight(256).level).toBe('secondary')
  })
})

describe('metricWeight in 3/4 — one accent, not two', () => {
  it('has a downbeat and two plain beats', () => {
    expect(metricWeight(0, '3/4').level).toBe('downbeat')
    expect(metricWeight(128, '3/4').level).toBe('beat')
    // NOT 'secondary'. A 3/4 bar has one accent; calling beat 2 or 3
    // secondary would erase the difference between 3/4 and 6/8.
    expect(metricWeight(256, '3/4').level).toBe('beat')
  })

  it('wraps at 384, not at the engine container 512', () => {
    // tick 384 is the DOWNBEAT of the next 3/4 bar
    expect(metricWeight(384, '3/4').level).toBe('downbeat')
    expect(metricWeight(384, '3/4').barTicks).toBe(0)
    // whereas in 4/4 the same tick is beat 4 of the same bar
    expect(metricWeight(384, '4/4').level).toBe('beat')
    expect(metricWeight(384, '4/4').beat).toBe(3)
  })

  it('keeps the original tick in `ticks` while wrapping `barTicks`', () => {
    const p = metricWeight(512, '3/4')
    expect(p.ticks).toBe(512)
    expect(p.barTicks).toBe(128) // 512 - 384
    expect(p.level).toBe('beat')
  })

  it('wraps negative offsets into the bar', () => {
    expect(metricWeight(-128, '3/4').barTicks).toBe(256)
    expect(metricWeight(-384, '3/4').level).toBe('downbeat')
  })
})

describe('metricWeight in compound meters', () => {
  it('6/8 has TWO beats of three eighths, not six beats', () => {
    const m = meterSpec('6/8')
    expect(m.beatsPerBar).toBe(2)
    expect(m.divisionsPerBeat).toBe(3)
    // the two dotted-quarter beats
    expect(metricWeight(0, '6/8').level).toBe('downbeat')
    expect(metricWeight(192, '6/8').level).toBe('beat')
    expect(metricWeight(192, '6/8').beat).toBe(1)
  })

  it('6/8 treats the inner eighths as divisions, not beats', () => {
    // eighths at 64 and 128 fall INSIDE the first dotted-quarter beat. The
    // classic compound-meter error is calling these beats.
    expect(metricWeight(64, '6/8').level).toBe('division')
    expect(metricWeight(128, '6/8').level).toBe('division')
    expect(metricWeight(64, '6/8').onBeat).toBe(false)
    // whereas in 3/4 tick 128 IS a beat — same ticks, different meter
    expect(metricWeight(128, '3/4').level).toBe('beat')
    expect(metricWeight(128, '3/4').onBeat).toBe(true)
  })

  it('12/8 keeps its half-bar secondary accent', () => {
    expect(metricWeight(0, '12/8').level).toBe('downbeat')
    expect(metricWeight(192, '12/8').level).toBe('beat')
    expect(metricWeight(384, '12/8').level).toBe('secondary') // the half-bar
    expect(metricWeight(576, '12/8').level).toBe('beat')
  })

  it('9/8 has three beats and no secondary accent', () => {
    expect(metricWeight(0, '9/8').level).toBe('downbeat')
    expect(metricWeight(192, '9/8').level).toBe('beat')
    expect(metricWeight(384, '9/8').level).toBe('beat')
  })

  it('knows every meter it advertises', () => {
    for (const name of METER_NAMES) {
      expect(meterSpec(name).name).toBe(name)
      expect(barTicksOf(name)).toBeGreaterThan(0)
    }
  })
})

describe('metricStrength — the MetricCondition vocabulary', () => {
  it('reads every beat as strong and every offbeat as weak', () => {
    // the cut documented on isStrongLevel: between beats and offbeats, because
    // a span's ['strong','weak'] compares ADJACENT CHORDS, usually a beat apart
    expect(metricStrength(0, '4/4')).toBe('strong')
    expect(metricStrength(128, '4/4')).toBe('strong')
    expect(metricStrength(256, '4/4')).toBe('strong')
    expect(metricStrength(384, '4/4')).toBe('strong')
    expect(metricStrength(64, '4/4')).toBe('weak')
    expect(metricStrength(32, '4/4')).toBe('weak')
  })

  it('agrees with the level weights', () => {
    expect(METRIC_LEVEL_WEIGHT.downbeat).toBeGreaterThan(
      METRIC_LEVEL_WEIGHT.secondary
    )
    expect(METRIC_LEVEL_WEIGHT.beat).toBeGreaterThan(
      METRIC_LEVEL_WEIGHT.division
    )
  })
})

describe('metricStronger — the relative comparison', () => {
  it('is strict', () => {
    expect(metricStronger(0, 128, '4/4')).toBe(true) // downbeat > beat 2
    expect(metricStronger(256, 384, '4/4')).toBe(true) // beat 3 > beat 4
    expect(metricStronger(128, 384, '4/4')).toBe(false) // beats 2 and 4 equal
    expect(metricStronger(64, 0, '4/4')).toBe(false) // offbeat < downbeat
  })
})

// --------------------------------------------------------------------------
// The activation of Stage M-A's inert conditions.metric field
// --------------------------------------------------------------------------

describe("spanMetricFit — activating the span library's metric conditions", () => {
  it('reads the REAL cadential-64 span authored in Stage M-A', () => {
    const span = spanById('cadential-64')!
    expect(span).toBeDefined()
    // the field this stream activates, exactly as M-A authored it
    expect(span.conditions?.metric).toEqual(['strong', 'weak'])
  })

  it('accepts a cadential 6/4 on the downbeat resolving on beat 2', () => {
    const span = spanById('cadential-64')!
    const fit = spanMetricFit(span, [0, 128], '4/4')
    expect(fit.ok).toBe(true)
    expect(fit.spanId).toBe('cadential-64')
    expect(fit.violations).toEqual([])
    expect(fit.steps[0].position.level).toBe('downbeat')
    expect(fit.steps[1].position.level).toBe('beat')
  })

  it('accepts beat 3 -> beat 4, where BOTH are absolutely strong', () => {
    // the case the relative reading exists for. Textbook cadential 6/4;
    // an absolute-only check would reject it and red-ink correct music.
    const span = spanById('cadential-64')!
    const fit = spanMetricFit(span, [256, 384], '4/4')
    expect(fit.ok).toBe(true)
    // step 1 is asked to be 'weak' and is absolutely 'strong' — it passes on
    // the CONTRAST with step 0, not on its own reading
    expect(fit.steps[1].required).toBe('weak')
    expect(fit.steps[1].actual).toBe('strong')
    expect(fit.steps[1].ok).toBe(true)
  })

  it('REJECTS the reversed placement — the counter-example', () => {
    // 6/4 on the offbeat resolving onto the downbeat. Same two chords; not a
    // cadential 6/4, because the dissonance is no longer accented.
    const span = spanById('cadential-64')!
    const fit = spanMetricFit(span, [64, 128], '4/4')
    expect(fit.ok).toBe(false)
    expect(fit.violations.length).toBeGreaterThan(0)
    expect(fit.steps[0].ok).toBe(false)
    expect(fit.steps[0].reason).toMatch(/must be strong/)
  })

  it('reads the passing and pedal 6/4 spans M-A authored', () => {
    for (const id of ['passing-64', 'pedal-64']) {
      const span = spanById(id)!
      expect(span.conditions?.metric).toEqual(['strong', 'weak', 'strong'])
      // strong - weak - strong: the 6/4 sits between two accented chords
      const fit = spanMetricFit(span, [0, 128, 256], '4/4')
      expect(fit.ok, `${id} should fit 0/128/256`).toBe(true)
    }
  })

  it('rejects a passing 6/4 whose middle chord is not the weak one', () => {
    const span = spanById('passing-64')!
    // downbeat / beat 3 / beat 2: the middle chord is STRONGER than the
    // third, so the 6/4 is not the unaccented passing chord it claims to be
    const fit = spanMetricFit(span, [0, 256, 128], '4/4')
    expect(fit.ok).toBe(false)
    expect(fit.steps[1].ok).toBe(false)
  })

  it("requires a TROUGH for 'strong,weak,strong', not merely a descent", () => {
    // The subtlety the relative check has to get right. Middle step at beat 3
    // (weight 3) is weaker than the downbeat before it (4) but STRONGER than
    // beat 2 after it (2). That is the front of a descent, not the trough a
    // passing 6/4 needs — the chord it passes TO must not be weaker than the
    // passing chord itself. Checking only one neighbour would accept it.
    const span = spanById('passing-64')!
    const descent = spanMetricFit(span, [0, 256, 128], '4/4')
    expect(descent.steps[1].ok).toBe(false)

    // a real trough: downbeat / offbeat / beat 3 — weaker than BOTH sides
    const trough = spanMetricFit(span, [0, 64, 256], '4/4')
    expect(trough.steps[1].ok).toBe(true)
    expect(trough.ok).toBe(true)
  })

  it('leaves later steps free when the metric array is shorter', () => {
    // documented on MetricCondition in graphData/types.ts
    const span: HarmonicSpan = {
      id: 'test-short',
      title: 'short metric array',
      kind: 'idiom',
      steps: ['I', 'V', 'I'],
      conditions: { metric: ['strong'] },
    }
    const fit = spanMetricFit(span, [0, 64, 32], '4/4')
    expect(fit.ok).toBe(true)
    expect(fit.steps[1].required).toBe('any')
    expect(fit.steps[2].required).toBe('any')
  })

  it("treats 'any' as unconstrained", () => {
    const span: HarmonicSpan = {
      id: 'test-any',
      title: 'any',
      kind: 'idiom',
      steps: ['I', 'V'],
      conditions: { metric: ['any', 'any'] },
    }
    expect(spanMetricFit(span, [64, 32], '4/4').ok).toBe(true)
  })

  it('reports a span with no metric conditions as unconstrained and ok', () => {
    // the lament bass declares bass conditions only — B1's field, not this
    // stream's — so this stream must pass it rather than invent a requirement
    const span = spanById('lament-bass')!
    expect(span.conditions?.metric).toBeUndefined()
    const fit = spanMetricFit(span, [0, 128, 256, 384], '4/4')
    expect(fit.unconstrained).toBe(true)
    expect(fit.ok).toBe(true)
  })

  it('evaluates every span in the library without throwing', () => {
    // a smoke test over the REAL library: this stream must be able to read
    // whatever M-A authored, including spans with no metric field at all
    const ids = [
      'cadential-64',
      'passing-64',
      'pedal-64',
      'lament-bass',
      'descending-bass-idiom',
      'fauxbourdon',
    ]
    for (const id of ids) {
      const span = spanById(id)!
      const placements = span.steps.map((_, i) => i * 128)
      expect(() => spanMetricFit(span, placements, '4/4')).not.toThrow()
    }
  })
})

// --------------------------------------------------------------------------
// The cadential six-four — the metric half
// --------------------------------------------------------------------------

describe('cadentialSixFourMetricFit — the metric half of the identity', () => {
  it('accepts the downbeat 6/4 resolving on beat 2 (hand-verified)', () => {
    // I6/4 on beat 1, V on beat 2 of a 4/4 bar — the commonest realization.
    // The 6th and 4th above the bass are accented dissonances.
    const v = cadentialSixFourMetricFit(0, 128, '4/4')
    expect(v.ok).toBe(true)
    expect(v.reading).toBe('cadential')
    expect(v.sixFour.level).toBe('downbeat')
    expect(v.resolution.level).toBe('beat')
  })

  it('accepts beat 3 -> beat 4', () => {
    // half-bar accent to the weakest beat; also textbook
    const v = cadentialSixFourMetricFit(256, 384, '4/4')
    expect(v.ok).toBe(true)
    expect(v.reading).toBe('cadential')
  })

  it('REJECTS the offbeat 6/4 resolving onto the downbeat (counter-example)', () => {
    // the accented passing chord the span notes warn about: the same two
    // chords, the metric relation reversed, a different musical object
    const v = cadentialSixFourMetricFit(64, 128, '4/4')
    expect(v.ok).toBe(false)
    expect(v.reading).toBe('non-cadential')
    expect(v.explanation).toMatch(/not metrically stronger/)
  })

  it('REJECTS an equal-weight pair', () => {
    // beats 2 and 4 carry the same weight, so neither is the accent — there
    // is no suspension without a metric contrast
    const v = cadentialSixFourMetricFit(128, 384, '4/4')
    expect(v.ok).toBe(false)
    expect(v.reading).toBe('non-cadential')
  })

  it('works in 3/4, where beat 1 -> beat 2 is the idiom', () => {
    expect(cadentialSixFourMetricFit(0, 128, '3/4').ok).toBe(true)
    // beat 2 -> beat 3 is NOT: both are plain beats in 3/4's single-accent bar
    expect(cadentialSixFourMetricFit(128, 256, '3/4').ok).toBe(false)
  })

  it('works in 6/8', () => {
    // beat 1 (dotted quarter) to beat 2
    expect(cadentialSixFourMetricFit(0, 192, '6/8').ok).toBe(true)
    // an inner eighth resolving to the second beat is not it
    expect(cadentialSixFourMetricFit(64, 192, '6/8').ok).toBe(false)
  })

  it('names what it does NOT decide — B1 owns the voice-leading half', () => {
    // A contract test, not a behavior test. This function reads two tick
    // offsets and nothing else; it must never be mistaken for a full
    // identification of a six-four. The verdict deliberately reports a
    // metric `reading` rather than a chord name, and says so.
    const v = cadentialSixFourMetricFit(0, 128, '4/4')
    expect(Object.keys(v).sort()).toEqual([
      'explanation',
      'ok',
      'reading',
      'resolution',
      'sixFour',
    ])
    // no claim about voice leading, bass or doubling appears in the verdict
    expect(v.explanation).toMatch(/voice-leading questions, checked elsewhere/)
    // and a non-cadential reading refuses to say WHICH other 6/4 it is,
    // because passing vs pedal is a question about the bass (B1)
    const nv = cadentialSixFourMetricFit(64, 128, '4/4')
    expect(nv.explanation).toMatch(/passing or pedal 6\/4 depending on its bass/)
  })
})

// --------------------------------------------------------------------------
// Harmonic rhythm
// --------------------------------------------------------------------------

describe('suggestHarmonicRhythm', () => {
  it('places a four-chord progression on the four beats of a 4/4 bar', () => {
    const s = suggestHarmonicRhythm(['C', 'F', 'G', 'C'], '4/4', {
      accelerateToCadence: false,
    })
    expect(s.meter).toBe('4/4')
    expect(s.steps.map((x) => x.barDelay)).toEqual([0, 128, 256, 384])
    // exactly the barDelay values addChord's default placements produce —
    // probed on this tree before this expectation was written
    expect(s.steps.map((x) => x.bar)).toEqual([0, 0, 0, 0])
    expect(s.bars).toBe(1)
  })

  it('reports the metric level of every placement', () => {
    const s = suggestHarmonicRhythm(['C', 'F', 'G', 'C'], '4/4', {
      accelerateToCadence: false,
    })
    expect(s.steps.map((x) => x.position.level)).toEqual([
      'downbeat',
      'beat',
      'secondary',
      'beat',
    ])
  })

  it('wraps into a second bar when there are more chords than beats', () => {
    const s = suggestHarmonicRhythm(
      ['C', 'F', 'G', 'C', 'Am', 'Dm'],
      '4/4',
      { accelerateToCadence: false }
    )
    expect(s.steps[4].bar).toBe(1)
    expect(s.steps[4].barDelay).toBe(0)
    expect(s.steps[4].position.level).toBe('downbeat')
    expect(s.bars).toBe(2)
  })

  it('respects 3/4 bar length', () => {
    const s = suggestHarmonicRhythm(['C', 'F', 'G', 'C'], '3/4', {
      accelerateToCadence: false,
    })
    // the fourth chord starts the SECOND bar at 384, not beat 4 of the first
    expect(s.steps.map((x) => x.barDelay)).toEqual([0, 128, 256, 0])
    expect(s.steps[3].bar).toBe(1)
    expect(s.steps[3].position.level).toBe('downbeat')
  })

  it('spreads over more bars when asked, always landing on beats', () => {
    const s = suggestHarmonicRhythm(['C', 'F', 'G', 'C'], '4/4', {
      accelerateToCadence: false,
      bars: 4,
    })
    // one chord per bar
    expect(s.steps.map((x) => x.barDelay)).toEqual([0, 0, 0, 0])
    expect(s.steps.map((x) => x.bar)).toEqual([0, 1, 2, 3])
    // every change is on a beat — the strong convention
    expect(s.steps.every((x) => x.position.onBeat)).toBe(true)
  })

  it('accelerates into the cadence by default', () => {
    const s = suggestHarmonicRhythm(['C', 'F', 'G', 'C'], '4/4', { bars: 4 })
    // the first two chords get a bar each; the last two share the third bar
    // at one per beat — harmonic rhythm speeding up into the close
    const last = s.steps[s.steps.length - 1]
    const penult = s.steps[s.steps.length - 2]
    expect(penult.durationTicks).toBe(128)
    expect(last.durationTicks).toBe(128)
    expect(s.steps[0].durationTicks).toBe(512)
    expect(penult.rationale).toMatch(/accelerate into the cadence/)
  })

  it('labels acceleration a convention, not a rule', () => {
    const s = suggestHarmonicRhythm(['C', 'F', 'G', 'C'], '4/4')
    expect(s.notes.join(' ')).toMatch(/idiomatic in Classical style and NOT/)
    expect(s.notes.join(' ')).toMatch(/chorale norm/)
  })

  it('discloses its simplifications in the notes', () => {
    const s = suggestHarmonicRhythm(['C', 'G'], '4/4')
    expect(s.notes.join(' ')).toMatch(/no hypermeter/)
    expect(s.notes.join(' ')).toMatch(/Lerdahl-Jackendoff/)
  })

  it('says when the final chord does not land on a downbeat', () => {
    // three chords in 4/4 at one per beat: the last lands on beat 3, not a
    // downbeat. It reports the discrepancy rather than silently repositioning.
    const s = suggestHarmonicRhythm(['C', 'F', 'G'], '4/4', {
      accelerateToCadence: false,
    })
    const last = s.steps[2]
    expect(last.position.level).toBe('secondary')
    expect(last.rationale).toMatch(/conventionally lands on a downbeat/)
  })

  it('notes when the final chord DOES land on a downbeat', () => {
    const s = suggestHarmonicRhythm(['C', 'F', 'G', 'C', 'C'], '4/4', {
      accelerateToCadence: false,
    })
    const last = s.steps[4]
    expect(last.position.level).toBe('downbeat')
    expect(last.rationale).toMatch(/where a cadence wants to land/)
  })

  it('handles an empty progression without throwing', () => {
    const s = suggestHarmonicRhythm([], '4/4')
    expect(s.steps).toEqual([])
    expect(s.bars).toBe(0)
  })

  it('works in 6/8 with dotted-quarter beats', () => {
    const s = suggestHarmonicRhythm(['C', 'G'], '6/8', {
      accelerateToCadence: false,
    })
    expect(s.steps.map((x) => x.barDelay)).toEqual([0, 192])
    expect(s.steps.map((x) => x.position.level)).toEqual(['downbeat', 'beat'])
    expect(s.bars).toBe(1)
  })

  it('produces barDelay values that round-trip through metricWeight', () => {
    // the output is meant to be usable directly as an engine barDelay
    const s = suggestHarmonicRhythm(['C', 'F', 'G', 'C'], '4/4', {
      accelerateToCadence: false,
    })
    for (const step of s.steps) {
      expect(metricWeight(step.barDelay, '4/4').level).toBe(step.position.level)
      expect(step.barDelay).toBeLessThan(barTicksOf('4/4'))
      expect(Number.isInteger(step.barDelay)).toBe(true)
    }
  })
})
