import { Chord, Key, Note, Scale } from 'tonal'

import { chordNameWithNotes, detectAllScales } from './graphh'
import { nextChordDetail, type ChordSuggestion } from './nextChord'

/**
 * One key the given chord could hinge into.
 *
 * A pivot chord belongs to both the current key and a target key, so it can be
 * heard in either — restating it as a different scale degree is the classic
 * hinge for modulation.
 */
export type PivotSuggestion = {
  /** full key name, e.g. 'C major' */
  targetKey: string
  /** e.g. 'C' */
  targetTonic: string
  /** 'major' or 'minor' */
  targetScale: string
  /** the chord's function in the target key, e.g. 'IV' or 'VIm' */
  romanThere: string
  /**
   * where this chord can go once you are hearing it in the target key.
   *
   * EMPTY when the chord is diatonic to the target key but is not a node in
   * that key's progression chart — a real and common case (Am is diatonic to
   * D minor but the minor chart has no Vm node, so `nextChordDetail` throws).
   * An empty list means "this pivot is available but the chart has no
   * continuations for it", not "this is a dead end".
   */
  follow: ChordSuggestion[]
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const

/** key names we treat as modulation targets; other modes are filtered out */
const isKeyName = (name: string) =>
  name.endsWith(' major') || name.endsWith(' minor')

/**
 * Pitch classes of a chord, octave-stripped.
 *
 * `chordNameWithNotes` defaults to octave 3 and returns octave-bearing notes
 * ('Am' -> ['A3','C4','E4']). `detectAllScales` does accept those (it sorts by
 * frequency and strips octaves itself), but scale membership is a pitch-class
 * question, so we normalize up front and keep the two concerns separate.
 */
const chordPitchClasses = (chordName: string): string[] => {
  const cnwn = chordNameWithNotes(chordName)
  const notes = cnwn?.notes ?? []
  return notes.map((n) => Note.get(n).pc).filter((pc) => !!pc)
}

/**
 * The chord's roman numeral in the given key.
 *
 * Derivation: locate the chord root among the target scale's notes to get the
 * degree, then suffix the chord's own quality. We build the numeral rather
 * than reverse-mapping `romanChordNameToReal`, because that function's roman
 * vocabulary is triad-only — reverse-mapping finds no roman at all for 'G7'.
 * `Progression.toRomanNumerals` was also rejected: it silently returns
 * quality-only garbage ('m', '', 'dim') when handed a full key name like
 * 'C major' rather than a bare tonic, and it has no minor-key mode.
 *
 * Limits, by construction:
 * - Degree matching prefers exact spelling and falls back to chroma, so an
 *   enharmonically respelled root (Ab in a key spelling it G#) still resolves,
 *   but the numeral reflects the SCALE's spelling, not the chord's.
 * - The numeral is diatonic-degree only. There is no accidental prefix
 *   (bIII/#IV) and no secondary-dominant notation (V7/V): a chord reaches this
 *   function only when every one of its pitch classes is already in the target
 *   scale, so a chromatic degree cannot occur.
 * - Minor keys are labelled from the NATURAL minor scale, which is what
 *   `detectAllScales` matched against. In A minor the subtonic G major is
 *   therefore 'VII' (not 'bVII'); this matches the existing chart's roman
 *   vocabulary in `graphData/minor.ts`, where the chord is likewise 'VII'.
 * - Seventh chords are labelled by type ('V7', 'Imaj7', 'IIm7'); exotic chord
 *   types beyond triads and common sevenths fall back to the bare numeral
 *   plus quality.
 */
export const romanInKey = (
  chordName: string,
  tonic: string,
  scale: string
): string | null => {
  const notes = chordPitchClasses(chordName)
  const rootPc = notes[0]
  if (!rootPc) return null

  const scaleNotes = Scale.get(`${tonic} ${scale}`).notes
  if (scaleNotes.length !== 7) return null

  let idx = scaleNotes.indexOf(rootPc)
  if (idx === -1) {
    const rootChroma = Note.chroma(rootPc)
    idx = scaleNotes.findIndex((n) => Note.chroma(n) === rootChroma)
  }
  if (idx === -1) return null

  const numeral = NUMERALS[idx]
  const chord = Chord.get(chordName)

  let roman: string = numeral
  if (chord.quality === 'Minor') roman = `${numeral}m`
  else if (chord.quality === 'Diminished') roman = `${numeral}dim`
  else if (chord.quality === 'Augmented') roman = `${numeral}aug`

  switch (chord.type) {
    case 'dominant seventh':
      return `${roman}7`
    case 'major seventh':
      return `${roman}maj7`
    case 'minor seventh':
      return `${roman}7`
    case 'half-diminished':
      return `${numeral}7b5`
    default:
      return roman
  }
}

/**
 * How far a key is from the circle-of-fifths origin, as a signed accidental
 * count (C major and A minor are both 0, G major and E minor +1, F major and
 * D minor -1). Relative major/minor pairs share a value, which is what makes
 * this a key-signature distance rather than a tonic distance.
 */
const alterationOf = (tonic: string, scale: string): number =>
  scale === 'major' ? Key.majorKey(tonic).alteration : Key.minorKey(tonic).alteration

/**
 * Continuations for the chord heard in the target key.
 *
 * `nextChordDetail` throws when the chord is not a node in that key's
 * progression chart, which is NOT an error condition here: a chord can be
 * fully diatonic to a key and still be absent from the chart (Am is diatonic
 * to D minor, but the minor chart has no Vm node). We swallow that and return
 * an empty list so one unreachable target cannot sink the whole result.
 */
const followIn = (
  chordName: string,
  targetTonic: string,
  targetScale: string
): ChordSuggestion[] => {
  try {
    return nextChordDetail(`${chordName},3`, targetTonic, targetScale)
  } catch {
    return []
  }
}

/**
 * Keys the chord could hinge into: every major/minor key containing all of its
 * pitch classes, minus the key you are already in.
 *
 * Ordering (fully deterministic, no ties left to input order):
 *   1. accidental distance from the CURRENT key ascending — closely related
 *      keys first, since a one-accidental move is the smoothest modulation and
 *      a six-accidental one is a hard swerve;
 *   2. then keys sharing the current mode (major -> major) before mode
 *      changes, because same-mode targets read as nearer;
 *   3. then major before minor, so the pair at equal distance has a fixed order;
 *   4. then target key name alphabetically, as a final tiebreak.
 *
 * Note that step 1 measures KEY SIGNATURES, so a chord's relative major and
 * minor targets sit at the same distance and step 2/3 separate them.
 *
 * Cost: `detectAllScales` scans every mode x every note name (~0.04 ms per
 * call, measured), so the scan is not the expensive part. Building a graph per
 * candidate key is, but `chordGraphCreate` memoizes into `mem()`, so repeat
 * calls for the same key are free. Expect console.warn noise on first build of
 * each key from the chart's node-merging.
 *
 * @param chordName realized chord name, e.g. 'Am' or 'G7'
 * @param tonic     current key's tonic, e.g. 'A'
 * @param scale     current key's scale, e.g. 'minor'
 */
export const pivotSuggestions = (
  chordName: string,
  tonic: string,
  scale: string
): PivotSuggestion[] => {
  const pitchClasses = chordPitchClasses(chordName)
  if (pitchClasses.length === 0) return []

  const currentKey = `${tonic} ${scale}`
  const currentAlteration = alterationOf(tonic, scale)

  const candidates = detectAllScales(pitchClasses)
    .map((s) => s.name)
    .filter(isKeyName)
    // the current key is not a modulation target
    .filter((name) => name !== currentKey)

  // defensive dedupe: detectAllScales walks a note-name list that includes
  // double accidentals, so a key could in principle be reached twice
  const seen = new Set<string>()

  const suggestions: PivotSuggestion[] = []
  for (const targetKey of candidates) {
    if (seen.has(targetKey)) continue
    seen.add(targetKey)

    const spaceIdx = targetKey.lastIndexOf(' ')
    const targetTonic = targetKey.slice(0, spaceIdx)
    const targetScale = targetKey.slice(spaceIdx + 1)

    const romanThere = romanInKey(chordName, targetTonic, targetScale)
    if (romanThere === null) continue

    suggestions.push({
      targetKey,
      targetTonic,
      targetScale,
      romanThere,
      follow: followIn(chordName, targetTonic, targetScale),
    })
  }

  return suggestions.sort((a, b) => {
    const da = Math.abs(alterationOf(a.targetTonic, a.targetScale) - currentAlteration)
    const db = Math.abs(alterationOf(b.targetTonic, b.targetScale) - currentAlteration)
    if (da !== db) return da - db

    const sameA = a.targetScale === scale ? 0 : 1
    const sameB = b.targetScale === scale ? 0 : 1
    if (sameA !== sameB) return sameA - sameB

    const modeA = a.targetScale === 'major' ? 0 : 1
    const modeB = b.targetScale === 'major' ? 0 : 1
    if (modeA !== modeB) return modeA - modeB

    return a.targetKey.localeCompare(b.targetKey)
  })
}
