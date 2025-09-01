import { isScaleNameWithTonic } from "./helpers"
import { isChordCsvArg } from "./util/barsUtil"
import { scale } from "./util/tagsUtil"
import { lookUpGraph } from "./util/phaseUtil"


export const nextChord = (chordCsvArg: string, userTonic: string, userScale: string) => {

    if (!isScaleNameWithTonic(`${userTonic} ${userScale}`)) {
        throw new Error(`Invalid scale name: ${userTonic} ${userScale}`)
    }

    if (!isChordCsvArg(chordCsvArg, userTonic, userScale)) {
        throw new Error(`could not get chord name; instead ${chordCsvArg}`)
    }

    if (!scale) {
        throw new Error(`could not obtain scale`)
    }

    let graph = lookUpGraph(userTonic, userScale)



    if (!graph) {
        throw new Error(`could not obtain graph for ${userTonic} ${userScale}`)
    }
    const [chordName] = chordCsvArg.split(',')
    if (!graph[chordName]) {
        throw new Error(`could not obtain ${chordCsvArg} in graph for ${userTonic} ${userScale}`)
    }

    const next = graph[chordName]?.next

    const roman = graph[chordName].roman

    if (!next) {
        throw new Error(`Got graph and chord; no next for ${chordName}; roman ${roman}`)
    }

    return next.map(({ name }) => name)
}