import { Chord, Note, Scale } from 'tonal'

import { chordNameWithNotes } from './graphh'
import { isConventionalKeyName } from './scaleList'
// the shared contract, from its own leaf module — naming nextChord here would
// be a runtime cycle. See chordSuggestion.ts's header.
import type { ChordSuggestion } from './chordSuggestion'

/**
 * Chromatic vocabulary that is NOT a chart edge: chromatic mediants,
 * common-tone diminished sevenths, and the enharmonic reinterpretations that
 * turn one of them into a modulation pivot.
 *
 * ── Why these are functions and not chart nodes ──────────────────────────────
 *
 * The codebase has two established precedents for adding harmonic vocabulary,
 * and they are chosen by one test: **does the thing depend on where you are
 * standing, or only on what key you are in?**
 *
 *   - The diatonic sevenths became CHART NODES, because a seventh's edges are a
 *     property of the move — `V7` resolves to the tonic and nothing else, which
 *     is a fact about a position in the progression.
 *   - `mixtureSuggestions` is an ADDITIVE NON-GRAPH CHANNEL, because a borrowed
 *     chord is a property of the KEY. It is available wherever you are, so no
 *     edge can express it without being duplicated onto every node.
 *
 * The augmented-sixth trio passes the first test and so became nodes (see
 * `graphData/minor.ts`). Everything in THIS module fails it:
 *
 *   - A **chromatic mediant** is available from the tonic at any moment and its
 *     defining feature is the common tone with the chord you are leaving, not a
 *     functional obligation about where it goes. Modelled as edges it would
 *     need four new nodes per chart plus an edge from every triad to each of
 *     them — a dense subgraph encoding one fact ("major-third relations sound
 *     good") that a five-line function states directly. It is also the least
 *     functional harmony in the plan's scope: the Romantic mediant is used
 *     precisely because it side-steps the T/PD/D cycle the charts encode, so
 *     forcing it into a functional flowchart would misrepresent it.
 *   - A **common-tone diminished seventh** returns to the chord it embellishes.
 *     Its "edge" is the identity edge, which the chart cannot usefully hold.
 *   - An **enharmonic pivot** is by definition about leaving the key, and the
 *     charts are key-independent templates. It is data for B2's pathfinding,
 *     not a suggestion at all.
 *
 * So this module follows the `mixture.ts` shape: pure functions of (tonic,
 * scale) returning `ChordSuggestion[]`, which callers concat onto
 * `nextChordDetail` output. Nothing here changes any existing suggestion list.
 */

// ── Chromatic mediants ──────────────────────────────────────────────────────

/**
 * One chromatic-mediant relation, described relative to the tonic.
 *
 * Roots are ALWAYS derived by interval transposition from the tonic, never by
 * scale-degree lookup — the same rule `mixture.ts` and the augmented sixths
 * follow, for the same reason: degree arithmetic double-flattens in minor and
 * mis-spells in flat keys. Probed across C/A/Eb/F#/Db/Cb/G#/Bb/B/Ab/D# before
 * this table was written; every entry round-trips through `Chord.get` with real
 * notes, including the triple-accidental cases (`B#` in G# major, `F##` in D#).
 *
 * DESCENDING THIRDS ARE SPELLED AS ASCENDING SIXTHS. `Note.transpose(t, '-3M')`
 * does not do what it looks like it does in this codebase's tonal version —
 * probed, `transpose('C','-3M')` returns `Ab`, which is right by luck for C but
 * is the ascending minor sixth, not a descending major third. The unambiguous
 * spelling is the sixth: `6m` is the major third below (C -> Ab), `6M` the
 * minor third below (C -> A). Written that way so the intent cannot drift.
 */
type MediantRelation = {
  /** interval from the tonic to this chord's root */
  interval: string
  /** chord-symbol suffix ('' = major triad, 'm' = minor triad) */
  suffix: string
  /** roman label, in the mixture module's casing convention */
  roman: string
  /** how this chord relates to the tonic triad, for docs and UI */
  relation: string
}

