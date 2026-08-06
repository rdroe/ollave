import { Chord, Interval, Note, Scale } from 'tonal'

// Direct imports only — never a barrel (importHygiene.test.ts guards it, and a
// barrel import here would drag in music.ts's browser-only Tone.js side
// effects). Every module named below is at or below this one in the dependency
// graph, so this file adds no cycle:
//
//   partWriting -> figuredBass  (LEAF: tonal + graphData/types)
//   partWriting -> graphData/types (zero-import)
//   partWriting -> voiceLeading -> util/graphUtil, chordSuggestion
//
// Nothing imports partWriting, so it is a sink. Confirmed with
// `npx madge --extensions ts --circular src/lib/partWriting.ts`.
import { bassOf, figureArity } from './figuredBass'
import type { Figure, HarmonicSpan } from './graphData/types'
import type { Voicing } from './voiceLeading'

/**
 * Part-writing rules and four-voice realization (Stage M-B, B1).
 *
 * WHAT THIS MODULE IS FOR. The audience is advanced composers who already know
 * these rules; what they lack is speed of planning. So the checker's job is not
 * to teach — it is to be a fast second pair of eyes that can be told to be
 * quiet. Two consequences run through every design decision here:
 *
 *   1. THE DEFAULT NEVER REMOVES ANYTHING. `strictness: 'report'` annotates and
 *      returns everything. A composer who writes parallel fifths on purpose
 *      must not have the move disappear from a suggestion list. Filtering is
 *      opt-in ('block'), for pedagogy and engraving tools.
 *   2. CONTEXT WAIVERS, NOT CONTEXT-FREE NAGGING. Spans (Stage M-A, A4) carry
 *      the rules they deliberately break, and `waivedRules` suppresses them.
 *      Fauxbourdon IS parallel motion; flagging it would red-ink the library's
 *      own shipped content.
 *
 * VIOLATIONS ARE TYPED OBJECTS, NOT BOOLEANS. Each carries the rule id, the
 * voices involved, the notes involved and a human sentence. A boolean cannot
 * tell a composer WHICH pair of voices was parallel, which is the only part
 * they need in order to fix it.
 *
 * SATB INDEXING: voices are indexed 0 = bass, ascending to the top. This module
 * speaks the same `Voicing` type as voiceLeading.ts — concrete note names with
 * octaves, sorted low to high — so a voicing from `figuredVoicings` drops
 * straight in.
 *
 * PITCH COMPARISON IS BY SEMITONE HEIGHT, INTERVAL QUALITY BY SPELLING. Those
 * are two different questions and this module answers each with the right tool.
 * Whether two voices move in parallel fifths is a question about SOUND, so it
 * uses semitone height mod 12 (probed: C3->G4 and C3->G3 both give 7, and
 * B3/Cb4 both give midi 59 — so enharmonic spellings and compound intervals
 * both behave). Whether a fifth is diminished or perfect is a question about
 * SPELLING, so it uses `Interval.get().q` (probed: B2-F3 is '5d', C3-G3 is
 * '5P'). Using semitones for the second would collapse the unequal-fifths rule
 * into the parallel-fifths rule; using spelling for the first would miss a
 * parallel between an F# and a Gb.
 */

// --------------------------------------------------------------------------
// pitch helpers
// --------------------------------------------------------------------------

/**
 * Semitone height of a note name; NaN when unparseable.
 *
 * `Note.midi` rather than a hand-rolled regex: it is spelling-exact across
 * double accidentals and enharmonics (probed: G##3 and A3 both 57, Fb4 and E4
 * both 64), which is the property every comparison in this file depends on.
 */
const height = (noteName: string): number => {
  const midi = Note.midi(noteName)
  return midi ?? NaN
}

/** Pitch class of a note name, falling back to the input when unparseable. */
const pc = (noteName: string): string => Note.get(noteName).pc || noteName

/**
 * Interval class between two notes in semitones, 0-11, direction-independent.
 * 0 is a unison OR an octave OR a fifteenth; 7 is a fifth or a twelfth.
 */
const intervalClass = (a: string, b: string): number => {
  const diff = height(b) - height(a)
  if (Number.isNaN(diff)) return NaN
  return ((Math.abs(diff) % 12) + 12) % 12
}

/** Whether two notes sound a perfect fifth (or twelfth, etc.) apart. */
const isPerfectFifth = (a: string, b: string): boolean => intervalClass(a, b) === 7

/**
 * Whether two notes sound an octave (or unison, or double octave) apart.
 * A UNISON COUNTS: two voices on the same pitch are as much a loss of
 * independence as an octave, and the parallel-octave rule has always covered
 * both. (Aldwell & Schachter, *Harmony and Voice Leading*, ch. 5.)
 */
const isOctaveOrUnison = (a: string, b: string): boolean => intervalClass(a, b) === 0

/**
 * The SPELLED quality of the interval between two notes, e.g. 'P', 'd', 'A',
 * 'M', 'm'; empty string when either note is unparseable.
 */
const intervalQuality = (a: string, b: string): string => {
  const d = Interval.distance(a, b)
  if (!d) return ''
  return Interval.get(d).q ?? ''
}

/** The SPELLED simple interval number between two notes (5 for a twelfth). */
const simpleIntervalNumber = (a: string, b: string): number => {
  const d = Interval.distance(a, b)
  if (!d) return NaN
  const got = Interval.get(d)
  return Math.abs(got.simple ?? NaN)
}

/** Motion direction of one voice: 1 up, -1 down, 0 static. NaN if unparseable. */
const direction = (from: string, to: string): number => {
  const diff = height(to) - height(from)
  if (Number.isNaN(diff)) return NaN
  return Math.sign(diff)
}

// --------------------------------------------------------------------------
// the rule catalogue
// --------------------------------------------------------------------------

/**
 * Every rule this checker knows, as a pinned union.
 *
 * PINNED HERE AND NOWHERE ELSE. `graphData/types.ts` deliberately types a
 * waiver's `rule` as a bare `string` so that adding a rule does not force an
 * edit to a zero-import chart-data module (see `RuleWaiver` there). This module
 * owns the catalogue; `spans.test.ts` separately pins that the ids actually
 * USED by the span library are members of a documented set.
 */
export type PartWritingRule =
  | 'parallel-fifths'
  | 'parallel-octaves'
  | 'parallel-fourths'
  | 'hidden-fifths'
  | 'hidden-octaves'
  | 'unequal-fifths'
  | 'unresolved-seventh'
  | 'doubled-leading-tone'
  | 'unresolved-leading-tone'
  | 'augmented-second'
  | 'voice-crossing'
  | 'voice-overlap'
  | 'spacing'
  | 'cadential-64-resolution'

