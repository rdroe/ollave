import { figuredRoman } from './figuredBass'
import type { ChartEdge, Figure, HarmonicSpan } from './graphData/types'

/**
 * Sequences (Stage M-B, B5) — spans that GENERATE progressions.
 *
 * WHY A SEQUENCE IS NOT A FIXED CHORD SUCCESSION. A composer does not think
 * "A7, Dm7, G7, C"; they think "sequence down by fifths for four bars." The
 * chords are the OUTPUT of a rule, not the rule itself. What makes a sequence a
 * sequence is that one short UNIT is restated at a fixed transposition, a fixed
 * number of times — change the number of times and it is the same sequence,
 * change the unit or the interval and it is a different one.
 *
 * So the model here is (unit, transposition, repeats), and the chord list is
 * derived by `applySequence`. Authoring the chords directly would make a
 * four-bar descending-fifths sequence and a six-bar one two different library
 * entries, which is exactly the duplication the roman layer already refuses to
 * accept for keys.
 *
 * HOW THIS EXTENDS THE M-A SPAN TYPE. `HarmonicSpan` deliberately has no
 * transposition-interval or repeat-count field: only sequences have those, and
 * M-A's design record says so explicitly ("B5 can extend `HarmonicSpan`
 * structurally"). `SequencePattern` is therefore an INTERSECTION —
 * `HarmonicSpan & { ... }` — not a competing type. Every sequence pattern IS a
 * valid `HarmonicSpan` and can be passed to `spanRomans`, `spanWaivedRules` or
 * anything else in `spans.ts` without a conversion. `steps` is populated with
 * one default-length realization of the pattern so that a consumer which knows
 * nothing about sequences still sees a well-formed span.
 *
 * TRANSPOSITION IS BY SCALE DEGREE, NOT BY INTERVAL. A diatonic sequence
 * transposes its unit by a fixed number of SCALE STEPS, and the resulting
 * interval quality varies with where in the scale it lands — that variance is
 * the defining feature of a diatonic sequence, not a defect. "Down a fifth"
 * diatonically is "down four scale steps", which is a perfect fifth six times
 * out of seven and a DIMINISHED fifth once (IV -> vii-dim in major). A sequence
 * modelled on real intervals would have to leave the key to keep every link
 * perfect, which is a different device (the applied-dominant form below).
 */

// --------------------------------------------------------------------------
// Diatonic degree tables
// --------------------------------------------------------------------------

/**
 * The diatonic triad on each scale degree, as the roman the charts already
 * speak. Index is 0-based degree (0 = tonic).
 *
 * These are the same roman spellings `romanChordNameToReal` consumes, verified
 * by probe in C major, Eb major, A minor and F# minor before being pinned.
 */
const MAJOR_TRIADS: readonly string[] = [
  'I',
  'IIm',
  'IIIm',
  'IV',
  'V',
  'VIm',
  'VIIdim',
]

/**
 * Minor is the HARMONIC-minor practice the charts already encode: the dominant
 * is major (V, not v) and the seventh degree is the leading-tone diminished
 * triad (vii-dim, not the subtonic VII). `romanChordNameToReal` special-cases
 * the VII-diminished family precisely so that 'VIIdim' in A minor realizes as
 * G#dim rather than Gdim — probed and confirmed.
 *
 * Degrees 3 and 6 keep their natural-minor forms (III, VI), which is what the
 * chart uses and what a sequence actually sounds like: a descending-fifths
 * sequence in minor runs i - iv - VII... in practice, but the DIATONIC form
 * modelled here uses the leading-tone chord so the sequence closes onto V.
 */
const MINOR_TRIADS: readonly string[] = [
  'Im',
  'IIdim',
  'III',
  'IVm',
  'V',
  'VI',
  'VIIdim',
]

/** Diatonic seventh chords per degree — the jazz-adjacent but wholly
 * common-practice form of the descending-fifths sequence, where each chord's
 * seventh is prepared by the previous chord and resolves down by step. */
const MAJOR_SEVENTHS: readonly string[] = [
  'Imaj7',
  'IIm7',
  'IIIm7',
  'IVmaj7',
  'V7',
  'VIm7',
  'VIIm7b5',
]

const MINOR_SEVENTHS: readonly string[] = [
  'Im7',
  'IIm7b5',
  'IIImaj7',
  'IVm7',
  'V7',
  'VImaj7',
  'VIIdim7',
]

export type SequenceMode = 'major' | 'minor'

/** Which family of diatonic chords a degree lookup should use. */
export type DegreeQuality = 'triad' | 'seventh'