/**
 * Chromatic mediants of a MAJOR tonic.
 *
 * A chromatic mediant is a triad whose root is a third from the tonic and which
 * is NOT the diatonic chord on that degree — it shares exactly ONE common tone
 * with the tonic triad, where the diatonic mediants (iii, vi) share two. That
 * single shared pitch is the whole effect: enough to hold the ear, too little
 * to sound functional. It is the Romantic sound, and it is why these are
 * grouped by common-tone count rather than by degree.
 *
 * Verified by probe against C major (tonic triad C-E-G):
 *
 *   E    E-G#-B    shares E     — chromatic (the diatonic iii, Em, shares E+G)
 *   Eb   Eb-G-Bb   shares G     — chromatic
 *   Ab   Ab-C-Eb   shares C     — chromatic
 *   A    A-C#-E    shares E     — chromatic (the diatonic vi, Am, shares C+E)
 *
 * The four MINOR triads on those same roots (Ebm, Abm) share NO common tone at
 * all and are excluded: with nothing held in common they are not mediants in
 * any useful sense, just remote triads. `Em` and `Am` are excluded for the
 * opposite reason — they are the diatonic mediants, already in the chart.
 */
const MAJOR_MEDIANTS: MediantRelation[] = [
  {
    interval: '3M',
    suffix: '',
    roman: 'III',
    relation: 'major third above; shares the tonic triad’s third',
  },
  {
    interval: '3m',
    suffix: '',
    roman: 'bIII',
    relation: 'minor third above; shares the tonic triad’s fifth',
  },
  {
    interval: '6m',
    suffix: '',
    roman: 'bVI',
    relation: 'major third below; shares the tonic itself',
  },
  {
    interval: '6M',
    suffix: '',
    roman: 'VI',
    relation: 'minor third below; shares the tonic triad’s third',
  },
]

/**
 * Chromatic mediants of a MINOR tonic (tonic triad 1-♭3-5; A-C-E in A minor).
 *
 * The mirror of the major set. Probed against A minor:
 *
 *   Cm   C-Eb-G    shares C   — chromatic (the diatonic III, C major, shares C+E)
 *   C#m  C#-E-G#   shares E   — chromatic
 *   Fm   F-Ab-C    shares C   — chromatic (the diatonic VI, F major, shares A+C)
 *   F#m  F#-A-C#   shares A   — chromatic
 *
 * Minor triads here, major triads there, for the same reason in both: a
 * chromatic mediant conventionally keeps the MODE of the tonic and changes only
 * the root, so the one common tone falls where the ear expects a third or fifth
 * rather than nowhere. The opposite-mode triads on these roots share nothing.
 */
const MINOR_MEDIANTS: MediantRelation[] = [
  {
    interval: '3M',
    suffix: 'm',
    roman: 'IIIm#',
    relation: 'major third above; shares the tonic triad’s fifth',
  },
  {
    interval: '3m',
    suffix: 'm',
    roman: 'IIIm',
    relation: 'minor third above; shares the tonic itself',
  },
  {
    interval: '6m',
    suffix: 'm',
    roman: 'VIm',
    relation: 'major third below; shares the tonic itself',
  },
  {
    interval: '6M',
    suffix: 'm',
    roman: 'VIm#',
    relation: 'minor third below; shares the tonic triad’s third',
  },
]

/** pitch classes of a realized chord name, octave-stripped */
const pitchClasses = (chordName: string): string[] => {
  const cnwn = chordNameWithNotes(chordName)
  return (cnwn?.notes ?? []).map((n) => Note.get(n).pc).filter((pc) => !!pc)
}

/** shared sounding pitches between two chords, compared by chroma */
const commonTones = (a: string[], b: string[]): string[] => {
  const bChromas = b.map((n) => Note.chroma(n))
  return a.filter((n) => bChromas.includes(Note.chroma(n)))
}

const scaleTypeOf = (tonic: string, scale: string) =>
  Scale.get(`${tonic} ${scale}`).type

