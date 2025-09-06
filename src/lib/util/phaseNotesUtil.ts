import { mem } from "../../core/mem"
import { NoteByBar } from "../schemas"

export const sortByNumberAfterColon = (a: string, b: string) => {
    const aNumber = parseInt(a.split(':')[1])
    const bNumber = parseInt(b.split(':')[1])
    return aNumber - bNumber
}

export const getAllPhaseBars = (phase: string) => {
    if (typeof phase !== 'string') { 
        throw new Error(`String arg is required in getAllPhaseBars; instead ${JSON.stringify(phase)}`) 
    }
    const nbb = mem().notesByBar
    const lookedUp = Object.keys(nbb).filter((barTag) => barTag.startsWith(`${phase}:`)).sort(sortByNumberAfterColon)
    return lookedUp
}

export const getAllPhaseBarNotes = (phase: string) => {
    const barNames = getAllPhaseBars(phase)
    const nbb = mem().notesByBar
    const myNoteGroups = barNames.map((barName) => nbb[barName])
    return myNoteGroups
}
