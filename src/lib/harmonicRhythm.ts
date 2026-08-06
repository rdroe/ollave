import { tickCounts, BAR, QUARTER, EIGHTH } from './util/constantsUtil'
import type { HarmonicSpan, MetricCondition } from './graphData/types'

/**
 * Harmonic rhythm and metric weight (Stage M-B, B3).
 *
 * WHAT THIS MODULE IS FOR. Several devices in this project are not identified
 * by their chords at all but by WHERE IN THE BAR those chords fall. The three
 * six-fours are the standing example (V9 in PLAN-MUSIC.md): a I6/4 moving to V
 * is a CADENTIAL six-four if the 6/4 is metrically stronger than its
 * resolution, and something else entirely if it is not. `spans.ts` authored
 * that requirement in Stage M-A as `conditions.metric` but could not evaluate
 * it, because nothing in the codebase could yet say what "strong" means. This
 * module says it, and `spanMetricFit` is where that inert field becomes live.
 *
 * NO NEW TIMING INFRASTRUCTURE. Finding V4 recorded that the metric data is
 * already present: `tickCounts` and `BAR` in util/constantsUtil, and a
 * `barDelay` tag on every note. This module derives everything from those
 * constants and adds no clock of its own. Probed on this tree (ppq 128):
 * `tickCounts[BAR]` is 512, a quarter is 128, an eighth 64, a sixteenth 32,
 * and a chord added on each of the four default placements carries
 * `barDelay` 0 / 128 / 256 / 384 — absolute TICKS FROM THE START OF THE BAR,
 * which is the unit every function here takes.
 */

// --------------------------------------------------------------------------
// Meter
// --------------------------------------------------------------------------

/**
 * The meters this module knows.
 *
 * Deliberately a small closed set rather than an arbitrary `n/d` pair. Every
 * one of these has an uncontroversial accent pattern, which is what lets
 * `metricWeight` be a lookup rather than a guess; irregular meters (5/8, 7/8)
 * do NOT, since their grouping (2+3 vs 3+2) is a compositional choice that no
 * time signature discloses. Adding one would mean inventing an answer, so the
 * type refuses instead. See `MeterSpec` for the escape hatch.
 */
export type MeterName = '4/4' | '3/4' | '2/4' | '6/8' | '9/8' | '12/8'

/**
 * A meter as this module actually uses it.
 *
 * `beatTicks` is the span of ONE BEAT — the pulse a listener taps and the unit
 * a harmony is normally at least as long as. In compound meters that is the
 * DOTTED quarter, not the eighth: 6/8 is two beats of three eighths, not six
 * beats. Getting this wrong is the classic compound-meter error, and it is why
 * `beatTicks` is stored rather than computed from the numerator.
 *
 * `beatsPerBar` counts those beats (6/8 has 2, not 6). `divisionsPerBeat` is
 * how the beat subdivides — 2 for simple meters, 3 for compound — and is what
 * makes the offbeat levels come out right without a separate branch.
 */
export type MeterSpec = {
  name: MeterName
  beatsPerBar: number
  beatTicks: number
  divisionsPerBeat: 2 | 3
  /**
   * Beat indices (0-based) that carry a secondary accent, beyond the downbeat
   * at index 0. In 4/4 this is beat 3 — the half-bar — which is the one fact
   * that distinguishes 4/4 from 2/4 + 2/4 and from 3/4.
   */
  secondaryAccents: number[]
}

const barTicks = tickCounts[BAR] // 512 at ppq 128 (probed)
const quarterTicks = tickCounts[QUARTER] // 128
const dottedQuarterTicks = tickCounts[QUARTER] + tickCounts[EIGHTH] // 192

