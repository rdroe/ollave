// using the currently loaded song, do any of the following.
// updated both mem.ts and the database.
import { ProgressionOptions, minor } from "./lib/graphh"
import { randId, randomInt, strjson } from "./lib/helpers"
import { mapSongToMidiTicks } from "./mapSongToTicks"
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
            speed: null,
            scaleName: null,
            scaleTonic: null
        }
    }
    mem().latestMap = mapSongToMidiTicks()
}


const getPhaseId = (phaseName: string) => {
    const phase = mem().phases[phaseName]
    return phase.id || phase['temp-id']
}

export async function phaseUnfollows(subject: string, objects?: string[]) {
    // remove all follows-ids from subject

    const phase = mem().phases[subject]
    if (objects) {
        if (objects.length) {
            const objectsById = objects.map(getPhaseId)
            mem().phases[subject] = {
                ...phase,
                'follows-ids': phase['follows-ids'].filter((phaseId) => {
                    return !objectsById.includes(phaseId)
                })
            }
        } else {
            // noop, noitice
        }
    }

    mem().phases[subject] = {
        ...phase,
        'follows-ids': []
    }

    mem().latestMap = mapSongToMidiTicks()


}

export const sortByNumberAfterColon = (a: string, b: string) => {
    const aNumber = parseInt(a.split(':')[1])
    const bNumber = parseInt(b.split(':')[1])
    return aNumber - bNumber
}

export const startEndData = (phaseName: string): StartEndTuple[] => {
    const startEndData = phaseBeginningsAndEnds()
    return startEndData[phaseName] || []
}
export const lookUpGraph = (userTonic: string, userScale: string): {
    [chordName: string]: ProgressionOptions
} => {
    console.log('all graphs', mem().graphs)
    const place = mem().graphs[`${userTonic} ${userScale}`]
    if (place) {
        if (place[0]) return place[0]
    }
    return null
}

export const lastTick = () => {
    // this is called very frequently!
    const songStartEndData = phaseBeginningsAndEnds()
    const lastTick = Object.values(songStartEndData).reduce((acc, curr) => {
        const lastPhaseTick = curr[curr.length - 1][1]
        return Math.max(acc, lastPhaseTick)
    }, 0)
    return lastTick
}


export const getAllPhaseBars = (phase: string) => {

    if (typeof phase !== 'string') { throw new Error(`String arg is required in getAllPhaseBars; instead ${strjson(phase)}`) }
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

export const getFollowingPhases = (phaseName: string) => {
    const phase = mem().phases[phaseName]
    const followsPhases = Object.entries(mem().phases).filter((
        [,
            { "follows-ids": followsIds }
        ]) => phase.id !== null && followsIds.includes(phase.id) || phase["temp-id"] !== null && followsIds.includes(phase["temp-id"]))

    return followsPhases
}

// update phase to have n bars.
export async function phaseCount(phase: string, size: number) {
    if (!phases[phase]) {
        phases[phase] = {
            id: null,
            "temp-id": randomInt(),
            "follows-ids": [],
            barSizeMultiplier: null,
            speed: null,
            scaleTonic: null,
            scaleName: null
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
    mem().latestMap = mapSongToMidiTicks()
}

