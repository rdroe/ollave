import fakeCli from 'peprn/fakeCli'
import { Chord, Note, Mode, Scale, Collection } from 'tonal'

import { bassOf, edgeChord, edgeFigure, figuredRoman } from './figuredBass'
import { minor } from './graphData/minor'
import type { ChartEdge, Figure, ProgressionGraphNode } from './graphData/types'
import { dedupeEnharmonicScales } from './scaleList'

// chart data lives in ./graphData (a sibling major.ts can be dropped in);
// re-exported here because `minor` is public API via the lib barrel
export { minor }
export type {
  ChartEdge,
  Figure,
  FiguredChord,
  HarmonicSpan,
  LineCondition,
  MetricCondition,
  ProgressionChart,
  ProgressionGraphNode,
  RuleWaiver,
  SpanConditions,
  SpanKind,
} from './graphData/types'
// re-exported because the curated scale list is public API via the lib barrel
export {
  conventionalKeys,
  conventionalMajorTonics,
  conventionalMinorTonics,
  dedupeEnharmonicScales,
  isConventionalKeyName,
} from './scaleList'

export const sharpNoteNames = [
  'C#',
  'C##',
  'D#',
  'D##',
  'F#',
  'F##',
  'G#',
  'G##',
  'A#',
  'A##',
]
export const noteNames = [
  'C',
  'Db',
  'Dbb',
  'D',
  'Eb',
  'Ebb',
  'E',
  'F',
  'Gb',
  'Gbb',
  'G',
  'Ab',
  'Abb',
  'A',
  'Bb',
  'Bbb',
  'B',
].concat(sharpNoteNames)

const allModes = Mode.all()

/**
 * Every note name crossed with every mode — 189 entries.
 *
 * This list contains enharmonic duplicates by construction, because
 * `noteNames` contains double accidentals: `Dbb major` is C major spelled
 * unplayably, `F## major` is G major, and so on. 84 of the 189 entries are
 * such artifacts.
 *
 * It is kept unfiltered for backward compatibility — it is public API, callers
 * may hold stored names that resolve against it, and `isScaleName` /
 * `properScaleName` search it. **For anything user-facing (a scale picker, a
 * key dropdown) prefer `conventionalKeys`**, which is the 30 real keys.
 */
export const allScales = allModes
  .map((m) => {
    const scales = noteNames.map((nn) => `${nn} ${m.name}`)
    const scaleObjs = scales.map((scName) => Scale.get(scName))
    return scaleObjs
  })
  .flat()

/**
 * `allScales` with enharmonic duplicates collapsed — 105 entries, one spelling
 * per (mode, sounding pitch set). Conventional key spellings win; see
 * `./scaleList`.
 */
export const distinctScales = dedupeEnharmonicScales(allScales)

const inScale = (notes: string[], scale: { notes: string[] }) => {
  // pitch-class membership; the previous ascending-index requirement wrongly
  // rejected scales whose rotation put the notes "out of order" (e.g. C-E-G
  // was reported as not in D dorian)
  if (notes.length === 0) return false
  return notes.every((note) => scale.notes.includes(note))
}

/** enharmonic membership: same sounding pitch, any spelling */
const inScaleByChroma = (notes: string[], scale: { notes: string[] }) => {
  if (notes.length === 0) return false
  const scaleChromas = scale.notes.map((n) => Note.chroma(n))
  return notes.every((note) => {
    const c = Note.chroma(note)
    return c !== undefined && scaleChromas.includes(c)
  })
}

/**
 * Every scale in `allScales` containing all of the given notes.
 *
 * MATCHING IS BY NOTE NAME, with an enharmonic fallback.
 *
 * Name matching is the primary rule and is what callers should rely on: it
 * keeps spelling meaningful, so a C-E-G triad reports the six keys that
 * genuinely contain it (C/F/G major, D/E/A minor) and nothing else. Because
 * `allScales` is built over a note-name list that includes double accidentals,
 * matching by pitch instead would report `Dbb major`, `F## major` and
 * `G## minor` for that same triad — 15 "keys" where 6 are meaningful. Those
 * are legitimate spellings of the same pitches, but they are not answers any
 * caller wants, and pivot discovery in particular would drown in them.
 *
 * The fallback exists because strict name matching has one genuinely useless
 * outcome: a mis-spelled input finds NO home at all. `['C#','F','G#']` is an
 * audible C# major triad written with the third spelled F instead of E#, and
 * name matching returns an empty array — no key in the universe contains the
 * literal name 'F' alongside 'C#' and 'G#'. So when, and only when, the
 * name-based pass finds nothing, we retry by chroma. A caller with correctly
 * spelled input never reaches the fallback and sees byte-identical results to
 * before; a caller with mis-spelled input gets the enharmonic answer set
 * instead of silence.
 *
 * C1-followup: this deliberately scans `allScales`, NOT the deduped
 * `distinctScales`, and the fallback stays. Deduping made the *picker* problem
 * go away but cannot serve detection: a deduped list holds only one spelling
 * per sounding scale, so `C# major` is absent (it loses its group to
 * `Db major`), and detecting the correctly-spelled triad C#-E#-G# against it
 * returns `B lydian` alone — the key the chord is actually in has been
 * deleted. Faithful name matching needs every spelling present, so the full
 * list is the right input here even though it is the wrong list for a UI.
 */
