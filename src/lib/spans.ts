import { edgeChord, edgeFigure, figuredRoman } from './figuredBass'
import type { ChartEdge, HarmonicSpan, SpanKind } from './graphData/types'

/**
 * The span library (Stage M-A, A6) — descending-bass idioms and the contextual
 * 6/4s, authored as `HarmonicSpan`s.
 *
 * WHY THESE ARE NOT EDGES. A first-order Markov edge answers "what may follow
 * this chord". Every device here answers a different question — "what is this
 * STRETCH of music" — and several of them are indistinguishable from one
 * another at the level of a single edge:
 *
 *   I - I6/4 - I6   is a PASSING 6/4  (stepwise bass through the 6/4)
 *   I - I6/4 - I    is a PEDAL 6/4    (static bass under the 6/4)
 *   I6/4 - V        is a CADENTIAL 6/4 (strong beat, resolving 6/4 -> 5/3)
 *
 * All three contain the identical sonority. Only the surrounding bass and the
 * metric position tell them apart, and an edge carries neither. That is V9 in
 * PLAN-MUSIC.md and the reason A4's span type exists.
 *
 * A SPAN IS NEVER CONSULTED BY `nextChord` / `nextChordDetail`. This library is
 * a parallel, additive channel — like `mixtureSuggestions` — so nothing here
 * can change a suggestion list that already existed. `nextChord` output is
 * byte-identical across both charts with this file present.
 *
 * CONDITIONS ARE INERT AT THIS STAGE. `conditions.bass`, `conditions.soprano`
 * and `conditions.metric` are declared, type-checked and stored, but nothing in
 * Stage M-A evaluates them. They are authored NOW so that B1 (voice leading)
 * and B3 (metric weight) inherit real content to switch on rather than a
 * hypothetical schema — and so that neither stream has to invent a shape that
 * the other and the already-authored spans would then have to migrate to.
 *
 * WAIVERS ARE LIVE DATA, not inert: fauxbourdon's parallel motion is the point
 * of the device, and B1 must not red-ink this library's own content. See the
 * `RuleWaiver` doc in graphData/types.ts.
 */

/**
 * The cadential 6/4 — a tonic triad over the dominant in the bass, on a strong
 * beat, resolving to a root-position V over the SAME bass note.
 *
 * The chart also carries this as the function node `V64`, which is a different
 * representation of the same object and is retained (see the alias policy in
 * docs/chord-theory.md §4). The span adds what the node structurally cannot:
 * the metric requirement that defines the device. `V64` is reachable and
 * playable; this span says when it is a CADENTIAL 6/4 rather than some other
 * 6/4.
 */
const cadentialSixFour: HarmonicSpan = {
  id: 'cadential-64',
  title: 'Cadential six-four',
  kind: 'idiom',
  steps: [{ chord: 'I', figure: '64' }, 'V'],
  conditions: {
    // THE defining condition: the 6/4 must fall on the STRONGER beat and its
    // resolution on the weaker. A 6/4 on a weak beat resolving to a strong V
    // is not a cadential 6/4 at all — it is an accented passing chord. (B3)
    metric: ['strong', 'weak'],
    // the bass does not move: 5 is held under both chords, which is what makes
    // the 6th and 4th read as suspensions over the dominant rather than as a
    // tonic chord (B1 owns the 6/4 -> 5/3 resolution itself)
    bass: { degrees: [5, 5], motion: 'static' },
  },
  notes:
    'Tonic notes suspended over scale degree 5. Functions as DOMINANT, not as ' +
    'tonic: the 6th and 4th above the bass resolve down to the 5th and 3rd ' +
    'while the bass holds. Must sit on the stronger beat of the pair.',
}

/**
 * The passing 6/4 — I and I6 joined by a 6/4 whose bass passes stepwise
 * between them. Distinguished from the cadential 6/4 by the MOVING bass and
 * from the pedal 6/4 by the bass not returning to where it started.
 */
