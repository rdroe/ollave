import { Chord, Note } from 'tonal'

// direct imports (not via the lib barrel) to avoid module-init cycles and
// browser-only side effects — cf. importHygiene.test.ts
import { lookUpGraph } from './util/graphUtil'

// the shared contract, imported from its own leaf module rather than from
// nextChord.ts: nextChord imports THIS file at runtime for its rankBy option,
// and barsUtil (which nextChord also imports) imports it too, so naming
// nextChord here — even type-only — would put a cycle one refactor away.
import type { ChordSuggestion } from './chordSuggestion'

// letter -> semitone within an octave
const PITCH_CLASS: { [letter: string]: number } = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
}

/**
 * Midi-ish comparable number for a note name; NaN when unparseable.
 *
 * DUPLICATED from barTemplates/compile.ts (which exports an identical
 * `pitchHeight`) rather than imported. Importing it would close a module
 * cycle: compile.ts imports `parseChordCsvArg` from util/barsUtil, and
 * barsUtil now imports this module for opt-in smooth voicing. That is the
 * same class of init-order landmine fixed in e302ee7, and compile.ts is not
 * this stream's to edit. The function is a self-contained ten lines with no
 * dependencies, so the copy is cheap and cannot drift semantically.
 */
const pitchHeight = (noteName: string): number => {
  const m = /^([a-g])([#b]*)(-?\d+)$/i.exec(noteName.trim())
  if (!m) {
    return NaN
  }
  let pc = PITCH_CLASS[m[1].toLowerCase()]
  for (const acc of m[2]) {
    pc += acc === '#' ? 1 : -1
  }
  return (parseInt(m[3], 10) + 1) * 12 + pc
}

/**
 * Voice-leading engine.
 *
 * Deliberately built ALONGSIDE `noteInversions` in graphh.ts, not on top of
 * it: that function returns raw pitch-class ROTATIONS, not playable voicings
 * (`noteInversions('Am')` → [[A3,C4,E4], [C4,E4,A3], [E4,A3,C4]] — the 2nd
 * and 3rd are non-ascending, so A3 sounds BELOW the E4 that precedes it in
 * the array). Semitone math over those arrays would be nonsense.
 * `noteInversions` is public API with pinned tests, so it stays untouched.
 */

/** A voicing: concrete note names with octaves, sorted low → high. */
export type Voicing = string[]

export type AscendingInversionsOptions = {
  /** lowest octave a voicing may start on (inclusive). Default 2. */
  minOctave?: number
  /** highest octave a voicing may start on (inclusive). Default 5. */
  maxOctave?: number
}

const DEFAULT_MIN_OCTAVE = 2
const DEFAULT_MAX_OCTAVE = 5

/**
 * Pitch classes of a chord name. Plain chord names resolve through tonal;
 * chord-FUNCTION names (V64, Aug6, N6) are empty in tonal and only exist in a
 * built graph, where `translatedSource.notes` holds their (octave-less)
 * pitch classes. `scale` lets callers reach those.
 */
const chordPitchClasses = (
  chordName: string,
  scale?: { tonic: string; name: string }
): string[] => {
  const chord = Chord.get(chordName)
  if (!chord.empty && chord.notes.length > 0) return chord.notes

  if (scale) {
    const graph = lookUpGraph(scale.tonic, scale.name)
    const notes = graph?.[chordName]?.translatedSource?.notes
    if (notes && notes.length > 0) {
      // graph notes may or may not carry octaves; reduce to pitch classes
      return notes.map((n) => Note.get(n).pc || n)
    }
  }

  return []
}

/**
 * TRUE ascending voicings of a chord: every returned voicing is strictly
 * ascending in pitch.
 *
 * For each inversion (rotation of the chord's pitch classes) and each
 * starting octave in the range, octaves are assigned left-to-right, bumping
 * up whenever the next pitch class would not clear the previous note. So the
 * 2nd inversion of Am starting at octave 3 is C4-E4-A4, not the raw rotation
 * C4-E4-A3.
 *
 * Returns [] for unresolvable names rather than throwing — callers rank over
 * suggestion lists where one odd name should not sink the batch.
 */
export const ascendingInversions = (
  chordName: string,
  opts?: AscendingInversionsOptions & { scale?: { tonic: string; name: string } }
): Voicing[] => {
  const pcs = chordPitchClasses(chordName, opts?.scale)
  if (pcs.length === 0) return []

  const minOctave = opts?.minOctave ?? DEFAULT_MIN_OCTAVE
  const maxOctave = opts?.maxOctave ?? DEFAULT_MAX_OCTAVE

  const voicings: Voicing[] = []
  const seen = new Set<string>()

  for (let startOct = minOctave; startOct <= maxOctave; startOct++) {
    for (let rot = 0; rot < pcs.length; rot++) {
      const rotated = [...pcs.slice(rot), ...pcs.slice(0, rot)]
      const voicing: string[] = []
      let previousHeight = -Infinity
      let octave = startOct
      let ok = true

      for (const pc of rotated) {
        let height = pitchHeight(`${pc}${octave}`)
        if (Number.isNaN(height)) {
          ok = false
          break
        }
        // climb until this note clears the one below it
        let guard = 0
        while (height <= previousHeight && guard < 12) {
          octave += 1
          height = pitchHeight(`${pc}${octave}`)
          guard += 1
        }
        if (height <= previousHeight) {
          ok = false
          break
        }
        voicing.push(`${pc}${octave}`)
        previousHeight = height
      }

      if (!ok || voicing.length !== pcs.length) continue
      const key = voicing.join(' ')
      if (seen.has(key)) continue
      seen.add(key)
      voicings.push(voicing)
    }
  }

  return voicings
}

/**
 * Total semitone motion between two voicings.
 *
 * ALGORITHM (unequal cardinalities): a symmetric nearest-note mapping. Every
 * note in `from` is charged the distance to its nearest note in `to`, and
 * every note in `to` is charged the distance to its nearest note in `from`;
 * the two sums are added.
 *
 * Why this and not a strict one-to-one assignment (Hungarian): voicings here
 * routinely differ in size (triad → seventh chord), so a bijection does not
 * exist and padding choices would be arbitrary. The symmetric form has the
 * properties ranking actually needs — it is 0 exactly when the two voicings
 * are the same pitch set, it is symmetric, and it charges BOTH abandoning a
 * voice and introducing one. A one-directional sum would let a 4-note target
 * hide an unreachable new note for free, and would make identity distance
 * depend on which side had more notes.
 */
export const voicingDistance = (from: Voicing, to: Voicing): number => {
  const a = from.map(pitchHeight).filter((h) => !Number.isNaN(h))
  const b = to.map(pitchHeight).filter((h) => !Number.isNaN(h))
  if (a.length === 0 || b.length === 0) return Infinity

  const forward = a.reduce(
    (sum, x) => sum + Math.min(...b.map((y) => Math.abs(x - y))),
    0
  )
  const backward = b.reduce(
    (sum, y) => sum + Math.min(...a.map((x) => Math.abs(x - y))),
    0
  )
  return forward + backward
}

export type NearestVoicing = {
  distance: number
  voicing: Voicing
}

/**
 * The candidate voicing of `toChordName` reachable with the least total
 * motion from `fromVoicing`, with that distance.
 *
 * Ties break toward the earliest candidate, i.e. the lowest starting octave
 * and then root position — a stable, reproducible choice.
 * `{ distance: Infinity, voicing: [] }` when the target cannot be resolved.
 */
export const nearestVoicing = (
  fromVoicing: Voicing,
  toChordName: string,
  opts?: AscendingInversionsOptions & { scale?: { tonic: string; name: string } }
): NearestVoicing => {
  const candidates = ascendingInversions(toChordName, opts)
  if (candidates.length === 0) return { distance: Infinity, voicing: [] }

  let best = candidates[0]
  let bestDistance = voicingDistance(fromVoicing, best)
  for (let i = 1; i < candidates.length; i++) {
    const d = voicingDistance(fromVoicing, candidates[i])
    if (d < bestDistance) {
      bestDistance = d
      best = candidates[i]
    }
  }
  return { distance: bestDistance, voicing: best }
}

/** Minimal total semitone motion from a voicing to the nearest voicing of a chord. */
export const voiceLeadingDistance = (
  fromVoicing: Voicing,
  toChordName: string,
  opts?: AscendingInversionsOptions & { scale?: { tonic: string; name: string } }
): number => nearestVoicing(fromVoicing, toChordName, opts).distance

export type RankedSuggestion = ChordSuggestion & {
  /** total semitone motion to `suggestedVoicing`; Infinity if unresolvable */
  distance: number
  /** the candidate voicing that achieved `distance`; [] if unresolvable */
  suggestedVoicing: Voicing
}

/**
 * Rank suggestions by how smoothly each is reached from `fromVoicing`.
 *
 * A PURE function over the Stage-A `ChordSuggestion[]` contract — it does not
 * touch `nextChordDetail`, which is what keeps this stream composable with
 * the other feature streams. Input is never mutated; copies are returned.
 *
 * SORT PRECEDENCE:
 *   1. `contextMatch` true first — but ONLY when the field is present on the
 *      suggestions (i.e. the caller passed `opts.prev`). Harmonic context is
 *      a stronger signal than voice leading: a smooth move to a chord that
 *      does not belong after the previous one is still the wrong chord.
 *      When no suggestion carries the field, this key is inert.
 *   2. ascending `distance`.
 *   3. original input order (stable), preserving nextChordDetail's ordering
 *      for exact ties.
 */
export const rankByVoiceLeading = (
  suggestions: ChordSuggestion[],
  fromVoicing: Voicing,
  opts?: AscendingInversionsOptions & { scale?: { tonic: string; name: string } }
): RankedSuggestion[] => {
  const ranked: RankedSuggestion[] = suggestions.map((sug) => {
    // A suggestion already carries realized notes from the graph. Prefer
    // resolving candidates from its name, but fall back to ranking its own
    // notes as the single candidate when the name is unresolvable (chord
    // functions outside a built graph).
    const byName = nearestVoicing(fromVoicing, sug.name, opts)
    if (byName.voicing.length > 0) {
      return { ...sug, distance: byName.distance, suggestedVoicing: byName.voicing }
    }
    const own = [...sug.notes].sort((a, b) => pitchHeight(a) - pitchHeight(b))
    return {
      ...sug,
      distance: own.length > 0 ? voicingDistance(fromVoicing, own) : Infinity,
      suggestedVoicing: own,
    }
  })

  const hasContext = ranked.some((s) => s.contextMatch !== undefined)

  return ranked
    .map((sug, index) => ({ sug, index }))
    .sort((left, right) => {
      if (hasContext) {
        const l = left.sug.contextMatch === true ? 0 : 1
        const r = right.sug.contextMatch === true ? 0 : 1
        if (l !== r) return l - r
      }
      if (left.sug.distance !== right.sug.distance) {
        return left.sug.distance - right.sug.distance
      }
      return left.index - right.index
    })
    .map(({ sug }) => sug)
}