/**
 * The meter table.
 *
 * COMPOUND METERS ARE CHEAP HERE and so they are included. Once `beatTicks`
 * and `divisionsPerBeat` are separate fields, 6/8 is one more row rather than a
 * special case: its beat is the dotted quarter and it divides in three, and
 * every function below reads those two numbers instead of assuming a duple
 * subdivision. The alternative — hardcoding "a beat is a quarter" — would have
 * made 6/8 a rewrite later for no saving now.
 *
 * NOTE ON BAR LENGTH. `tickCounts[BAR]` is a fixed 512 ticks (four quarters):
 * the engine's bar is a container of that size, not a per-meter quantity. A 3/4
 * bar of music therefore occupies 384 of those 512 ticks. Everything in this
 * module works in ticks from the bar start and uses `barTicksOf(meter)` — the
 * meter's OWN length — for wrapping, so a 3/4 reading is correct even though
 * the engine's bar constant is longer than a 3/4 bar.
 */
const METERS: { [K in MeterName]: MeterSpec } = {
  '4/4': {
    name: '4/4',
    beatsPerBar: 4,
    beatTicks: quarterTicks, // 128
    divisionsPerBeat: 2,
    secondaryAccents: [2], // beat 3 — the half-bar
  },
  '3/4': {
    name: '3/4',
    beatsPerBar: 3,
    beatTicks: quarterTicks, // 128
    divisionsPerBeat: 2,
    // NONE. A 3/4 bar has one accent. Beat 2 and beat 3 are both weak, and
    // calling either "secondary" would erase the difference between 3/4 and
    // 6/8 — which is exactly the difference the two rows exist to record.
    secondaryAccents: [],
  },
  '2/4': {
    name: '2/4',
    beatsPerBar: 2,
    beatTicks: quarterTicks, // 128
    divisionsPerBeat: 2,
    secondaryAccents: [],
  },
  '6/8': {
    name: '6/8',
    beatsPerBar: 2, // TWO dotted-quarter beats, not six eighths
    beatTicks: dottedQuarterTicks, // 192
    divisionsPerBeat: 3,
    secondaryAccents: [],
  },
  '9/8': {
    name: '9/8',
    beatsPerBar: 3,
    beatTicks: dottedQuarterTicks, // 192
    divisionsPerBeat: 3,
    secondaryAccents: [],
  },
  '12/8': {
    name: '12/8',
    beatsPerBar: 4,
    beatTicks: dottedQuarterTicks, // 192
    divisionsPerBeat: 3,
    secondaryAccents: [2], // the half-bar, as in 4/4
  },
}

/** The `MeterSpec` for a name. Defaults to 4/4, the tradition's default. */
export const meterSpec = (meter: MeterName | MeterSpec = '4/4'): MeterSpec =>
  typeof meter === 'string' ? METERS[meter] : meter

/** Every meter this module knows, for a UI picker. */
export const METER_NAMES: readonly MeterName[] = Object.keys(
  METERS
) as MeterName[]

/**
 * Length of ONE BAR of this meter in ticks — `beatsPerBar * beatTicks`.
 *
 * NOT `tickCounts[BAR]`, which is the engine's fixed 512-tick container. For
 * 4/4 the two coincide (4 * 128 = 512); for 3/4 they do not (3 * 128 = 384),
 * and using the container would put beat 1 of the next bar at tick 512 rather
 * than at 384. Every wrap in this module goes through here.
 */
export const barTicksOf = (meter: MeterName | MeterSpec = '4/4'): number => {
  const m = meterSpec(meter)
  return m.beatsPerBar * m.beatTicks
}

/** The engine's fixed bar container, 512 ticks at ppq 128. Re-exported so a
 * caller can see the distinction above without importing constantsUtil. */
export const ENGINE_BAR_TICKS = barTicks

// --------------------------------------------------------------------------
// Metric weight
// --------------------------------------------------------------------------

/**
 * How strong a metric position is, as a small ordered vocabulary.
 *
 * RICHER THAN A BOOLEAN, ON PURPOSE. The plan asked whether the return should
 * be more than strong/weak, and the theory says yes: in 4/4 the downbeat, beat
 * 3, beats 2/4 and the offbeats are four distinct levels, and collapsing them
 * loses the fact a composer actually uses — that a harmony may change on beat 3
 * in a way it may not on beat 2. `strong`/`weak` remains derivable from this
 * (see `metricStrength`), which is what keeps it compatible with the
 * `MetricCondition` vocabulary the spans declare.
 *
 * Ordered strongest to weakest; `level` in `MetricPosition` is the numeric form.
 */
