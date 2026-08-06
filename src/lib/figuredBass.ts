import { Chord, Note } from 'tonal'

import type { ChartEdge, Figure, FiguredChord } from './graphData/types'

// direct import (not via a barrel) to avoid module-init cycles and
// browser-only side effects — cf. importHygiene.test.ts
import { ascendingInversions, type Voicing } from './voiceLeading'

/**
 * Figured-bass vocabulary (Stage M-A, A2).
 *
 * WHAT A FIGURE MEANS HERE: which chord tone is in the bass, and nothing else.
 * Figured bass historically also implies suspensions, alterations and voicing;
 * this module models only the inversion, which is the part the chart needs and
 * the part that is unambiguous. Everything else is B1's (part-writing).
 *
 * THE MAPPING IS BY INDEX, NOT BY INTERVAL. `figureBassIndex` returns a
 * position in the chord's own note list and `bassOf` indexes
 * `Chord.get(name).notes` with it. That is a deliberate correctness decision,
 * not laziness: tonal's note list is already spelling-exact in every key, and
 * indexing inherits that for free. Probed before pinning —
 *
 *   G# minor, VIIdim  -> F##-A#-C#   (bassOf '6' = A#, not Bb)
 *   Eb minor, i       -> Eb-Gb-Bb    (bassOf '6' = Gb, not F#)
 *   Db major, V7 Ab7  -> Ab-C-Eb-Gb  (bassOf '42' = Gb, not F#)
 *   C# major, V7 G#7  -> G#-B#-D#-F# (bassOf '65' = B#, not C)
 *   Fbm               -> Fb-Abb-Cb   (bassOf '64' = Cb, not B)
 *
 * The alternative — transposing a third or a fifth from the root — would have
 * to re-derive each of those spellings and gets several of them wrong, which
 * is exactly the enharmonic-respelling class of bug this codebase has been
 * bitten by repeatedly (see the N6 and Aug6 notes in graphh.ts).
 */

/** Every figure, in the order a reference table would list them. */
export const FIGURES: readonly Figure[] = [
  '53',
  '6',
  '64',
  '7',
  '65',
  '43',
  '42',
] as const

/**
 * Which chord tone a figure puts in the bass, as a 0-based index into the
 * chord's ascending note list (0 = root, 1 = third, 2 = fifth, 3 = seventh).
 *
 * Triads and seventh chords are given separate figures rather than a shared
 * "inversion number" because that is how the notation works and how a composer
 * reads it: `6` and `65` both mean third-in-the-bass, but `6` says triad and
 * `65` says seventh chord, and the difference is legible at a glance.
 */
const FIGURE_BASS_INDEX: { [K in Figure]: number } = {
  '53': 0, // root position triad — root in the bass
  '6': 1, //  first inversion triad — THIRD in the bass
  '64': 2, // second inversion triad — FIFTH in the bass
  '7': 0, //  root position seventh — root in the bass
  '65': 1, // first inversion seventh — THIRD in the bass
  '43': 2, // second inversion seventh — FIFTH in the bass
  '42': 3, // third inversion seventh — SEVENTH in the bass
}

/** How many notes a figure presupposes: 3 for a triad figure, 4 for a seventh. */
const FIGURE_ARITY: { [K in Figure]: 3 | 4 } = {
  '53': 3,
  '6': 3,
  '64': 3,
  '7': 4,
  '65': 4,
  '43': 4,
  '42': 4,
}

/**
 * The chord tone a figure puts in the bass, as a 0-based index.
 * 0 = root, 1 = third, 2 = fifth, 3 = seventh.
 */
export const figureBassIndex = (figure: Figure): number =>
  FIGURE_BASS_INDEX[figure]

/** Whether a figure describes a seventh chord (4 notes) or a triad (3). */
export const figureArity = (figure: Figure): 3 | 4 => FIGURE_ARITY[figure]

/** Human-readable name of a figure, for UI and error messages. */
export const figureLabel = (figure: Figure): string =>
  ({
    '53': 'root position',
    '6': 'first inversion',
    '64': 'second inversion',
    '7': 'root position seventh',
    '65': 'first inversion seventh',
    '43': 'second inversion seventh',
    '42': 'third inversion seventh',
  })[figure]

/**
 * Unicode and shorthand spellings accepted as INPUT, normalized to the ASCII
 * stored form. Stored data (charts, spans) is always ASCII so that one spelling
 * means one thing to a diff and to grep; these exist only so a caller may type
 * what a score prints.
 */
const FIGURE_ALIASES: { [alias: string]: Figure } = {
  '⁶': '6',
  '⁶₄': '64',
  '⁷': '7',
  '⁶₅': '65',
  '⁴₃': '43',
  '⁴₂': '42',
  '⁵₃': '53',
  // '2' is the other current spelling of the third-inversion figure; both
  // appear in the literature, and '42' is stored because the ASCII set is then
  // uniformly two symbols per seventh-chord inversion.
  '2': '42',
  // root position is usually left unfigured entirely
  '': '53',
  '5': '53',
  '3': '53',
}

const isFigure = (value: string): value is Figure =>
  (FIGURES as readonly string[]).includes(value)

/**
 * Normalize a figure written in any accepted spelling to its stored ASCII form;
 * `null` when the input is not a figure at all.
 *
 * Returns null rather than throwing: callers here are parsing user input and a
 * non-figure is an ordinary "no" answer, not an exceptional condition.
 */