/** Every rule id, in the order a textbook chapter would introduce them. */
export const PART_WRITING_RULES: readonly PartWritingRule[] = [
  'parallel-fifths',
  'parallel-octaves',
  'parallel-fourths',
  'hidden-fifths',
  'hidden-octaves',
  'unequal-fifths',
  'unresolved-seventh',
  'doubled-leading-tone',
  'unresolved-leading-tone',
  'augmented-second',
  'voice-crossing',
  'voice-overlap',
  'spacing',
  'cadential-64-resolution',
] as const

/**
 * How seriously to take a violation by default.
 *
 * 'error' is a rule essentially no common-practice composer breaks by accident;
 * 'warning' is one that is routinely and deliberately relaxed. The distinction
 * drives NOTHING automatically — it is advisory metadata for a UI, and the
 * per-rule toggles are what actually control behaviour. It exists because an
 * expert audience wants to see at a glance which flags are worth reading.
 */
export type ViolationSeverity = 'error' | 'warning'

/**
 * One rule broken, at one place.
 *
 * TYPED OBJECT, NOT A BOOLEAN — the plan is explicit about this and it is the
 * difference between a usable tool and a nag. `voices` and `notes` are what let
 * a caller highlight the exact pair of parts in a score.
 */
export type Violation = {
  rule: PartWritingRule
  severity: ViolationSeverity
  /** voice indices involved; 0 = bass, ascending. One index for single-voice rules. */
  voices: number[]
  /** the notes involved, in the same order as `voices` where that makes sense */
  notes: string[]
  /** one sentence, written for a composer to read in a UI */
  message: string
  /**
   * Index of the chord this violation is attached to within a progression.
   * Set by `realizeProgression` / `checkProgression`; absent from a bare
   * `checkVoiceLeading` call, which knows only about one pair of chords.
   */
  at?: number
}

/**
 * Textbook citations for every rule.
 *
 * EVERY RULE CITES ITS SOURCE. For an audience that knows the repertoire, a
 * rule stated without provenance is a rule they cannot argue with — and these
 * rules genuinely differ between authorities (the unequal fifth is forbidden by
 * Fux and permitted by Bach's practice). Naming the source makes the tool's
 * opinions inspectable rather than oracular.
 */
export const RULE_CITATIONS: { [K in PartWritingRule]: string } = {
  'parallel-fifths':
    'Aldwell & Schachter, Harmony and Voice Leading, ch. 5: "Two voices ' +
    'that form a perfect fifth may not move to another perfect fifth." The ' +
    'objection is to the loss of independence — the two parts momentarily ' +
    'fuse into one.',
  'parallel-octaves':
    'Aldwell & Schachter, ch. 5: the same prohibition at the octave and ' +
    'unison. Stricter than the fifth in practice, since an octave doubling ' +
    'reduces four voices audibly to three.',
  'parallel-fourths':
    'Fux, Gradus ad Parnassum (1725), on two-part writing: the fourth is a ' +
    'dissonance against the bass and parallel fourths above it are forbidden. ' +
    'Between UPPER voices, parallel fourths are free — which is why this rule ' +
    'checks the bass only, and why fauxbourdon waives it.',
  'hidden-fifths':
    'Piston, Harmony, ch. 4: similar motion into a perfect fifth between the ' +
    'OUTER voices, with the upper voice moving by leap. Also called direct ' +
    'fifths. Restricted to the outer voices because that is where the ' +
    'exposure is audible.',
  'hidden-octaves':
    'Piston, Harmony, ch. 4: similar motion into a perfect octave between ' +
    'the outer voices with the soprano leaping. The soprano moving by STEP ' +
    'into the octave is the standard exemption and is not flagged.',
  'unequal-fifths':
    'Piston, Harmony, ch. 4: a diminished fifth followed by a perfect fifth ' +
    'in the same pair of voices. Widely tolerated — Bach uses it freely when ' +
    'the diminished fifth resolves inward — hence a warning and a natural ' +
    'per-rule toggle. The reverse order (P5 -> d5) is more freely accepted ' +
    'still and is not flagged.',
  'unresolved-seventh':
    'Aldwell & Schachter, ch. 12: the chordal seventh is a dissonance and ' +
    'must resolve DOWN BY STEP in the voice that sounds it. Holding it as a ' +
    'common tone into the next chord is the standard exemption.',
  'doubled-leading-tone':
    'Piston, Harmony, ch. 5: the leading tone is a tendency tone and must ' +
    'not be doubled, since both copies would want to resolve to the tonic and ' +
    'produce parallel octaves.',
  'unresolved-leading-tone':
    'Aldwell & Schachter, ch. 7: at a cadence the leading tone in an OUTER ' +
    'voice resolves up by step to the tonic. In an inner voice it may fall to ' +
    'the fifth to complete the triad — the "frustrated leading tone", which is ' +
    'standard and is not flagged.',
  'augmented-second':
    'Aldwell & Schachter, ch. 20: in minor, the gap between scale degrees 6 ' +
    'and raised 7 is an augmented second and is avoided as a melodic ' +
    'interval; the melodic-minor inflections exist precisely to avoid it.',
  'voice-crossing':
    'Piston, Harmony, ch. 4: a voice must not be written below the voice ' +
    'beneath it (or above the one above), since the listener cannot then ' +
    'follow either line.',
  'voice-overlap':
    'Piston, Harmony, ch. 4: a voice must not move past the pitch the ' +
    'ADJACENT voice just left. Distinct from crossing, which is simultaneous; ' +
    'overlap is a relation between consecutive chords.',
  spacing:
    'Piston, Harmony, ch. 4: adjacent UPPER voices stay within an octave of ' +
    'one another. The bass-tenor gap is exempt and may exceed an octave — ' +
    'that is normal scoring, not an error.',
  'cadential-64-resolution':
    'Aldwell & Schachter, ch. 17: the cadential six-four is a pair of ' +
    'suspensions over the dominant. The sixth and fourth above the bass must ' +
    'resolve DOWN BY STEP to the fifth and third while the bass HOLDS. B3 ' +
    'owns the metric half of the device (the 6/4 falls on the stronger beat); ' +
    'this is its voice-leading half.',
}

/** Default severity per rule. Advisory only — see `ViolationSeverity`. */
const RULE_SEVERITY: { [K in PartWritingRule]: ViolationSeverity } = {
  'parallel-fifths': 'error',
  'parallel-octaves': 'error',
  'parallel-fourths': 'warning',
  'hidden-fifths': 'warning',
  'hidden-octaves': 'warning',
  'unequal-fifths': 'warning',
  'unresolved-seventh': 'error',
  'doubled-leading-tone': 'error',
  'unresolved-leading-tone': 'warning',
  'augmented-second': 'warning',
  'voice-crossing': 'error',
  'voice-overlap': 'warning',
  spacing: 'warning',
  'cadential-64-resolution': 'error',
}

/**
 * Rules OFF by default.
 *
 * `unequal-fifths` is off because the plan calls it "widely tolerated" and
 * because Bach breaks it constantly; leaving it on would make the checker's
 * first impression on an expert be a false positive. `parallel-fourths` is off
 * because the rule only bites against the bass and most four-voice textures
 * produce them harmlessly between upper parts. Both are one toggle away.
 */