const table = (mode: SequenceMode, quality: DegreeQuality): readonly string[] => {
  if (quality === 'seventh') {
    return mode === 'major' ? MAJOR_SEVENTHS : MINOR_SEVENTHS
  }
  return mode === 'major' ? MAJOR_TRIADS : MINOR_TRIADS
}

/** Wrap a degree into 0..6. Sequences walk off both ends constantly. */
const wrap = (degree: number): number => ((degree % 7) + 7) % 7

/**
 * The roman for a scale degree. `degree` is 0-based and may be any integer:
 * out-of-range values wrap, which is what makes a sequence able to run for as
 * long as the caller asks (see `applySequence`'s wrap policy).
 */
export const degreeRoman = (
  degree: number,
  mode: SequenceMode,
  quality: DegreeQuality = 'triad'
): string => table(mode, quality)[wrap(degree)]!

/**
 * The bare roman a `V/x` or `V7/x` tonicization should name, e.g. 'IIm' -> 'II'.
 *
 * The chart writes secondary chords as `V7/II`, with the TARGET stripped of its
 * quality suffix — `V7/IIm` is not a name the translator knows. Probed in four
 * keys: `V7/II` in A minor realizes as F#7, the dominant of B, which is right.
 */
const tonicizationTarget = (roman: string): string =>
  roman.replace(/(maj7|m7b5|dim7|m7|dim|maj|m|7)+$/, '')

// --------------------------------------------------------------------------
// The pattern type — the structural extension of HarmonicSpan
// --------------------------------------------------------------------------

/**
 * One chord of a sequence's UNIT, expressed relative to the unit's own
 * starting degree rather than to the key.
 *
 * This relative form is what lets one unit be transposed: a step saying
 * "degree +3, first inversion" means the same thing at every restatement,
 * whereas an absolute roman would have to be rewritten for each.
 *
 * `applied` promotes the step to the SECONDARY DOMINANT of the degree it names
 * instead of the diatonic chord there — the one field that lets the diatonic
 * and applied-dominant forms of the descending-fifths sequence share a
 * generator rather than being two hand-written chord lists.
 */
export type SequenceStep = {
  /** offset in scale degrees from the unit's starting degree (may be negative) */
  degree: number
  /** figure for this step; omit for root position (a bare edge, as in the charts) */
  figure?: Figure
  /** use the diatonic triad or the diatonic seventh on that degree */
  quality?: DegreeQuality
  /**
   * Emit `V/x` (triad) or `V7/x` (seventh) of the degree rather than the
   * diatonic chord on it. This is what makes the applied-dominant sequence a
   * PATTERN rather than a transcription.
   */
  applied?: 'triad' | 'seventh'
}

/**
 * A sequence, as (unit, transposition, repeats) — and simultaneously a valid
 * `HarmonicSpan`, by intersection.
 *
 * WHY INTERSECTION RATHER THAN A NEW TYPE. Four streams consume `HarmonicSpan`
 * and one registry (`spansOfKind`) serves them. A separate sequence type would
 * force every one of those consumers to learn a second shape, and `kind:
 * 'sequence'` — which M-A put in `SpanKind` specifically for this stream —
 * would have nothing to tag. Intersecting keeps sequences inside the one
 * registry while adding the three fields only sequences can use.
 *
 * SHOULD THIS FOLD BACK INTO `spans.ts`? Not as it stands. `unit` /
 * `transposition` / `defaultRepeats` are meaningless on a cadence or an idiom,
 * and `graphData/types.ts` is deliberately zero-import chart-data. If a later
 * stream needs generated spans too, the right move is to lift `SequenceStep`
 * and these three fields into types.ts as an OPTIONAL `generator?: {...}`
 * sub-object, so a non-generating span still carries no dead fields. Until a
 * second consumer exists, that would be speculative generality.
 */
export type SequencePattern = HarmonicSpan & {
  kind: 'sequence'
  /**
   * The repeating cell, in degrees relative to the current restatement's
   * starting degree. Its LENGTH is the number of chords per restatement.
   */
  unit: SequenceStep[]
  /**
   * How far the unit moves each restatement, in SCALE DEGREES (signed).
   * -1 = each restatement starts a step lower; +2 = a third higher; and
   * "down a fifth" is -4, because a fifth down is four scale steps down.
   */
  transposition: number
  /** restatements used when a caller does not say — enough to be legible */
  defaultRepeats: number
  /** which mode's degree table the unit is read against; both if omitted */
  modes?: SequenceMode[]
}

// --------------------------------------------------------------------------
// The library
// --------------------------------------------------------------------------

