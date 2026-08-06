// Shared chart-data types.
//
// This module deliberately has NO imports: chart data files (minor.ts, and a
// future major.ts) import it, and graphh.ts re-exports both the type and the
// charts. Keeping the type here rather than in graphh.ts is what stops the
// chart data from depending on the translator that consumes it.
//
// KEEP IT ZERO-IMPORT. The figured-bass and span types added in Stage M-A live
// here for the same reason: `spans.ts` and the charts both need them, and
// `spans.ts` must not become a dependency of the chart data.

/**
 * Figured-bass symbol, ASCII. Says WHICH CHORD TONE IS IN THE BASS.
 *
 * Triads:
 *   '53' — root position (the implied default; rarely written)
 *   '6'  — first inversion, THIRD in the bass
 *   '64' — second inversion, FIFTH in the bass
 *
 * Seventh chords:
 *   '7'  — root position, ROOT in the bass
 *   '65' — first inversion, THIRD in the bass
 *   '43' — second inversion, FIFTH in the bass
 *   '42' — third inversion, SEVENTH in the bass
 *
 * The mapping is by INDEX into the chord's own note list, never by interval
 * arithmetic from the root — `Chord.get(name).notes` is already spelling-exact
 * in every key (probed: G# minor's leading-tone triad is F##-A#-C#, Fbm is
 * Fb-Abb-Cb), so indexing inherits that correctness for free, whereas
 * transposing would have to re-derive it and could respell.
 *
 * Unicode forms (⁶, ⁶₄, ⁶₅, ⁴₃, ⁴₂) are accepted as INPUT SUGAR by
 * `parseFigure` and normalized to these ASCII spellings. Stored data is always
 * ASCII: one spelling in the charts means one thing to diff and to grep.
 *
 * '42' is spelled '42' and not '2': both are current in the literature, and
 * the four-symbol set (`6 64 65 43 42`) is internally consistent about naming
 * two figures per inversion. `parseFigure` accepts '2' as an alias.
 */
export type Figure = '53' | '6' | '64' | '7' | '65' | '43' | '42'

/**
 * A chord with a specified bass — the Stage M-A schema addition (A1).
 *
 * `chord` is a ROMAN NUMERAL when this appears in chart data or a span
 * (`'I'`, `'V7'`, `'VIIdim'`), exactly like a bare-string edge; the translator
 * realizes it per key. It is deliberately the SAME string a bare edge holds,
 * so adding a figure to an existing edge is a local change with no rename.
 *
 * WHY A STRUCTURED FIELD rather than a naming convention (`I6`, `V65`):
 *  - `/` is already taken: `V7/III` means tonicization, not a bass note, and
 *    `Chord.get('C/E')` returns no notes at all, so slash names are both
 *    ambiguous in this vocabulary and unresolvable by the underlying library.
 *  - a suffix convention collides with real chord suffixes — `C6` is a sixth
 *    chord to tonal, and `V64` is already a chord-FUNCTION node name here — so
 *    the figure could not be recovered from the string without a parser that
 *    knows which suffixes are figures and which are chord qualities.
 *  - a structured field needs no parser and cannot collide.
 */
export type FiguredChord = {
  /** roman numeral in chart/span data, e.g. 'I', 'V7', 'VIIdim' */
  chord: string
  figure: Figure
}

/**
 * One outgoing edge in a chart.
 *
 * A BARE STRING IS AND REMAINS THE NORMAL FORM: it means the chord in root
 * position, and every edge authored before Stage M-A is one. The object form
 * is purely additive — `translateEdge` normalizes both to the same realized
 * edge, and a string edge takes a byte-identical path to the one it took
 * before this type existed.
 */
export type ChartEdge = string | FiguredChord

export type ProgressionGraphNode = {
  name: string // may be a function name (V64 / Aug6 / N6)
  next: ChartEdge[]
  dotted?: ChartEdge[]
  // arrival context: which chords may precede this node. Realized into the
  // `enabler` of every edge the node emits. Bare romans only — arrival context
  // is about WHICH CHORD you came from, not which inversion of it.
  prev?: string[]
}

export type ProgressionChart = { [name: string]: ProgressionGraphNode[] }

// --------------------------------------------------------------------------
// A4 — the span/pattern schema.
//
// A span is a TEMPLATE OVER THE GRAPH, not an edge in it. Several of the
// devices this project models are not chords and not edges but short ordered
// patterns whose identity depends on context (V9 in PLAN-MUSIC.md): a passing
// 6/4 is only a passing 6/4 between I and I6 with stepwise bass; a cadential
// 6/4 is defined by its metric position and its 6/4 -> 5/3 resolution; the
// lament bass, fauxbourdon, the cadence formulas and the sequences are all
// ordered multi-chord templates with conditions. A first-order Markov edge
// cannot carry that context, and inventing a separate shape in each of A5/A6,
// B2 and B5 would give four incompatible vocabularies for one idea.
//
// FOUR STREAMS CONSUME THIS TYPE. Read the inertness notes before extending it.
// --------------------------------------------------------------------------

/**
 * Coarse classification, so one registry can serve several consumers without
 * each keeping a private list. B2 filters `kind: 'cadence'`; B5 filters
 * `kind: 'sequence'`.
 */
