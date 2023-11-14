// using the currently loaded song, do any of the following.
// updated both mem.ts and the database.
import { randId, randomInt } from "./lib/helpers"
import { mem } from "./mem"
import { StartEndTuple, phaseBeginningsAndEnds } from "./startEndData"
const { phases, notesByBar } = mem()
// temp-id is for in-memory only. id is for the database.
// phase <new-phase> follows <existing-phase>
export async function phaseFollowsPhase(subject: string, objects: string[]) {
    objects.forEach((obj) => {
        if (!phases[obj]) {
            throw new Error(`phase ${obj} does not exist`)
        }
    })

    // if subject exists, add follows-ids.
    if (phases[subject]) {
        phases[subject]["follows-ids"] = phases[subject]["follows-ids"].concat(objects.map((obj) => phases[obj].id ?? phases[obj]["temp-id"]))

        // if subject does not exist, create it with a default note block (1 empty bar) and the specified  follows-ids.
    } else {
        phases[subject] = {
            id: null,
            "temp-id": null,
            "follows-ids": objects.map((obj) => phases[obj].id),
            barSizeMultiplier: null,
            speed: null
        }
    }
}

export async function phaseUnfollows(subject: string, objects: string[]) {
    // where this subject is followed, remove this subject from the follows-ids
    // remove all follows-ids from subject
}

const sortByNumberAfterColon = (a: string, b: string) => {
    const aNumber = parseInt(a.split(':')[1])
    const bNumber = parseInt(b.split(':')[1])
    return aNumber - bNumber
}

export const startEndData = (phaseName: string): StartEndTuple[] => {
    const startEndData = phaseBeginningsAndEnds()
    return startEndData[phaseName] || []
}

export const lastTick = () => {
    const songStartEndData = phaseBeginningsAndEnds()
    const lastTick = Object.values(songStartEndData).reduce((acc, curr) => {
        const lastPhaseTick = curr[curr.length - 1][1]
        return Math.max(acc, lastPhaseTick)
    }, 0)
    return lastTick
}


export const getAllPhaseBars = (phase: string) => {
    const lookedUp = Object.keys(notesByBar).filter((barTag) => barTag.startsWith(`${phase}:`)).sort(sortByNumberAfterColon)
    return lookedUp
}

export const getAllPhaseBarNotes = (phase: string) => {
    const barNames = getAllPhaseBars(phase)
    return barNames.map((barName) => notesByBar[barName])
}
export const getFollowingPhases = (phaseName: string) => {
    const phase = mem().phases[phaseName]
    const followsPhases = Object.entries(mem().phases).filter((
        [,
            { "follows-ids": followsIds }
        ]) => phase.id !== null && followsIds.includes(phase.id) || phase["temp-id"] !== null && followsIds.includes(phase["temp-id"]))
    return followsPhases
}
export async function phaseCount(phase: string, size: number) {
    if (!phases[phase]) {
        phases[phase] = {
            id: null,
            "temp-id": randomInt(),
            "follows-ids": [],
            barSizeMultiplier: null,
            speed: null
        }
    }
    // get all the phase bars.
    let allBars = getAllPhaseBars(phase)
    if (allBars.length === 0) {
        const newBarTag = `${phase}:0`
        notesByBar[newBarTag] = []
        allBars = getAllPhaseBars(phase)
    }
    // if size is less than the number of bars, remove bars from the end.
    // if size is more than the number of bars, add bars to the end (copy the existing pattern fully or partially until the size is reached)    
    // if size is the same as the number of bars, do nothing.
    if (allBars.length > size) {
        const barsToRemove = allBars.slice(size)
        barsToRemove.forEach((barTag) => {
            delete notesByBar[barTag]
        })
    } else if (allBars.length < size) {

        const barsToAdd = size - allBars.length

        const lastBar = allBars[allBars.length - 1]

        const lastBarNumber = parseInt(lastBar.split(':')[1])
        const lastBarNumberPlusOne = lastBarNumber + 1

        const copyGroup = `copied:${randId("", 3)}}`
        for (let i = 0; i < barsToAdd; i++) {
            const barToCopy = allBars[i % allBars.length]
            const newBarTag = `${phase}:${lastBarNumberPlusOne + i}`
            notesByBar[newBarTag] = notesByBar[barToCopy].map((note) => {
                return {
                    ...note,
                    barTag: newBarTag,
                    tags: [...note.tags, copyGroup]
                }
            })
        }
    }
}