/**
 * DESCENDING FIFTHS, DIATONIC — the most common sequence in tonal music.
 * I - IV - vii-dim - iii - vi - ii - V - I in major.
 *
 * The unit is a single chord and the transposition is DOWN FOUR SCALE DEGREES
 * (a fifth down / a fourth up). Roots therefore fall by fifth, and because the
 * sequence stays diatonic exactly one of the seven links is a DIMINISHED fifth
 * rather than a perfect one — IV to vii-dim in major, iv to vii-dim in minor.
 * That irregular link is a property of the diatonic scale, not a bug, and it is
 * why the applied-dominant form below exists as a separate device: making every
 * link a real perfect fifth requires chromatic chords.
 *
 * Voice leading: alternate chords share two common tones, and in four voices
 * the standard realization alternates complete and incomplete chords so that no
 * parallel fifths arise between the falling roots. See Aldwell & Schachter,
 * "Harmony and Voice Leading", ch. 27 (diatonic sequences); Gauldin, "Harmonic
 * Practice in Tonal Music", ch. 15.
 */
const descendingFifths: SequencePattern = {
  id: 'descending-fifths',
  title: 'Descending fifths (diatonic)',
  kind: 'sequence',
  unit: [{ degree: 0 }],
  // down a fifth = down four scale steps
  transposition: -4,
  defaultRepeats: 8,
  steps: [], // filled below by `withRealizedSteps`
  conditions: {
    // the bass falls by fifth and rises by fourth alternately when the chords
    // are kept in a comfortable register; as pure root motion it is -4 each time
    bass: { motion: 'any' },
  },
  waivers: [
    {
      rule: 'doubled-leading-tone',
      reason:
        'A strict descending-fifths sequence keeps its pattern of doublings ' +
        'through every restatement, so the step landing on the leading-tone ' +
        'chord may double the leading tone rather than break the sequence. ' +
        'Breaking the pattern to avoid it is the greater fault.',
    },
    {
      rule: 'unresolved-seventh',
      reason:
        'In the seventh-chord form each seventh is prepared and resolves down ' +
        'by step into the next chord, but the FINAL chord of a truncated ' +
        'sequence has nothing to resolve into. That is an artefact of where ' +
        'the caller cut the sequence, not of the device.',
    },
  ],
  notes:
    'Roots fall by fifth: I-IV-vii-iii-vi-ii-V-I. Exactly one link is a ' +
    'diminished rather than perfect fifth (IV to vii-dim), because the ' +
    'sequence is diatonic. Alternate chords share two common tones.',
}

/**
 * DESCENDING FIFTHS, APPLIED-DOMINANT — each unit tonicizes the next.
 * V7/ii - ii - V7/V ... or, read chord by chord, a chain in which every chord
 * is the dominant seventh of the one that follows.
 *
 * THIS IS A DIFFERENT OBJECT FROM THE DIATONIC FORM, not a variant of it, and
 * an expert wants both: the diatonic form is a scalar pattern that happens to
 * move by fifth, while this one is a chain of real dominant-tonic resolutions
 * that leaves the diatonic set on every other chord. They sound different, they
 * are voice-led differently (here every seventh must resolve down by step and
 * every third is a real leading tone), and a composer chooses between them.
 *
 * The unit is a PAIR — the applied dominant and its target — and the pair moves
 * down a fifth each restatement, so the chain reads V7/x - x - V7/(x-5) ...
 *
 * See Aldwell & Schachter ch. 27 on sequences with applied chords; Laitz,
 * "The Complete Musician", ch. on sequences (the "D2 (-5/+4)" family, of which
 * this is the chromatic member).
 */
const descendingFifthsApplied: SequencePattern = {
  id: 'descending-fifths-applied',
  title: 'Descending fifths with applied dominants',
  kind: 'sequence',
  unit: [
    // the applied dominant OF the degree the unit starts on
    { degree: 0, applied: 'seventh' },
    // ...resolving to that degree itself
    { degree: 0 },
  ],
  // down a fifth per PAIR, so each target is a fifth below the last and the
  // chain reads V7/x - x - V7/(x-4) - (x-4): a real circle of fifths in which
  // every chord is the dominant of the next.
  transposition: -4,
  defaultRepeats: 3,
  steps: [],
  waivers: [
    {
      rule: 'unresolved-seventh',
      reason:
        'Every applied seventh here resolves into the next chord, so the only ' +
        'unresolved seventh is the last one, left hanging by wherever the ' +
        'caller ended the sequence rather than by the device.',
    },
    {
      rule: 'augmented-second',
      reason:
        'Chaining applied dominants in minor puts raised and unraised forms of ' +
        'the same degree in adjacent chords; the melodic augmented second that ' +
        'results is idiomatic in a sequence, where the pattern governs.',
    },
  ],
  notes:
    'Each chord is the dominant seventh of the next: a chain of real ' +
    'tonicizations rather than a diatonic pattern. Every seventh resolves ' +
    'down by step and every third rises as a leading tone, which is why this ' +
    'voice-leads quite differently from the diatonic form.',
}