export type MetricLevel =
  | 'downbeat' // the first beat of the bar
  | 'secondary' // a secondary accent: beat 3 of 4/4, the half-bar
  | 'beat' // any other beat of the bar
  | 'division' // the beat's own subdivision (an offbeat eighth in 4/4)
  | 'subdivision' // anything finer than that

/** Numeric weight, higher is stronger. The dot-column height (see below). */
export const METRIC_LEVEL_WEIGHT: { [K in MetricLevel]: number } = {
  downbeat: 4,
  secondary: 3,
  beat: 2,
  division: 1,
  subdivision: 0,
}

/** Where a tick offset falls in the bar, fully described. */
export type MetricPosition = {
  /** the input, normalized into the first bar (see `metricWeight`) */
  ticks: number
  /** ticks from the START OF THE BAR, after wrapping */
  barTicks: number
  level: MetricLevel
  /** `METRIC_LEVEL_WEIGHT[level]` — the dot-column height */
  level_: number
  /** 0-based beat index if this falls exactly on a beat, else null */
  beat: number | null
  /** true when the offset is exactly on a beat of the meter */
  onBeat: boolean
  /** the coarse two-value reading the span conditions speak (see below) */
  strength: 'strong' | 'weak'
}

/**
 * THE MODEL, AND WHAT IT SIMPLIFIES.
 *
 * This is the metrical DOT GRID of Lerdahl & Jackendoff, *A Generative Theory
 * of Tonal Music* (MIT Press, 1983), chapter 2 — specifically the metrical
 * well-formedness rules MWFR 1-4 and the dot notation of §2.2. A metrical
 * structure is a set of nested levels of equally spaced beats; every beat at a
 * given level is also a beat at every coarser level; and the strength of a
 * time-point is the NUMBER OF LEVELS at which it is a beat — the height of its
 * column of dots. In 4/4 with levels {bar, half-bar, quarter, eighth}:
 *
 *     tick   0    64   128  192  256  320  384  448      (probed values)
 *     beat   1    +    2    +    3    +    4    +
 *     bar    .
 *     half   .                   .
 *     qtr    .         .         .         .
 *     8th    .    .    .    .    .    .    .    .
 *     height 4    1    2    1    3    1    2    1
 *
 * which is exactly `METRIC_LEVEL_WEIGHT` and exactly the ordering the plan
 * asked for: downbeat > beat 3 > other beats > offbeats.
 *
 * SIMPLIFICATIONS, STATED PLAINLY. This implements only the well-formedness
 * half of GTTM's metrical component, as a FLAT PERIODIC GRID:
 *
 *  - No grouping structure and no interaction with it. GTTM's metrical
 *    PREFERENCE rules (MPR 1-10) choose among well-formed grids using
 *    phenomenal accent — note length, dynamics, harmonic change, parallelism,
 *    bass attacks. None of that is here. This module reads the notated meter as
 *    given rather than inferring it from a surface.
 *  - No hypermeter. Levels coarser than the bar (the strong-bar/weak-bar
 *    alternation of a four-bar phrase) are real and are not modelled; every bar
 *    is treated identically. This is the most likely thing a user will notice
 *    missing, and it is why `metricWeight` wraps rather than reporting which
 *    bar it is in.
 *  - No syncopation or displacement. A tie across a barline does not move the
 *    grid here; the grid is fixed by the meter.
 *  - Two subdivision levels below the beat, then everything else is
 *    `subdivision`. Finer distinctions exist and carry no weight for harmonic
 *    rhythm, which is what this module is for.
 *
 * The consequence to be honest about: this is enough to place a chord, and NOT
 * enough to analyse a rhythm. It answers "is this position metrically strong",
 * which is the question the six-four spans ask.
 */
