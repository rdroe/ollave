import { ProgressionOptions } from "../graphh"
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