const DEFAULT_OFF: readonly PartWritingRule[] = ['unequal-fifths', 'parallel-fourths']

// --------------------------------------------------------------------------
// options
// --------------------------------------------------------------------------

/**
 * How violations affect a returned list.
 *
 * The user decision recorded in PLAN-MUSIC.md, verbatim in intent: skilled
 * composers break textbook rules deliberately, so the DEFAULT must never hide a
 * legal-but-unconventional move; but a pedagogy or engraving tool wants
 * enforcement, and hardcoding permissiveness would make that impossible.
 */
export type StrictnessMode =
  /** DEFAULT — annotate, never remove. Matches `contextMatch`'s behaviour. */
  | 'report'
  /** annotate, and sort suggestions with violations last */
  | 'warn'
  /** filter out illegal moves entirely (exercises, student work) */
  | 'block'

export type PartWritingOptions = {
  /** default 'report' — never removes a suggestion */
  strictness?: StrictnessMode
  /**
   * Per-rule on/off. A rule absent from this map keeps its default state
   * (everything on except `unequal-fifths` and `parallel-fourths`). Set a rule
   * to `false` to silence it, `true` to enable one that is off by default.
   *
   * This is the "a user may accept hidden fifths but not parallel octaves"
   * case from the plan's Decisions section.
   */
  rules?: Partial<{ [K in PartWritingRule]: boolean }>
  /**
   * Rule ids this passage licenses — the WAIVER CHANNEL. Pass
   * `spanWaivedRules(span)` straight in.
   *
   * Typed as `string[]` rather than `PartWritingRule[]` on purpose: waivers
   * come from `graphData/types.ts`, where `RuleWaiver.rule` is a bare string so
   * that the chart-data module need not know the catalogue. An unrecognized id
   * is ignored rather than rejected — a span authored against a future rule
   * must not break today's checker.
   */
  waivedRules?: string[]
  /**
   * The key, for the rules that need one: the leading tone, the augmented
   * second, and cadential resolution are all defined relative to a tonic.
   * Without it those rules are SKIPPED rather than guessed — a wrong rule is
   * worse than a missing one for this audience.
   */
  key?: { tonic: string; mode: 'major' | 'minor' }
  /**
   * Whether this pair of chords is a cadence, which is the only place
   * `unresolved-leading-tone` applies. Default false: the leading tone is free
   * to fall mid-phrase and flagging it everywhere would be exactly the
   * context-free nagging this design rejects.
   */
  cadence?: boolean
  /** the figure of the FROM chord, when known — enables the cadential 6/4 check */
  fromFigure?: Figure
  /** the figure of the TO chord, when known */
  toFigure?: Figure
  /** chord name of the FROM chord, for the seventh-resolution and doubling rules */
  fromChord?: string
  /** chord name of the TO chord */
  toChord?: string
}

/** Whether a rule is live given the toggles and waivers. */
const ruleEnabled = (rule: PartWritingRule, opts?: PartWritingOptions): boolean => {
  if (opts?.waivedRules?.includes(rule)) return false
  const explicit = opts?.rules?.[rule]
  if (explicit !== undefined) return explicit
  return !DEFAULT_OFF.includes(rule)
}

/**
 * Every rule a span licenses, ready to hand to the checker.
 *
 * A thin re-expression of `spanWaivedRules` that exists so a caller can go from
 * a span to a checker call without importing two modules — and so that this
 * module states, in code, that it honours the waiver channel. `spans.ts` is not
 * imported (it would add a dependency for one array read); the span is passed
 * in by the caller.
 */
export const waiversFor = (span: HarmonicSpan): string[] =>
  (span.waivers ?? []).map((w) => w.rule)

// --------------------------------------------------------------------------
// scale-degree helpers (key-dependent rules)
// --------------------------------------------------------------------------

/**
 * The leading tone of a key as a pitch class, or null when there is none.
 *
 * In MINOR this is the RAISED seventh (harmonic minor), because that is what a
 * dominant chord in a minor key actually contains — probed: A harmonic minor's
 * seventh degree is G#, and `Chord.get('E').notes` is E-G#-B. Using natural
 * minor here would make the rule silently never fire in the mode where it
 * matters most.
 */
const leadingToneOf = (key: { tonic: string; mode: 'major' | 'minor' }): string | null => {
  const scaleName = key.mode === 'minor' ? 'harmonic minor' : 'major'
  const notes = Scale.get(`${key.tonic} ${scaleName}`).notes
  const seventh = notes[6]
  return seventh ? pc(seventh) : null
}

/** Whether a note is the leading tone of the key, comparing by SOUND. */
const isLeadingTone = (
  noteName: string,
  key: { tonic: string; mode: 'major' | 'minor' }
): boolean => {
  const lt = leadingToneOf(key)
  if (!lt) return false
  const a = Note.chroma(pc(noteName))
  const b = Note.chroma(lt)
  return a !== undefined && b !== undefined && a === b
}

/** Whether a note is the tonic of the key, comparing by SOUND. */
const isTonic = (
  noteName: string,
  key: { tonic: string; mode: 'major' | 'minor' }
): boolean => {
  const a = Note.chroma(pc(noteName))
  const b = Note.chroma(pc(key.tonic))
  return a !== undefined && b !== undefined && a === b
}

/** The chordal seventh of a chord name as a pitch class, or null for a triad. */
const seventhPitchClass = (chordName: string): string | null => {
  const chord = Chord.get(chordName)
  if (chord.empty || chord.notes.length < 4) return null
  const note = chord.notes[3]
  return note ? pc(note) : null
}

// --------------------------------------------------------------------------
// the checker
// --------------------------------------------------------------------------

/**
 * Every part-writing violation in the move from one voicing to the next.
 *
 * VOICINGS MUST BE THE SAME SIZE and are read as parts: index 0 is the bass,
 * ascending. A size mismatch returns [] rather than throwing — this module
 * follows the never-throw contract the rest of `src/lib` uses, and a caller
 * ranking a suggestion list must not have one odd pair sink the batch.
 *
 * COMPOSES OVER THE EXISTING CONTRACT, it does not replace it.
 * `rankByVoiceLeading` SORTS by smoothness; this ANNOTATES with legality. They
 * answer different questions and a caller may use either or both. This is
 * deliberately NOT folded into `nextChordDetail`'s options — that pattern is
 * what keeps the feature streams independent (PLAN-MUSIC.md, B1).
 */