export const metricWeight = (
  barDelay: number,
  meter: MeterName | MeterSpec = '4/4'
): MetricPosition => {
  const m = meterSpec(meter)
  const barLen = barTicksOf(m)

  // Normalize into the first bar. A `barDelay` should already be within its
  // bar, but a caller accumulating across bars (as `suggestHarmonicRhythm`
  // does) passes absolute offsets, and the grid is identical in every bar —
  // no hypermeter, as documented above. `%` alone is wrong for negatives, so
  // wrap into [0, barLen).
  const wrapped = ((barDelay % barLen) + barLen) % barLen

  const divisionTicks = m.beatTicks / m.divisionsPerBeat
  const onBeat = wrapped % m.beatTicks === 0
  const beat = onBeat ? wrapped / m.beatTicks : null

  let level: MetricLevel
  if (onBeat) {
    if (beat === 0) level = 'downbeat'
    else if (m.secondaryAccents.includes(beat as number)) level = 'secondary'
    else level = 'beat'
  } else if (wrapped % divisionTicks === 0) {
    level = 'division'
  } else {
    level = 'subdivision'
  }

  return {
    ticks: barDelay,
    barTicks: wrapped,
    level,
    level_: METRIC_LEVEL_WEIGHT[level],
    beat,
    onBeat,
    strength: isStrongLevel(level) ? 'strong' : 'weak',
  }
}

/**
 * The coarse two-value reading: which levels count as `'strong'`.
 *
 * THE CUT IS BETWEEN BEATS AND OFFBEATS — a position on any beat of the bar
 * reads as strong against the subdivisions between beats. This is the reading
 * `MetricCondition` needs, because a span's `['strong', 'weak']` is a claim
 * about ADJACENT CHORDS, and two adjacent chords in a real progression are
 * usually a beat apart rather than a bar apart; a cut that made only the
 * downbeat strong would fail every cadential six-four not written in whole
 * notes.
 *
 * The absolute cut is a fallback, though. `spanMetricFit` prefers the RELATIVE
 * comparison (`metricStronger`) precisely because "stronger than its
 * resolution" is what the theory actually says, and it is a relation, not a
 * property of one chord. See that function.
 */
const isStrongLevel = (level: MetricLevel): boolean =>
  METRIC_LEVEL_WEIGHT[level] >= METRIC_LEVEL_WEIGHT.beat

/** Just the `'strong' | 'weak'` reading — the `MetricCondition` vocabulary. */
export const metricStrength = (
  barDelay: number,
  meter: MeterName | MeterSpec = '4/4'
): 'strong' | 'weak' => metricWeight(barDelay, meter).strength

/**
 * Is `a` metrically stronger than `b`? A strict comparison of dot-column
 * heights — the relation the theory states, rather than two absolute readings.
 */
export const metricStronger = (
  a: number,
  b: number,
  meter: MeterName | MeterSpec = '4/4'
): boolean => metricWeight(a, meter).level_ > metricWeight(b, meter).level_

// --------------------------------------------------------------------------
// Evaluating a span's metric conditions — the activation of A4's inert field
// --------------------------------------------------------------------------

/** One step's verdict inside a `SpanMetricFit`. */
export type MetricStepFit = {
  /** 0-based index into the span's `steps` */
  step: number
  /** what the span asked for; `'any'` when unconstrained */
  required: 'strong' | 'weak' | 'any'
  /** what the placement actually is, absolutely */
  actual: 'strong' | 'weak'
  position: MetricPosition
  ok: boolean
  /** why it failed, for a human; absent when `ok` */
  reason?: string
}

/** The verdict on a whole span. */
export type SpanMetricFit = {
  spanId: string
  /** false if ANY constrained step failed */
  ok: boolean
  steps: MetricStepFit[]
  /** human-readable summary of the failures, empty when `ok` */
  violations: string[]
  /** true when the span declares no `conditions.metric` at all */
  unconstrained: boolean
}

