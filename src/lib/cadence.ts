import { Chord, Note, Scale } from 'tonal'

import { edgeChord, edgeFigure, figuredRoman } from './figuredBass'
import type { HarmonicSpan } from './graphData/types'
import { functionOf } from './harmonicFunction'
import { chordGraphCreate, lookUpGraph } from './util/graphUtil'

/**
 * Cadence types as data, and cadence DETECTION over music already written
 * (Stage M-B, B2).
 *
 * Two features share this file because they must share one definition. A
 * cadence type is authored once, as a `HarmonicSpan` (the A4 schema), and both
 * directions read the same object: `pathToCadence` uses it as a TARGET to route
 * toward, and `detectCadences` uses it as a PATTERN to match. Writing the
 * definitions twice — once for generation, once for analysis — is how a tool
 * ends up able to produce a cadence it cannot then recognize.
 *
 * WHY DETECTION DOES NOT USE THE CHART'S EDGES. The obvious implementation of
 * `detectCadences` is "walk the progression and look for a chart edge marked as
 * cadential". It is wrong, and the probe that established this is worth
 * recording because it is counter-intuitive:
 *
 *   A minor, IVm -> Im   ABSENT from the chart (the minor plagal cadence)
 *   A minor, V   -> VI   ABSENT from the chart (the minor deceptive cadence)
 *   A minor, VIIdim -> Im ABSENT from the chart
 *
 * All three are real, common cadences that composers write constantly. The
 * chart is a model of idiomatic CONTINUATION — where to go next — and it is
 * deliberately not exhaustive; it does not owe analysis a complete edge set.
 * If detection were chart-driven, the tool would look a competent composer in
 * the eye and fail to label the plagal cadence at the end of their minor-key
 * hymn. So detection matches on ROMAN PAIRS evaluated independently of the
 * chart, and the chart is used only for what it is good at: pathfinding, and
 * resolving a realized chord name to its roman.
 *
 * THE QUALITY BAR, stated once and applied throughout: for this audience a
 * WRONG cadence label is worse than a missing one. Every definition below is
 * hand-verified against theory and pinned by a real example in
 * `cadence.test.ts`, and every place where the available evidence is
 * insufficient to distinguish two cadence types returns the weaker claim or no
 * claim at all rather than guessing. `confidence` exists for exactly this
 * reason — see `detectCadences`.
 *
 * DELIBERATELY NOT A CADENCE TYPE: `vii°` to `i`. It is a resolution, and a
 * strong one, but the standard taxonomy does not name it a cadence — it is a
 * contrapuntal, dominant-function resolution without the root motion that
 * defines an authentic cadence, and theorists who do count it treat it as a
 * variety of IAC rather than a type of its own. Reporting it as a labelled
 * cadence type would be inventing vocabulary; `detectCadences` therefore
 * returns nothing for `Am - G#dim - Am`, which is a MISSING label rather than a
 * wrong one, and the right side of the quality bar to err on.
 */

/**
 * The cadence types this module knows.
 *
 * 'evaded' is on the list deliberately and is not a curiosity: it is the
 * phrase-EXTENSION device, the answer to "how do I avoid closing yet", which for
 * a composer planning a phrase is as live a question as "how do I close". The
 * others are the standard taxonomy.
 */
export type CadenceType =
  | 'PAC'
  | 'IAC'
  | 'half'
  | 'deceptive'
  | 'plagal'
  | 'phrygian-half'
  | 'evaded'

/**
 * A cadence definition: the span, plus the machine-checkable facts detection
 * needs that a span's inert `conditions` cannot yet express.
 *
 * The span is the AUTHORED form and the thing a composer reads. `approach` and
 * `arrival` are the same information in the form the matcher consumes — sets of
 * acceptable romans for the two chords — and they exist because a span's
 * `steps` name ONE realization of the cadence while a cadence type admits
 * several (a PAC may be V-I or V7-I; a half cadence may be approached from any
 * predominant). A span with seven alternative step-lists would stop being
 * readable, so the span shows the canonical form and these fields carry the
 * full set.
 */
export type CadenceDefinition = {
  type: CadenceType
  /** the authored span — canonical form, conditions, prose */
  span: HarmonicSpan
  /** romans acceptable as the PENULTIMATE chord */
  approach: readonly string[]
  /** romans acceptable as the FINAL chord */
  arrival: readonly string[]
  /**
   * Ranking weight when two definitions match the same chord pair, higher
   * first. Only one pair is genuinely ambiguous — see `PAC`/`IAC` below — and
   * this makes the resolution explicit rather than dependent on array order.
   */
  specificity: number
}

// ---------------------------------------------------------------------------
// The definitions. One per cadence type, hand-verified.
// ---------------------------------------------------------------------------