export type SpanKind = 'idiom' | 'cadence' | 'sequence' | 'schema'

/**
 * Melodic shape of a line across a span's steps.
 *
 * INERT AT STAGE M-A — declared, type-checked and stored, never evaluated.
 * B1 (part-writing) is the intended evaluator: it is the stream that will hold
 * actual voicings and can therefore tell whether a realization matches. Nothing
 * in Stage M-A reads these fields, and no Stage M-A behavior depends on them.
 *
 * `degrees` is scale degrees 1-7 as numbers, one per step, key-independent —
 * the lament bass is [1, 7, 6, 5] in any key. `motion` is the coarse shape and
 * is what a cheap check can use without realizing pitches.
 */
export type LineCondition = {
  /** scale degrees, one per step; length SHOULD equal steps.length */
  degrees?: number[]
  /** coarse contour of the line across the span */
  motion?: 'stepwise-down' | 'stepwise-up' | 'static' | 'any'
}

/**
 * Metric placement requirements, one entry per step.
 *
 * INERT AT STAGE M-A. B3 (metric weight) is the intended evaluator: it owns
 * `metricWeight(barDelay, meter)` and is the only stream that can decide what
 * counts as strong. The cadential 6/4's defining requirement — the 6/4 on a
 * STRONGER beat than the V that resolves it — is expressible today as
 * `['strong', 'weak']`, and is authored that way in the span library so that
 * B3 has real content to switch on rather than a hypothetical.
 *
 * 'any' means the step is unconstrained; a shorter array leaves later steps
 * unconstrained.
 */
export type MetricCondition = ('strong' | 'weak' | 'any')[]

/** Conditions on a span. Every field here is INERT at Stage M-A (see above). */
export type SpanConditions = {
  /** the bass line the span is ABOUT; the most load-bearing of the three */
  bass?: LineCondition
  /** soprano requirements — e.g. a PAC needs scale degree 1 on top (B2) */
  soprano?: LineCondition
  /** per-step metric placement (B3) */
  metric?: MetricCondition
}

/**
 * A part-writing rule this span DELIBERATELY breaks, with the reason.
 *
 * This exists in Stage M-A rather than being added by B1 because Stage M-A
 * ships fauxbourdon, whose entire identity is parallel 6/3 chords — parallel
 * fourths between the outer-ish voices are the device, not a mistake. Without a
 * waiver channel, B1's first act would be to flag this library's own content,
 * which is exactly the context-free nagging that alienates the composers this
 * project is for.
 *
 * `rule` is a B1 rule id. The ids are NOT enumerated here on purpose: B1 owns
 * the rule catalogue, and pinning a union in a zero-import chart-data module
 * would mean every new B1 rule forces an edit to this file. `spans.test.ts`
 * instead pins that every waiver id used in the library is a member of a small
 * documented set, so a typo still fails a test.
 */
export type RuleWaiver = {
  /** B1 rule id, e.g. 'parallel-fifths', 'parallel-octaves', 'doubled-leading-tone' */
  rule: string
  /** why this span licenses it — shown to a user, so write it for a human */
  reason: string
  /** limit the waiver to these step indices (0-based); omit to cover the span */
  steps?: number[]
}

/**
 * An ordered harmonic template with conditions — the shared abstraction for
 * every multi-chord device in this project (A4/V9).
 *
 * STEPS ARE ROMAN-KEYED, always. The charts are roman-keyed and
 * key-independent; a span written in realized chord names would be a different
 * object per key, which is the duplication the roman layer exists to prevent.
 * A step is exactly the `FiguredChord` an edge carries, so a chart edge and a
 * span step speak one vocabulary — which is what lets B2 emit cadence patterns
 * and B5 emit sequences without a translation layer.
 *
 * A SPAN IS NOT A NODE AND NOT AN EDGE. It is never inserted into the graph and
 * `nextChord`/`nextChordDetail` never consult the span library. Spans are a
 * parallel channel, like `mixtureSuggestions`: additive, opt-in, and incapable
 * of changing an existing suggestion list.
 *
 * @example the cadential 6/4 — a device that CANNOT be an edge, because its
 * identity is metric and contextual rather than a chord-to-chord relation:
 * ```ts
 * {
 *   id: 'cadential-64',
 *   kind: 'idiom',
 *   steps: [{ chord: 'I', figure: '64' }, 'V' as never],
 *   conditions: { metric: ['strong', 'weak'] },
 * }
 * ```
 */
export type HarmonicSpan = {
  /** stable kebab-case identifier, unique in the library */
  id: string
  /** one line, for a human */
  title: string
  kind: SpanKind
  /**
   * The ordered template. Bare strings are permitted and mean root position,
   * exactly as on a chart edge, so an unfigured span reads as plainly as the
   * chart does.
   */
  steps: ChartEdge[]
  /** which mode(s) the span belongs to; omit for both */
  modes?: ('major' | 'minor')[]
  /** INERT at Stage M-A — see SpanConditions */
  conditions?: SpanConditions
  /** part-writing rules this span deliberately licenses (consumed by B1) */
  waivers?: RuleWaiver[]
  /** prose: what the device is and when to reach for it */
  notes?: string
}