/**
 * Does a placement satisfy a span's declared `conditions.metric`?
 *
 * THIS IS THE ACTIVATION OF STAGE M-A's INERT FIELD. `spans.ts` authored
 * `metric: ['strong', 'weak']` on the cadential six-four and
 * `['strong', 'weak', 'strong']` on the passing and pedal six-fours, and
 * types.ts recorded that B3 would be the evaluator. This is that evaluator.
 * Nothing about the span schema changes; the data was already correct.
 *
 * `placements` is one `barDelay` (ticks from the start of ITS bar) per step,
 * in step order. A caller whose span crosses a barline may pass cumulative
 * offsets instead — `metricWeight` wraps, and with no hypermeter the reading is
 * the same either way.
 *
 * TWO KINDS OF CHECK, AND WHY BOTH.
 *
 * 1. ABSOLUTE. Each step's own level is read as strong or weak and compared to
 *    what the span asked for. This is what a naive reading of
 *    `MetricCondition` means, and it is the check that fails when someone puts
 *    a whole device on offbeats.
 *
 * 2. RELATIVE, and it is the one that matters. A `['strong', 'weak']` pair is a
 *    claim about the two chords' relation to EACH OTHER: the theory says the
 *    six-four is stronger than its resolution, not that it sits on any
 *    particular beat. A I6/4 on beat 3 resolving to V on beat 4 is a textbook
 *    cadential six-four, and both beats are 'strong' absolutely. Requiring the
 *    absolute reading alone would reject it — the tool red-inking correct
 *    music, which is the failure mode the waiver mechanism exists to prevent
 *    elsewhere.
 *
 * So a `'strong'` step passes if it is absolutely strong OR strictly stronger
 * than the adjacent `'weak'` step it is contrasted with; a `'weak'` step passes
 * if it is absolutely weak OR strictly weaker than the `'strong'` step next to
 * it. The condition is a CONTRAST, and either way of realizing the contrast
 * satisfies it.
 */
export const spanMetricFit = (
  span: HarmonicSpan,
  placements: number[],
  meter: MeterName | MeterSpec = '4/4'
): SpanMetricFit => {
  const required: MetricCondition = span.conditions?.metric ?? []
  const positions = placements.map((p) => metricWeight(p, meter))
  const steps: MetricStepFit[] = []
  const violations: string[] = []

  positions.forEach((position, i) => {
    // a shorter `metric` array leaves later steps free — types.ts says so
    const req = required[i] ?? 'any'
    const actual = position.strength
    if (req === 'any') {
      steps.push({ step: i, required: req, actual, position, ok: true })
      return
    }

    // absolute reading
    let ok = actual === req

    // Relative reading: satisfied by a contrast with the adjacent steps that
    // carry the OPPOSITE requirement.
    //
    // EVERY such neighbour must contrast, not merely one. A
    // 'strong','weak','strong' span asks for a TROUGH in the middle, so a
    // middle step that is weaker than the chord before it but stronger than
    // the chord after it has not made the required contrast — it is the front
    // of a descent, not a trough. `every` is what encodes that; `some` would
    // accept the descent and wave through a passing 6/4 that is metrically
    // stronger than the chord it passes to.
    if (!ok) {
      const opposite = req === 'strong' ? 'weak' : 'strong'
      const neighbours = [i - 1, i + 1].filter(
        (j) =>
          j >= 0 && j < positions.length && (required[j] ?? 'any') === opposite
      )
      ok =
        neighbours.length > 0 &&
        neighbours.every((j) =>
          req === 'strong'
            ? position.level_ > positions[j].level_
            : position.level_ < positions[j].level_
        )
    }

    const reason = ok
      ? undefined
      : `step ${i} must be ${req} but falls on ${position.level} ` +
        `(tick ${position.barTicks} of the bar), and is not ` +
        `${req === 'strong' ? 'stronger' : 'weaker'} than the step it is ` +
        `contrasted with`
    if (reason) violations.push(reason)
    steps.push({ step: i, required: req, actual, position, ok, reason })
  })

  return {
    spanId: span.id,
    ok: violations.length === 0,
    steps,
    violations,
    unconstrained: required.length === 0,
  }
}