export const checkVoiceLeading = (
  from: Voicing,
  to: Voicing,
  opts?: PartWritingOptions
): Violation[] => {
  if (from.length === 0 || to.length === 0) return []
  if (from.length !== to.length) return []

  const violations: Violation[] = []
  const n = from.length
  const push = (
    rule: PartWritingRule,
    voices: number[],
    notes: string[],
    message: string
  ): void => {
    if (!ruleEnabled(rule, opts)) return
    violations.push({ rule, severity: RULE_SEVERITY[rule], voices, notes, message })
  }

  // ---- rules over every PAIR of voices -----------------------------------
  for (let lower = 0; lower < n; lower++) {
    for (let upper = lower + 1; upper < n; upper++) {
      const fLow = from[lower]
      const fUp = from[upper]
      const tLow = to[lower]
      const tUp = to[upper]
      if (!fLow || !fUp || !tLow || !tUp) continue

      const lowMoved = height(tLow) !== height(fLow)
      const upMoved = height(tUp) !== height(fUp)
      const bothMoved = lowMoved || upMoved

      // PARALLEL FIFTHS — see RULE_CITATIONS. Both voices must actually MOVE:
      // a fifth restated over a held pair of notes is one fifth, not two, and
      // flagging it would be a false positive on every repeated chord.
      if (bothMoved && isPerfectFifth(fLow, fUp) && isPerfectFifth(tLow, tUp)) {
        // Only PARALLEL (same-direction) or oblique repetition counts; contrary
        // motion between two fifths is a different creature and textbooks
        // treat it separately (Piston calls it acceptable in four parts).
        const dLow = direction(fLow, tLow)
        const dUp = direction(fUp, tUp)
        if (dLow === dUp || dLow === 0 || dUp === 0) {
          push(
            'parallel-fifths',
            [lower, upper],
            [fLow, fUp, tLow, tUp],
            `Parallel fifths between voices ${lower} and ${upper}: ` +
              `${fLow}/${fUp} to ${tLow}/${tUp}.`
          )
        }
      }

      // PARALLEL OCTAVES (and unisons) — the stricter sibling of the above.
      if (bothMoved && isOctaveOrUnison(fLow, fUp) && isOctaveOrUnison(tLow, tUp)) {
        const dLow = direction(fLow, tLow)
        const dUp = direction(fUp, tUp)
        if (dLow === dUp || dLow === 0 || dUp === 0) {
          push(
            'parallel-octaves',
            [lower, upper],
            [fLow, fUp, tLow, tUp],
            `Parallel octaves between voices ${lower} and ${upper}: ` +
              `${fLow}/${fUp} to ${tLow}/${tUp}.`
          )
        }
      }

      // UNEQUAL FIFTHS — d5 followed by P5, in that order. SPELLING decides
      // whether the first is diminished, which is why this uses
      // `intervalQuality` and not semitones; semitone arithmetic cannot tell a
      // diminished fifth from a perfect one it is a semitone smaller than
      // without also re-deriving the letter names.
      if (
        bothMoved &&
        simpleIntervalNumber(fLow, fUp) === 5 &&
        intervalQuality(fLow, fUp) === 'd' &&
        isPerfectFifth(tLow, tUp)
      ) {
        push(
          'unequal-fifths',
          [lower, upper],
          [fLow, fUp, tLow, tUp],
          `Unequal fifths between voices ${lower} and ${upper}: diminished ` +
            `fifth ${fLow}/${fUp} to perfect fifth ${tLow}/${tUp}.`
        )
      }

      // PARALLEL FOURTHS — AGAINST THE BASS ONLY. Between upper voices the
      // fourth is a consonance and parallel fourths are free; the prohibition
      // is specifically about the fourth as a dissonance over the bass. Getting
      // this wrong would flag most ordinary four-part writing, which is the
      // false-positive rate that loses an expert audience.
      if (lower === 0 && bothMoved) {
        const fourthFrom = intervalClass(fLow, fUp) === 5
        const fourthTo = intervalClass(tLow, tUp) === 5
        if (fourthFrom && fourthTo) {
          const dLow = direction(fLow, tLow)
          const dUp = direction(fUp, tUp)
          if (dLow === dUp || dLow === 0 || dUp === 0) {
            push(
              'parallel-fourths',
              [lower, upper],
              [fLow, fUp, tLow, tUp],
              `Parallel fourths above the bass with voice ${upper}: ` +
                `${fLow}/${fUp} to ${tLow}/${tUp}.`
            )
          }
        }
      }

      // VOICE CROSSING — simultaneous: the upper voice is below the lower one
      // in the DESTINATION chord. Checked on adjacent voices only, since a
      // non-adjacent crossing implies an adjacent one.
      if (upper === lower + 1 && height(tUp) < height(tLow)) {
        push(
          'voice-crossing',
          [lower, upper],
          [tLow, tUp],
          `Voice ${upper} (${tUp}) crosses below voice ${lower} (${tLow}).`
        )
      }

      // SPACING — adjacent UPPER voices within an octave. The bass-tenor gap
      // (lower === 0) is deliberately exempt: a tenth or twelfth there is
      // normal scoring, and flagging it would fire on most correct chorales.
      if (upper === lower + 1 && lower > 0) {
        const gap = height(tUp) - height(tLow)
        if (!Number.isNaN(gap) && gap > 12) {
          push(
            'spacing',
            [lower, upper],
            [tLow, tUp],
            `More than an octave between adjacent upper voices ${lower} and ` +
              `${upper}: ${tLow} to ${tUp}.`
          )
        }
      }
    }
  }

  // ---- HIDDEN / DIRECT FIFTHS AND OCTAVES — OUTER VOICES ONLY ------------
  // Similar motion into a perfect interval, with the UPPER voice leaping. The
  // outer-voice restriction and the leap requirement are both load-bearing:
  // without them this rule fires on ordinary inner-voice motion and on the
  // stepwise soprano approach every textbook explicitly permits.
  if (n >= 2) {
    const fBass = from[0]
    const tBass = to[0]
    const fSop = from[n - 1]
    const tSop = to[n - 1]
    if (fBass && tBass && fSop && tSop) {
      const dBass = direction(fBass, tBass)
      const dSop = direction(fSop, tSop)
      const similar = dBass !== 0 && dBass === dSop
      const sopLeap = Math.abs(height(tSop) - height(fSop)) > 2
      if (similar && sopLeap) {
        if (isPerfectFifth(tBass, tSop) && !isPerfectFifth(fBass, fSop)) {
          push(
            'hidden-fifths',
            [0, n - 1],
            [fBass, fSop, tBass, tSop],
            `Hidden fifths: outer voices move similarly into ${tBass}/${tSop} ` +
              `with the soprano leaping.`
          )
        }
        if (isOctaveOrUnison(tBass, tSop) && !isOctaveOrUnison(fBass, fSop)) {
          push(
            'hidden-octaves',
            [0, n - 1],
            [fBass, fSop, tBass, tSop],
            `Hidden octaves: outer voices move similarly into ${tBass}/${tSop} ` +
              `with the soprano leaping.`
          )
        }
      }
    }
  }

  // ---- VOICE OVERLAP — between CONSECUTIVE chords ------------------------
  // A voice moves past where its neighbour just was. Distinct from crossing:
  // crossing is simultaneous, overlap is sequential.
  for (let i = 0; i + 1 < n; i++) {
    const fLow = from[i]
    const fUp = from[i + 1]
    const tLow = to[i]
    const tUp = to[i + 1]
    if (!fLow || !fUp || !tLow || !tUp) continue
    if (height(tUp) < height(fLow)) {
      push(
        'voice-overlap',
        [i, i + 1],
        [fLow, tUp],
        `Voice ${i + 1} moves to ${tUp}, below where voice ${i} just was (${fLow}).`
      )
    }
    if (height(tLow) > height(fUp)) {
      push(
        'voice-overlap',
        [i, i + 1],
        [fUp, tLow],
        `Voice ${i} moves to ${tLow}, above where voice ${i + 1} just was (${fUp}).`
      )
    }
  }

  // ---- MELODIC: the augmented second (minor keys) ------------------------
  // A SPELLED interval, so quality and number decide it — an augmented second
  // and a minor third sound identical and only one of them is the problem.
  if (opts?.key?.mode === 'minor') {
    for (let v = 0; v < n; v++) {
      const a = from[v]
      const b = to[v]
      if (!a || !b) continue
      if (simpleIntervalNumber(a, b) === 2 && intervalQuality(a, b) === 'A') {
        push(
          'augmented-second',
          [v],
          [a, b],
          `Augmented second in voice ${v}: ${a} to ${b}.`
        )
      }
    }
  }

  // ---- the chordal seventh must fall by step -----------------------------
  if (opts?.fromChord) {
    const seventh = seventhPitchClass(opts.fromChord)
    if (seventh) {
      const seventhChroma = Note.chroma(seventh)
      for (let v = 0; v < n; v++) {
        const a = from[v]
        const b = to[v]
        if (!a || !b) continue
        if (Note.chroma(pc(a)) !== seventhChroma) continue
        const step = height(b) - height(a)
        // held as a common tone is the standard exemption; otherwise it must
        // fall by a semitone or a whole tone.
        if (step === 0) continue
        if (step === -1 || step === -2) continue
        push(
          'unresolved-seventh',
          [v],
          [a, b],
          `Chordal seventh ${a} in voice ${v} does not resolve down by step ` +
            `(goes to ${b}).`
        )
      }
    }
  }

  // ---- the leading tone: doubling, and resolution at a cadence -----------
  if (opts?.key) {
    const key = opts.key
    // DOUBLED LEADING TONE — checked on the DESTINATION chord, since that is
    // the chord being written. Two voices sounding it is the violation
    // regardless of octave, so this compares pitch classes.
    const ltVoices: number[] = []
    for (let v = 0; v < n; v++) {
      const note = to[v]
      if (note && isLeadingTone(note, key)) ltVoices.push(v)
    }
    if (ltVoices.length > 1) {
      push(
        'doubled-leading-tone',
        ltVoices,
        ltVoices.map((v) => to[v] ?? ''),
        `Leading tone doubled in voices ${ltVoices.join(' and ')}.`
      )
    }

    // UNRESOLVED LEADING TONE — ONLY AT A CADENCE, and only in an OUTER voice.
    // Both restrictions are the textbook's, not a simplification: mid-phrase
    // the leading tone is free, and the "frustrated leading tone" falling to
    // the fifth in an inner voice is standard practice.
    if (opts.cadence) {
      for (const v of [0, n - 1]) {
        const a = from[v]
        const b = to[v]
        if (!a || !b) continue
        if (!isLeadingTone(a, key)) continue
        const rises = height(b) - height(a) === 1
        if (rises && isTonic(b, key)) continue
        push(
          'unresolved-leading-tone',
          [v],
          [a, b],
          `Leading tone ${a} in outer voice ${v} does not resolve up to the ` +
            `tonic at a cadence (goes to ${b}).`
        )
      }
    }
  }

  // ---- the cadential 6/4's voice-leading half ----------------------------
  // B3 owns the metric requirement (the 6/4 on the stronger beat). This is the
  // other half: the sixth and fourth above the bass resolve DOWN BY STEP to the
  // fifth and third, over a bass that HOLDS. Both parts are required — a 6/4
  // whose bass moves is a passing or pedal 6/4, a different device entirely
  // (see the span library's note on why all three cannot be one edge).
  if (opts?.fromFigure === '64' && n >= 2) {
    const fBass = from[0]
    const tBass = to[0]
    if (fBass && tBass) {
      if (height(fBass) !== height(tBass)) {
        push(
          'cadential-64-resolution',
          [0],
          [fBass, tBass],
          `Cadential 6/4 requires a held bass; it moves ${fBass} to ${tBass}.`
        )
      } else {
        // Over the held bass, find the voices a sixth and a fourth above it and
        // require each to fall by step. Measured by interval class so that a
        // thirteenth counts as a sixth.
        for (let v = 1; v < n; v++) {
          const a = from[v]
          const b = to[v]
          if (!a || !b) continue
          const ic = intervalClass(fBass, a)
          const isSixth = ic === 8 || ic === 9
          const isFourth = ic === 5
          if (!isSixth && !isFourth) continue
          const step = height(b) - height(a)
          if (step === -1 || step === -2) continue
          push(
            'cadential-64-resolution',
            [v],
            [a, b],
            `Cadential 6/4: the ${isSixth ? 'sixth' : 'fourth'} above the bass ` +
              `(${a}, voice ${v}) must resolve down by step; it goes to ${b}.`
          )
        }
      }
    }
  }

  return violations
}