/**
 * ASCENDING 5-6 — the ascending sequence that AVOIDS parallel fifths.
 *
 * THE POINT OF THE DEVICE. A bass rising by step under root-position triads
 * produces parallel fifths and octaves on every step. The 5-6 technique fixes
 * that: over each rising bass note the upper voice moves 5th -> 6th, so the
 * fifth of one chord becomes the sixth above the same bass and the parallels
 * are broken. That is why this pattern requires FIRST-INVERSION chords and
 * could not be written with bare root-position edges — the 6/3s are the device.
 *
 * Realized: I - vi6 - ii - vii-dim6 - iii - I6 - IV - ii6 ... with the bass
 * 1-1-2-2-3-3-4-4, each bass note carrying its 5/3 then its 6/3. Probed in C
 * major, Eb major and A minor before pinning; the 6/3 above bass degree d is
 * the chord rooted on degree d-2, which is what `{ degree: -2, figure: '6' }`
 * says.
 *
 * See Aldwell & Schachter, "Harmony and Voice Leading", ch. 28 (the 5-6
 * technique); Gauldin ch. 15. Historically the "ascending 5-6" of Renaissance
 * and Baroque practice.
 */
const ascendingFiveSix: SequencePattern = {
  id: 'ascending-5-6',
  title: 'Ascending 5-6',
  kind: 'sequence',
  unit: [
    // 5/3 on the bass degree
    { degree: 0 },
    // 6/3 over the SAME bass: its root lies a third below that bass
    { degree: -2, figure: '6' },
  ],
  transposition: 1,
  defaultRepeats: 4,
  steps: [],
  conditions: {
    // the identity of the device: the bass rises by step, each degree held for
    // the 5 and then the 6 above it
    bass: { motion: 'stepwise-up' },
  },
  waivers: [
    {
      rule: 'doubled-leading-tone',
      reason:
        'The restatement built on scale degree 2 puts vii-dim6 in the pattern; ' +
        'holding the sequence\'s doubling scheme through it may double the ' +
        'leading tone on a weak step. The sequence governs.',
    },
  ],
  notes:
    'Over each rising bass note the upper voice moves from the 5th to the 6th ' +
    'above it, which is precisely what breaks the parallel fifths a stepwise ' +
    'rising bass under root-position triads would otherwise produce. The ' +
    'first-inversion chords are not decoration; they ARE the technique.',
}

/**
 * DESCENDING 5-6 — the falling counterpart, and the Pachelbel/romanesca ground.
 * I - V6 - vi - iii6 - IV - I6 - ii - vi6, bass 1-7-6-5-4-3-2-1.
 *
 * RELATIONSHIP TO M-A's `descending-bass-idiom`. Its first six chords are
 * identical to that span (I - V6 - vi - iii6 - IV - I6), which is not a
 * coincidence and not a duplication: M-A authored that stretch as a fixed
 * eight-chord IDIOM with a turn back to the dominant at the end, while this is
 * the GENERATOR whose output it is a truncation of. They are cross-referenced
 * rather than merged because the idiom's ending (IV - V) is not what the
 * sequence produces — the idiom breaks the pattern to cadence, which is exactly
 * how the device is used in practice.
 *
 * See Aldwell & Schachter ch. 28; Gjerdingen, "Music in the Galant Style",
 * on the Romanesca (the same bass, with the galant repertory's own
 * harmonization).
 */
const descendingFiveSix: SequencePattern = {
  id: 'descending-5-6',
  title: 'Descending 5-6 (Romanesca / Pachelbel ground)',
  kind: 'sequence',
  unit: [
    // 5/3 on the bass degree
    { degree: 0 },
    // 6/3 whose bass is the step BELOW: its root lies a third under that
    { degree: -3, figure: '6' },
  ],
  transposition: -2,
  defaultRepeats: 4,
  steps: [],
  conditions: {
    bass: { motion: 'stepwise-down' },
  },
  notes:
    'Bass 1-7-6-5-4-3-2-1: root position and first inversion alternate so the ' +
    'line falls by step. The ground of the Pachelbel canon and of the ' +
    'Romanesca schema. Its first six chords are M-A\'s descending-bass-idiom, ' +
    'which is this generator truncated and turned to a cadence.',
}

// --------------------------------------------------------------------------
// The Galant schemata (Gjerdingen)
// --------------------------------------------------------------------------