export const detectAllScales = (notes: string[]) => {
  if (notes.length === 0) return []
  let sorted: string[]
  if (Note.get(notes[0]).oct !== undefined) {
    const sortMe = notes.concat()
    sortMe.sort((ntA, ntB) => {
      const ntDataA = Note.get(ntA)
      const ntDataB = Note.get(ntB)
      return (ntDataA.freq ?? 0) - (ntDataB.freq ?? 0)
    })

    sorted = sortMe.map((nt) => {
      return Note.get(nt).pc
    })
  } else {
    sorted = notes
  }
  const byName = allScales.filter((sc) => inScale(sorted, sc))
  if (byName.length > 0) return byName

  return allScales.filter((sc) => inScaleByChroma(sorted, sc))
}

export type ChordNameWithNotes = {
  name: string
  notes: string[]
  octMap?: (notes: string[], oct: number) => string[]
}

export type EnabledChordNameWithNotes = ChordNameWithNotes & {
  enabler: string[] | null
  // the edge's ORIGINAL roman, which is not always the target node's own
  // roman: in A minor Dm's dotted edge to Bdim is Bdim-as-VIIdim/III, while
  // the Bdim node's own identity is IIdim (the two romans realize to the same
  // chord and are merged). Keeping the edge's roman preserves that distinction.
  //
  // For a FIGURED edge this carries the figured roman ('I6', 'V65'), because
  // `roman` has always meant "how this edge is spelled" rather than "which node
  // this is". The node's `name` stays the plain chord symbol — see below.
  roman: string
  // Stage M-A (A1). Present ONLY on figured edges; a bare-string edge produces
  // neither field and is byte-identical to before this existed.
  //
  // `name` deliberately stays the plain triad/seventh symbol ('C', not 'C/E'):
  // it is the graph's key and is looked up by name in half a dozen places
  // (graph indexing, nearestVoicing, the sevenths dedupe in nextChordDetail,
  // randomProgression's self-loop check). Putting the bass in the name would
  // break every one of them.
  figure?: Figure
  /** realized bass PITCH CLASS, e.g. 'E' — no octave; see figuredBass.bassOf */
  bass?: string
}

export const N6 = function N6(
  tonic: string,
  // kept for signature parity with the other chord functions in `fns`, which
  // are all dispatched as (tonic, scale); the Neapolitan root is now derived
  // from the tonic alone and is the same in either mode.
  _scaleName?: string
): ChordNameWithNotes[] {
  // Root = the LOWERED SECOND DEGREE, derived by transposing a minor second up
  // from the tonic rather than by flattening the scale's own second degree.
  //
  // The previous form (`Note.simplify(deg2 + 'b')`) respelled enharmonically in
  // flat keys: in Eb major it flattened F to Fb and then simplified that to E,
  // producing the N6 as E-G#-B instead of Fb-Ab-Cb. Pitch-correct but written
  // in a key signature the piece is not in. `Note.transpose(tonic, '2m')` is
  // spelling-exact and produces double flats where they genuinely belong
  // (Db major -> Ebb-Gb-Bbb), which `chordNameWithNotes` resolves without
  // trouble. In every key whose lowered second is already a single accidental
  // (C, A minor, G, F# ...) this is byte-identical to the old result.
  const neoRoot = Note.transpose(tonic, '2m')
  const notes = ['1P', '3M', '5P'].map(Note.transposeFrom(neoRoot))
  if (Note.octave(notes[0]) !== undefined) {
    throw new Error(`Neapolitan chord ${notes} has octave`)
  }
  return [
    {
      name: 'N6',
      notes: Collection.rotate(1, notes),
      octMap: (notes, oct) => notes.map((nt) => `${nt}${oct}`),
    },
  ]
}

export const V64 = function V64(
  tonic: string,
  scaleName: string = 'minor'
): ChordNameWithNotes[] {
  // Cadential 6/4: the tonic triad with the fifth scale degree (the dominant)
  // in the bass — degrees 5, 1, 3 (e.g. E-A-C in A minor). The previous
  // version rotated the dominant triad, which produced a first-inversion V
  // (G#-B-E in A minor) instead.
  const degrees = Scale.degrees(`${tonic} ${scaleName}`)
  const notes = [degrees(5), degrees(1), degrees(3)]
  if (Note.octave(notes[0]) !== undefined) {
    throw new Error(`V64 chord ${notes} has octave`)
  }
  return [
    {
      name: 'V64',
      notes,
      octMap: (notes, oct) => notes.map((nt) => `${nt}${oct}`),
    },
  ]
}

