import z from 'zod'

import { isChordCsvArg } from './util/barsUtil'
import { chordGraphCreate, lookUpGraph } from './util/graphUtil'
import { isScaleNameWithTonic } from './util/scaleUtil'

export const nextChord = (
  chordCsvArgRaw: string,
  userTonicRaw: string,
  userScaleRaw: string
) => {
  const [chordCsvArg, userTonic, userScale] = z
    .tuple([z.string(), z.string(), z.string()])
    .parse([chordCsvArgRaw, userTonicRaw, userScaleRaw])

  if (!isScaleNameWithTonic(`${userTonic} ${userScale}`)) {
    throw new Error(`Invalid scale name: ${userTonic} ${userScale}`)
  }

  if (!isChordCsvArg(chordCsvArg)) {
    throw new Error(`could not get chord name; instead ${chordCsvArg}`)
  }

  // build the graph on first use; previously a cache miss was a hard error
  const graph =
    lookUpGraph(userTonic, userScale) ?? chordGraphCreate(userTonic, userScale)

  if (!graph) {
    throw new Error(`could not obtain graph for ${userTonic} ${userScale}`)
  }
  const [chordName] = chordCsvArg.split(',')
  if (!graph[chordName]) {
    throw new Error(
      `could not obtain ${chordCsvArg} in graph for ${userTonic} ${userScale}`
    )
  }

  const next = graph[chordName]?.next

  const roman = graph[chordName].roman

  if (!next) {
    throw new Error(
      `Got graph and chord; no next for ${chordName}; roman ${roman}`
    )
  }

  return next.map(({ name }) => name)
}