// --------------------------------------------------------------------------
// annotating and filtering suggestion-shaped things
// --------------------------------------------------------------------------

/** Anything with a voicing that can be annotated with legality. */
export type Checked<T> = T & {
  violations: Violation[]
  /** true when nothing fired; the field a UI colours on */
  legal: boolean
}

/**
 * Annotate a list of candidate voicings with their violations, applying the
 * strictness mode.
 *
 * THE DEFAULT NEVER REMOVES ANYTHING. 'report' returns every input in its
 * original order with a `violations` array attached; 'warn' keeps everything
 * but sorts the clean ones first; only 'block' filters. The plan's Decisions
 * section makes this a user-level guarantee, not an implementation detail.
 *
 * `pick` maps an item to the voicing to check, so this works over
 * `RankedSuggestion[]` (whose voicing is `suggestedVoicing`) or over bare
 * voicings, without this module importing the suggestion contract.
 */
export const annotateVoiceLeading = <T>(
  items: T[],
  from: Voicing,
  pick: (item: T) => Voicing,
  opts?: PartWritingOptions
): Checked<T>[] => {
  const annotated: Checked<T>[] = items.map((item) => {
    const violations = checkVoiceLeading(from, pick(item), opts)
    return { ...item, violations, legal: violations.length === 0 }
  })

  const mode = opts?.strictness ?? 'report'
  if (mode === 'report') return annotated
  if (mode === 'block') return annotated.filter((a) => a.legal)
  // 'warn' — stable sort, clean first. Input order is preserved within each
  // group so an upstream ranking (rankByVoiceLeading) survives.
  return annotated
    .map((item, index) => ({ item, index }))
    .sort((l, r) => {
      const lk = l.item.legal ? 0 : 1
      const rk = r.item.legal ? 0 : 1
      if (lk !== rk) return lk - rk
      return l.index - r.index
    })
    .map(({ item }) => item)
}