/**
 * The three notes every augmented sixth chord is built on: ♭6 – 1 – ♯4.
 *
 * MEASURED AS ABSOLUTE INTERVALS FROM THE TONIC, never by scale-degree lookup.
 * This is the bug class that has bitten this codebase repeatedly: in minor the
 * sixth degree is *already* lowered, so flattening "the scale's sixth degree"
 * lowers it a second time and produces E natural in A minor where F is wanted.
 * Interval transposition is spelling-exact in every key and produces double
 * flats exactly where they genuinely belong — probed across all fifteen tonics
 * before this was written:
 *
 *   C  -> Ab C F#      A  -> F A D#      F# -> D F# B#
 *   Eb -> Cb Eb A      Db -> Bbb Db G    Gb -> Ebb Gb C
 *   Cb -> Abb Cb F     D# -> B D# G##    A# -> F# A# D##
 *
 * The interval from ♭6 to ♯4 is an AUGMENTED SIXTH (`6A`, ten semitones), which
 * is what the family is named for and what it must never be respelled as. The
 * two outer voices expand outward by half step onto the dominant.
 */
const aug6Frame = (tonic: string) => ({
  flatSix: Note.transpose(tonic, 'm6'),
  one: tonic,
  sharpFour: Note.transpose(tonic, 'A4'),
})

/**
 * Shared constructor for the augmented-sixth family.
 *
 * `extra` is the interval from the tonic to the ONE note that distinguishes
 * this member from the three-note Italian prototype, or `null` for the Italian
 * itself. It is inserted between 1 and ♯4, which is where it sits in the
 * conventional close-position spelling (♭6 in the bass, ♯4 on top, so that the
 * augmented sixth is between the outer voices of the chord itself).
 */
const makeAug6 = (
  name: string,
  tonic: string,
  extra: string | null
): ChordNameWithNotes[] => {
  const { flatSix, one, sharpFour } = aug6Frame(tonic)
  const middle = extra === null ? [] : [Note.transpose(tonic, extra)]
  const notes = [flatSix, one, ...middle, sharpFour]

  if (notes.some((nt) => Note.octave(nt) !== undefined)) {
    throw new Error(`${name} chord ${notes} has octave`)
  }

  return [
    {
      name,
      notes,
      octMap: (notes, oct) => notes.map((nt) => `${nt}${oct}`),
    },
  ]
}

/**
 * Italian augmented sixth: ♭6 – 1 – ♯4. The three-note prototype.
 *
 * In A minor `F–A–D♯`; in C `Ab–C–F#`. Intervals from the bass are `1P 3M 6A`.
 * With only three notes, the doubled tone in a four-voice realization is
 * conventionally scale degree 1 — the one note that is neither half of the
 * augmented sixth and so is free to double without creating parallels when the
 * outer voices expand.
 *
 * NOT A TERTIAN CHORD. There is no fifth and the top interval is an augmented
 * sixth rather than a stacked third, so it has no root to invert and FIGURES DO
 * NOT APPLY TO IT — see the `Aug6` alias note below and docs/chord-theory.md §4.
 */
export const It6 = function It6(
  tonic: string,
  _scaleName?: string
): ChordNameWithNotes[] {
  return makeAug6('It6', tonic, null)
}

/**
 * French augmented sixth: ♭6 – 1 – 2 – ♯4.
 *
 * In A minor `F–A–B–D♯`; in C `Ab–C–D–F#`. Intervals from the bass are
 * `1P 3M 4A 6A`. The added note is scale degree 2, a MAJOR SECOND above the
 * tonic — which makes the chord whole-tone in content and gives it the
 * characteristically hollow, unsettled colour that distinguishes it by ear from
 * the German. `Chord.detect` calls it `Ab7b5` (or the tritone-substitute
 * rotation `D7b5/Ab`), which is again the wrong analysis for the same reason
 * the Italian's is: it respells ♯4 as a flat seventh.
 */
export const Fr6 = function Fr6(
  tonic: string,
  _scaleName?: string
): ChordNameWithNotes[] {
  return makeAug6('Fr6', tonic, 'M2')
}