/**
 * One chromatic mediant, as a suggestion plus the analysis that makes it one.
 *
 * Extends `ChordSuggestion` rather than replacing it so the result concats
 * directly onto `nextChordDetail` output — the same composition rule the whole
 * suggestion layer follows. The extra fields ride along for callers that want
 * to explain the relation.
 */
export type ChromaticMediantSuggestion = ChordSuggestion & {
  /** the single shared pitch class with the tonic triad, e.g. 'E' */
  commonTone: string
  /** human-readable description of the third-relation */
  relation: string
}

/**
 * The four chromatic mediants of a key: major-third and minor-third relations
 * that share exactly one tone with the tonic triad.
 *
 * An ADDITIVE PALETTE, exactly like `mixtureSuggestions` — a property of the
 * key, not of where you are standing, so it does not consult the chord graph
 * and takes no current chord:
 *
 * ```ts
 * const all = [
 *   ...nextChordDetail('C,3', 'C', 'major'),
 *   ...chromaticMediants('C', 'major'),
 * ]
 * ```
 *
 * Strength is `'mixture'`, reusing the existing union member rather than
 * widening it. That is the same decision `mixture.ts` documents: a new member
 * would break exhaustive switches in existing consumers and would say nothing
 * the `roman` field does not already carry. 'mixture' is honest here — these
 * are chords from outside the key offered as an additive palette, which is what
 * that member means.
 *
 * Modes other than major and minor return `[]` rather than throwing, for the
 * reason mixture does: this is optional colour, and a caller concatenating it
 * should degrade to "no mediants offered" rather than lose the graph
 * suggestions it already has.
 */
export const chromaticMediants = (
  tonic: string,
  scale: string
): ChromaticMediantSuggestion[] => {
  const type = scaleTypeOf(tonic, scale)
  const table =
    type === 'major'
      ? MAJOR_MEDIANTS
      : type === 'minor'
        ? MINOR_MEDIANTS
        : null
  if (!table) return []

  const tonicTriad = pitchClasses(`${tonic}${type === 'minor' ? 'm' : ''}`)
  if (tonicTriad.length === 0) return []

  const out: ChromaticMediantSuggestion[] = []
  for (const m of table) {
    const root = Note.transpose(tonic, m.interval)
    if (!root) continue
    const name = `${root}${m.suffix}`
    const cnwn = chordNameWithNotes(name)
    // same guard the graph translator applies: a symbol resolving to no notes
    // is not a usable suggestion
    if (cnwn === null || cnwn.notes.length === 0) continue

    const shared = commonTones(pitchClasses(name), tonicTriad)
    // by construction every entry in both tables shares exactly one tone.
    // Asserting it here rather than trusting the table means a future edit that
    // adds a non-mediant is dropped instead of silently mislabelled.
    if (shared.length !== 1) continue

    out.push({
      name,
      roman: m.roman,
      notes: cnwn.notes,
      strength: 'mixture',
      enabledBy: null,
      commonTone: shared[0],
      relation: m.relation,
    })
  }
  return out
}

// ── Common-tone diminished sevenths ─────────────────────────────────────────

/**
 * One common-tone diminished seventh, with the chord it embellishes.
 *
 * ── HOW THIS DIFFERS FROM THE LEADING-TONE °7, which is the whole point ──────
 *
 * Both are fully-diminished seventh chords. They are told apart by what they do
 * with their target, and this codebase can state the difference mechanically:
 *
 *   **The leading-tone °7 RESOLVES.** It is built on the leading tone, shares
 *   NO pitch with its tonic, and is dominant-function: every one of its notes
 *   moves. `vii°7` in C is `Bdim7` = B-D-F-Ab, and the intersection with the C
 *   triad (C-E-G) is EMPTY — probed. It already exists in this codebase as the
 *   chart node `VIIdim7`, reached from the predominants and resolving onward.
 *
 *   **The common-tone °7 RETURNS.** It is built a semitone ABOVE its target's
 *   root, shares TWO pitches with it, and is not dominant-function at all — it
 *   is a neighbour-note embellishment that goes back where it came from.
 *   `#i°7` in C is `C#dim7` = C#-E-G-Bb, and the intersection with C-E-G is
 *   {E, G} — probed. Its "resolution" is the identity: it decorates I and
 *   returns to I.
 *
 * The `resolvesTo` field carries that distinction as data: it is always the
 * chord the °7 came FROM and goes BACK TO, never a new harmonic goal. A caller
 * comparing this to `VIIdim7`'s chart edges sees the difference immediately —
 * the chart node points somewhere else, this points home.
 *
 * That is also why these are not chart nodes. An edge X -> Y -> X where Y's
 * only purpose is to return to X is not a motion the chart models; it is an
 * elaboration of standing still.
 */