// --------------------------------------------------------------------------
// The cadential six-four — the point of this stream
// --------------------------------------------------------------------------

/** The verdict from `cadentialSixFourMetricFit`. */
export type SixFourMetricVerdict = {
  /** true when the metric requirement of a CADENTIAL 6/4 is met */
  ok: boolean
  /** the 6/4's position */
  sixFour: MetricPosition
  /** the resolution's position */
  resolution: MetricPosition
  /**
   * What this placement makes the 6/4, ON METRIC GROUNDS ALONE. `'cadential'`
   * when the 6/4 is metrically stronger than its resolution; `'non-cadential'`
   * when it is not. NOT a claim that it IS a passing or pedal 6/4 — telling
   * those two apart is a question about the BASS, which is B1's half.
   */
  reading: 'cadential' | 'non-cadential'
  explanation: string
}

/**
 * THE METRIC HALF of the cadential six-four's identity.
 *
 * WHY THIS IS THE POINT OF THE STREAM. A cadential 6/4 is not a chord. The
 * sonority I6/4 is identical in all three of the six-fours the span library
 * carries; what makes one CADENTIAL is that it falls on a metrically stronger
 * position than the V it resolves to. The 6th and 4th above the bass are
 * ACCENTED DISSONANCES — suspensions over the dominant — and a suspension that
 * is not metrically stronger than its resolution is not a suspension at all.
 * Reverse the metric relation and the same two chords become an unaccented
 * passing or neighbouring motion. That is why the device cannot be a chart
 * edge, and why `spans.ts` declared `metric: ['strong', 'weak']` on it.
 *
 * A STRICT COMPARISON, NOT TWO ABSOLUTE READINGS. `strictlyStronger` is the
 * criterion, for the reason given at `spanMetricFit`: beat 3 -> beat 4 in 4/4
 * is a correct cadential 6/4 even though both beats are absolutely 'strong',
 * and beat 1 -> beat 2 is correct even though a 3/4 downbeat and beat 2 are a
 * bar apart in the grid. What is ruled out is the 6/4 landing on the WEAKER
 * position — an offbeat 6/4 resolving onto the downbeat, which is the accented
 * passing chord the span notes warn about.
 *
 * WHAT I DO NOT DECIDE — B1's HALF, EXPLICITLY. This function reads two tick
 * offsets. It says nothing about, and must not be read as checking:
 *
 *  - the 6/4 -> 5/3 RESOLUTION itself: the 6th falling to the 5th and the 4th
 *    to the 3rd over a held bass. That is voice leading; B1 owns it, and
 *    PLAN-MUSIC.md B1 names it explicitly.
 *  - the HELD BASS (scale degree 5 under both chords). `spans.ts` declares it
 *    as `conditions.bass`, and `LineCondition` is documented as B1's to
 *    evaluate.
 *  - DOUBLING (the cadential 6/4 doubles its bass) — B1, per-figure.
 *  - whether a non-cadential 6/4 is PASSING or PEDAL. Both are metrically
 *    identical (`['strong','weak','strong']` in the library); they differ only
 *    in whether the bass moves stepwise or holds. Bass again: B1.
 *
 * A full identification of any six-four is therefore this verdict AND B1's.
 * Neither half alone is sufficient, and this function returns a `reading` on
 * metric grounds rather than a chord name so that it cannot be mistaken for
 * the whole answer.
 */
