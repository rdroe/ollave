import { combineEntriesByName, fns, isChordFn, makeProgNodeTranslator, minor, optionalRomans, ProgressionGraphNode, ProgressionOptions, romanChordNameToReal } from "../graphh"
import { mem } from "../../core/mem"
import { Key } from "tonal"

export const lookUpGraph = (userTonic: string, userScale: string): {
    [chordName: string]: ProgressionOptions
} => {
    const place = mem().graphs[`${userTonic} ${userScale}`]
    if (place) {
        if (place[0]) return place[0]
    }
    return null
}



export function chordGraphCreate (userLetter: string, userScale: string) {
  const lookedUp = lookUpGraph(userLetter, userScale)

  if (lookedUp) return lookedUp
  const names = Object.keys(minor)
  const untranslatable = names.map((romanName) => {

    if (isChordFn(romanName)) { return null }
    const translated = romanChordNameToReal(userLetter, userScale, romanName)
    if (!translated) {
        return romanName
    }

      return null
  }).filter((elem) => elem !== null && !optionalRomans.includes(elem))

  if (untranslatable.length) {
      throw new Error(`Not all roman names were translatable.Make sure this is a minor key.${JSON.stringify(untranslatable)} ; scale: ${userLetter} ${userScale} `)
  }

  const scaledGraph =
      Object.entries(minor).reduce((accum, [romanName, progNodes]) => {

          const realizedName = fns[romanName as keyof typeof fns]
              ? romanName
              : romanChordNameToReal(userLetter, userScale, romanName)

          if (accum.find(([x, _]) => x === realizedName)) {
              console.error(`prog node already translated; ${romanName} in ${userLetter} ${userScale} ${JSON.stringify({ romanName, realizedName, progNodes }, null, 2)} `)
          }

          const realizedOptions = progNodes.map(makeProgNodeTranslator(userLetter, userScale))


          return [...accum, [realizedName, realizedOptions]]

      }, [] as [romanName: string, progNodes: ProgressionGraphNode][])

  const combinedScaleGraphEntries = scaledGraph.map(([name, pOpts]: [nm: string, pOpts: ProgressionOptions[]]) => {
      return [name, combineEntriesByName(
          pOpts)

      ]
  }) as [name: string, pOpt: ProgressionOptions][]

  const formatted = Object.fromEntries(combinedScaleGraphEntries)

  const idx = userLetter && userScale ? `${userLetter} ${userScale}` : Date.now()
  mem().graphs[idx] = mem().graphs[idx] || [] as any[]
  mem().graphs[idx].push(formatted)
  return {
      formatted

  }
}

//
export const getPhaseChordNames = (userTonic: string, userScale: string, type?: 'harmonic' | 'melodic' | 'natural' | 'all') => {
    // Normalize the scale type to lowercase for comparison
    const normalizedScale = userScale.toLowerCase()

    // Determine if it's a major or minor key
    const isMajor = normalizedScale === 'major' || normalizedScale === 'maj'
    const isMinor = normalizedScale === 'minor' || normalizedScale === 'min'

    if (!isMajor && !isMinor) {
        throw new Error(`Unsupported scale type: ${userScale}. Please use 'major', 'minor', 'maj', or 'min'`)
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
                ...minorKey.melodic.chords
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

(window as any).getPhaseChordNames = getPhaseChordNames