/**
 * German augmented sixth: ♭6 – 1 – ♭3 – ♯4.
 *
 * In A minor `F–A–C–D♯`; in C `Ab–C–Eb–F#`. Intervals from the bass are
 * `1P 3M 5P 6A` — it has a perfect fifth, which the other two do not, and that
 * is exactly why it is ENHARMONICALLY A DOMINANT SEVENTH: respell ♯4 as ♭7 and
 * `Ab–C–Eb–F#` becomes `Ab7`, the dominant of D♭. That reinterpretation is a
 * modulation pivot, and is exported as data by `chromatic.ts`'s
 * `enharmonicPivots` — the chord that sounds like V⁷ of the Neapolitan key.
 *
 * The added note is ♭3 measured from the TONIC (a minor third), not the mode's
 * third degree: in a major key it is the borrowed lowered third, which is what
 * makes the German usable in major at all.
 *
 * Because of the fifth, a German sixth moving directly to a root-position V
 * produces parallel fifths; the idiomatic resolution goes through the cadential
 * ⁶₄ instead, which is why its strong edge to `V64` matters more than the other
 * two members'.
 */
export const Ger6 = function Ger6(
  tonic: string,
  _scaleName?: string
): ChordNameWithNotes[] {
  return makeAug6('Ger6', tonic, 'm3')
}

/**
 * `Aug6` — the generic augmented sixth, kept as a WORKING DOCUMENTED ALIAS.
 *
 * ALIASED TO THE ITALIAN (`It6`), which makes this split PURELY ADDITIVE:
 * `Aug6` returns exactly the notes it always returned, in every key.
 *
 * The choice was between the Italian (the three-note prototype every member is
 * built on) and the German (by far the most common in practice, and the only
 * member with the enharmonic V⁷ reinterpretation). The German is the better
 * answer to "which one did the composer mean?", and it was the initial choice
 * here — but it is the wrong answer to the question that actually governs,
 * which is what `Aug6` ALREADY MEANS in this codebase:
 *
 *   - **`Aug6` is a live user-facing input.** `isChordCsvArg('Aug6,3')` is
 *     true, it passes `isDyna`, and the name appears in SAVED SONGS. Aliasing
 *     the German would silently change three notes into four in songs already
 *     on disk — the same chord in the file sounding different after an upgrade.
 *   - **The existing behaviour is pinned as a regression guard**, not
 *     incidentally: `graphh.test.ts` asserts `Aug6('A','minor')` is `F-A-D#`
 *     precisely because an earlier version double-flattened minor's already
 *     lowered sixth. That test is guarding a real bug that was fixed once, and
 *     it should not have to be rewritten to accommodate an alias decision.
 *   - **The Italian IS the prototype.** ♭6-1-♯4 is the frame all three share;
 *     the French and German each add exactly one note to it. So the generic
 *     name denoting the generic content is also the honest reading.
 *
 * A caller who wants the German — including its V⁷ reinterpretation — names
 * `Ger6`, which is now available and was not before. Nothing is lost and
 * nothing changes underfoot.
 *
 * The name is NOT rewritten to `It6` in the result: a caller round-tripping a
 * suggestion must get back the name it asked for, and saved songs contain
 * 'Aug6'.
 *
 * FIGURES DO NOT APPLY TO ANY MEMBER OF THIS FAMILY. The `6` in the name is an
 * INTERVAL ABOVE THE BASS — figured bass in its original sense — not an
 * inversion label. None of the three is tertian, so there is no root to invert
 * and no chord tone for a figure to select. This is why the alias policy in
 * docs/chord-theory.md §4 keeps all the function-name nodes rather than
 * retiring the ones that happen to be expressible as figures.
 */
export const Aug6 = function Aug6(
  tonic: string,
  scaleName?: string
): ChordNameWithNotes[] {
  return It6(tonic, scaleName).map((c) => ({ ...c, name: 'Aug6' }))
}

export type ChordFunction =
  | 'V64'
  | 'Aug6'
  | 'It6'
  | 'Fr6'
  | 'Ger6'
  | 'N6'
  | 'V63'

const CHORD_FN_NAMES = ['V64', 'Aug6', 'It6', 'Fr6', 'Ger6', 'N6'] as const

export const isChordFn = (arg: any): arg is ChordFunction => {
  return (CHORD_FN_NAMES as readonly string[]).includes(arg)
}

export const fns = {
  V64,
  Aug6,
  It6,
  Fr6,
  Ger6,
  N6,
  V63: () => {
    throw new Error('V63 is not a function')
  },
}

export const DynamicChordNames: {
  [key in Exclude<ChordFunction, 'V63'>]: string
} = {
  V64: 'V64',
  Aug6: 'Aug6',
  It6: 'It6',
  Fr6: 'Fr6',
  Ger6: 'Ger6',
  N6: 'N6',
} as const
export const scaleLetters = (scaleTonic: string, scaleName: string) => {
  const ten = oneIndexedArr(10).map(Scale.degrees(`${scaleTonic} ${scaleName}`))
  const len = Scale.get(`${scaleTonic} ${scaleName}`).notes.length
  if (len !== 7)
    throw new Error(`Cannot get progressions for ${len} sized scale`)
  return ten.slice(0, len)
}