/**
 * PERFECT AUTHENTIC CADENCE — V (or V7) to I, BOTH IN ROOT POSITION, with the
 * tonic in the soprano. The strongest close in the idiom; the only one that
 * sounds fully final.
 *
 * All three requirements are load-bearing and the span states all three, which
 * is the concrete demonstration that a cadence is a span and not a chord pair:
 *
 *  - both root position — `bass: { degrees: [5, 1] }` says the bass is on 5
 *    then 1. An inverted V or I makes the same chords an IAC.
 *  - soprano on 1 — `soprano: { degrees: [2, 1] }`, the canonical 2-1 descent.
 *    (7-1 is equally standard; `sopranoArrival` below is what detection
 *    actually checks, since only the ARRIVAL degree distinguishes PAC from IAC.)
 *  - the arrival on the stronger beat — `metric: ['weak', 'strong']`.
 *
 * A chord PAIR cannot say any of that, which is the point of A4.
 */
const PAC: CadenceDefinition = {
  type: 'PAC',
  specificity: 2,
  approach: ['V', 'V7'],
  arrival: ['I', 'Im'],
  span: {
    id: 'cadence-pac',
    title: 'Perfect authentic cadence',
    kind: 'cadence',
    steps: ['V', 'I'],
    conditions: {
      // both chords in root position: 5 then 1 in the bass. THE requirement
      // that separates a PAC from an IAC.
      bass: { degrees: [5, 1] },
      // the tonic in the soprano, reached by the 2-1 descent. 7-1 is equally
      // canonical; what matters for the label is that the soprano ARRIVES on 1.
      soprano: { degrees: [2, 1] },
      // a cadence arrives on the stronger beat
      metric: ['weak', 'strong'],
    },
    notes:
      'The strongest close available: V or V7 to I, both in root position, ' +
      'with scale degree 1 in the soprano. Any one of those three conditions ' +
      'relaxed gives an imperfect authentic cadence instead.',
  },
}

/**
 * IMPERFECT AUTHENTIC CADENCE — the same V-I motion, but WEAKENED: either a
 * chord is inverted, or the soprano lands on 3 or 5 instead of 1.
 *
 * Same chords as a PAC, so the two are distinguished entirely by voicing. This
 * is the reason `detectCadences` returns a `confidence` field: given only chord
 * NAMES, without a soprano or a bass, a V-I is an authentic cadence of
 * unknown strength, and reporting "PAC" on that evidence would be a wrong
 * label, which is the one thing this module must not do. The default is
 * therefore IAC — the weaker, safer claim — upgraded to PAC only when the
 * caller supplies a soprano on 1 with root-position bass.
 */
const IAC: CadenceDefinition = {
  type: 'IAC',
  // lower than PAC: when both match, PAC is the more specific claim and wins,
  // but only when the evidence for it is actually present.
  specificity: 1,
  approach: ['V', 'V7'],
  arrival: ['I', 'Im'],
  span: {
    id: 'cadence-iac',
    title: 'Imperfect authentic cadence',
    kind: 'cadence',
    steps: ['V', 'I'],
    conditions: {
      // 3 or 5 in the soprano rather than 1 — the commonest form of the
      // weakening. Inverting either chord produces an IAC just as surely; the
      // span shows one representative case, and `sopranoArrival` in the matcher
      // carries the full rule.
      soprano: { degrees: [2, 3] },
      metric: ['weak', 'strong'],
    },
    notes:
      'V to I weakened: an inversion in either chord, or a soprano arriving ' +
      'on 3 or 5 rather than 1. Closes a phrase without the finality of a PAC, ' +
      'which is why it is the normal interior cadence.',
  },
}

/**
 * HALF CADENCE — a phrase ending ON the dominant. The dominant is the ARRIVAL,
 * not the approach: the phrase stops there, unresolved, and that suspension is
 * the device.
 *
 * Approached from anywhere, which is why `approach` is the widest list here —
 * I-V, ii-V, IV-V and vi-V are all ordinary half cadences. What makes it a
 * cadence is where it STOPS, so the arrival is the constrained end.
 *
 * NOT the same as a phrase that merely passes through V. Only metric position
 * and phrase context distinguish them, and neither is available from a chord
 * list alone — `detectCadences` reports a half cadence at the END of the
 * supplied progression with full confidence and one in the middle with reduced
 * confidence, which is the honest reading of that evidence.
 */
