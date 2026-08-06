import { Note, Scale } from 'tonal'

/**
 * The conventional key spellings of Western tonal music.
 *
 * WHY THIS IS A HAND-WRITTEN LIST AND NOT A COMPUTED ONE.
 *
 * The obvious way to remove enharmonic duplicates from a scale list is to
 * group by sounding pitch and keep the spelling with the fewest accidentals.
 * That rule is wrong, and measurably so: it discards `C# major` (7 sharps) in
 * favour of `Db major` (5 flats), `A# minor` (7) in favour of `Bb minor` (5),
 * and `Ab minor` (7) in favour of `G# minor` (5). All three of the discarded
 * keys are real, notated, conventional keys with their own key signatures.
 *
 * Which spellings are conventional is a fact about music notation, not a
 * property derivable from counting accidentals, so it is stated here as data.
 * There are exactly 15 major and 15 minor conventional keys — the circle of
 * fifths from 7 flats to 7 sharps, whose ends overlap enharmonically.
 */

/** The 15 conventional major key tonics, in circle-of-fifths order (♭7 → ♯7). */
export const conventionalMajorTonics = [
  'Cb', // 7 flats
  'Gb', // 6 flats
  'Db', // 5 flats
  'Ab', // 4 flats
  'Eb', // 3 flats
  'Bb', // 2 flats
  'F', //  1 flat
  'C', //  0
  'G', //  1 sharp
  'D', //  2 sharps
  'A', //  3 sharps
  'E', //  4 sharps
  'B', //  5 sharps
  'F#', // 6 sharps
  'C#', // 7 sharps
] as const

/** The 15 conventional minor key tonics, in circle-of-fifths order (♭7 → ♯7). */
export const conventionalMinorTonics = [
  'Ab', // 7 flats
  'Eb', // 6 flats
  'Bb', // 5 flats
  'F', //  4 flats
  'C', //  3 flats
  'G', //  2 flats
  'D', //  1 flat
  'A', //  0
  'E', //  1 sharp
  'B', //  2 sharps
  'F#', // 3 sharps
  'C#', // 4 sharps
  'G#', // 5 sharps
  'D#', // 6 sharps
  'A#', // 7 sharps
] as const

/**
 * True when `name` is a conventional key: a tonic from the lists above paired
 * with 'major' or 'minor'. Double-accidental spellings (`Dbb major`, `G##
 * minor`) are spelling artifacts, not keys, and are rejected.
 */
export const isConventionalKeyName = (name: string): boolean => {
  const idx = name.indexOf(' ')
  if (idx === -1) return false
  const tonic = name.slice(0, idx)
  const mode = name.slice(idx + 1)
  if (mode === 'major') {
    return (conventionalMajorTonics as readonly string[]).includes(tonic)
  }
  if (mode === 'minor') {
    return (conventionalMinorTonics as readonly string[]).includes(tonic)
  }
  return false
}

/**
 * The 30 conventional keys as resolved `Scale` objects — the list to build a
 * scale picker from.
 *
 * Ordered major keys first then minor, each around the circle of fifths from
 * 7 flats to 7 sharps, so a dropdown reads in a musically sensible order
 * rather than alphabetically.
 */
export const conventionalKeys = [
  ...conventionalMajorTonics.map((t) => Scale.get(`${t} major`)),
  ...conventionalMinorTonics.map((t) => Scale.get(`${t} minor`)),
]

/** Total accidentals in a scale's spelling; `Db major` -> 5, `C# major` -> 7. */
const accidentalWeight = (notes: string[]) =>
  notes.reduce((n, note) => n + (note.match(/[#b]/g) ?? []).length, 0)

/**
 * Collapse scales that sound identical AND share a mode, keeping one spelling
 * each.
 *
 * The grouping key is (mode, pitch-class set) — NOT the pitch-class set alone.
 * C major and A minor are built from the same seven pitch classes, so grouping
 * by pitches only would merge the relative major and minor into a single
 * entry and silently delete half the keys. The mode has to be part of the key.
 *
 * Preference order within a group:
 *   1. a conventional key spelling, if the group contains one;
 *   2. otherwise the fewest accidentals;
 *   3. ties broken toward the flat spelling, then by input order.
 *
 * Step 3 only ever fires for genuine enharmonic pairs of equal weight —
 * `Gb major`/`F# major` (6 each) and `Eb minor`/`D# minor` (6 each) and their
 * modal equivalents. Both members are conventional there, so the choice is a
 * convention and not a correctness question; flats are preferred to match the
 * flat-leaning spelling the rest of the library produces (see the Neapolitan
 * in `graphh.ts`, which spells `Db major`'s N6 as `Gb Bbb Ebb`).
 */
export const dedupeEnharmonicScales = <T extends { name: string; notes: string[] }>(
  scales: readonly T[]
): T[] => {
  const groups = new Map<string, T[]>()
  for (const scale of scales) {
    const idx = scale.name.indexOf(' ')
    const mode = idx === -1 ? '' : scale.name.slice(idx + 1)
    const pcs = scale.notes
      .map((n) => Note.chroma(n))
      .sort((a, b) => (a ?? 0) - (b ?? 0))
      .join(',')
    const key = `${mode}|${pcs}`
    const group = groups.get(key)
    if (group) group.push(scale)
    else groups.set(key, [scale])
  }

  const out: T[] = []
  for (const group of groups.values()) {
    if (group.length === 1) {
      out.push(group[0])
      continue
    }
    const conventional = group.filter((s) => isConventionalKeyName(s.name))
    const pool = conventional.length > 0 ? conventional : group
    const best = Math.min(...pool.map((s) => accidentalWeight(s.notes)))
    const winners = pool.filter((s) => accidentalWeight(s.notes) === best)
    const flat = winners.find((s) => s.name.slice(0, s.name.indexOf(' ')).includes('b'))
    out.push(flat ?? winners[0])
  }
  return out
}