// flatten/sharpen a letter by one accidental (same idiom as N6/Aug6 above)
const flattenNote = (letter: string) =>
  Note.simplify(`${letter}b`.replace('#b', ''))
const sharpenNote = (letter: string) =>
  Note.simplify(`${letter}#`.replace('b#', ''))

export const romanToLetterEntries = (scaleTonic: string, scaleName: string) => {
  const letters = scaleLetters(scaleTonic, scaleName)
  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
  const entries1 = letters.map((ltr, idx) => {
    return [romans[idx], ltr]
  })

  const entries2 = letters.map((ltr, idx) => {
    return [romans[idx], Note.enharmonic(ltr)]
  })

  const all1 = [...entries1, ...entries2]

  all1.sort(([lA], [lB]) => lB.length - lA.length)

  // Accidental romans: bX lowers degree X by a half step, #X raises it
  // (e.g. bII in A minor -> Bb, the Neapolitan root). These must come first
  // so e.g. bIII is matched before the plain III entry can mangle it
  // (previously 'bIII' in A minor produced the garbage name 'bC'). An earlier
  // enharmonic-based version of this list filtered on the roman instead of
  // the letter and always came out empty.
  const accidentalEntries = letters
    .map((ltr, idx) => {
      return [
        [`b${romans[idx]}`, flattenNote(ltr)],
        [`#${romans[idx]}`, sharpenNote(ltr)],
      ]
    })
    .flat()
  accidentalEntries.sort(([lA], [lB]) => lB.length - lA.length)

  return accidentalEntries.concat(all1)
}

const romanChordNameToReal_ = (
  scaleTonic: string,
  scaleName: string,
  romanName: string
) => {
  // vii°: the leading-tone diminished chord sits a half step below the tonic
  // even in minor keys, where the scale's own seventh degree is the subtonic
  // (harmonic-minor practice: G#dim, not Gdim, in A minor). Major keys are
  // unaffected — their seventh degree already is the leading tone.
  //
  // This applies to the whole VII-DIMINISHED FAMILY, not just the bare triad:
  // 'VIIdim', the fully-diminished seventh 'VIIdim7', and the half-diminished
  // 'VIIm7b5' are all leading-tone chords. Matching the literal string
  // 'VIIdim' (as this did before) silently regressed the seventh forms to the
  // subtonic — 'VIIdim7' in A minor produced Gdim7 rather than G#dim7.
  //
  // The suffix is preserved rather than hardcoded so each form keeps its own
  // quality. Deliberately NOT matched: bare 'VII' (the subtonic major triad of
  // natural minor, G in A minor) and 'VII7' — those are diatonic subtonic
  // chords the chart keeps distinct from vii°, and pinned tests cover them.
  const viiDim = /^VII(dim7?|m7b5)$/.exec(romanName)
  if (viiDim) {
    return `${Note.transpose(scaleTonic, '-2m')}${viiDim[1]}`
  }
  const entries = romanToLetterEntries(scaleTonic, scaleName)
  const newName = entries.reduce((accum, curr) => {
    return accum.replace(curr[0], curr[1])
  }, romanName)
  if (newName === romanName) return ''
  return newName
}

export const romanChordNameToReal = (
  scaleTonic: string,
  scaleName: string,
  romanName: string
): string => {
  if (romanName.includes('/')) {
    return unromanizeSecondaryChords(scaleTonic, scaleName, romanName)[0]
  }
  return romanChordNameToReal_(scaleTonic, scaleName, romanName)
}

export const getTriadByRomanNumeral = async (
  scaleTonic: string,
  scaleName: string,
  romanNum: string
) => {
  const prog = (
    await fakeCli(
      `chord progressions ${scaleTonic} ${scaleName.toLocaleLowerCase()}`
    )
  ).formatted[0]
  const progEntries = Object.entries(
    prog as { [idx: string]: { roman: string; chordName: string } }
  )
  const found = progEntries.find(([, progElem]) => {
    return progElem.roman === romanNum
  })
  if (!found) {
    throw new Error(
      `Could not find triad for roman numeral ${romanNum} in ${scaleTonic} ${scaleName}`
    )
  }
  return found[1].chordName
}

