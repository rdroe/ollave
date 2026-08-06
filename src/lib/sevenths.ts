import { Scale } from 'tonal'

import { chordNameWithNotes, romanChordNameToReal } from './graphh'
// the shared contract, from its own leaf module — see chordSuggestion.ts's
// header for why naming nextChord here would be a runtime cycle.
import type { ChordSuggestion } from './chordSuggestion'

/**
 * The seventh form of one diatonic degree.
 *
 * `triadRoman` is the roman the CHART uses for the plain triad; `seventhRoman`
 * is the roman for its seventh. Both are stored rather than derived because
 * the mapping is not a string append in every case: the chart writes the minor
 * supertonic of a minor key as 'IIdim', whose idiomatic seventh is the
 * half-diminished 'IIm7b5', not 'IIdim7'.
 */
type SeventhForm = {
  /** the chart's roman for the plain triad, e.g. 'V' or 'IIdim' */
  triadRoman: string
  /** the roman for the seventh chord, e.g. 'V7' or 'IIm7b5' */
  seventhRoman: string
  /** short label for what the seventh does, surfaced in docs and tests */
  note: string
}

/**
 * Diatonic sevenths of a MAJOR key.
 *
 * These pairs are now ALSO nodes in `graphData/major.ts`. This table remains
 * the definition of the triad->seventh RELATION, which the chart does not
 * record: the chart knows `IIm` and `IIm7` as two independent nodes, but only
 * this table knows that one is the other's seventh. `seventhOf` needs exactly
 * that relation, so the table stays. The chart and this table are kept in step
 * by `sevenths.test.ts`, which asserts every roman here is a real chart node.
 *
 * Scope is deliberately the common-practice functional sevenths, not the full
 * jazz set of seven. Included:
 *
 * - `V7` — the dominant seventh. By far the most common seventh in tonal
 *   music; the tritone between 3̂ and 7̂ is what makes the dominant resolve.
 * - `IIm7` — the supertonic seventh, the standard predominant (the ii7-V7-I
 *   chain).
 * - `IVmaj7` — subdominant seventh, a soft colour on a very common chord.
 * - `Imaj7` — tonic seventh. Included because it is the other half of the
 *   Imaj7/IVmaj7 pair that defines the sound; flagged 'dotted' below, since a
 *   tonic seventh is a colour and NOT a stable point of arrival.
 * - `VIIm7b5` — the half-diminished leading-tone seventh. In MAJOR the
 *   leading-tone seventh is half-diminished (B-D-F-A in C), not fully
 *   diminished; the fully-diminished form belongs to minor. Probed and
 *   confirmed: `Chord.get('Bm7b5')` resolves to B D F A.
 *
 * Deliberately EXCLUDED: `IIIm7` and `VIm7`. They are perfectly legal
 * diatonic sevenths, but as mediant and submediant sevenths they carry no
 * distinct functional role — they are colour on chords that are already
 * colour, and including them would push this toward "every triad also has a
 * seventh", which is exactly the suggestion-list bloat this feature is shaped
 * to avoid. A caller who wants them can append the suffix themselves; the
 * translator already resolves 'IIIm7' and 'VIm7' correctly.
 */
const MAJOR_SEVENTHS: SeventhForm[] = [
  { triadRoman: 'I', seventhRoman: 'Imaj7', note: 'tonic seventh (colour, not arrival)' },
  { triadRoman: 'IIm', seventhRoman: 'IIm7', note: 'supertonic seventh, the standard predominant' },
  { triadRoman: 'IV', seventhRoman: 'IVmaj7', note: 'subdominant seventh' },
  { triadRoman: 'V', seventhRoman: 'V7', note: 'dominant seventh' },
  { triadRoman: 'VIIdim', seventhRoman: 'VIIm7b5', note: 'half-diminished leading-tone seventh' },
]