export const parseFigure = (raw: string): Figure | null => {
  const trimmed = raw.trim()
  if (isFigure(trimmed)) return trimmed
  const aliased = FIGURE_ALIASES[trimmed]
  return aliased ?? null
}

/** Narrow a chart edge to its object form. */
export const isFiguredChord = (edge: ChartEdge): edge is FiguredChord =>
  typeof edge !== 'string'

/**
 * The chord name of an edge, whichever form it takes. A bare string IS the
 * chord name; a figured chord carries it in `.chord`.
 */
export const edgeChord = (edge: ChartEdge): string =>
  isFiguredChord(edge) ? edge.chord : edge

/**
 * The figure of an edge, or null for a bare string.
 *
 * A bare string is root position, but this returns NULL rather than '53' so
 * that "unfigured" and "explicitly root position" stay distinguishable. That
 * distinction is what keeps the change additive: a bare edge produces a
 * suggestion with no `figure` field at all, byte-identical to before.
 */
export const edgeFigure = (edge: ChartEdge): Figure | null =>
  isFiguredChord(edge) ? edge.figure : null

/**
 * The bass PITCH CLASS of a realized chord under a figure; `null` when the
 * chord cannot be resolved or does not have the tone the figure asks for.
 *
 * Takes a REALIZED chord name ('C', 'G7'), not a roman — realization is the
 * translator's job and this module deliberately knows nothing about keys.
 *
 * Returns a pitch class without an octave, matching how the rest of the
 * suggestion contract speaks: `ChordSuggestion.notes` is the only field that
 * has ever carried octaves, and which octave the bass lands in is a placement
 * decision owned by `parseChordCsvArg` and `nearestVoicing`.
 *
 * A figure asking for a tone the chord lacks (`'42'` on a triad) yields null
 * rather than a wrong note or a throw; `nearestFiguredVoicing` then degrades to
 * the unfigured behaviour, which is the same "never lose a suggestion you had"
 * policy the rest of this codebase follows.
 */
export const bassOf = (chordName: string, figure: Figure): string | null => {
  const chord = Chord.get(chordName)
  if (chord.empty || chord.notes.length === 0) return null
  // ARITY IS CHECKED, not just index existence. A seventh-chord figure on a
  // triad must fail even when the bass index happens to be in range: '7' maps
  // to index 0, so an index-only check would cheerfully report that C major in
  // root position is a `V7` — a wrong ANALYSIS reported with full confidence,
  // which is worse than the null a caller can handle. Probed: before this
  // check, `bassOf('C', '7')` returned 'C'.
  if (chord.notes.length < figureArity(figure)) return null
  const index = figureBassIndex(figure)
  const note = chord.notes[index]
  if (!note) return null
  return Note.get(note).pc || note
}

/**
 * Whether a figure is arithmetically applicable to a chord: the chord must have
 * as many notes as the figure presupposes.
 *
 * This is a NOTE-COUNT check, not a style check. `{ chord: 'I', figure: '42' }`
 * is rejected because a triad has no seventh to put in the bass. It says
 * nothing about whether the inversion is a good idea — that is B1's business.
 */
export const figureFitsChord = (chordName: string, figure: Figure): boolean => {
  const chord = Chord.get(chordName)
  if (chord.empty) return false
  return chord.notes.length >= figureArity(figure)
}

/**
 * The roman a composer would actually write for a figured chord.
 *
 * The figure is appended, EXCEPT that a seventh-chord figure absorbs a
 * trailing '7' in the roman: `{ chord: 'V7', figure: '65' }` is `V65`, not
 * `V765`. Probed before pinning — naive concatenation produced 'V765' and
 * 'V742', which read as nonsense and would collide with a hypothetical roman
 * for a chord on degree 7. The figures 65/43/42 already SAY seventh chord, so
 * the '7' is redundant as well as ambiguous; this is exactly how the notation
 * works on a page (V⁶₅, never V⁷⁶₅).
 *
 * Root-position figures are dropped entirely: '53' and '7' add nothing to a
 * roman that already spells the chord ('V7' stays 'V7', 'I' stays 'I').
 */
export const figuredRoman = (chord: string, figure: Figure | null): string => {
  if (!figure) return chord
  if (figure === '53' || figure === '7') return chord
  if (figureArity(figure) === 4 && chord.endsWith('7')) {
    return `${chord.slice(0, -1)}${figure}`
  }
  return `${chord}${figure}`
}

/**
 * Every ascending voicing of a chord whose LOWEST NOTE is the one the figure
 * calls for.
 *
 * Built on `ascendingInversions` rather than beside it: the pitch math for
 * enumerating inversions already existed before Stage M-A (V2 in the plan) and
 * this stage is about NAMING and CHOOSING a bass, not about computing pitches.
 * This is the filter that turns "every arrangement" into "the arrangements this
 * figure permits".
 *
 * Returns [] when the figure does not fit the chord or the name is
 * unresolvable, matching `ascendingInversions`' own never-throw contract.
 */
export const figuredVoicings = (
  chordName: string,
  figure: Figure,
  opts?: Parameters<typeof ascendingInversions>[1]
): Voicing[] => {
  const bass = bassOf(chordName, figure)
  if (!bass) return []
  return ascendingInversions(chordName, opts).filter((voicing) => {
    const low = voicing[0]
    if (!low) return false
    return (Note.get(low).pc || low) === bass
  })
}