const passingSixFour: HarmonicSpan = {
  id: 'passing-64',
  title: 'Passing six-four',
  kind: 'idiom',
  steps: ['I', { chord: 'V', figure: '64' }, { chord: 'I', figure: '6' }],
  conditions: {
    // 1 - 2 - 3: the bass walks up through the 6/4. Reverse the span for the
    // descending form; the degrees are what distinguish it from the pedal.
    bass: { degrees: [1, 2, 3], motion: 'stepwise-up' },
    // unaccented by definition — a passing chord on a strong beat reads as
    // cadential, which is the whole point of keeping the two spans apart (B3)
    metric: ['strong', 'weak', 'strong'],
  },
  notes:
    'A 6/4 as pure voice leading: the bass passes stepwise between a chord ' +
    'and its own first inversion. Not a harmony in its own right, which is ' +
    'why it is a span and not a chart edge — the same sonority on a strong ' +
    'beat would be a cadential 6/4 instead.',
}

/**
 * The pedal (or neighbour) 6/4 — the bass holds while the upper voices step
 * away and back. Same sonority as the other two; identified by a static bass
 * that begins and ends on the same chord.
 */
const pedalSixFour: HarmonicSpan = {
  id: 'pedal-64',
  title: 'Pedal six-four',
  kind: 'idiom',
  steps: ['I', { chord: 'IV', figure: '64' }, 'I'],
  conditions: {
    bass: { degrees: [1, 1, 1], motion: 'static' },
    metric: ['strong', 'weak', 'strong'],
  },
  notes:
    'The bass holds scale degree 1 while two upper voices step up and back. ' +
    'A decoration of a held tonic, not a change of harmony.',
}

/**
 * The lament bass — a tonic descending by step through a fourth to the
 * dominant, the ground of countless laments (Dido, the Crucifixus, Purcell
 * generally). In minor the descent is 1-b7-b6-5.
 *
 * The bass line is the subject; the harmonies above it are one common
 * realization rather than the only one, which is exactly the sort of statement
 * a span can make and an edge cannot.
 */
const lamentBass: HarmonicSpan = {
  id: 'lament-bass',
  title: 'Lament bass',
  kind: 'schema',
  modes: ['minor'],
  steps: [
    'Im',
    { chord: 'V', figure: '6' },
    'VI',
    // the dominant arrived at by step from above, in root position
    'V',
  ],
  conditions: {
    // 1 - 7 - 6 - 5, a stepwise descent through a fourth: the identity of the
    // device. The harmonization may vary; this line may not.
    bass: { degrees: [1, 7, 6, 5], motion: 'stepwise-down' },
  },
  notes:
    'The descending tetrachord 1-b7-b6-5 in the bass. A ground bass: expect ' +
    'it repeated, with the upper voices varying over it.',
}

/**
 * The major-key descending-bass idiom named in the plan:
 * I - V6 - vi - iii6 - IV - I6 - IV - V.
 *
 * The bass descends 1-7-6-5-4-3-4-5 — a stepwise fall through a sixth that
 * turns back up to the dominant. Alternating root position and first inversion
 * is what produces the smooth line; this is the clearest demonstration in the
 * library of the bass as a MELODY rather than a series of chord roots, which
 * is what Stage M-A exists to make expressible.
 */
const descendingBassIdiom: HarmonicSpan = {
  id: 'descending-bass-idiom',
  title: 'Descending-bass idiom (I–V6–vi–iii6–IV–I6–IV–V)',
  kind: 'schema',
  modes: ['major'],
  steps: [
    'I',
    { chord: 'V', figure: '6' },
    'VIm',
    { chord: 'IIIm', figure: '6' },
    'IV',
    { chord: 'I', figure: '6' },
    'IV',
    'V',
  ],
  conditions: {
    bass: { degrees: [1, 7, 6, 5, 4, 3, 4, 5] },
  },
  notes:
    'Root position and first inversion alternate so that the bass falls by ' +
    'step from 1 to 3 before turning back to the dominant. The harmony is ' +
    'ordinary; the LINE is the idea — this is the canonical case for figured ' +
    'edges, since half of these chords are inverted purely to keep the bass ' +
    'moving by step.',
}