function romanEntry(progRoman: string) {
  const indicesStartsFlat = Object.entries({
    bI: 0,
    bII: 1,
    bIII: 2,
    bIV: 3,
    bV: 4,
    bVI: 5,
    bVII: 6,
  })
  const indicesStarts = Object.entries({
    I: 0,
    II: 1,
    III: 2,
    IV: 3,
    V: 4,
    VI: 5,
    VII: 6,
  })

  const longestMatch = indicesStartsFlat
    .concat(indicesStarts)
    .filter(([roman1, idx]) => {
      return progRoman.startsWith(roman1)
    })
    .sort(([roman1], [roman2]) => {
      return roman2.length - roman1.length
    })

  return longestMatch[0]
}

// given e.g. IImdim, return II
// given e.g. bIIImdim, return bIII
export function romanFromProgRoman(progRoman: string) {
  const longestMatch = romanEntry(progRoman)
  return longestMatch[0]
}

const unromanizeSecondaryChord = (
  tonic: string,
  scale: string,
  romanChord: string,
  // true only when resolving the secondary (left) half of a slash roman: a
  // secondary VII is a leading-tone chord, but a VII *target* (VIIdim/VII)
  // stays the diatonic subtonic chord
  asSecondary: boolean = false
) => {
  const romGuess1 = romanFromProgRoman(romanChord)
  const type = romanChord.replace(romGuess1, '')
  const letters = scaleLetters(tonic, scale)
  const romanDegreeIndex = romanEntry(romGuess1)

  let letter = letters[romanDegreeIndex[1]]
  if (asSecondary && romGuess1 === 'VII') {
    // secondary leading-tone chords sit a half step below the tonicized
    // root even when the target scale's seventh degree is the subtonic
    // (e.g. VIIdim/VIm in A minor -> Edim, not Ebdim); for major targets
    // this matches the scale's own seventh degree
    letter = Note.transpose(tonic, '-2m')
  } else if (romGuess1.startsWith('b')) {
    // a flat roman (e.g. bIII) lowers the degree's letter; previously the
    // accidental was silently dropped and the natural degree was used
    letter = flattenNote(letter)
  }
  const finalDom = Chord.getChord(type, letter).symbol

  return finalDom
}

export const unromanizeSecondaryChords = (
  tonic: string,
  scale: string,
  slashRoman: string
) => {
  const slashed = slashRoman.split('/')
  const dominantRoman = slashed[1]
  const dominantChord = unromanizeSecondaryChord(tonic, scale, dominantRoman)

  const secondaryRoman = slashed[0]
  const domData = Chord.get(dominantChord)
  const secondaryTonic = domData.tonic
  if (!secondaryTonic) {
    throw new Error(
      `could not resolve dominant chord ${dominantChord} for ${slashRoman} in ${tonic} ${scale}`
    )
  }
  const secondaryScale =
    domData.quality === 'Diminished'
      ? 'minor'
      : domData.quality.toLocaleLowerCase()

  const secondaryChord = unromanizeSecondaryChord(
    secondaryTonic,
    secondaryScale,
    secondaryRoman,
    true
  )

  return [secondaryChord, dominantChord]
}

/**
 * @deprecated Dead configuration — nothing reads it and its one entry,
 * 'IImdim', is not a node in any chart (neither `graphData/minor.ts` nor
 * `graphData/major.ts`). It described romans that were permitted to be absent
 * from a chart back when the untranslatable-romans check was a hard error.
 * Kept only because it is exported through the lib barrel and removing it
 * would be a breaking change for any external importer; expect it to be
 * removed in a future major version.
 */