/**
 * MONTE ("mountain") — a RISING sequence of applied-dominant pairs, normally
 * stated twice, moving up by step.
 *
 * THE SPECIFIC SIGNATURE, because "chords going up" is not a monte. Gjerdingen's
 * Monte (Music in the Galant Style, ch. 7) is: a two-chord unit of an applied
 * dominant resolving to its target, restated a STEP HIGHER. The classic
 * realization after a mid-piece cadence in the dominant is
 * V7/IV - IV then V7/V - V, i.e. the pair rises by one scale degree, and the
 * bass leaps down a fifth (or up a fourth) within each pair before stepping up
 * to begin the next. The upper voice descends within each unit and is reset a
 * step higher at each restatement — the "climbing" contour that names the
 * schema. It typically prolongs and re-approaches the dominant.
 *
 * The distinguishing feature against fonte is direction AND the fact that both
 * schemata are built from applied-dominant PAIRS, not from single chords: a
 * bare rising step-sequence of diatonic triads is neither.
 */
const monte: SequencePattern = {
  id: 'monte',
  title: 'Monte (Galant rising sequence)',
  kind: 'sequence',
  unit: [
    { degree: 0, applied: 'seventh' },
    { degree: 0 },
  ],
  // each restatement a STEP HIGHER — the climb that names the schema
  transposition: 1,
  defaultRepeats: 2,
  steps: [],
  conditions: {
    // within a pair the bass leaps (dominant to its tonic); between pairs it
    // steps up. The overall trajectory is what "monte" names.
    bass: { motion: 'any' },
  },
  waivers: [
    {
      rule: 'augmented-second',
      reason:
        'Restating an applied-dominant pair a step higher juxtaposes raised ' +
        'and diatonic forms of the same degree; the resulting melodic ' +
        'augmented second is idiomatic to the schema.',
    },
  ],
  notes:
    'Gjerdingen\'s Monte: an applied dominant and its target, restated a step ' +
    'higher — classically V7/IV-IV then V7/V-V. The bass leaps down a fifth ' +
    'inside each pair and steps up between them; the melody descends within ' +
    'each unit and resets higher. Prolongs and re-approaches the dominant. ' +
    'NOT merely "chords going up": the applied-dominant pair is essential.',
}

/**
 * FONTE ("fountain/well") — the FALLING counterpart, normally stated twice,
 * moving down by step.
 *
 * Gjerdingen (ch. 4): the classic fonte follows the double bar of a galant
 * binary movement, where the music has just cadenced in the dominant. It steps
 * down through a minor-then-major pair — canonically V7/ii - ii then V7/I - I,
 * i.e. a tonicization of the supertonic followed a step lower by a
 * tonicization of the tonic. That is what returns the music to the home key,
 * which is the schema's structural job.
 *
 * The minor-first, major-second shape is the audible signature: the first
 * statement lands on a minor chord (ii) and the second on the major tonic.
 */
const fonte: SequencePattern = {
  id: 'fonte',
  title: 'Fonte (Galant falling sequence)',
  kind: 'sequence',
  unit: [
    { degree: 0, applied: 'seventh' },
    { degree: 0 },
  ],
  // a step LOWER each restatement; started on degree 2 (ii) it lands on I
  transposition: -1,
  defaultRepeats: 2,
  steps: [],
  waivers: [
    {
      rule: 'augmented-second',
      reason:
        'As in the monte, adjacent restatements mix raised and diatonic forms ' +
        'of a degree; the melodic augmented second is idiomatic here.',
    },
  ],
  notes:
    'Gjerdingen\'s Fonte: applied dominant and target, restated a step LOWER — ' +
    'canonically V7/ii-ii then V7/I-I, which is why it is the standard way ' +
    'back to the tonic after the double bar of a galant binary movement. ' +
    'Start it on degree 2 (index 1) to get the textbook form. The minor-then-' +
    'major landing is its audible signature.',
}

/**
 * PONTE ("bridge") — the DOMINANT PEDAL, and the odd one out.
 *
 * Gjerdingen (ch. 13): a ponte is a stretch of dominant harmony held while the
 * upper voices decorate it — a bridge across a structural gap, typically before
 * the return of the opening material. Its bass is STATIC on scale degree 5.
 *
 * WHY IT IS MODELLED WITH A ZERO TRANSPOSITION. A ponte is not a sequence in
 * the strict sense: nothing is transposed, because the whole device is that
 * nothing moves. It is included here — with `transposition: 0` — because it is
 * one of the three schemata a composer names in the same breath as the other
 * two, and because a repeating unit over a fixed bass is exactly what this
 * generator produces when the interval is zero. That is an honest use of the
 * mechanism rather than a stretch of it: `applySequence` will emit the unit
 * restated in place, which IS the device.
 *
 * The unit given is the neighbour motion over the held dominant: V, then the
 * 6/4 decorating it, then V again — the upper voices step away and back while
 * degree 5 holds.
 */