const HALF: CadenceDefinition = {
  type: 'half',
  specificity: 1,
  approach: [
    'I',
    'Im',
    'IV',
    'IVm',
    'IIm',
    'IIdim',
    'IIm7',
    'IIm7b5',
    'IVmaj7',
    'IVm7',
    'VIm',
    'VI',
    'Imaj7',
    'Im7',
    // the chromatic predominants and the applied dominant of V — all of them
    // approach the dominant, which is what they exist for
    'N6',
    'Aug6',
    'V/V',
    'V7/V',
    'VIIdim/V',
    'V64',
  ],
  arrival: ['V', 'V7'],
  span: {
    id: 'cadence-half',
    title: 'Half cadence',
    kind: 'cadence',
    steps: ['IIm', 'V'],
    conditions: {
      // the arrival is a root-position dominant: an inverted V does not sound
      // like an arrival, it sounds like it is still moving
      bass: { degrees: [2, 5] },
      metric: ['weak', 'strong'],
    },
    notes:
      'A phrase ending ON the dominant, unresolved. Approached from any ' +
      'predominant or from the tonic. The dominant must be in root position ' +
      'to read as an arrival rather than as a passing chord.',
  },
}

/**
 * DECEPTIVE CADENCE — V resolving to vi (VI in minor) instead of the tonic the
 * ear was promised. The substitution works because the submediant shares two of
 * the tonic's three notes, so for an instant it is mistaken for the resolution.
 *
 * Both spellings are accepted as the arrival because the chart itself uses
 * different ones per mode (probed: major has `VIm`, minor has `VI`), and a
 * minor-key deceptive cadence lands on the MAJOR submediant (F in A minor).
 */
const DECEPTIVE: CadenceDefinition = {
  type: 'deceptive',
  specificity: 2,
  approach: ['V', 'V7'],
  arrival: ['VIm', 'VI'],
  span: {
    id: 'cadence-deceptive',
    title: 'Deceptive cadence',
    kind: 'cadence',
    steps: ['V', 'VIm'],
    conditions: {
      // 5 rising to 6: the bass goes UP by step where the ear expected it to
      // fall a fifth, which is the whole effect
      bass: { degrees: [5, 6], motion: 'stepwise-up' },
      metric: ['weak', 'strong'],
    },
    notes:
      'V resolves to vi rather than I. The submediant shares two notes with ' +
      'the tonic, so it stands in for it just long enough to disappoint. ' +
      'Standard usage is to extend the phrase and cadence properly afterwards.',
  },
}

/**
 * PLAGAL CADENCE — IV to I, the "Amen" cadence. A subdominant close with no
 * leading tone in it at all, which is what gives it its settled, non-urgent
 * quality: nothing has to resolve.
 *
 * Not a substitute for an authentic cadence. Its normal use is AFTER one, as a
 * codetta extending a close already made, which is why the chart carries
 * `IV -> I` as a dotted edge rather than a strong one.
 *
 * ABSENT FROM THE MINOR CHART ENTIRELY (probed: `IVm -> Im` is not an edge),
 * yet the minor plagal cadence is completely standard. Detection therefore
 * knows it and the pathfinder cannot route to it in minor — a divergence that
 * is honest rather than a bug, and is exactly why detection is not chart-driven.
 */
const PLAGAL: CadenceDefinition = {
  type: 'plagal',
  specificity: 2,
  approach: ['IV', 'IVm', 'IVmaj7', 'IVm7'],
  arrival: ['I', 'Im'],
  span: {
    id: 'cadence-plagal',
    title: 'Plagal cadence',
    kind: 'cadence',
    steps: ['IV', 'I'],
    conditions: {
      bass: { degrees: [4, 1] },
      metric: ['weak', 'strong'],
    },
    notes:
      'IV to I — the "Amen" cadence. No leading tone, so nothing pulls; the ' +
      'effect is settled rather than conclusive. Usually follows an authentic ' +
      'cadence as a codetta rather than replacing one.',
  },
}

/**
 * PHRYGIAN HALF CADENCE — iv6 to V in a MINOR key, with the bass falling by a
 * HALF STEP from 6 to 5.
 *
 * A half cadence, so the arrival is the dominant; what names it is the bass.
 * The first-inversion subdominant puts scale degree 6 in the bass, and in minor
 * that 6 is a half step above 5, producing the semitone descent that is the
 * device's entire identity. IN MAJOR THE SAME CHORDS GIVE A WHOLE STEP AND IT
 * IS NOT A PHRYGIAN CADENCE — hence `modes: ['minor']`, which is not decoration
 * but the definition.
 *
 * The figure is likewise definitional: root-position iv to V is an ordinary
 * half cadence. `iv6` is the requirement, and this is the cadence that most
 * clearly justifies Stage M-A existing at all — before figures were expressible
 * this device could not be stated.
 */
