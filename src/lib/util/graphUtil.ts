import { Key, Scale } from 'tonal'

import { mem } from '../../core/mem'
import { major } from '../graphData/major'
import type { ProgressionChart } from '../graphData/types'
import {
  combineEntriesByName,
  fns,
  isChordFn,
  makeProgNodeTranslator,
  minor,
  optionalRomans,
  ProgressionOptions,
  romanChordNameToReal,
} from '../graphh'

export type ChordProgressionGraph = {
  [chordName: string]: ProgressionOptions
}

export const lookUpGraph = (
  userTonic: string,
  userScale: string
): ChordProgressionGraph | null => {
  const place = mem().graphs[`${userTonic} ${userScale}`]
  if (place) {
    if (place[0]) return place[0]
  }
  return null
}

// Historically chordGraphCreate returned `{ formatted }` on first build but
// the bare graph on cache hits. Both shapes are kept working: the graph is
// returned with a non-enumerable `formatted` self-reference (non-enumerable
// so chord-name iteration over the graph is unaffected).
const withFormattedSelfRef = (
  graph: ChordProgressionGraph
): ChordProgressionGraph & { formatted: ChordProgressionGraph } => {
  if (!('formatted' in graph)) {
    Object.defineProperty(graph, 'formatted', {
      value: graph,
      enumerable: false,
      writable: false,
    })
  }
  return graph as ChordProgressionGraph & { formatted: ChordProgressionGraph }
}

/**
 * Pick the harmonic chart for a key.
 *
 * Dispatch is on `Scale.get(...).type`, not on the raw scale string: the type
 * is what collapses aliases onto their mode, so 'C ionian' and 'C major' both
 * report `major` and 'A aeolian' and 'A minor' both report `minor`. String
 * matching would miss those aliases, and they really do reach this function.
 *
 * Anything else (dorian, mixolydian, harmonic minor, ...) throws rather than
 * silently building the borrowed-minor chart on the wrong letters, which is
 * what used to happen for every non-minor key including plain major.
 */
const chartForScale = (
  userLetter: string,
  userScale: string
): ProgressionChart => {
  const { type, empty } = Scale.get(`${userLetter} ${userScale}`)
  if (empty) {
    throw new Error(
      `Unrecognized scale "${userLetter} ${userScale}": no chord graph can be built for it. Supported modes are major and minor.`
    )
  }
  if (type === 'major') return major
  if (type === 'minor') return minor
  throw new Error(
    `Unsupported mode "${type}" for ${userLetter} ${userScale}: chord graphs exist only for major and minor keys.`
  )
}

export function chordGraphCreate(userLetter: string, userScale: string) {
  const lookedUp = lookUpGraph(userLetter, userScale)

  if (lookedUp) return withFormattedSelfRef(lookedUp)
  // cache keys stay the raw input string, so 'C ionian' and 'C major' remain
  // separate entries even though they resolve to the same chart
  const chart = chartForScale(userLetter, userScale)
  const names = Object.keys(chart)
  const untranslatable = names
    .map((romanName) => {
      if (isChordFn(romanName)) {
        return null
      }
      const translated = romanChordNameToReal(userLetter, userScale, romanName)
      if (!translated) {
        return romanName
      }

      return null
    })
    .filter((elem) => elem !== null && !optionalRomans.includes(elem))

  if (untranslatable.length) {
    throw new Error(
      `Not all roman names were translatable.${JSON.stringify(untranslatable)} ; scale: ${userLetter} ${userScale} `
    )
  }

  const scaledGraph = new Map<string, ProgressionOptions[]>()
  for (const [romanName, progNodes] of Object.entries(chart)) {
    const realizedName = fns[romanName as keyof typeof fns]
      ? romanName
      : romanChordNameToReal(userLetter, userScale, romanName)

    const realizedOptions = progNodes
      .map(makeProgNodeTranslator(userLetter, userScale))
      // a null means the node was untranslatable; keep it out of the graph
      // rather than letting it poison combineEntriesByName
      .filter((pOpt): pOpt is ProgressionOptions => pOpt !== null)

    const already = scaledGraph.get(realizedName)
    if (already) {
      // two roman nodes can realize to the same chord (e.g. IIdim and
      // VIIdim/III are both Bdim in A minor); merge their edges instead of
      // letting the later node overwrite the earlier, which silently dropped
      // the first node's next-chord options
      console.warn(
        `merging progression nodes that realize to the same chord: ${romanName} -> ${realizedName} in ${userLetter} ${userScale}`
      )
      already.push(...realizedOptions)
      continue
    }
    scaledGraph.set(realizedName, realizedOptions)
  }

  const combinedScaleGraphEntries = [...scaledGraph.entries()].map(
    ([name, pOpts]) => {
      return [name, combineEntriesByName(pOpts)]
    }
  ) as [name: string, pOpt: ProgressionOptions][]

  const formatted: ChordProgressionGraph = Object.fromEntries(
    combinedScaleGraphEntries
  )

  const idx = `${userLetter} ${userScale}`
  mem().graphs[idx] = mem().graphs[idx] || []
  mem().graphs[idx].push(formatted)
  return withFormattedSelfRef(formatted)
}

//
export const getPhaseChordNames = (
  userTonic: string,
  userScale: string,
  type?: 'harmonic' | 'melodic' | 'natural' | 'all'
) => {
  // Normalize the scale type to lowercase for comparison
  const normalizedScale = userScale.toLowerCase()

  // Determine if it's a major or minor key
  const isMajor = normalizedScale === 'major' || normalizedScale === 'maj'
  const isMinor = normalizedScale === 'minor' || normalizedScale === 'min'

  if (!isMajor && !isMinor) {
    throw new Error(
      `Unsupported scale type: ${userScale}. Please use 'major', 'minor', 'maj', or 'min'`
    )
  }

  let chordNames: string[] = []

  if (isMajor) {
    // For major keys, use Key.majorKey()
    const majorKey = Key.majorKey(userTonic)

    if (type === 'all' || !type) {
      // Return both triads and 7th chords when no type specified or 'all'
      chordNames = [...majorKey.triads, ...majorKey.chords]
    } else {
      // For major keys, only 'all' type is supported by Tonal.js
      // Return triads by default for other types
      chordNames = [...majorKey.triads]
    }
  } else {
    // For minor keys, use Key.minorKey()
    const minorKey = Key.minorKey(userTonic)

    if (type === 'all' || !type) {
      // Return all available chord types when no type specified or 'all'
      chordNames = [
        ...minorKey.natural.triads,
        ...minorKey.natural.chords,
        ...minorKey.harmonic.triads,
        ...minorKey.harmonic.chords,
        ...minorKey.melodic.triads,
        ...minorKey.melodic.chords,
      ]
    } else if (type === 'natural') {
      chordNames = [...minorKey.natural.triads, ...minorKey.natural.chords]
    } else if (type === 'harmonic') {
      chordNames = [...minorKey.harmonic.triads, ...minorKey.harmonic.chords]
    } else if (type === 'melodic') {
      chordNames = [...minorKey.melodic.triads, ...minorKey.melodic.chords]
    } else {
      // Default to natural minor if invalid type specified
      chordNames = [...minorKey.natural.triads, ...minorKey.natural.chords]
    }
  }

  // Remove duplicates and return
  return [...new Set(chordNames)]
}