const ponte: SequencePattern = {
  id: 'ponte',
  title: 'Ponte (Galant dominant pedal / bridge)',
  kind: 'sequence',
  unit: [
    // V in root position
    { degree: 4 },
    // the 6/4 above the SAME bass note: the chord a fourth above degree 5,
    // in second inversion, so degree 5 stays in the bass. Upper voices step up.
    { degree: 0, figure: '64' },
  ],
  // NOTHING MOVES — the point of the device
  transposition: 0,
  defaultRepeats: 2,
  steps: [],
  conditions: {
    // the whole identity: scale degree 5 held throughout
    bass: { motion: 'static' },
  },
  notes:
    'A dominant pedal: scale degree 5 held in the bass while the upper voices ' +
    'decorate, bridging to the return of the opening material. Modelled with ' +
    'transposition 0 because a ponte transposes nothing — that IS the device. ' +
    'The 6/4 over the held dominant is a pedal 6/4, not a cadential one. ' +
    'ASK FOR AN ODD LENGTH to end on the dominant rather than on the 6/4: ' +
    '`applySequence(ponte, 5)` gives V-I64-V-I64-V, the shape that hands over ' +
    'to whatever follows the bridge. An even length is a legitimate mid-bridge ' +
    'slice and is reported as truncated-mid-unit.',
}

// --------------------------------------------------------------------------
// Realization
// --------------------------------------------------------------------------

/** How a realization ended, so a caller never has to guess. */
export type SequenceStopReason =
  /** produced exactly the number of chords asked for */
  | 'complete'
  /** the caller asked for fewer chords than one whole unit */
  | 'truncated-mid-unit'

/**
 * One realized chord of a sequence, with enough context to explain itself.
 *
 * `roman` is the figured roman a composer writes ('I6', 'V65'); `edge` is the
 * same thing in the `ChartEdge` form the charts and spans speak, so a realized
 * sequence can be handed straight to anything that consumes chart edges.
 */
export type SequenceChord = {
  /** the roman as written, figure included: 'I', 'V6', 'V7/II' */
  roman: string
  /** the same step in chart-edge form, for consumers that speak edges */
  edge: ChartEdge
  /** which restatement of the unit this chord belongs to (0-based) */
  restatement: number
  /** position within the unit (0-based) */
  indexInUnit: number
  /**
   * The 0-based scale degree this chord's ROOT sits on, wrapped into 0..6.
   * Null for an applied chord, whose root is chromatic and therefore not a
   * degree of the key at all.
   */
  degree: number | null
}

export type SequenceRealization = {
  pattern: SequencePattern
  chords: SequenceChord[]
  /** the romans alone — the common case */
  romans: string[]
  stopReason: SequenceStopReason
  /**
   * True when the walk wrapped past the end of the scale, i.e. the sequence ran
   * longer than the diatonic set allows. See the wrap policy on `applySequence`.
   */
  wrapped: boolean
  /** rule ids B1 should suppress while checking this realization */
  waivedRules: string[]
}

export type ApplySequenceOptions = {
  /** where the first restatement starts, as a 0-based scale degree (default 0) */
  startDegree?: number
  /** major or minor degree tables (default 'major') */
  mode?: SequenceMode
}

/** Render one unit step into its roman, at a given absolute degree. */
const stepRoman = (
  step: SequenceStep,
  absoluteDegree: number,
  mode: SequenceMode
): string => {
  if (step.applied) {
    const target = tonicizationTarget(degreeRoman(absoluteDegree, mode))
    return step.applied === 'seventh' ? `V7/${target}` : `V/${target}`
  }
  return degreeRoman(absoluteDegree, mode, step.quality ?? 'triad')
}

/**
 * Realize a sequence pattern into actual chords.
 *
 * `length` is a NUMBER OF CHORDS, not of restatements: a composer says "four
 * bars of it", and a bar is chords, not units. The generator emits whole units
 * until it would exceed `length` and then emits the partial unit, reporting
 * `'truncated-mid-unit'` so the caller knows the pattern was cut. Cutting is
 * allowed rather than rounded down because real sequences are routinely broken
 * off mid-unit to cadence — that is how M-A's `descending-bass-idiom` ends.
 *
 * WHAT HAPPENS WHEN THE SEQUENCE RUNS OFF THE DIATONIC SET — the honest answer.
 * A sequence transposing by a fixed number of scale degrees necessarily walks
 * past degree 7 (or below degree 1). There are exactly two things a real
 * sequence does at that point:
 *
 *   1. WRAP — keep transposing within the key, so degree 8 is degree 1 again.
 *      The sequence stays diatonic and, after seven restatements of a
 *      single-chord unit, returns to where it began. This is what a DIATONIC
 *      sequence does, and it is what this function does.
 *   2. EXIT THE KEY — keep the INTERVAL exact instead of the degree, which
 *      makes the sequence modulate. This is a genuinely different device and it
 *      is why `descending-fifths-applied` exists as its own pattern: its
 *      applied dominants are the chromatic chords that a real-interval sequence
 *      would need, but they are notated as tonicizations WITHIN the key rather
 *      than as a modulation.
 *
 * This function therefore WRAPS, always, and never silently modulates. It sets
 * `wrapped: true` as soon as a restatement begins on a degree an earlier
 * restatement already used, so a caller that cares can stop, cadence, or switch
 * to the applied form. Wrapping is the right default because it keeps every
 * chord a real chord in the requested key: a sequence that modulated by
 * accident would hand back chord names the caller's key signature cannot spell,
 * which is a much worse failure than a sequence that comes back round.
 *
 * @example four chords of descending fifths from the tonic of C major
 * ```ts
 * applySequence(descendingFifths, 4).romans // ['I', 'IV', 'VIIdim', 'IIIm']
 * ```
 */
