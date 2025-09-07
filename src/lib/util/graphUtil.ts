import { combineEntriesByName, fns, isChordFn, makeProgNodeTranslator, minor, optionalRomans, ProgressionGraphNode, ProgressionOptions, romanChordNameToReal } from "../graphh"
import { mem } from "../../core/mem"

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