// --------------------------------------------------------------------------
// doubling — per figure, not global
// --------------------------------------------------------------------------

/**
 * Which chord tone to double, as an index into the chord's own ascending note
 * list (0 = root, 1 = third, 2 = fifth), best first.
 *
 * DOUBLING IS A FUNCTION OF THE FIGURE, which is precisely why B1 depends on
 * Stage M-A: before the figure existed there was nothing to key this on.
 *
 *   root position (53) — double the ROOT. The strongest tone of the chord and
 *     the one already reinforced by the bass. (Aldwell & Schachter ch. 6.)
 *   cadential 6/4 (64)  — double the BASS, i.e. the chord's FIFTH. The bass is
 *     the real harmonic root of the moment (it is a dominant), and the sixth
 *     and fourth above it are suspensions that must be free to resolve.
 *   first inversion (6) — FLEXIBLE. Any tone but the leading tone; the soprano
 *     is the usual choice. Returned root-first as a stable default with the
 *     others as genuine alternatives, since this is the figure where a search
 *     has something to search over.
 *   diminished triads   — double the THIRD, never the root or the fifth: both
 *     of those are members of the tritone that defines the chord, and doubling
 *     either doubles a tendency tone. (Piston ch. 5.)
 *
 * NEVER THE LEADING TONE — enforced separately in `realizeSATB`, because
 * whether a given chord tone IS the leading tone depends on the key, which this
 * function does not take.
 *
 * A SEVENTH CHORD DOUBLES NOTHING: it already has four distinct tones for four
 * voices, so this returns [] and the realizer uses each tone once.
 */
export const doublingPreference = (chordName: string, figure: Figure): number[] => {
  if (figureArity(figure) === 4) return []

  const chord = Chord.get(chordName)
  const isDiminished =
    !chord.empty &&
    (chord.type.includes('diminished') || chord.aliases.includes('dim') || chord.quality === 'Diminished')

  if (isDiminished) {
    // third first, then root; the fifth last and only as a fallback, since it
    // is the upper member of the tritone.
    return [1, 0, 2]
  }

  switch (figure) {
    case '64':
      // the bass of a 6/4 is the chord's FIFTH (figureBassIndex('64') === 2)
      return [2, 0, 1]
    case '6':
      // genuinely flexible — this is where a search has room to work
      return [0, 2, 1]
    case '53':
    default:
      return [0, 2, 1]
  }
}

// --------------------------------------------------------------------------
// four-voice realization
// --------------------------------------------------------------------------

/** Default SATB ranges, as inclusive semitone heights. Conventional choral limits. */
const SATB_RANGE: readonly { low: number; high: number }[] = [
  { low: Note.midi('E2') ?? 40, high: Note.midi('C4') ?? 60 }, // bass
  { low: Note.midi('A2') ?? 45, high: Note.midi('F4') ?? 65 }, // tenor
  { low: Note.midi('F3') ?? 53, high: Note.midi('C5') ?? 72 }, // alto
  { low: Note.midi('C4') ?? 60, high: Note.midi('A5') ?? 81 }, // soprano
]

export type RealizeOptions = PartWritingOptions & {
  /** figures, one per chord; a missing entry means root position */
  figures?: (Figure | undefined)[]
  /** voicing the progression must start from, if any */
  startVoicing?: Voicing
  /**
   * How many candidate voicings to keep per chord during the search. Higher is
   * more thorough and slower. Default 24, which probing showed is well past the
   * point where the chosen realization stops changing on ordinary progressions.
   */
  beamWidth?: number
}

/** One realized chord in a progression. */
export type RealizedChord = {
  chord: string
  figure?: Figure
  /** four note names, low to high: bass, tenor, alto, soprano */
  voicing: Voicing
  /** violations introduced by the move INTO this chord; [] for the first */
  violations: Violation[]
}

export type RealizedProgression = {
  chords: RealizedChord[]
  /** every violation across the whole progression, each tagged with its index */
  violations: Violation[]
  /** true when the whole progression is clean */
  legal: boolean
  /**
   * Set when a chord could not be realized at all (an unresolvable name, or a
   * figure that does not fit). NEVER THROWS — the honest-scoping rule the plan
   * applies to pathfinding applies here too: return best effort with a reason.
   */
  incomplete?: string
}

/**
 * Every four-voice arrangement of one chord under one figure.
 *
 * Built from the chord tones directly rather than from `figuredVoicings`,
 * because `figuredVoicings` returns three-note close-position triads (probed:
 * `figuredVoicings('C','53')` gives `[C3,E3,G3]`, `[C4,E4,G4]`, …) and a
 * four-voice realization needs a DOUBLING, which is a choice that function does
 * not make. `bassOf` supplies the bass the figure demands, which is the part
 * Stage M-A owns; everything above it is this module's business.
 *
 * The bass is placed in every octave its range allows, the upper three voices
 * are drawn from the chord tones plus the doubling, and each candidate is
 * filtered by range, ordering and spacing before it is returned. Candidates
 * come back in a stable order — bass low to high, then doubling preference —
 * so the search is reproducible.
 */