export const applySequence = (
  pattern: SequencePattern,
  length: number,
  options: ApplySequenceOptions = {}
): SequenceRealization => {
  const mode: SequenceMode = options.mode ?? 'major'
  const startDegree = options.startDegree ?? 0
  const unitLength = pattern.unit.length
  const chords: SequenceChord[] = []
  let wrapped = false
  /**
   * Degrees an earlier restatement has already started on. A repeat here is
   * exactly what "the sequence ran off the end of the diatonic set" means.
   *
   * A stationary pattern (transposition 0 — the ponte) restates on the SAME
   * degree by definition, so it is excluded: it has not run out of scale, it
   * never consumed any. Without this guard the ponte would report a wrap on
   * its second restatement, which is the device working as intended.
   */
  const seenUnitStarts = new Set<number>()
  const stationary = pattern.transposition === 0

  // A non-positive length is an empty realization, not an error: a caller
  // computing a length from a bar count can legitimately arrive at zero.
  const wanted = Math.max(0, Math.floor(length))

  for (let i = 0; i < wanted; i++) {
    const restatement = Math.floor(i / unitLength)
    const indexInUnit = i % unitLength
    const step = pattern.unit[indexInUnit]!
    const unitStart = startDegree + pattern.transposition * restatement
    const absolute = unitStart + step.degree

    // "wrapped" means a restatement has begun on a degree an EARLIER
    // restatement already used — the sequence has run longer than the diatonic
    // set can support without repeating itself. Reported, never fatal.
    //
    // MEASURED BY REVISITED DEGREE, not by distance travelled, and not per
    // step. Two earlier attempts were both wrong, and both wrong in ways that
    // would have misinformed a caller:
    //
    //  - per STEP (`absolute < 0 || absolute > 6`): a unit step routinely
    //    reaches outside 0..6 by design — the ascending 5-6's 6/3 is written
    //    `{ degree: -2 }` and is negative on the very first chord — so this
    //    reported a wrap on chord one of a sequence that had not moved.
    //  - by DISTANCE TRAVELLED (`|unitStart - startDegree| >= 7`): a
    //    single-chord unit moving -4 travels 12 degrees by its fourth chord,
    //    so a four-chord descending-fifths sequence claimed to have wrapped
    //    while it was still on its first pass through the scale.
    //
    // Tracking the degrees actually used is exact: a wrap is a repeat, and a
    // repeat is what a caller cares about when deciding whether to stop,
    // cadence, or switch to the applied form.
    if (indexInUnit === 0 && !stationary) {
      const home = wrap(unitStart)
      if (seenUnitStarts.has(home)) wrapped = true
      seenUnitStarts.add(home)
    }

    const roman = stepRoman(step, absolute, mode)
    const figure = step.figure
    chords.push({
      roman: figuredRoman(roman, figure ?? null),
      edge: figure ? { chord: roman, figure } : roman,
      restatement,
      indexInUnit,
      degree: step.applied ? null : wrap(absolute),
    })
  }

  const stopReason: SequenceStopReason =
    wanted > 0 && wanted % unitLength !== 0 ? 'truncated-mid-unit' : 'complete'

  return {
    pattern,
    chords,
    romans: chords.map((c) => c.roman),
    stopReason,
    wrapped,
    waivedRules: (pattern.waivers ?? []).map((w) => w.rule),
  }
}

/**
 * The chart edges of a realization — the form `spanRomans` and the charts speak.
 *
 * Kept separate from `applySequence` so that the common "just give me the
 * romans" case does not pay for a second array it will not read.
 */
export const sequenceEdges = (realization: SequenceRealization): ChartEdge[] =>
  realization.chords.map((c) => c.edge)