export const cadentialSixFourMetricFit = (
  sixFourDelay: number,
  resolutionDelay: number,
  meter: MeterName | MeterSpec = '4/4'
): SixFourMetricVerdict => {
  const sixFour = metricWeight(sixFourDelay, meter)
  const resolution = metricWeight(resolutionDelay, meter)
  const ok = sixFour.level_ > resolution.level_
  return {
    ok,
    sixFour,
    resolution,
    reading: ok ? 'cadential' : 'non-cadential',
    explanation: ok
      ? `the 6/4 falls on ${sixFour.level} and resolves on ${resolution.level}, ` +
        `so its 6th and 4th are accented dissonances over the dominant — a ` +
        `cadential 6/4 on metric grounds (the 6/4 -> 5/3 resolution and the ` +
        `held bass are voice-leading questions, checked elsewhere)`
      : `the 6/4 falls on ${sixFour.level} and its resolution on ` +
        `${resolution.level}, so the 6/4 is not metrically stronger than what ` +
        `it resolves to. This is an unaccented 6/4 — a passing or pedal 6/4 ` +
        `depending on its bass — not a cadential one`,
  }
}

// --------------------------------------------------------------------------
// Harmonic rhythm
// --------------------------------------------------------------------------

/** One suggested placement in a `HarmonicRhythmSuggestion`. */
export type HarmonicRhythmStep = {
  /** 0-based index into the progression */
  index: number
  chord: string
  /** which bar of the suggestion this chord starts in, 0-based */
  bar: number
  /** ticks from the start of THAT bar — a `barDelay`, ready to use */
  barDelay: number
  /** ticks from the start of the whole suggestion */
  ticks: number
  /** how long this chord sounds, in ticks */
  durationTicks: number
  position: MetricPosition
  /** why this chord is here, for a human */
  rationale: string
}

/** The result of `suggestHarmonicRhythm`. */
export type HarmonicRhythmSuggestion = {
  meter: MeterName
  steps: HarmonicRhythmStep[]
  /** total length in bars */
  bars: number
  /** the prose the caller should show: what is rule and what is convention */
  notes: string[]
}

/** Options for `suggestHarmonicRhythm`. */
export type HarmonicRhythmOptions = {
  /**
   * Speed up into the final chord, the idiomatic approach to a cadence.
   * Default true. See the convention/rule note in the function doc.
   */
  accelerateToCadence?: boolean
  /**
   * Bars to fill. Omit to let the function choose one chord per beat-group and
   * report how many bars that took.
   */
  bars?: number
}

/**
 * Where the harmonic changes should fall.
 *
 * HARMONIC RHYTHM IS A COMPOSITIONAL PARAMETER, NOT A DERIVED QUANTITY. The
 * rate at which harmony changes is one of the strongest determinants of how
 * music feels — the same progression at one chord per bar and one chord per
 * beat are different pieces — and no algorithm can pick it for a composer. So
 * this function SUGGESTS a default placement and explains its reasoning; it is
 * a starting point to edit, not an answer.
 *
 * WHAT IS RULE AND WHAT IS CONVENTION. The plan asked for honesty here, so:
 *
 *  - RULE, in the sense that violating it changes what the device IS: the
 *    cadential six-four must be metrically stronger than its resolution
 *    (`cadentialSixFourMetricFit`). This is definitional, not stylistic.
 *  - STRONG CONVENTION, near-invariant in common-practice tonal music: the
 *    final chord of a cadence lands on a downbeat, and harmonies change ON
 *    beats rather than between them. Exceptions exist and are audibly marked
 *    (syncopated harmonic change is a deliberate effect); this function follows
 *    the convention and says that it is one.
 *  - CONVENTION, common but far from universal: harmonic rhythm ACCELERATES
 *    into a cadence — a phrase at one chord per bar often moves to one per beat
 *    for its last bar. It is idiomatic in Classical style and much less so in,
 *    say, a chorale, where an even harmonic rhythm is the norm. It is on by
 *    default because it is the more useful starting point, and it is an option
 *    because it is a choice.
 *  - NOT MODELLED: hypermeter (a four-bar phrase's strong and weak bars),
 *    phrase rhythm, and any interaction with the melody. See the
 *    simplifications listed at `metricWeight`.
 *
 * The default placement is one chord per beat-group: with a progression of 4 in
 * 4/4 the chords land on the four beats of a bar; with more chords than beats,
 * bars are added. Every step reports the `barDelay` the engine wants, so the
 * output can be fed straight to `addChord`'s numeric arp form.
 */