export type CommonToneDim7Suggestion = ChordSuggestion & {
  /**
   * The chord this °7 embellishes AND returns to — realized name, e.g. 'C'.
   * This is the field that distinguishes a common-tone °7 from a leading-tone
   * °7: the latter resolves to a DIFFERENT chord and has no such home.
   */
  resolvesTo: string
  /** the two pitch classes held in common with `resolvesTo` */
  commonTones: string[]
}

/**
 * The targets a common-tone °7 conventionally embellishes.
 *
 * Both are built a chromatic semitone above the target's root, which is what
 * produces the two common tones: raising the root by a half step turns the
 * root into a lower neighbour and leaves the third and fifth in place as
 * chord tones of the °7.
 *
 * - **♯i°7 → I** — the common-tone °7 of the tonic. In C, `C#dim7` -> `C`.
 * - **♯v°7 → V** — the same device applied to the dominant, which is where it
 *   most often appears in practice (it decorates a dominant arrival without
 *   weakening it). In C, `G#dim7` -> `G`.
 *
 * THE DEVICE NEEDS A MAJOR TARGET, and that fact is enforced by the two-common-
 * tone check rather than asserted here. Raising the root of a MAJOR triad by a
 * semitone leaves its third and fifth as chord tones of the °7 (C-E-G against
 * C#-E-G-Bb: E and G both survive). Raising the root of a MINOR triad does not
 * — probed in A minor, `A#dim7` (A#-C#-E-G) against `Am` (A-C-E) shares only E,
 * because the minor third C is not a member of the °7 built on A#. So a minor
 * key gets only `♯v°7` from this function, its dominant being major in both
 * modes. That is musically right, not a gap: the common-tone °7 embellishing a
 * minor tonic is not a device the common-practice repertoire uses, precisely
 * because the second common tone is not there to hold it.
 *
 * Note that `#v°7` in C is `G#dim7`, which is ALSO the leading-tone °7 of A
 * minor. Same four pitches, two entirely different functions — which is the
 * cleanest possible illustration of why the distinction is behavioural rather
 * than a property of the notes, and it is exactly the ambiguity
 * `enharmonicPivots` exploits below.
 */
const CT_DIM7_TARGETS = [
  { targetInterval: '1P', roman: '#i°7', label: 'tonic' },
  { targetInterval: '5P', roman: '#v°7', label: 'dominant' },
] as const

/**
 * Common-tone diminished sevenths for a key.
 *
 * An additive palette on the `mixture.ts` model, like `chromaticMediants`.
 * Returns the °7 that embellishes the tonic and the one that embellishes the
 * dominant; each carries `resolvesTo` (the chord it returns to) and the two
 * pitches it holds in common with it.
 *
 * CONTRAST WITH `VIIdim7`, which is a chart node: the leading-tone °7 resolves
 * to a different chord and shares nothing with it. See the type doc above.
 *
 * Roots come from interval transposition (`1A` above the target root), so
 * spelling stays exact in every key: probed, C -> `C#dim7`, Eb -> `Edim7`,
 * F# -> `F##dim7`, Db -> `Ddim7`, Cb -> `Cdim7`, G# -> `G##dim7`. The
 * double-sharp roots resolve to real notes through `Chord.get`.
 *
 * A MAJOR key returns both entries; a MINOR key returns only `♯v°7`. That is
 * not an omission — see the type doc above: raising the root of a minor triad
 * leaves only ONE common tone, so the device does not apply to a minor tonic
 * and the two-common-tone check drops it. The dominant is major in both modes,
 * so `♯v°7` is available either way. Unsupported modes return `[]`.
 */