const PHRYGIAN_HALF: CadenceDefinition = {
  type: 'phrygian-half',
  // more specific than a plain half cadence: when both match, this wins
  specificity: 3,
  approach: ['IVm6', 'IVm'],
  arrival: ['V'],
  span: {
    id: 'cadence-phrygian-half',
    title: 'Phrygian half cadence',
    kind: 'cadence',
    // MINOR ONLY — in major the bass step is a whole tone and the device
    // evaporates
    modes: ['minor'],
    steps: [{ chord: 'IVm', figure: '6' }, 'V'],
    conditions: {
      // 6 down to 5. In minor that is a HALF step, which is the device.
      bass: { degrees: [6, 5], motion: 'stepwise-down' },
      metric: ['weak', 'strong'],
    },
    notes:
      'iv6 to V in minor: the bass falls a semitone from 6 to 5. A half ' +
      'cadence named for the Phrygian mode, whose second degree sits a ' +
      'semitone above the final. Minor only — in major the same chords give a ' +
      'whole step and the effect is gone.',
  },
}

/**
 * EVADED CADENCE — V42 to I6. The phrase-EXTENSION device: the cadence is set
 * up and then sidestepped, so the music cannot stop and must continue.
 *
 * The mechanism is precise and is why this is a real cadence type rather than a
 * mere weak resolution. In V42 the chordal seventh is IN THE BASS, and a
 * chordal seventh must resolve DOWN by step. So the bass is obliged to fall to
 * 3, which forces the tonic into first inversion — the one resolution available
 * makes closure impossible. The listener hears the dominant, expects the close,
 * and gets a tonic that cannot bear weight.
 *
 * The figures are the entire definition here: `V - I` root position is a PAC
 * and the same two chords with these two figures cannot close at all. There is
 * no way to state this without Stage M-A, and it is a chart edge already
 * (probed: `V7` has a dotted `I6` edge in both modes).
 */
const EVADED: CadenceDefinition = {
  type: 'evaded',
  // the most specific definition in the module: it pins both figures
  specificity: 4,
  approach: ['V42'],
  arrival: ['I6', 'Im6'],
  span: {
    id: 'cadence-evaded',
    title: 'Evaded cadence',
    kind: 'cadence',
    steps: [
      { chord: 'V7', figure: '42' },
      { chord: 'I', figure: '6' },
    ],
    conditions: {
      // 4 falling to 3: the chordal seventh in the bass resolving down by step,
      // which is COMPULSORY and is what denies the cadence its root position
      bass: { degrees: [4, 3], motion: 'stepwise-down' },
      metric: ['weak', 'strong'],
    },
    notes:
      'V42 to I6 — a cadence set up and sidestepped. The seventh is in the ' +
      'bass and must fall by step, so the tonic can only arrive inverted and ' +
      'the phrase cannot close. The standard way to extend a phrase past the ' +
      'point the ear expected it to end.',
  },
}

/**
 * Every cadence definition, most specific first.
 *
 * Sorted at module scope so the matcher can take the first match rather than
 * scoring and sorting on every call, and so the resolution of the one genuinely
 * ambiguous pair (PAC vs IAC) is a property of the data rather than of the loop.
 */
export const cadenceDefinitions: readonly CadenceDefinition[] = [
  EVADED,
  PHRYGIAN_HALF,
  PAC,
  DECEPTIVE,
  PLAGAL,
  IAC,
  HALF,
].sort((a, b) => b.specificity - a.specificity || a.type.localeCompare(b.type))

/** One definition by type. */
export const cadenceDefinition = (
  type: CadenceType
): CadenceDefinition | undefined => cadenceDefinitions.find((c) => c.type === type)

/**
 * The cadence spans, for the A4 span registry.
 *
 * These are `kind: 'cadence'` and are what `spansOfKind('cadence')` would
 * return if the library in `spans.ts` were extended. They are NOT registered
 * there: `spans.ts` is owned by Stage M-A and another stream may be editing it,
 * so this module exposes its own spans and the barrel exports both. The type is
 * identical, so a caller can concatenate them.
 */
export const cadenceSpans = (mode?: 'major' | 'minor'): HarmonicSpan[] =>
  cadenceDefinitions
    .map((c) => c.span)
    .filter((s) => !mode || !s.modes || s.modes.includes(mode))

/** Human-readable name of a cadence type. */
export const cadenceLabel = (type: CadenceType): string =>
  ({
    PAC: 'perfect authentic cadence',
    IAC: 'imperfect authentic cadence',
    half: 'half cadence',
    deceptive: 'deceptive cadence',
    plagal: 'plagal cadence',
    'phrygian-half': 'Phrygian half cadence',
    evaded: 'evaded cadence',
  })[type]

// ---------------------------------------------------------------------------
// Roman resolution — turning the composer's realized chords back into function.
// ---------------------------------------------------------------------------

const graphFor = (tonic: string, scale: string) => {
  try {
    return lookUpGraph(tonic, scale) ?? chordGraphCreate(tonic, scale)
  } catch {
    return null
  }
}