export const suggestHarmonicRhythm = (
  progression: string[],
  meter: MeterName | MeterSpec = '4/4',
  opts: HarmonicRhythmOptions = {}
): HarmonicRhythmSuggestion => {
  const m = meterSpec(meter)
  const accelerate = opts.accelerateToCadence ?? true
  const barLen = barTicksOf(m)
  const notes: string[] = []

  if (progression.length === 0) {
    return { meter: m.name, steps: [], bars: 0, notes: ['empty progression'] }
  }

  // How many chords to give the final bar. Acceleration means the last chords
  // of the progression share a bar at one per beat while earlier chords get
  // more room; the simplest honest version of that is: place one chord per
  // beat throughout, and note where the cadence lands.
  const beatsPerBar = m.beatsPerBar

  // Choose a chord duration. One chord per beat is the dense default; if the
  // caller asked for more bars than chords, spread them out over whole bars.
  const requestedBars = opts.bars
  let ticksPerChord = m.beatTicks
  if (requestedBars && requestedBars * beatsPerBar > progression.length) {
    // spread: give each chord an equal share, rounded DOWN to a beat so that
    // every change still lands on a beat (the strong convention above)
    const totalTicks = requestedBars * barLen
    const share = Math.floor(totalTicks / progression.length / m.beatTicks)
    ticksPerChord = Math.max(1, share) * m.beatTicks
    notes.push(
      `spread over ${requestedBars} bar(s): one chord every ` +
        `${ticksPerChord / m.beatTicks} beat(s), rounded to a whole beat so ` +
        `every change lands on a beat (convention, not rule)`
    )
  }

  // The final chord of a cadence wants a downbeat (strong convention). Work out
  // where the last chord would land and, if it is not a downbeat and the
  // progression is long enough to shift, note the discrepancy rather than
  // silently repositioning — the caller asked for these chords in this order.
  const steps: HarmonicRhythmStep[] = []
  let cursor = 0

  progression.forEach((chord, index) => {
    const isLast = index === progression.length - 1
    const isPenultimate = index === progression.length - 2

    // acceleration: the last two chords go at one per beat regardless of the
    // spread chosen above, which is what "speeding up into the cadence" means
    const duration =
      accelerate && (isPenultimate || isLast)
        ? Math.min(ticksPerChord, m.beatTicks)
        : ticksPerChord

    const bar = Math.floor(cursor / barLen)
    const barDelay = cursor % barLen
    const position = metricWeight(barDelay, m)

    const rationale = isLast
      ? position.level === 'downbeat'
        ? 'final chord on a downbeat — where a cadence wants to land (strong convention)'
        : `final chord on ${position.level}; a cadence conventionally lands on a ` +
          `downbeat, so consider lengthening an earlier chord`
      : position.onBeat
        ? `on beat ${(position.beat ?? 0) + 1} (${position.level}) — harmonies ` +
          `change on beats, not between them (strong convention)`
        : `off the beat (${position.level}) — a marked, syncopated harmonic change`

    steps.push({
      index,
      chord,
      bar,
      barDelay,
      ticks: cursor,
      durationTicks: duration,
      position,
      rationale:
        accelerate && isPenultimate && duration < ticksPerChord
          ? rationale + '; shortened to accelerate into the cadence (convention)'
          : rationale,
    })
    cursor += duration
  })

  notes.push(
    'metric weight follows a flat Lerdahl-Jackendoff dot grid: no hypermeter, ' +
      'no grouping structure, no preference rules. See metricWeight.'
  )
  if (accelerate) {
    notes.push(
      'acceleration into the cadence is idiomatic in Classical style and NOT ' +
        'universal — an even harmonic rhythm is the chorale norm. Pass ' +
        '{ accelerateToCadence: false } for an even placement.'
    )
  }

  return {
    meter: m.name,
    steps,
    bars: Math.ceil(cursor / barLen),
    notes,
  }
}