export const commonToneDim7s = (
  tonic: string,
  scale: string
): CommonToneDim7Suggestion[] => {
  const type = scaleTypeOf(tonic, scale)
  if (type !== 'major' && type !== 'minor') return []

  const out: CommonToneDim7Suggestion[] = []
  for (const t of CT_DIM7_TARGETS) {
    const targetRoot = Note.transpose(tonic, t.targetInterval)
    if (!targetRoot) continue
    // the tonic keeps the mode; the dominant is major in both modes (the
    // leading tone is raised in minor), which is what the chart's V node holds
    const targetName =
      t.targetInterval === '1P' && type === 'minor'
        ? `${targetRoot}m`
        : targetRoot
    const targetNotes = pitchClasses(targetName)
    if (targetNotes.length === 0) continue

    const dimRoot = Note.transpose(targetRoot, '1A')
    if (!dimRoot) continue
    const name = `${dimRoot}dim7`
    const cnwn = chordNameWithNotes(name)
    if (cnwn === null || cnwn.notes.length === 0) continue

    const shared = commonTones(pitchClasses(name), targetNotes)
    // the defining property: a COMMON-tone °7 shares two tones with its target.
    // A leading-tone °7 shares none. Checking rather than assuming means a bad
    // table entry is dropped instead of shipped under the wrong name.
    if (shared.length !== 2) continue

    out.push({
      name,
      roman: t.roman,
      notes: cnwn.notes,
      strength: 'mixture',
      enabledBy: null,
      resolvesTo: targetName,
      commonTones: shared,
    })
  }
  return out
}

// ── Enharmonic reinterpretation (the B2 contract) ───────────────────────────

/**
 * One enharmonic reinterpretation of a chord: the same sounding pitches heard
 * as a different chord in a different key.
 *
 * ── THIS IS THE CROSS-STREAM CONTRACT WITH B2 ───────────────────────────────
 *
 * B2 owns modulation pathfinding and consumes these to extend its pivot set. It
 * is therefore shaped to sit ALONGSIDE `PivotSuggestion` (pivots.ts) without B2
 * having to change its surface: the three fields B2's routing needs from a
 * diatonic pivot — `targetKey`, `targetTonic`, `targetScale` — are present here
 * under the SAME NAMES AND THE SAME TYPES, so a consumer can widen its input to
 * `PivotSuggestion | EnharmonicPivot` and keep its existing field accesses.
 *
 * What is deliberately NOT here:
 *
 *   - **No `follow` field.** `PivotSuggestion.follow` is `nextChordDetail`
 *     output for the chord in the target key, which requires building that
 *     key's graph. This module does not import `nextChord` (that would be a
 *     runtime cycle: nextChord -> ... -> this) and, more importantly, B2 owns
 *     the decision of what to do after arriving. Handing over the destination
 *     and letting B2 route from it is the smaller, more composable contract.
 *   - **No ranking or distance.** B2 sorts pivots by key distance already.
 *     Duplicating that here would mean two sort orders to reconcile.
 *
 * What IS here that a diatonic pivot cannot carry: `respelled` and `heardAs`.
 * A diatonic pivot is the same chord in two keys; an enharmonic pivot is a
 * DIFFERENT chord that sounds identical, so the reinterpretation itself has to
 * be reported or the modulation is unexplainable.
 */
