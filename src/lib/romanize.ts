import { isScaleNameWithTonic } from "./util/scaleUtil"
import { isChordCsvArg } from "./util/barsUtil"
import { scale } from "./util/tagsUtil"
import { lookUpGraph } from "./util/phaseUtil"
import z from "zod"


export const romanize = (chordCsvArgRaw: string, userTonicRaw: string, userScaleRaw: string) => {
    const [chordCsvArg, userTonic, userScale] = z.tuple([
        z.string(),
        z.string(),
        z.string(),
            ]).parse([
                chordCsvArgRaw,
                userTonicRaw,
                userScaleRaw
            ])


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

    const roman = graph[chordName].roman
    if (!roman) {
        throw new Error(`could not obtain ${chordCsvArg} in graph for ${userTonic} ${userScale}`)
    }
    return roman
}