export const realizeSATB = (
  chordName: string,
  figure: Figure = '53',
  opts?: PartWritingOptions & { limit?: number }
): Voicing[] => {
  const chord = Chord.get(chordName)
  if (chord.empty || chord.notes.length === 0) return []
  const arity = figureArity(figure)
  if (chord.notes.length < arity) return []

  const bassPc = bassOf(chordName, figure)
  if (!bassPc) return []

  const tones = chord.notes.slice(0, arity).map((n) => pc(n))
  const key = opts?.key

  // Which tones may be doubled: everything except the leading tone. That
  // exclusion is absolute (Piston ch. 5) and is applied here rather than in
  // `doublingPreference` because it needs the key.
  const doublingIndices =
    arity === 4
      ? []
      : doublingPreference(chordName, figure).filter((i) => {
          const tone = tones[i]
          if (!tone) return false
          if (key && isLeadingTone(tone, key)) return false
          return true
        })

  const candidates: Voicing[] = []
  const seen = new Set<string>()
  const limit = opts?.limit ?? 200

  const bassRange = SATB_RANGE[0]
  if (!bassRange) return []

  // The multiset of pitch classes the upper three voices must supply: every
  // chord tone not in the bass, plus the doubled tone (triads only).
  const upperSets: string[][] = []
  if (arity === 4) {
    // a seventh chord has exactly four tones for four voices — no doubling, and
    // the three upper voices are the three tones the bass did not take.
    const remaining = [...tones]
    const bassIdx = remaining.findIndex((t) => Note.chroma(t) === Note.chroma(bassPc))
    if (bassIdx >= 0) remaining.splice(bassIdx, 1)
    upperSets.push(remaining)
  } else {
    for (const dbl of doublingIndices) {
      const doubled = tones[dbl]
      if (!doubled) continue
      const remaining = [...tones]
      const bassIdx = remaining.findIndex((t) => Note.chroma(t) === Note.chroma(bassPc))
      if (bassIdx >= 0) remaining.splice(bassIdx, 1)
      upperSets.push([...remaining, doubled])
    }
  }

  for (let bassOct = 1; bassOct <= 5; bassOct++) {
    const bassNote = `${bassPc}${bassOct}`
    const bassHeight = height(bassNote)
    if (Number.isNaN(bassHeight)) continue
    if (bassHeight < bassRange.low || bassHeight > bassRange.high) continue

    for (const upper of upperSets) {
      // every ORDERING of the three upper pitch classes across tenor/alto/
      // soprano, each placed in every octave its own range permits
      for (const perm of permutations(upper)) {
        const placements: string[][] = perm.map((tone, i) => {
          const range = SATB_RANGE[i + 1]
          if (!range) return []
          const out: string[] = []
          for (let oct = 1; oct <= 6; oct++) {
            const name = `${tone}${oct}`
            const h = height(name)
            if (Number.isNaN(h)) continue
            if (h < range.low || h > range.high) continue
            out.push(name)
          }
          return out
        })
        if (placements.some((p) => p.length === 0)) continue

        for (const tenor of placements[0] ?? []) {
          for (const alto of placements[1] ?? []) {
            for (const soprano of placements[2] ?? []) {
              const voicing = [bassNote, tenor, alto, soprano]
              // strictly ascending — no crossing within the chord
              const hs = voicing.map(height)
              let ordered = true
              for (let i = 0; i + 1 < hs.length; i++) {
                const a = hs[i]
                const b = hs[i + 1]
                if (a === undefined || b === undefined || !(b > a)) {
                  ordered = false
                  break
                }
              }
              if (!ordered) continue
              // spacing: adjacent UPPER voices within an octave (the bass-tenor
              // gap is exempt, as in the `spacing` rule itself)
              const h1 = hs[1]
              const h2 = hs[2]
              const h3 = hs[3]
              if (
                h1 === undefined ||
                h2 === undefined ||
                h3 === undefined ||
                h2 - h1 > 12 ||
                h3 - h2 > 12
              ) {
                continue
              }
              const k = voicing.join(' ')
              if (seen.has(k)) continue
              seen.add(k)
              candidates.push(voicing)
              if (candidates.length >= limit) return candidates
            }
          }
        }
      }
    }
  }

  return candidates
}

/** All orderings of a small array. Only ever called with three elements. */
const permutations = (items: string[]): string[][] => {
  if (items.length <= 1) return [items]
  const out: string[][] = []
  const seen = new Set<string>()
  for (let i = 0; i < items.length; i++) {
    const head = items[i]
    if (head === undefined) continue
    if (seen.has(head)) continue
    seen.add(head)
    const rest = [...items.slice(0, i), ...items.slice(i + 1)]
    for (const tail of permutations(rest)) out.push([head, ...tail])
  }
  return out
}

/**
 * Total semitone motion between two equal-length voicings, part by part.
 *
 * NOT `voicingDistance` from voiceLeading.ts, deliberately. That function is a
 * symmetric NEAREST-NOTE mapping, built for voicings of unequal size where no
 * bijection exists — the right tool for ranking a suggestion list. Here the
 * voicings are both SATB and the parts are known, so the correct measure is the
 * literal sum of what each singer has to move. Using the nearest-note form
 * would let a soprano leap a tenth for free as long as some other voice
 * happened to land nearby.
 */
const partMotion = (from: Voicing, to: Voicing): number => {
  let total = 0
  for (let i = 0; i < Math.min(from.length, to.length); i++) {
    const a = from[i]
    const b = to[i]
    if (!a || !b) continue
    const d = Math.abs(height(b) - height(a))
    if (!Number.isNaN(d)) total += d
  }
  return total
}

/** Cost of a violation for the search. Errors outweigh any amount of motion. */
const violationCost = (v: Violation): number => (v.severity === 'error' ? 1000 : 250)

/**
 * A mild preference for compact scoring, as a cost in notional semitones.
 *
 * WHY THIS EXISTS — found by probe, not by theory. With violations and voice
 * motion as the only terms, `realizeProgression(['C','F','G','C'])` opened on
 * `C3 E4 G4 C5`: a SIXTEEN-semitone gap between bass and tenor. That is legal
 * (the `spacing` rule deliberately exempts the bass-tenor gap, because a tenth
 * there is normal scoring) and it is smooth, so nothing in the score objected —
 * but no composer would write it as a first chord. The search was optimizing
 * exactly what it was told to and the instruction was incomplete.
 *
 * The fix is a preference, NOT a rule. Making it a violation would be wrong
 * twice over: a wide opening spacing is not an error, and adding it to the rule
 * catalogue would make the checker flag legitimate open-position writing in a
 * composer's own music. So it lives here, in the search's cost function, where
 * it breaks ties toward the idiomatic voicing without ever calling anything
 * illegal.
 *
 * Only the gap ABOVE an octave is charged, and only between the bass and the
 * tenor — the upper voices are already governed by the `spacing` rule proper.
 * The weight is small enough that it never outranks real voice motion.
 */
const spacingPreference = (voicing: Voicing): number => {
  const a = voicing[0]
  const b = voicing[1]
  if (!a || !b) return 0
  const gap = height(b) - height(a)
  if (Number.isNaN(gap)) return 0
  return gap > 12 ? (gap - 12) * 0.5 : 0
}

/**
 * Four-voice realization of a WHOLE PROGRESSION — the composer-facing
 * deliverable of this stream (rank 2 in the plan's audience-delight ordering).
 *
 * THE ALGORITHM: a beam search over (doubling x spacing x octave) per chord,
 * scored by violations across the whole span plus total voice motion.
 *
 * Why a beam and not a greedy chord-by-chord choice: part-writing is not
 * locally optimal. The classic case is V-I in root position, where the smoothest
 * individual voicing of V is frequently the one that forces parallel octaves
 * into I — a greedy realizer picks it, then has no legal continuation. A beam
 * keeps the best `beamWidth` partial realizations alive so a slightly worse
 * chord that leads somewhere clean can win.
 *
 * Why not exhaustive: the candidate count per chord is in the hundreds
 * (doublings x orderings x octaves), so an exact search is exponential in the
 * length of the progression. A beam of 24 was probed to give the same answer as
 * a beam of 200 on every progression in the test suite while staying fast.
 *
 * SCORING. Each transition costs `violationCost` per violation (an error is
 * 1000, a warning 250) plus the literal semitone motion summed over the four
 * parts. The weights are chosen so that no amount of smoothness buys a single
 * error — an expert wants the legal realization, and among legal realizations
 * the smooth one. Ties break toward the earlier candidate, which makes the
 * output reproducible.
 *
 * DISABLED RULES DO NOT COST ANYTHING. The toggles and the waivers are applied
 * inside `checkVoiceLeading`, so a waived rule is not merely hidden from the
 * report — it stops steering the search. That is what lets this function
 * realize fauxbourdon as fauxbourdon instead of routing around the parallel
 * motion the device is made of.
 *
 * NEVER THROWS. An unresolvable chord name stops the search and returns what
 * was realized so far with `incomplete` set to a reason.
 *
 * @example a I-IV-V-I in C major, realized clean:
 * ```ts
 * const r = realizeProgression(['C', 'F', 'G', 'C'], {
 *   key: { tonic: 'C', mode: 'major' },
 * })
 * r.legal            // true
 * r.chords[0].voicing // ['C3', 'C4', 'E4', 'G4'] — root doubled
 * ```
 */