export type EnharmonicPivot = {
  /** the chord as it is spelled in the current key, e.g. 'Ger6' or 'G#dim7' */
  from: string
  /** the current-key analysis, e.g. 'Ger6' or 'vii°7' */
  fromRoman: string
  /**
   * the same pitches respelled for the target key, e.g. ['Ab','C','Eb','Gb'].
   * This is the reinterpretation made explicit — the note that changes name is
   * the whole mechanism of the pivot.
   */
  respelled: string[]
  /** realized chord name in the target key, e.g. 'Ab7' or 'Bdim7' */
  heardAs: string
  /** the target-key analysis, e.g. 'V7' */
  romanThere: string
  /** full key name, e.g. 'Db major' — same field name/type as PivotSuggestion */
  targetKey: string
  /** e.g. 'Db' — same field name/type as PivotSuggestion */
  targetTonic: string
  /** 'major' or 'minor' — same field name/type as PivotSuggestion */
  targetScale: string
  /** short prose explanation, for UI and for reading a returned path */
  explanation: string
}

/**
 * The augmented-sixth family members that support the V⁷ reinterpretation.
 *
 * ONLY THE GERMAN. This is not an arbitrary restriction — it falls out of the
 * pitch content probed in `graphh.ts`:
 *
 *   Italian  ♭6-1-♯4      three notes, no fifth  -> `Ab7no5`, not a V⁷
 *   French   ♭6-1-2-♯4    has a ♯4 AND a 2       -> `Ab7b5`, an altered chord
 *   German   ♭6-1-♭3-♯4   has a perfect fifth    -> `Ab7`, a real V⁷
 *
 * Respelling ♯4 as ♭7 turns the German into a dominant seventh on ♭6, which is
 * the dominant of ♭II — the NEAPOLITAN key. So a German sixth in C is `Ab7`,
 * V⁷ of D♭. That single respelling is the most famous enharmonic modulation in
 * the common-practice repertoire, and it is available from exactly one of the
 * three members.
 *
 * `Aug6` IS NOT ACCEPTED HERE, and that is a consequence of the alias decision
 * rather than an oversight. `Aug6` aliases the ITALIAN (see `graphh.ts`), which
 * has only three notes and no fifth, so it is `Ab7no5` — not a dominant
 * seventh, and there is nothing to reinterpret. Passing 'Aug6' returns `[]` for
 * exactly the same reason passing 'It6' does. A caller who wants this pivot
 * names `Ger6`.
 */
const isGer6Name = (name: string) => name === 'Ger6'

/**
 * Build the German sixth's pitch classes in a key, and its V⁷ respelling.
 *
 * Shares its frame with `graphh.ts`'s `Ger6` by construction (the same three
 * intervals from the tonic) rather than by importing it, because this needs the
 * RESPELLED form too and building both here keeps the respelling adjacent to
 * the spelling it replaces.
 */
const ger6Reinterpretation = (tonic: string) => {
  const flatSix = Note.transpose(tonic, 'm6')
  const flatThree = Note.transpose(tonic, 'm3')
  const sharpFour = Note.transpose(tonic, 'A4')
  // the one note that changes name: ♯4 becomes ♭7 above ♭6. Derived as a
  // MINOR SEVENTH ABOVE THE NEW ROOT rather than by `Note.enharmonic`, because
  // enharmonic() picks the simplest spelling of the pitch and not necessarily
  // the one the target key needs — in Eb the ♯4 is A and its ♭7 spelling is
  // Bbb, which enharmonic() would give as A.
  const flatSeven = Note.transpose(flatSix, 'm7')
  return {
    original: [flatSix, tonic, flatThree, sharpFour],
    respelled: [flatSix, tonic, flatThree, flatSeven],
    /** root of the dominant seventh it becomes */
    domRoot: flatSix,
    /** the key that V7 belongs to: a fourth above its root = ♭II, the Neapolitan */
    targetTonic: Note.transpose(flatSix, '4P'),
    sharpFour,
    flatSeven,
  }
}

/**
 * The four rotations of a fully-diminished seventh, each heard as the
 * leading-tone °7 of a different key.
 *
 * A °7 divides the octave into four equal minor thirds, so it is its own
 * inversion in sound: `G#dim7` (G#-B-D-F) is enharmonically also `Bdim7`,
 * `Ddim7` and `Fdim7`. Probed — `Chord.detect(['G#','B','D','F'])` returns all
 * four spellings. Each rotation is the leading-tone °7 of the key a semitone
 * above its root, which gives four minor keys (and their parallel majors)
 * reachable from one sonority. That is the second classic enharmonic pivot.
 */
