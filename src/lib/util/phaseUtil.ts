
import { ProgressionOptions, minor } from "../graphh"
import { randomInt } from "../helpers"
import { strjson } from "./common"
import { randId } from "./common"
import { mapSongToMidiTicks } from "../mapSongToTicks"
import { mem } from "../../core/mem"
import { startEndData, lastTick } from "./startEndUtil"
import { setLatestMap } from "../../core/observables"
import { browser } from "user-tables"
import { z } from "zod"
import { PhaseRecord } from "./phaseTypes"
import { getAllPhaseBars, getAllPhaseBarNotes, sortByNumberAfterColon } from "./phaseNotesUtil"

// temp-id is for in-memory only. id is for the database.
// phase <new-phase> follows <existing-phase>
export async function phaseFollowsPhase(subject: string, objects: string[]) {
    const { phases } = mem()
    objects.forEach((obj) => {
        if (!phases[obj]) {
            throw new Error(`phase ${obj} does not exist`)
        }
    })

    // if subject exists, add follows-ids.
    if (phases[subject]) {
        phases[subject]["follows-ids"] = phases[subject]["follows-ids"].concat(objects.map((obj) => phases[obj].id ?? phases[obj].id))

        // if subject does not exist, create it with a default note block (1 empty bar) and the specified  follows-ids.
    } else {
        const phaseData: Omit<PhaseRecord, "id"> = {
            "follows-ids": objects.map((obj) => phases[obj].id),
            barSizeMultiplier: null,
            speed: null,
            scaleName: null,
            scaleTonic: null,
            name: subject
        }
        // create the phase in the db to get the id
        const phaseId = (await browser.userTables.add('phase', { data: phaseData }))
        phases[subject] = {
            ...phaseData,
            id: z.number().parse(phaseId)
        }
    }
    setLatestMap(mapSongToMidiTicks())
}


const getPhaseId = (phaseName: string) => {
    const phase = mem().phases[phaseName]
    return phase.id
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

    setLatestMap(mapSongToMidiTicks())


}

// Re-export functions from their new locations
export { sortByNumberAfterColon, getAllPhaseBars, getAllPhaseBarNotes } from "./phaseNotesUtil"
export { startEndData, lastTick } from "./startEndUtil"
export { lookUpGraph } from "./graphUtil"
export { getFollowingPhases } from "./phaseRelationsUtil"

export const phaseExists = (phase: string) => {
    const { phases } = mem()
    return phases[phase] !== undefined
}

// update phase to have n bars.
export async function phaseCount(phase: string, size: number, skipCopy: boolean = false, rawTrackId: number | null = null) {
    const { phases, notesByBar } = mem()
    if (!phases[phase]) {
        const phaseData: Omit<PhaseRecord, "id"> = {
            "follows-ids": [],
            barSizeMultiplier: null,
            speed: null,
            scaleTonic: null,
            scaleName: null,
            name: phase
        }
        const phaseId = (await browser.userTables.add('phase', { data: phaseData })) 
        phases[phase] = {
            ...phaseData,
            id: z.number().parse(phaseId)
        }
        const trackId = rawTrackId ? rawTrackId : mem().tracks[0].id 
        if (typeof trackId === 'number') {
            const track = mem().tracks.find((track) => track.id === trackId)
            if (track) {
                track["phase-ids"].push(phases[phase].id)
                track["phase-names"].push(phase)
            } else {
                throw new Error(`Track ${trackId} not found`)
            }
        } else {
            throw new Error(`Track id is not a number`)
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

        const copyGroup = `copied:${randId("", 3)}`
        for (let i = 0; i < barsToAdd; i++) {
            const barToCopy =  allBars[i % allBars.length]
            const newBarTag = `${phase}:${lastBarNumberPlusOne + i}`
            notesByBar[newBarTag] = skipCopy ? [] : notesByBar[barToCopy].map((note) => {
                return {
                    ...note,
                    barTag: newBarTag,
                    tags: [...note.tags, copyGroup]
                }
            })
        }
    }
    setLatestMap(mapSongToMidiTicks())
}