/**
 * Diatonic sevenths of a MINOR key.
 *
 * The set mirrors major, with the qualities minor keys actually use:
 *
 * - `V7` — still the dominant seventh, and still built on the RAISED seventh
 *   degree (E7 in A minor, with G#). This comes free: the chart's `V` is
 *   already the major dominant of harmonic-minor practice.
 * - `IVm7` — minor subdominant seventh.
 * - `Im7` — tonic seventh; as in major, a colour rather than an arrival.
 * - `IIm7b5` — the supertonic in minor is diminished, and its idiomatic
 *   seventh is HALF-diminished (B-D-F-A in A minor), not fully diminished.
 *   This is why the mapping is a table and not a suffix append.
 * - `VIIdim7` — the FULLY-diminished leading-tone seventh (G#-B-D-F in A
 *   minor). This is the characteristic minor-key seventh, and it depends on
 *   the leading-tone rule in `romanChordNameToReal` covering the whole
 *   VII-diminished family.
 *
 * Deliberately EXCLUDED: `IIImaj7`, `VImaj7`, `VII7`. Same reasoning as major
 * — no distinct function — and in minor the subtonic `VII7` in particular
 * risks reading as a secondary dominant of III rather than a diatonic seventh.
 */
const MINOR_SEVENTHS: SeventhForm[] = [
  { triadRoman: 'Im', seventhRoman: 'Im7', note: 'tonic seventh (colour, not arrival)' },
  { triadRoman: 'IIdim', seventhRoman: 'IIm7b5', note: 'half-diminished supertonic seventh' },
  { triadRoman: 'IVm', seventhRoman: 'IVm7', note: 'minor subdominant seventh' },
  { triadRoman: 'V', seventhRoman: 'V7', note: 'dominant seventh (raised 7th degree)' },
  { triadRoman: 'VIIdim', seventhRoman: 'VIIdim7', note: 'fully-diminished leading-tone seventh' },
]

/**
 * Strength assigned to a seventh variant.
 *
 * `V7` is 'strong': adding the seventh to a dominant is the single most
 * ordinary move in tonal harmony, and a caller ranking by strength should see
 * it alongside the chart's own principal motions. Every other seventh is
 * 'dotted' — valid and idiomatic, but a colouring choice rather than a
 * principal motion, which is exactly the distinction `dotted` already carries
 * for the chart's dashed arrows.
 *
 * Note this reuses the EXISTING strength vocabulary rather than adding a
 * 'seventh' member to the union. Widening `ChordSuggestion['strength']` would
 * be a breaking change for every existing consumer's exhaustive switch, and it
 * would say nothing a caller cannot already read off the `roman` field.
 */
const strengthFor = (seventhRoman: string): ChordSuggestion['strength'] =>
  seventhRoman === 'V7' ? 'strong' : 'dotted'

const toSuggestion = (
  form: SeventhForm,
  tonic: string,
  scale: string
): ChordSuggestion | null => {
  const name = romanChordNameToReal(tonic, scale, form.seventhRoman)
  if (!name) return null

  const cnwn = chordNameWithNotes(name)
  // same guard the graph translator and mixture apply: a symbol that resolves
  // to no notes is not a usable suggestion
  if (cnwn === null || cnwn.notes.length === 0) return null

  return {
    name,
    roman: form.seventhRoman,
    notes: cnwn.notes,
    strength: strengthFor(form.seventhRoman),
    // a seventh is available wherever its triad is; it inherits the triad's
    // position in the chart rather than introducing an arrival condition of
    // its own
    enabledBy: null,
  }
}

const formsFor = (tonic: string, scale: string): SeventhForm[] | null => {
  // dispatch on Scale.get().type, not string matching, so aliases work for
  // free ('C ionian' is major, 'A aeolian' is minor) — same rule as the chart
  // instantiation and mixture use.
  const scaleType = Scale.get(`${tonic} ${scale}`).type
  if (scaleType === 'major') return MAJOR_SEVENTHS
  if (scaleType === 'minor') return MINOR_SEVENTHS
  return null
}