/**
 * The roman of a realized chord in a key — the first step of detection.
 *
 * RESOLVED VIA THE REALIZED GRAPH, not via `romanInKey` from pivots.ts, and the
 * probe that forced this is the single most important one behind this file:
 *
 *   romanInKey('G#dim', 'A', 'minor')  ->  null
 *
 * G#dim is the leading-tone triad of A minor and the most characteristic
 * dominant-function chord in the minor mode. `romanInKey` cannot name it
 * because it measures against the NATURAL minor scale, in which G# does not
 * appear — the raised seventh is a property of harmonic minor. It likewise
 * returns 'VII7b5' where the charts say 'VIIm7b5', and 'VI7' for the applied
 * dominant A7 in C major.
 *
 * The realized graph has every one of these right, because the charts were
 * authored by hand with the correct romans and `chordGraphCreate` realizes them
 * per key. So the graph is consulted first and `romanInKey` is the fallback for
 * chords the chart does not contain (which is a real case: the chart is a model
 * of idiomatic motion, not a complete catalogue of the key's chords).
 *
 * Returns null when neither can name the chord — an honest "I do not know what
 * this is in this key", which detection turns into "no cadence here" rather
 * than into a guess.
 */
export const romanOf = (
  chordName: string,
  tonic: string,
  scale: string
): string | null => {
  const graph = graphFor(tonic, scale)
  const node = graph?.[chordName]
  if (node?.roman) return node.roman

  // Fallback: derive the degree from the scale directly. Deliberately NOT
  // `romanInKey` — see above. This covers the chords a key contains that the
  // chart does not model, using the mode's own scale, and in minor it checks
  // harmonic minor too so the leading-tone chords resolve.
  return degreeRoman(chordName, tonic, scale)
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const

/**
 * Roman by scale degree, for chords the chart does not contain.
 *
 * Checks the mode's own scale and, in minor, harmonic minor as well — the
 * raised seventh is diatonic to the minor MODE even though it is absent from
 * the natural minor scale, and a leading-tone chord that the chart happens not
 * to carry must still be nameable.
 */
const degreeRoman = (
  chordName: string,
  tonic: string,
  scale: string
): string | null => {
  const chord = Chord.get(chordName)
  const root = chord.tonic
  if (!root || chord.empty) return null
  const rootChroma = Note.chroma(root)
  if (rootChroma === undefined) return null

  const scaleNames =
    scale === 'minor' ? [`${tonic} minor`, `${tonic} harmonic minor`] : [`${tonic} ${scale}`]

  for (const sn of scaleNames) {
    const notes = Scale.get(sn).notes
    if (notes.length !== 7) continue
    const idx = notes.findIndex((n) => Note.chroma(n) === rootChroma)
    if (idx === -1) continue
    const numeral = NUMERALS[idx]
    if (chord.quality === 'Minor') return `${numeral}m${chord.type.includes('seventh') ? '7' : ''}`
    if (chord.quality === 'Diminished') {
      return chord.type === 'diminished seventh'
        ? `${numeral}dim7`
        : chord.type === 'half-diminished'
          ? `${numeral}m7b5`
          : `${numeral}dim`
    }
    if (chord.type === 'dominant seventh') return `${numeral}7`
    if (chord.type === 'major seventh') return `${numeral}maj7`
    return numeral
  }
  return null
}

// ---------------------------------------------------------------------------
// Detection.
// ---------------------------------------------------------------------------

/**
 * One chord of a progression handed to `detectCadences`.
 *
 * A BARE STRING IS THE NORMAL FORM and is all most callers have: a chord name
 * per bar. The object form exists so a caller who DOES know the voicing can
 * supply it and get a sharper answer — specifically, the soprano and bass are
 * what upgrade an IAC to a PAC, and without them the module will not make that
 * claim. That asymmetry is the point: extra evidence buys a stronger label, and
 * its absence costs only precision, never correctness.
 */
export type ProgressionChord =
  | string
  | {
      name: string
      /** figured-bass symbol, if the chord is inverted */
      figure?: string
      /** soprano note or pitch class, e.g. 'C5' or 'C' */
      soprano?: string
      /** bass note or pitch class; inferred from `figure` when absent */
      bass?: string
      /** metric placement, if the caller knows it (B3 territory) */
      metric?: 'strong' | 'weak'
    }

/** A detected cadence. */
export type DetectedCadence = {
  type: CadenceType
  /** index of the APPROACH chord in the input progression */
  index: number
  /** the two chords, as realized names */
  chords: [string, string]
  /** their romans in the analysed key */
  romans: [string, string]
  /**
   * How much the evidence supports this label.
   *
   * 'high'   — everything the definition asks for was supplied and matched.
   * 'medium' — the chord functions match and nothing contradicts, but a
   *            condition could not be checked (no soprano given, say).
   * 'low'    — the pair matches but its context argues against calling it a
   *            cadence, e.g. a half cadence in the middle of a phrase.
   *
   * This field is the module's answer to the quality bar. A wrong label is
   * worse than a missing one, so where the evidence is thin the label is
   * DOWNGRADED rather than withheld — the composer sees what was found and how
   * much to trust it, which is more useful than silence and more honest than a
   * confident guess.
   */
  confidence: 'high' | 'medium' | 'low'
  /** why this label, in one line, for a human */
  reason: string
}

const chordName = (c: ProgressionChord): string =>
  typeof c === 'string' ? c : c.name

const chordFigure = (c: ProgressionChord): string | null =>
  typeof c === 'string' ? null : (c.figure ?? null)

const chordSoprano = (c: ProgressionChord): string | null =>
  typeof c === 'string' ? null : (c.soprano ?? null)

const chordBass = (c: ProgressionChord): string | null =>
  typeof c === 'string' ? null : (c.bass ?? null)

/**
 * Scale degree (1-7) of a pitch class in a key, or null.
 *
 * Minor checks harmonic minor as well, so the raised seventh resolves to degree
 * 7 rather than to nothing.
 */
export const scaleDegreeOf = (
  note: string,
  tonic: string,
  scale: string
): number | null => {
  const pc = Note.get(note).pc || note
  const chroma = Note.chroma(pc)
  if (chroma === undefined) return null
  const scaleNames =
    scale === 'minor' ? [`${tonic} minor`, `${tonic} harmonic minor`] : [`${tonic} ${scale}`]
  for (const sn of scaleNames) {
    const notes = Scale.get(sn).notes
    if (notes.length !== 7) continue
    const idx = notes.findIndex((n) => Note.chroma(n) === chroma)
    if (idx !== -1) return idx + 1
  }
  return null
}

/**
 * Does a roman match one of a definition's accepted romans?
 *
 * Compares the roman WITH its figure when the definition specifies one, and
 * without when it does not. That asymmetry is deliberate and is what lets the
 * evaded cadence require `V42` -> `I6` specifically while the PAC accepts any
 * `V` -> `I`: a definition that names a figure means it, and one that does not
 * is indifferent to inversion at the matching stage (the bass CONDITION then
 * carries the root-position requirement, checked separately and only when the
 * caller supplied a bass).
 */
const romanMatches = (
  roman: string,
  figure: string | null,
  accepted: readonly string[]
): boolean => {
  const figured = figure ? figuredRoman(roman, figure as never) : roman
  return accepted.includes(figured) || accepted.includes(roman)
}

/**
 * Whether a definition that names figures is satisfied by the figures given.
 *
 * The evaded cadence is the only definition whose identity is its figures, and
 * this is what stops a plain `V7 - I` being reported as one. It requires the
 * figures to be PRESENT and correct: an unfigured V7-I is an authentic cadence,
 * not an evaded one, and inferring otherwise from silence would be exactly the
 * confident wrong answer the quality bar forbids.
 */
const figuresSatisfied = (
  def: CadenceDefinition,
  approachFigure: string | null,
  arrivalFigure: string | null
): boolean => {
  if (def.type === 'evaded') {
    // BOTH figures are definitional: the seventh in the bass is what compels
    // the inverted tonic. Either one missing and this is some other cadence.
    return approachFigure === '42' && arrivalFigure === '6'
  }
  if (def.type === 'phrygian-half') {
    // iv6 is definitional. Root-position iv to V is an ordinary half cadence,
    // so without the figure this must NOT claim a Phrygian cadence.
    return approachFigure === '6'
  }
  return true
}

/**
 * Label the cadences in a progression the composer already wrote.
 *
 * THE INVERSE QUERY, and the feature this module treats as first-class: a
 * composer pointing the tool at their own music and being told what they did.
 *
 * Scans every adjacent pair and reports the best-supported cadence label for
 * each, most specific definition winning. Only ONE label per pair — a V-I is
 * not simultaneously a PAC and an IAC, and returning both would make the caller
 * do the disambiguation this module exists to do.
 *
 * CONFIDENCE, NOT SILENCE, is how thin evidence is handled. Given bare chord
 * names a V-I yields `IAC` at medium confidence rather than `PAC` at high,
 * because the PAC's defining conditions (root position, soprano on 1) were not
 * supplied and cannot be assumed. Supply a soprano and a bass and the same pair
 * is reported as a PAC at high confidence. The rule throughout: extra evidence
 * strengthens a claim; missing evidence weakens it; nothing is invented.
 *
 * @param progression the chords, in order. Bare names or objects carrying
 *   voicing — see `ProgressionChord`.
 * @param tonic the key's tonic, e.g. 'C'
 * @param scale 'major' or 'minor'
 *
 * @example bare names — the ordinary case
 * detectCadences(['C', 'F', 'G', 'C'], 'C', 'major')
 * // -> half cadence at index 1 (low: mid-phrase), authentic at index 2
 *
 * @example with voicing — the sharper answer
 * detectCadences(
 *   ['G', { name: 'C', soprano: 'C5', bass: 'C3' }], 'C', 'major'
 * )
 * // -> PAC at high confidence
 */
export const detectCadences = (
  progression: readonly ProgressionChord[],
  tonic: string,
  scale: string
): DetectedCadence[] => {
  if (progression.length < 2) return []

  const out: DetectedCadence[] = []
  const lastIndex = progression.length - 2

  for (let i = 0; i < progression.length - 1; i++) {
    const a = progression[i]
    const b = progression[i + 1]
    const nameA = chordName(a)
    const nameB = chordName(b)
    const romanA = romanOf(nameA, tonic, scale)
    const romanB = romanOf(nameB, tonic, scale)
    if (!romanA || !romanB) continue

    const figA = chordFigure(a)
    const figB = chordFigure(b)

    const found = cadenceDefinitions.find(
      (def) =>
        romanMatches(romanA, figA, def.approach) &&
        romanMatches(romanB, figB, def.arrival) &&
        (!def.span.modes || def.span.modes.includes(scale as 'major' | 'minor')) &&
        figuresSatisfied(def, figA, figB)
    )
    if (!found) continue

    // REPORT THE FIGURED ROMANS. When the caller supplied a figure the label
    // must show it: an evaded cadence reported as 'V7 -> I' names the chords
    // correctly and describes the wrong device, since it is precisely the
    // figures that make it evaded. `figuredRoman` absorbs the seventh, so
    // V7 + '42' reads 'V42' rather than 'V742'.
    const detected = classify(found, {
      a,
      b,
      romanA: figA ? figuredRoman(romanA, figA as never) : romanA,
      romanB: figB ? figuredRoman(romanB, figB as never) : romanB,
      tonic,
      scale,
      index: i,
      isFinalPair: i === lastIndex,
    })
    out.push(detected)
  }

  return out
}

/**
 * Decide the final type and confidence for a matched pair.
 *
 * This is where the PAC/IAC distinction is actually made, and it is separated
 * from the matching loop because it is the part with the musical judgement in
 * it. `cadenceDefinitions` is ordered most-specific-first, so `find` returns
 * PAC for any V-I; this function then DEMOTES it to IAC unless the evidence for
 * a PAC is present. Demoting is the right direction: the stronger claim must be
 * earned.
 */
const classify = (
  def: CadenceDefinition,
  ctx: {
    a: ProgressionChord
    b: ProgressionChord
    romanA: string
    romanB: string
    tonic: string
    scale: string
    index: number
    isFinalPair: boolean
  }
): DetectedCadence => {
  const { a, b, romanA, romanB, tonic, scale, index, isFinalPair } = ctx
  const chords: [string, string] = [chordName(a), chordName(b)]
  const romans: [string, string] = [romanA, romanB]

  // --- the authentic cadences: PAC only when earned ------------------------
  if (def.type === 'PAC' || def.type === 'IAC') {
    const sopranoB = chordSoprano(b)
    const bassA = chordBass(a) ?? impliedBass(a)
    const bassB = chordBass(b) ?? impliedBass(b)
    const sopDegree = sopranoB ? scaleDegreeOf(sopranoB, tonic, scale) : null
    const rootPositionA = isRootPosition(a, bassA)
    const rootPositionB = isRootPosition(b, bassB)

    if (sopDegree === null) {
      // No soprano supplied. The chords are a V-I, which IS an authentic
      // cadence, but PAC vs IAC is a question about the soprano and the bass,
      // and answering it without them would be a guess. Report the weaker,
      // safer label.
      const inverted = rootPositionA === false || rootPositionB === false
      return {
        type: 'IAC',
        index,
        chords,
        romans,
        confidence: inverted ? 'high' : 'medium',
        reason: inverted
          ? `${romanA} to ${romanB} with an inversion — imperfect by the bass`
          : `${romanA} to ${romanB}: an authentic cadence. No soprano supplied, so it cannot be confirmed as perfect`,
      }
    }

    const sopranoOnTonic = sopDegree === 1
    const bothRootPosition = rootPositionA !== false && rootPositionB !== false
    if (sopranoOnTonic && bothRootPosition) {
      return {
        type: 'PAC',
        index,
        chords,
        romans,
        confidence: rootPositionA === true && rootPositionB === true ? 'high' : 'medium',
        reason: `${romanA} to ${romanB}, both root position, soprano on 1 — a perfect authentic cadence`,
      }
    }
    return {
      type: 'IAC',
      index,
      chords,
      romans,
      confidence: 'high',
      reason: !sopranoOnTonic
        ? `${romanA} to ${romanB} with the soprano on ${sopDegree}, not 1 — imperfect`
        : `${romanA} to ${romanB} with an inversion — imperfect by the bass`,
    }
  }

  // --- the half cadence: position in the phrase is the evidence ------------
  if (def.type === 'half') {
    return {
      type: 'half',
      index,
      chords,
      romans,
      // A dominant at the END of what was supplied is an arrival. One in the
      // middle may be a cadence or may just be a passing dominant, and a chord
      // list carries nothing that distinguishes them — so it is reported, and
      // reported as weak.
      confidence: isFinalPair ? 'high' : 'low',
      reason: isFinalPair
        ? `the phrase ends on ${romanB} — a half cadence`
        : `${romanA} to ${romanB} mid-phrase: a half cadence only if the phrase stops here`,
    }
  }

  // --- the rest: the chord pair IS the definition --------------------------
  const reason =
    def.type === 'deceptive'
      ? `${romanA} resolves to ${romanB} instead of the tonic — deceptive`
      : def.type === 'plagal'
        ? `${romanA} to ${romanB} with no leading tone — plagal`
        : def.type === 'phrygian-half'
          ? `${romanA} to ${romanB}: the bass falls a semitone from 6 to 5 — Phrygian half cadence`
          : `${romanA} to ${romanB}: the seventh in the bass forces an inverted tonic — the cadence is evaded`

  return {
    type: def.type,
    index,
    chords,
    romans,
    confidence: 'high',
    reason,
  }
}

/**
 * The bass implied by a chord's figure, when the caller gave a figure but no
 * explicit bass. Returns null for an unfigured chord — NOT the root, because
 * "unfigured" means "the caller did not say", not "root position", and treating
 * silence as a root-position assertion is what would let an inverted cadence be
 * mislabelled a PAC.
 */
const impliedBass = (c: ProgressionChord): string | null => {
  const fig = chordFigure(c)
  if (!fig) return null
  const chord = Chord.get(chordName(c))
  const idx = { '53': 0, '6': 1, '64': 2, '7': 0, '65': 1, '43': 2, '42': 3 }[fig]
  if (idx === undefined) return null
  const note = chord.notes[idx]
  return note ? Note.get(note).pc || note : null
}

/**
 * Is this chord in root position?
 *
 * THREE-VALUED, and that is the whole point: `true` (the bass is the root),
 * `false` (the bass is some other chord tone), `null` (NOT KNOWN). A caller who
 * supplied no bass and no figure gets null, and `classify` treats null as
 * "cannot confirm a PAC" rather than as either answer. Collapsing this to a
 * boolean would force a default, and either default is a wrong label waiting to
 * happen.
 */
const isRootPosition = (
  c: ProgressionChord,
  bass: string | null
): boolean | null => {
  const fig = chordFigure(c)
  if (fig) return fig === '53' || fig === '7'
  if (!bass) return null
  const chord = Chord.get(chordName(c))
  const root = chord.tonic
  if (!root) return null
  const bassPc = Note.get(bass).pc || bass
  return Note.chroma(bassPc) === Note.chroma(root)
}

/**
 * Is a functional move a cadential arrival at all? Used by the pathfinder to
 * recognize that it has reached its goal, and exported because it is the same
 * question `detectCadences` answers, asked prospectively.
 */
export const isCadentialPair = (
  approachRoman: string,
  arrivalRoman: string,
  type: CadenceType
): boolean => {
  const def = cadenceDefinition(type)
  if (!def) return false
  return (
    def.approach.includes(approachRoman) && def.arrival.includes(arrivalRoman)
  )
}

/**
 * The function tags of a cadence's two chords, for explaining a path.
 * Exported mainly so tests can pin that every cadence ends on the function it
 * ought to: authentic and plagal cadences arrive on a tonic, the half cadence
 * arrives on a dominant.
 */
export const cadenceFunctions = (
  type: CadenceType
): { approach: string | null; arrival: string | null } => {
  const def = cadenceDefinition(type)
  if (!def) return { approach: null, arrival: null }
  return {
    approach: functionOf(def.approach[0]),
    arrival: functionOf(def.arrival[0]),
  }
}

// `edgeChord`/`edgeFigure` are used by the span-reading helpers below; re-stated
// here rather than re-implemented so a span's steps are read exactly the way
// spans.ts reads them.
/** The romans of a cadence span's steps, as a composer would write them. */
export const cadenceSpanRomans = (type: CadenceType): string[] => {
  const def = cadenceDefinition(type)
  if (!def) return []
  return def.span.steps.map((s) => figuredRoman(edgeChord(s), edgeFigure(s)))
}