const dim7Rotations = (rootPc: string): string[] => {
  // built by stacking minor thirds from the given root, so the spelling of each
  // rotation follows from the interval rather than from a lookup table. tonal's
  // own dim7 note list is used because it is spelling-exact.
  const notes = Chord.get(`${rootPc}dim7`).notes
  return notes.map((n) => Note.get(n).pc).filter((pc) => !!pc)
}

const KEY_MODES = ['minor', 'major'] as const

/**
 * A modulation target must be a key someone could actually write in.
 *
 * Enharmonic reinterpretation generates spellings mechanically, and rotating a
 * °7 four times walks off the end of the circle of fifths: probed,
 * `enharmonicPivots('Bdim7', ...)` produced `Abdim7` heard in **B♭♭ minor**,
 * and rotating from `C#dim7` produced **C♭ minor** — spellings that are
 * arithmetically correct and musically nonexistent. `isConventionalKeyName`
 * (scaleList.ts) is the project's existing answer to exactly this problem; it
 * accepts the 15 major and 15 minor tonics of the circle of fifths and rejects
 * double-accidental artifacts.
 *
 * Filtering rather than respelling is deliberate. Respelling `Bbb minor` to
 * `A minor` would silently change which pitches the target key contains
 * relative to the respelled chord this pivot hands B2, and a pivot whose
 * target key does not literally contain the notes reported in `respelled` is
 * worse than no pivot at all.
 */
const isUsableTarget = (targetKey: string) => isConventionalKeyName(targetKey)

/**
 * Enharmonic reinterpretations of a chord, with the keys they lead to.
 *
 * **THE CROSS-STREAM CONTRACT: B2 consumes this to extend its pivot set.** The
 * return shape mirrors `PivotSuggestion`'s key fields exactly (`targetKey`,
 * `targetTonic`, `targetScale`), so B2 can widen its input union and slot these
 * in without changing its own surface. See `EnharmonicPivot`'s doc.
 *
 * Two families are recognized, and they are the two the common-practice
 * repertoire actually uses:
 *
 * **1. Ger⁶ ↔ V⁷.** Pass `'Ger6'` or `'Aug6'`. The German sixth on ♭6 respells
 * as a dominant seventh on ♭6, which is V⁷ of ♭II — the Neapolitan key. In C,
 * `Ab-C-Eb-F#` becomes `Ab-C-Eb-Gb` = `Ab7` = V⁷ of D♭. Reported for both the
 * major and minor forms of the target key, since a dominant seventh resolves to
 * either.
 *
 * The relation is symmetric and both directions are offered: pass a DOMINANT
 * SEVENTH name (`'Ab7'`) and you get back the keys in which those pitches are a
 * German sixth — the modulation read the other way, which is how a composer
 * arrives at a remote key and then reinterprets their way home.
 *
 * **2. The four rotations of a °7.** Pass any fully-diminished seventh name.
 * Each of its four notes can be heard as the leading tone, so the chord is the
 * leading-tone °7 of four different keys; each is reported in both modes,
 * minor first (the fully-diminished form is characteristically minor). The key
 * the chord already belongs to as `vii°7` is excluded, exactly as
 * `pivotSuggestions` excludes the current key.
 *
 * Anything else returns `[]` — no reinterpretation is available, which is not
 * an error. Unsupported modes likewise return `[]`.
 *
 * @param chordName 'Ger6' / 'Aug6', a dominant seventh, or a dim7 symbol
 * @param fromTonic current key's tonic, e.g. 'C'
 * @param fromScale current key's scale, e.g. 'major'
 */