/**
 * Where each pattern's canonical statement begins, as a 0-based scale degree.
 *
 * Most sequences start on the tonic. The fonte does NOT: its textbook form
 * begins on the supertonic so that its second, lower restatement lands on the
 * tonic — which is the schema's entire structural purpose (returning home after
 * the double bar). Encoding that here rather than in the pattern keeps
 * `startDegree` a caller's choice everywhere else.
 *
 * DECLARED BEFORE ITS USE ON PURPOSE. `withRealizedSteps` reads this table at
 * MODULE INITIALIZATION time (`sequences` maps over it below), so a `const`
 * declared after that point would be in its temporal dead zone and throw at
 * import. That is the same class of module-init landmine that produced a
 * production blank page in e302ee7 and that `figuredBass.ts`'s header warns
 * about; ordering is the fix, and the test suite imports this module for real.
 */
const DEFAULT_START_DEGREE: { [id: string]: number } = {
  // V7/ii - ii - V7/I - I : starts on degree 2 (0-based index 1)
  fonte: 1,
  // V7/IV - IV - V7/V - V : starts on the subdominant (0-based index 3)
  monte: 3,
  // V7/ii - ii - V7/V - V - V7/I - I : starts on the supertonic so that the
  // chain of tonicizations descends by fifth INTO the tonic and closes there.
  // Started on the tonic instead it opens on V7/I — a dominant resolving to
  // tonic before the sequence has begun — and then tonicizes the leading-tone
  // diminished triad, which is not a real tonicization at all (probed: C major
  // gave `C7 F F#7 Bdim B7 Em`). Starting on ii is the textbook form.
  'descending-fifths-applied': 1,
}

/** The canonical starting degree for a pattern, 0-based. */
export const defaultStartDegree = (pattern: SequencePattern): number =>
  DEFAULT_START_DEGREE[pattern.id] ?? 0

/**
 * Populate a pattern's `steps` with one default-length realization, so that
 * every `SequencePattern` is a well-formed `HarmonicSpan` to a consumer that
 * knows nothing about generation.
 *
 * The default realization is in MAJOR unless the pattern declares itself
 * minor-only, and starts on the degree the pattern names as its home. This is a
 * REPRESENTATIVE realization, not the definition — the definition is the unit
 * and the transposition, which is the whole point of B5.
 */
const withRealizedSteps = (pattern: SequencePattern): SequencePattern => {
  const mode: SequenceMode =
    pattern.modes && !pattern.modes.includes('major') ? 'minor' : 'major'
  const startDegree = DEFAULT_START_DEGREE[pattern.id] ?? 0
  const realized = applySequence(
    pattern,
    pattern.unit.length * pattern.defaultRepeats,
    { mode, startDegree }
  )
  return { ...pattern, steps: sequenceEdges(realized) }
}

/**
 * Every sequence in the library.
 *
 * These are `SequencePattern`s, which are `HarmonicSpan`s by intersection — so
 * they can be passed to `spanRomans`, `spanWaivedRules`, or anything else in
 * `spans.ts` unchanged. They are NOT registered into `spans.ts`'s own array:
 * that file is owned by Stage M-A and this stream does not edit it. Use
 * `sequencesOfMode` here, or concatenate the two arrays at the call site.
 */
export const sequences: readonly SequencePattern[] = [
  descendingFifths,
  descendingFifthsApplied,
  ascendingFiveSix,
  descendingFiveSix,
  monte,
  fonte,
  ponte,
].map(withRealizedSteps)

/** One sequence pattern by id, or `undefined`. */
export const sequenceById = (id: string): SequencePattern | undefined =>
  sequences.find((s) => s.id === id)

/**
 * Sequences available in a mode. A pattern with no declared `modes` belongs to
 * both — the same rule `spansOfKind` applies, so the two registries behave
 * alike.
 */
export const sequencesOfMode = (mode: SequenceMode): SequencePattern[] =>
  sequences.filter((s) => !s.modes || s.modes.includes(mode))

/**
 * The romans of a pattern's canonical statement — display sugar over
 * `applySequence` for the common "show me what this looks like" case.
 */
export const sequenceRomans = (
  pattern: SequencePattern,
  options: ApplySequenceOptions = {}
): string[] =>
  applySequence(pattern, pattern.unit.length * pattern.defaultRepeats, {
    startDegree: defaultStartDegree(pattern),
    ...options,
  }).romans

/**
 * The rule ids a sequence licenses — the same accessor `spans.ts` exposes,
 * restated here so a caller holding a `SequencePattern` need not import both.
 */
export const sequenceWaivedRules = (pattern: SequencePattern): string[] =>
  (pattern.waivers ?? []).map((w) => w.rule)