/**
 * Fauxbourdon — a chain of parallel 6/3 chords, the bass and an upper voice
 * moving in parallel sixths with a third voice filling in fourths above the
 * bass. Fifteenth-century in origin and still current as a texture.
 *
 * THIS SPAN EXISTS TO CARRY ITS WAIVERS. The device is defined by parallel
 * motion, so a part-writing checker with no notion of context would flag every
 * step of it. That is exactly the "tool red-inks its own content" failure the
 * waiver mechanism (A4) was put in the schema to prevent, and it is why the
 * waiver channel could not wait for B1: the content ships in this stage.
 */
const fauxbourdon: HarmonicSpan = {
  id: 'fauxbourdon',
  title: 'Fauxbourdon (parallel 6/3 chains)',
  kind: 'idiom',
  steps: [
    { chord: 'I', figure: '6' },
    { chord: 'VIIdim', figure: '6' },
    { chord: 'VIm', figure: '6' },
    { chord: 'V', figure: '6' },
  ],
  conditions: {
    bass: { degrees: [3, 2, 1, 7], motion: 'stepwise-down' },
    // the outer voices move in parallel sixths, so the soprano descends in
    // lockstep with the bass — that parallelism IS the texture (B1)
    soprano: { degrees: [1, 7, 6, 5], motion: 'stepwise-down' },
  },
  waivers: [
    {
      rule: 'parallel-fourths',
      reason:
        'Fauxbourdon is BUILT from parallel fourths above the bass — the ' +
        'middle voice doubles the bass a fourth up throughout. Flagging them ' +
        'would flag the device itself.',
    },
    {
      rule: 'parallel-fifths',
      reason:
        'The 6/3 chain admits fifths between upper voices at points where a ' +
        'root-position progression would not. The parallel texture is ' +
        'deliberate and period-correct.',
    },
    {
      rule: 'doubled-leading-tone',
      reason:
        'A 6/3 chain passing through vii°6 may double the leading tone in ' +
        'passing, because the voice doubling it is moving in parallel rather ' +
        'than resolving as an independent part.',
    },
  ],
  notes:
    'Parallel first-inversion triads. The bass and soprano run in sixths and ' +
    'the inner voice a fourth above the bass. Deliberately breaks the ' +
    'parallel-motion rules, which is why it declares waivers.',
}

/**
 * Every span in the library, in no significant order.
 *
 * Exported as a plain array rather than a map because callers filter it (by
 * `kind`, by `mode`) far more often than they look one up, and `spanById`
 * covers the lookup case.
 */
export const spans: readonly HarmonicSpan[] = [
  cadentialSixFour,
  passingSixFour,
  pedalSixFour,
  lamentBass,
  descendingBassIdiom,
  fauxbourdon,
]

/** One span by id, or `undefined`. */
export const spanById = (id: string): HarmonicSpan | undefined =>
  spans.find((s) => s.id === id)

/**
 * Spans of a kind, optionally restricted to a mode.
 *
 * A span with no `modes` belongs to both, so it is returned for either — the
 * cadential 6/4 is not a major-key device or a minor-key device, it is both.
 *
 * This is the entry point B2 (cadence patterns) and B5 (sequences) are
 * expected to use: each filters for its own `kind` over this one registry
 * rather than keeping a private list.
 */
export const spansOfKind = (
  kind: SpanKind,
  mode?: 'major' | 'minor'
): HarmonicSpan[] =>
  spans.filter(
    (s) => s.kind === kind && (!mode || !s.modes || s.modes.includes(mode))
  )

/**
 * The romans of a span's steps as a composer would write them: `['I6', 'V']`.
 *
 * Display only — it does not realize into a key. Realization is the graph
 * translator's job, and a span deliberately stays key-independent (its steps
 * are romans) so that one span serves every key.
 */
export const spanRomans = (span: HarmonicSpan): string[] =>
  span.steps.map((step: ChartEdge) =>
    figuredRoman(edgeChord(step), edgeFigure(step))
  )

/**
 * Every rule id this span licenses, flattened.
 *
 * B1's checker is expected to take this set and suppress those rules while
 * verifying a realization of the span. Returns [] for a span with no waivers,
 * which is most of them.
 */
export const spanWaivedRules = (span: HarmonicSpan): string[] =>
  (span.waivers ?? []).map((w) => w.rule)