export const optionalRomans = ['IImdim']
export function makeProgNodeTranslator(
  userLetter: string,
  userScale: string
): (progNode: ProgressionGraphNode) => ProgressionOptions | null {
  // fn names (V64, Aug6, N6) are kept as-is; romans realize to letter names
  const realizeName = (romanName: string) =>
    isChordFn(romanName)
      ? romanName
      : romanChordNameToReal(userLetter, userScale, romanName)

  return (progNodeIn) => {
    let translatedSource: ChordNameWithNotes | undefined

    if (isChordFn(progNodeIn.name)) {
      const fnRes = fns[progNodeIn.name](userLetter, userScale)
      const asEnabledArr = fnRes.map((cnwnFn) => {
        return {
          name: cnwnFn.name,
          notes: cnwnFn.notes,
          octMap: cnwnFn.octMap,
        }
      })
      if (asEnabledArr.length) {
        translatedSource = asEnabledArr[0]
      } else {
        translatedSource = {
          name: progNodeIn.name,
          notes: [],
        }
      }
    } else {
      const newName = romanChordNameToReal(
        userLetter,
        userScale,
        progNodeIn.name
      )
      translatedSource = chordNameWithNotes(newName) ?? undefined
    }

    if (!translatedSource) {
      console.error(
        `Could not translate ${progNodeIn.name} in ${userLetter} ${userScale}`
      )
      return null
    }

    // arrival context for every edge this node emits: the chords that may
    // precede the node, realized to letter names so they can be compared
    // against graph keys at runtime. null means unconditional.
    const edgeEnabler = progNodeIn.prev
      ? progNodeIn.prev.map(realizeName)
      : null

    /**
     * Translate one outgoing edge, whatever kind of arrow it came from.
     *
     * Shared by the `next` and `dotted` branches so the two cannot drift. They
     * previously did: only `next` recognized chord-FUNCTION names (V64 / Aug6 /
     * N6) via `isChordFn`, while `dotted` called `romanChordNameToReal`
     * unconditionally. That returns '' for N6/Aug6 and — worse — mangles 'V64'
     * into the garbage letter name 'E64' (the roman-replacement pass rewrites
     * the leading 'V'), so every dotted edge to a chord function was silently
     * discarded with a "Dropping untranslatable dotted chord" warning. Chord
     * functions could therefore only ever be reached over a strong arrow,
     * which forced N6/Aug6 onto `next` in the charts even where a weak arrow
     * was the musically honest choice.
     *
     * `kind` appears only in the warning text.
     *
     * STAGE M-A: the edge may be a bare string (root position, the normal
     * form) or a `{ chord, figure }` object. Both are normalized here, so the
     * figure is a property of the EDGE and never of the node — which is what
     * keeps every node lookup, and therefore every existing caller, untouched.
     */
    const translateEdge = (
      edge: ChartEdge,
      kind: 'next' | 'dotted'
    ): EnabledChordNameWithNotes[] => {
      const romanName = edgeChord(edge)
      const figure = edgeFigure(edge)
      // the figured roman is what a composer reads ('I6', 'V65'); the plain
      // roman is what the node is called. Only the roman is decorated, never
      // the name. `figuredRoman` (not naive concatenation) is what turns
      // { chord: 'V7', figure: '65' } into 'V65' rather than the unreadable
      // 'V765' — see its doc comment.
      const edgeRoman = figuredRoman(romanName, figure)

      if (isChordFn(romanName)) {
        const fnRes = fns[romanName](userLetter, userScale)
        return fnRes.map((cnwnFn) => ({
          ...cnwnFn,
          // fn edges (V64/Aug6/N6) take the same prev-based enabler as their
          // non-fn siblings. This used to be the *current node's own name*,
          // which described nothing about arrival context and so was useless
          // for matching against a caller's recent chords.
          enabler: edgeEnabler,
          roman: edgeRoman,
          octMap: cnwnFn.octMap,
        }))
      }

      const realizedName = romanChordNameToReal(
        userLetter,
        userScale,
        romanName
      )
      const cnwn = chordNameWithNotes(realizedName)

      if (cnwn === null || cnwn.notes.length === 0) {
        console.warn(
          `Dropping untranslatable ${kind} chord ${romanName} (realized: ${realizedName}) of ${progNodeIn.name} in ${userLetter} ${userScale}`
        )
        return []
      }

      if (!figure) {
        // the pre-Stage-M-A path, verbatim: no figure/bass keys are added, so
        // the emitted object is byte-identical to what it was before.
        return [
          {
            ...cnwn,
            enabler: edgeEnabler,
            roman: romanName,
          },
        ]
      }

      const bass = bassOf(cnwn.name, figure)
      if (!bass) {
        // the figure asks for a tone the chord does not have (e.g. '42' on a
        // triad). Keep the edge, drop the figure: losing a legitimate chord
        // over an authoring slip would be worse than silently ignoring the
        // figure, and `figuredBass.test.ts` pins that the authored library has
        // no such edge.
        console.warn(
          `Ignoring inapplicable figure ${figure} on ${kind} edge ${romanName} (realized: ${realizedName}) of ${progNodeIn.name} in ${userLetter} ${userScale}`
        )
        return [{ ...cnwn, enabler: edgeEnabler, roman: romanName }]
      }

      return [
        {
          ...cnwn,
          enabler: edgeEnabler,
          roman: edgeRoman,
          figure,
          bass,
        },
      ]
    }

    const next = progNodeIn.next.flatMap((edge) => translateEdge(edge, 'next'))

    const dotted = progNodeIn?.dotted?.flatMap((edge) =>
      translateEdge(edge, 'dotted')
    )

    return {
      roman: progNodeIn.name,
      scaleName: userScale,
      scaleTonic: userLetter,
      translatedSource,
      next,
      dotted: dotted ?? [],
    }
  }
}
export type ProgressionOptionsEntry = [name: string, po: ProgressionOptions]
export type ProgressionOptions = {
  roman: string
  scaleTonic: string
  scaleName: string
  translatedSource: ChordNameWithNotes
  next: EnabledChordNameWithNotes[]
  dotted: EnabledChordNameWithNotes[]
  octMap?: (notes: string[], rootOct: number) => string[]
}