export const enharmonicPivots = (
  chordName: string,
  fromTonic: string,
  fromScale: string
): EnharmonicPivot[] => {
  const fromType = scaleTypeOf(fromTonic, fromScale)
  if (fromType !== 'major' && fromType !== 'minor') return []
  const fromKey = `${fromTonic} ${fromScale}`

  // ── family 1a: Ger6 heard as V7 of the Neapolitan ────────────────────────
  if (isGer6Name(chordName)) {
    const r = ger6Reinterpretation(fromTonic)
    if (!r.targetTonic) return []
    const heardAs = `${r.domRoot}7`
    if (chordNameWithNotes(heardAs)?.notes.length !== 4) return []

    return KEY_MODES.map((mode) => ({
      from: chordName,
      fromRoman: chordName === 'Aug6' ? 'Aug6' : 'Ger6',
      respelled: r.respelled,
      heardAs,
      romanThere: 'V7',
      targetKey: `${r.targetTonic} ${mode}`,
      targetTonic: r.targetTonic,
      targetScale: mode,
      explanation:
        `The German sixth ${r.original.join('-')} has a perfect fifth above its bass, ` +
        `so respelling ${r.sharpFour} as ${r.flatSeven} makes it ${heardAs} — the ` +
        `dominant seventh of ${r.targetTonic}, the Neapolitan degree of ${fromKey}.`,
    })).filter((p) => p.targetKey !== fromKey && isUsableTarget(p.targetKey))
  }

  const chord = Chord.get(chordName)
  const rootPc = Note.get(chord.notes[0] ?? '').pc

  // ── family 1b: a dominant seventh heard as a German sixth ────────────────
  // the mirror of 1a: V7 on X is the German sixth of the key whose ♭6 is X,
  // i.e. the key a major third BELOW X (spelled as an ascending minor sixth —
  // see the MediantRelation doc for why descending intervals are written that
  // way here).
  if (chord.type === 'dominant seventh' && rootPc) {
    const target = Note.transpose(rootPc, '3M')
    if (!target) return []
    const flatSeven = Note.get(chord.notes[3] ?? '').pc
    const sharpFour = Note.transpose(target, 'A4')
    if (!flatSeven || !sharpFour) return []

    return KEY_MODES.map((mode) => ({
      from: chordName,
      fromRoman: 'V7',
      respelled: [
        ...chord.notes.slice(0, 3).map((n) => Note.get(n).pc),
        sharpFour,
      ],
      heardAs: 'Ger6',
      romanThere: 'Ger6',
      targetKey: `${target} ${mode}`,
      targetTonic: target,
      targetScale: mode,
      explanation:
        `Respelling the seventh ${flatSeven} as ${sharpFour} turns ${chordName} into ` +
        `the German sixth of ${target} — an augmented sixth that expands outward onto ` +
        `that key's dominant instead of resolving down a fifth.`,
    })).filter((p) => p.targetKey !== fromKey && isUsableTarget(p.targetKey))
  }

  // ── family 2: the four rotations of a fully-diminished seventh ───────────
  if (chord.type === 'diminished seventh' && rootPc) {
    const members = dim7Rotations(rootPc)
    if (members.length !== 4) return []

    const out: EnharmonicPivot[] = []
    for (const member of members) {
      // heard as the leading-tone °7 of the key a semitone above this member
      const target = Note.transpose(member, '2m')
      if (!target) continue
      const heardAs = `${member}dim7`
      const respelled = dim7Rotations(member)
      if (respelled.length !== 4) continue

      for (const mode of KEY_MODES) {
        const targetKey = `${target} ${mode}`
        if (targetKey === fromKey) continue
        if (!isUsableTarget(targetKey)) continue
        out.push({
          from: chordName,
          fromRoman: 'vii°7',
          respelled,
          heardAs,
          romanThere: 'vii°7',
          targetKey,
          targetTonic: target,
          targetScale: mode,
          explanation:
            `A fully-diminished seventh divides the octave evenly, so ${chordName} is ` +
            `also ${heardAs}. Hearing ${member} as the leading tone makes it the ` +
            `leading-tone seventh of ${targetKey}.`,
        })
      }
    }
    return out
  }

  return []
}