export const realizeProgression = (
  chordNames: string[],
  opts?: RealizeOptions
): RealizedProgression => {
  if (chordNames.length === 0) {
    return { chords: [], violations: [], legal: true }
  }

  const beamWidth = opts?.beamWidth ?? 24
  const figures = opts?.figures ?? []

  type Path = {
    voicings: Voicing[]
    perChord: Violation[][]
    cost: number
  }

  const figureAt = (i: number): Figure => figures[i] ?? '53'

  // seed
  const firstName = chordNames[0]
  if (firstName === undefined) {
    return { chords: [], violations: [], legal: true }
  }
  const firstCandidates = realizeSATB(firstName, figureAt(0), opts)
  if (firstCandidates.length === 0) {
    return {
      chords: [],
      violations: [],
      legal: false,
      incomplete: `could not realize '${firstName}' with figure '${figureAt(0)}'`,
    }
  }

  let beam: Path[] = []
  if (opts?.startVoicing && opts.startVoicing.length > 0) {
    // an explicit starting voicing is honoured exactly; the search begins from
    // the move INTO the second chord.
    beam = [{ voicings: [opts.startVoicing], perChord: [[]], cost: 0 }]
  } else {
    // No previous chord to lead from, so there is no voice motion to score. The
    // seed is charged only the spacing preference, which is what stops the
    // search opening on a legal-but-ungainly wide chord (see
    // `spacingPreference`). Keep a WIDE seed — wider than the beam — so the
    // first chord is not committed to before its consequences are known.
    beam = firstCandidates.map((v) => ({
      voicings: [v],
      perChord: [[]],
      cost: spacingPreference(v),
    }))
    beam.sort((a, b) => a.cost - b.cost)
    beam = beam.slice(0, Math.max(beamWidth, 32))
  }

  for (let i = 1; i < chordNames.length; i++) {
    const name = chordNames[i]
    if (name === undefined) continue
    const figure = figureAt(i)
    const candidates = realizeSATB(name, figure, opts)
    if (candidates.length === 0) {
      const best = beam[0]
      const chords = (best?.voicings ?? []).map((voicing, idx) => ({
        chord: chordNames[idx] ?? '',
        ...(figures[idx] ? { figure: figures[idx] } : {}),
        voicing,
        violations: best?.perChord[idx] ?? [],
      }))
      const all = chords.flatMap((c, idx) =>
        c.violations.map((v) => ({ ...v, at: idx }))
      )
      return {
        chords,
        violations: all,
        legal: false,
        incomplete: `could not realize '${name}' with figure '${figure}'`,
      }
    }

    const stepOpts: PartWritingOptions = {
      ...opts,
      fromChord: chordNames[i - 1],
      toChord: name,
      fromFigure: figureAt(i - 1),
      toFigure: figure,
      // the LAST transition of a progression is where a cadence lives; the
      // caller may override by passing `cadence` explicitly.
      cadence: opts?.cadence ?? i === chordNames.length - 1,
    }

    const next: Path[] = []
    for (const path of beam) {
      const prev = path.voicings[path.voicings.length - 1]
      if (!prev) continue
      for (const cand of candidates) {
        const violations = checkVoiceLeading(prev, cand, stepOpts)
        const cost =
          path.cost +
          violations.reduce((s, v) => s + violationCost(v), 0) +
          partMotion(prev, cand) +
          spacingPreference(cand)
        next.push({
          voicings: [...path.voicings, cand],
          perChord: [...path.perChord, violations],
          cost,
        })
      }
    }

    if (next.length === 0) {
      // nothing survived — should not happen, since nothing filters here, but
      // the honest-scoping rule says report rather than throw.
      const best = beam[0]
      const chords = (best?.voicings ?? []).map((voicing, idx) => ({
        chord: chordNames[idx] ?? '',
        ...(figures[idx] ? { figure: figures[idx] } : {}),
        voicing,
        violations: best?.perChord[idx] ?? [],
      }))
      return {
        chords,
        violations: chords.flatMap((c, idx) =>
          c.violations.map((v) => ({ ...v, at: idx }))
        ),
        legal: false,
        incomplete: `no voicing of '${name}' could follow the previous chord`,
      }
    }

    // stable sort by cost, keep the beam
    next.sort((a, b) => a.cost - b.cost)
    beam = next.slice(0, beamWidth)
  }

  const best = beam[0]
  if (!best) {
    return { chords: [], violations: [], legal: false, incomplete: 'search failed' }
  }

  const chords: RealizedChord[] = best.voicings.map((voicing, idx) => ({
    chord: chordNames[idx] ?? '',
    ...(figures[idx] ? { figure: figures[idx] } : {}),
    voicing,
    violations: best.perChord[idx] ?? [],
  }))

  const violations = chords.flatMap((c, idx) =>
    c.violations.map((v) => ({ ...v, at: idx }))
  )

  return { chords, violations, legal: violations.length === 0 }
}

/**
 * Check a progression that is ALREADY realized — the analytic inverse of
 * `realizeProgression`.
 *
 * A composer with their own four-part writing wants it checked, not rewritten.
 * Violations are tagged with `at`, the index of the chord they arrive at.
 */
export const checkProgression = (
  voicings: Voicing[],
  opts?: RealizeOptions
): Violation[] => {
  const out: Violation[] = []
  const figures = opts?.figures ?? []
  for (let i = 1; i < voicings.length; i++) {
    const from = voicings[i - 1]
    const to = voicings[i]
    if (!from || !to) continue
    const stepOpts: PartWritingOptions = {
      ...opts,
      ...(figures[i - 1] ? { fromFigure: figures[i - 1] } : {}),
      ...(figures[i] ? { toFigure: figures[i] } : {}),
      cadence: opts?.cadence ?? i === voicings.length - 1,
    }
    for (const v of checkVoiceLeading(from, to, stepOpts)) {
      out.push({ ...v, at: i })
    }
  }
  return out
}
