import fakeCli from 'peprn/fakeCli'
import { Chord, Note, Mode, Scale, Collection } from 'tonal'

import { minor } from './graphData/minor'
import type { ProgressionGraphNode } from './graphData/types'
import { dedupeEnharmonicScales } from './scaleList'

// chart data lives in ./graphData (a sibling major.ts can be dropped in);
// re-exported here because `minor` is public API via the lib barrel
export { minor }
export type { ProgressionGraphNode, ProgressionChart } from './graphData/types'
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
  roman: string
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

export const Aug6 = function Aug6(
  tonic: string,
  _scaleName?: string
): ChordNameWithNotes[] {
  /*
Think of your key as C. The formula for the chord is (using scale degrees) b6, 1, #4, or in C, this would be Ab, C, F#. https://www.reddit.com/r/musictheory/comments/2vhagj/eli5_augmented_sixth_chords/

b6 and #4 are absolute intervals from the tonic (minor sixth, augmented
fourth), so they are the same pitches in either mode: F and D# in A minor.
The previous version flattened the *scale's* sixth degree, which
double-flattened minor's already lowered sixth (producing E natural in
A minor instead of F).
*/
  const flatSix = Note.transpose(tonic, 'm6')
  const one = tonic
  const sharpFour = Note.transpose(tonic, 'A4')
  if (
    Note.octave(flatSix) !== undefined ||
    Note.octave(one) !== undefined ||
    Note.octave(sharpFour) !== undefined
  ) {
    throw new Error(`Aug6th chord ${[flatSix, one, sharpFour]} has octave`)
  }

  return [
    {
      name: 'Aug6',
      notes: [flatSix, one, sharpFour],
      octMap: (notes, oct) => notes.map((nt) => `${nt}${oct}`),
    },
  ]
}

export type ChordFunction = 'V64' | 'Aug6' | 'N6' | 'V63'

export const isChordFn = (arg: any): arg is ChordFunction => {
  return ['V64', 'Aug6', 'N6'].includes(arg)
}

export const fns = {
  V64,
  Aug6,
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
  if (romanName === 'VIIdim') {
    return `${Note.transpose(scaleTonic, '-2m')}dim`
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
     */
    const translateEdge = (
      romanName: string,
      kind: 'next' | 'dotted'
    ): EnabledChordNameWithNotes[] => {
      if (isChordFn(romanName)) {
        const fnRes = fns[romanName](userLetter, userScale)
        return fnRes.map((cnwnFn) => ({
          ...cnwnFn,
          // fn edges (V64/Aug6/N6) take the same prev-based enabler as their
          // non-fn siblings. This used to be the *current node's own name*,
          // which described nothing about arrival context and so was useless
          // for matching against a caller's recent chords.
          enabler: edgeEnabler,
          roman: romanName,
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

      return [
        {
          ...cnwn,
          enabler: edgeEnabler,
          roman: romanName,
        },
      ]
    }

    const next = progNodeIn.next.flatMap((romanName) =>
      translateEdge(romanName, 'next')
    )

    const dotted = progNodeIn?.dotted?.flatMap((romanName) =>
      translateEdge(romanName, 'dotted')
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