export const randomElement = <Elem = any>(array: Array<Elem>): Elem =>
  array[Math.floor(Math.random() * array.length)]

export const combineEntriesByName = (
  progOptions: ProgressionOptions[]
): ProgressionOptions | null => {
  if (progOptions.length === 0) return null
  if (progOptions.length === 1) return progOptions[0]
  return progOptions.reduce((accum, curr, idx) => {
    if (idx === 0) return accum
    return {
      ...accum,
      next: [...accum.next, ...curr.next],
      dotted: [...accum.dotted, ...curr.dotted],
    }
  }, progOptions[0] as ProgressionOptions)
}


export const oneIndexedArr = (len: number) => {
  if (len <= 0) return []
  const arr: number[] = []
  let n = 1
  while (n <= len) {
    arr.push(n)
    n += 1
  }
  return arr
}

export const zeroIndexedArr = (len: number) => {
  if (len <= 0) return []
  const oneIndexed = oneIndexedArr(len)
  return oneIndexed.map((elem) => elem - 1)
}

export const rotations = <T>(arr: Array<T>): T[][] => {
  const len = arr.length
  let rotation = 1
  const rotations: T[][] = []
  while (rotation < len) {
    const rotated = Collection.rotate(rotation, arr)
    rotations.push(rotated)
    rotation++
  }
  return rotations
}

export const noteInversions = (
  chordName: string,
  userOct: number = 3
): string[][] => {
  const { tonic: tonicNote, type: chordType } = Chord.get(chordName)
  // a null tonic yields an empty letter and falls into the throw below
  const { letter } = Note.get(tonicNote ?? '')

  const oct = userOct

  if (!letter) {
    console.error('inversions', { chordName })
    throw new Error(`Cannot get note inversions without a letter + octave note`)
  }

  const validTonic = `${letter}${oct}`
  const notesArr = Chord.getChord(chordType, validTonic)?.notes
  const noteCount = notesArr.length
  if (typeof noteCount !== 'number') return []
  const mappableNums = oneIndexedArr(noteCount)
  const rotatedIndexes = rotations(mappableNums)
  const degreesFn = Chord.degrees([validTonic, chordType])
  const rots = rotatedIndexes.map((orderedIndexes) => {
    return orderedIndexes.map(degreesFn)
  })

  return [notesArr, ...rots]
}

export const nakedNoteInversions = (cn: string, oct: number = 3) => {
  return noteInversions(cn, oct).map((nArr) =>
    nArr.map((nm) => Note.get(nm).pc)
  )
}

export const detectScales = (
  notes: string[],
  userLetter?: string,
  userScale?: string
) => {
  const allScales = detectAllScales(notes)

  if (!userLetter || !userScale) {
    return allScales
  }

  const scales = allScales.reduce(
    (accum, scale) => {
      const split = scale.name.split(' ')
      const scaleTonic = Note.get(split[0])

      const nameOnly = split.slice(1).join(' ').toLocaleLowerCase()
      const nameMatch =
        scaleTonic.pc === split[0] && userScale.toLowerCase().includes(nameOnly)
      const notAlready = !accum.find(({ name }) => name === scale.name)

      if (nameMatch && notAlready) {
        return [...accum, scale]
      }
      return accum
    },
    [] as { name: string }[]
  )

  return scales
}

export const fnChordNameWithNotes = (
  fnName: ChordFunction,
  tonic: string,
  scaleName: string
) => {
  return fns[fnName](tonic, scaleName)[0]
}

export const chordNameWithNotes = (
  chordName: string,
  oct: number = 3,
  tonic?: string,
  scaleName?: string
): ChordNameWithNotes | null => {
  // canonical case-insensitive lookup; comparing the lowercased name against
  // the mixed-case keys previously made this branch unreachable, so dynamic
  // chords silently fell through to Chord.get and resolved to no notes
  const dynamicName = (
    Object.keys(DynamicChordNames) as (keyof typeof DynamicChordNames)[]
  ).find((key) => key.toLowerCase() === chordName.toLowerCase())
  if (dynamicName) {
    if (!scaleName || !tonic) {
      throw new Error(
        `Cannot get dynamic chord ${chordName} without tonic and scale name`
      )
    }

    const fnsResult = fns[dynamicName](tonic, scaleName)[0]
    return fnsResult
  }
  const simpleChord = Chord.get(chordName)
  const tonicParsed = Note.get(simpleChord.notes[0])
  const noteWithOct = `${tonicParsed.name}${oct}`

  if (typeof tonicParsed.oct === 'number')
    return {
      name: chordName,
      notes: simpleChord.notes,
    }

  return {
    name: simpleChord.symbol,
    notes: Chord.getChord(simpleChord.type, noteWithOct)?.notes || [],
  }
}