/**
 * The idiomatic diatonic sevenths of a key, as a KEY-WIDE palette.
 *
 * These chords are now first-class nodes in the charts, so most callers no
 * longer need this function: `nextChordDetail` already offers the sevenths
 * reachable from the current chord, as dotted edges. This remains exported and
 * supported for the different question it answers — *what sevenths does this
 * KEY have*, independent of where you are standing — which is what a palette
 * or a key-summary UI wants, and which no single node's edges can report.
 *
 * ```ts
 * seventhSuggestions('A', 'minor')  // the key's five, regardless of position
 * nextChordDetail('Am,3', 'A', 'minor')  // the ones reachable from Am
 * ```
 *
 * Into major: Imaj7, IIm7, IVmaj7, V7, VIIm7b5.
 * Into minor: Im7, IIm7b5, IVm7, V7, VIIdim7.
 *
 * `V7` carries `strength: 'strong'`; the rest are `'dotted'`. See
 * `strengthFor`. Note this is the palette's own grading and is deliberately
 * NOT the same as the chart's: in the chart every seventh is reached over a
 * dotted edge, including V7, so that promoting them left `nextChord` output
 * unchanged. Here there is no edge to weigh, only the chord's standing in the
 * key, and the dominant seventh's standing is principal.
 *
 * Modes other than major and minor return `[]` rather than throwing, for the
 * same reason mixture does: this is an optional additive feature, and a caller
 * concatenating it should degrade to "no sevenths offered" rather than lose
 * the suggestions it already had.
 *
 * When passed to `nextChordDetail`'s `include: ['sevenths']`, entries that are
 * already present as graph edges are deduped away — see that option's note.
 */
export const seventhSuggestions = (
  tonic: string,
  scale: string
): ChordSuggestion[] => {
  const forms = formsFor(tonic, scale)
  if (!forms) return []

  return forms
    .map((f) => toSuggestion(f, tonic, scale))
    .filter((s): s is ChordSuggestion => s !== null)
}

/**
 * The seventh form of ONE chord, if this key offers a canonical one.
 *
 * Where `seventhSuggestions` answers "what sevenths does this key have",
 * this answers "the chord I am on — can it take a seventh?", which is the
 * question a caller sitting on a chord actually has. Returns `null` when the
 * chord has no idiomatic seventh in the scope above (see the exclusions in
 * `MAJOR_SEVENTHS` / `MINOR_SEVENTHS`).
 *
 * This is the one thing the chart cannot answer on its own. The chart holds
 * `Dm` and `Dm7` as separate nodes with no recorded link between them; the
 * triad->seventh pairing lives only in the tables above. So this function
 * stays table-driven by design rather than by inertia.
 *
 * Matching is by REALIZED CHORD NAME, not by roman, so a caller can pass what
 * it is holding ('E', 'Bdim') without knowing the chord's function:
 *
 * ```ts
 * seventhOf('E', 'A', 'minor')     // E7,  roman 'V7',      strong
 * seventhOf('Bdim', 'A', 'minor')  // Bm7b5, roman 'IIm7b5', dotted
 * seventhOf('F', 'A', 'minor')     // null — VI has no seventh in scope
 * ```
 *
 * Chord-function names (`V64`, `N6`, `Aug6`) never match: they are defined by
 * voicing and role, and stacking a seventh on them is not a meaningful
 * operation in this vocabulary.
 */
export const seventhOf = (
  chordName: string,
  tonic: string,
  scale: string
): ChordSuggestion | null => {
  const forms = formsFor(tonic, scale)
  if (!forms) return null

  const match = forms.find(
    (f) => romanChordNameToReal(tonic, scale, f.triadRoman) === chordName
  )
  if (!match) return null

  return toSuggestion(match, tonic, scale)
}
