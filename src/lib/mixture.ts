import { Note, Scale } from 'tonal'

import { chordNameWithNotes } from './graphh'
// the shared contract, from its own leaf module — nextChord.ts imports THIS
// file at runtime for its `include: ['mixture']` option, so naming nextChord
// here would be a cycle. See chordSuggestion.ts's header.
import type { ChordSuggestion } from './chordSuggestion'

/**
 * `ChordSuggestion['strength']`.
 *
 * This alias predates the base union carrying 'mixture' directly. It was
 * originally written as a DERIVED type (`ChordSuggestion['strength'] |
 * 'mixture'`) precisely so that widening the base union would collapse it to
 * an exact alias with no churn — which is what has now happened. It is kept
 * rather than deleted because both it and `MixtureSuggestion` are exported
 * public API, and removing them would break external importers for no gain.
 *
 * @deprecated Use `ChordSuggestion['strength']`; this is now the same type.
 */
export type MixtureStrength = ChordSuggestion['strength']

/**
 * A borrowed-chord suggestion.
 *
 * Now structurally identical to `ChordSuggestion` (the base union carries
 * 'mixture'), and kept as documentation of intent at the call site.
 *
 * @deprecated Use `ChordSuggestion`; this is now the same type.
 */
export type MixtureSuggestion = ChordSuggestion

/**
 * A borrowed chord, described relative to the tonic.
 *
 * `interval` is transposed from the tonic to get the root. Roots are ALWAYS
 * derived by interval transposition, never by scale-degree lookup: degree
 * lookup double-flattens in minor keys (flattening an already-flat sixth), the
 * bug class that produced a wrong `Aug6` earlier. Interval transposition
 * spells correctly even where that means a double flat — bVI of Db major is
 * genuinely Bbb, and it round-trips through `Chord.get` with real notes.
 */
type BorrowedChord = {
  /** interval from the tonic to this chord's root */
  interval: string
  /** chord-symbol suffix appended to the realized root ('' = major triad) */
  suffix: string
  /**
   * Roman label. Casing convention: case encodes quality — uppercase for major
   * triads (bIII, bVI, bVII, IV), lowercase for minor (iv), lowercase plus the
   * degree symbol for diminished (ii°). A leading 'b' marks a root lowered
   * relative to the *major* scale. This is standard mixture notation and is
   * deliberately distinct from the source chart's own scheme (which is
   * uppercase-with-suffix: 'IVm', 'IIdim'), because these suggestions describe
   * chords borrowed from OUTSIDE the current key's chart.
   */
  roman: string
}

/** borrowed from the parallel minor into a major key */
const INTO_MAJOR: BorrowedChord[] = [
  // minor subdominant — the classic 'minor iv' cadence
  { interval: '4P', suffix: 'm', roman: 'iv' },
  // half-diminished supertonic; spelled as a plain diminished triad to match
  // the chart's triadic vocabulary ('Bdim' etc.)
  { interval: '2M', suffix: 'dim', roman: 'ii°' },
  { interval: '3m', suffix: '', roman: 'bIII' },
  { interval: '6m', suffix: '', roman: 'bVI' },
  { interval: '7m', suffix: '', roman: 'bVII' },
]

/**
 * Borrowed from the parallel major / dorian into a minor key.
 *
 * Only the dorian raised sixth (major IV). The Picardy third (major I) is NOT
 * listed here: it already exists in the minor chart as a dotted edge from V
 * (`graphData/minor.ts`, the `V` node carries `dotted: ['I'] // Picardy
 * third`), so `nextChordDetail('E', 'A', 'minor')` already returns `A` with
 * roman 'I'. Emitting it again would duplicate a suggestion the caller
 * already has when the two lists are concatenated.
 */
const INTO_MINOR: BorrowedChord[] = [
  { interval: '4P', suffix: '', roman: 'IV' },
]

const toSuggestion = (borrowed: BorrowedChord, tonic: string): MixtureSuggestion | null => {
  const root = Note.transpose(tonic, borrowed.interval)
  if (!root) return null

  const name = `${root}${borrowed.suffix}`
  const cnwn = chordNameWithNotes(name)

  // same guard the graph translator applies: a symbol that resolves to no
  // notes is not a usable suggestion
  if (cnwn === null || cnwn.notes.length === 0) return null

  return {
    name,
    roman: borrowed.roman,
    notes: cnwn.notes,
    strength: 'mixture',
    // borrowed chords are an opt-in palette, available at any point
    enabledBy: null,
  }
}

/**
 * Borrowed chords (modal mixture) for a key: an additive palette a composer
 * can opt into.
 *
 * This does NOT consult the chord graph and does not depend on a current
 * chord — mixture is a property of the key, not of a position in a
 * progression. Callers concat it with `nextChordDetail` output:
 *
 * ```ts
 * const all = [
 *   ...nextChordDetail('Am,3', 'A', 'minor'),
 *   ...mixtureSuggestions('A', 'minor'),
 * ]
 * ```
 *
 * Into major: iv, ii°, bIII, bVI, bVII (borrowed from the parallel minor).
 * Into minor: IV (the dorian raised sixth).
 *
 * Mode dispatch is keyed on `Scale.get(...).type` rather than string matching,
 * so aliases work for free ('C ionian' dispatches as major, 'A aeolian' as
 * minor). Modes other than major and minor have no defined mixture palette
 * here and return `[]` — an empty palette, not an error, because this is an
 * optional additive feature and a caller concatenating it should degrade to
 * "no borrowed chords offered" rather than throw and lose the graph
 * suggestions it already has.
 */
export const mixtureSuggestions = (
  tonic: string,
  scale: string
): MixtureSuggestion[] => {
  const scaleType = Scale.get(`${tonic} ${scale}`).type

  const borrowed =
    scaleType === 'major'
      ? INTO_MAJOR
      : scaleType === 'minor'
        ? INTO_MINOR
        : null

  if (!borrowed) return []

  return borrowed
    .map((b) => toSuggestion(b, tonic))
    .filter((s): s is MixtureSuggestion => s !== null)
}
