import { isScaleNameWithTonic } from "./util/scaleUtil"
import { isChordCsvArg } from "./util/barsUtil"
import { scale } from "./util/tagsUtil"
import { lookUpGraph } from "./util/phaseUtil"
import z from "zod"
import { fakeCli } from "peprn/browser"


export const romans = async( userTonicRaw: string, userScaleRaw: string) => {
    const [ userTonic, userScale] = z.tuple([
        z.string(),
        z.string(),
            ]).parse([
                userTonicRaw,
                userScaleRaw
            ])


    if (!isScaleNameWithTonic(`${userTonic} ${userScale}`)) {
        throw new Error(`Invalid scale name: ${userTonic} ${userScale}`)
    }

    if (!scale) {
        throw new Error(`could not obtain scale`)
    }

    let graph = lookUpGraph(userTonic, userScale)

    if (!graph) {
        await fakeCli(`chord graph create ${userTonic} ${userScale}`)
    }

    graph = lookUpGraph(userTonic, userScale)
    
    if (!graph) {
        throw new Error(`could not obtain graph for ${userTonic} ${userScale}`)
    }
    return Object.keys(graph)

}