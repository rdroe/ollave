import { isNumber } from "peprn/util"
import { makeNoteByBar,  NoteByBar, notesByBarSchema, phaseRecordSchema, songRecordSchema, trackRecordSchema } from "./schemas"
import { mem } from "../core/mem"
import { allScales } from "./graphh"
import { isNoteNameWithoutOctave } from "./util/barsUtil"
import { getAllPhaseBarNotes } from "./util/phaseUtil"
import { updateNoteTag } from "./util/tagsUtil"
import { setLatestMap } from "../core/observables"
import { browser } from "user-tables"
import { fetchLatestSongAndTracks, loadAndInitLatestSongAndTracks } from "./fetch"
import { mapSongToMidiTicks } from "./mapSongToTicks"
import { addSlider } from "./addSlider"
import { PhaseRecord, SongRecord, TrackRecord } from "../commands/song/song"
import { getSongNames } from "../lib/util/songUtil"
import { deleteCueObservable, startCueObservable, stopCueObservable } from "../core/observables/songObservables"
export const strjson = (arg: any) => JSON.stringify(arg, null, 2)
export const isString = (arg: any): arg is string => {
    return typeof arg === 'string'
}

export const isStringNumNum = (arr: any[]): arr is [string, number, number] => {
    if (arr.length !== 3) return false
    const [a, b, c] = arr
    return isString(a) && isNum(b) && isNum(c)
}

export const peprnIsNum = (arg: string | number) => {
    return typeof arg === 'number' || isNumber(arg)
}

export const passivelyNumberize = (arg: string | number): number | string => {
    if (typeof arg === 'number') return arg
    // @ts-ignore
    const isNumber = !isNaN(arg)
    return isNumber ? parseFloat(arg) : arg
}

export const isNum = (arg: any): arg is number => {
    return typeof arg === 'number'
}

function randomString(length: number) {
    const chars = '0123456789abcdef'
    var result = '';
    for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

export const randId = (prefix = "", length = 10) => {
    let randStr = randomString(length);
    if (prefix) {
        return `${prefix}.${randStr}`
    }
    while (peprnIsNum(randStr)) {
        randStr = randomString(length);
    }
    return `${randStr}`
}
export function randomNumber(min: number, max: number) {
    return Math.floor(Math.random() * (max - min) + min);
}

export function randomInt(min: number = 1, max: number = 900000) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}


export const phaseScale = (phaseName: string, userScale?: string, userTonic?: string, doUpdatePhase: boolean = true) => {
    const phase = mem().phases[phaseName]
    if (!phase) {
        console.error('phase not found', phaseName, mem().phases)
        throw new Error(`Phase ${phaseName} not found`)
    }
    if (!userScale && !userTonic) {
        return {
            scaleName: phase.scaleName,
            scaleTonic: phase.scaleTonic,
        }
    }
    if (!userScale || !userTonic) {
        throw new Error(`Scale and tonic must both be provided to set phase scale`)
    }
    const properlyCasedScaleName = properScaleName(userScale) 

    phase.scaleName = properlyCasedScaleName
    phase.scaleTonic = userTonic

    if (doUpdatePhase) {
        getAllPhaseBarNotes(phaseName).forEach((bar) => {
            bar.forEach((note) => {
                updateNoteTag(note, 'scaleTonic', [userTonic])
                updateNoteTag(note, 'scaleName', [properlyCasedScaleName])
            })
        })
    }

    return {
        scaleName: userScale,
        scaleTonic: userTonic,
    }
}

export function isScaleName(str: string): str is typeof allScales[number]['name'] {

    return !!allScales.find((scale) => {
        const found = scale.name.toLowerCase().endsWith(` ${str.toLowerCase()}`)
        return found
    })
}

export function isScaleNameWithTonic(str: string) {
    const [scaleTonic, scaleName] = str.split(' ')
    if (!scaleTonic || !scaleName) {
        return false
    }
    if (!isScaleName(scaleName)) {
        throw new Error(`Scale ${scaleName} not found`)
    }
    if (!isNoteNameWithoutOctave(scaleTonic)) {
        throw new Error(`Scale tonic ${scaleTonic} not acceptable`)
    }
    return true
}

export function properScaleName(str: string) {
    if (!isScaleName(str)) {
        throw new Error(`Scale ${str} not found`)
    }
    const scaleNameExample = allScales.find((scale) => {
        return scale.name.toLowerCase().endsWith(` ${str.toLowerCase()}`)
    })
    if (!scaleNameExample) {
        throw new Error(`Scale ${str} not found`)
    }
    return scaleNameExample.name.split(' ')[1]
}

export function initNotesByBar() {
    songRecordSchema.parse(mem().song) 
    const notesByBar = mem().tracks.reduce((acc, track) => {
        return {
            ...acc,
            ...track.notesByBar
        }
    }, {} as Record<string, NoteByBar[]>)
    mem().notesByBar = notesByBarSchema.parse(notesByBar)
}



export function compileNotesByBarToTracks() {
    songRecordSchema.parse(mem().song)
    const { tracks } = mem()
    const notesByBar = notesByBarSchema.parse(mem().notesByBar)
    Object.keys(notesByBar).forEach((barId) => {
        const phaseIdForBar = barId.split(':')[0]
        const owningTrack = tracks.find((track) => track["phase-names"].includes(phaseIdForBar))
        if (owningTrack) {
            owningTrack.notesByBar[barId] = notesByBar[barId]
        }
    })
    mem().tracks = tracks
}

export function compilePhasesToTracks() {
    // get the phase names, then temp ids of phases that have bars in notesByBar
    const activePhaseNames = Object.keys(mem().notesByBar).map((barTag) => {
        return barTag.split(':')[0]
    })
    const activePhaseTempIds = activePhaseNames.map((phaseName) => {
        return mem().phases[phaseName].id
    })
    const deleteablePhaseTempIds = [...new Set(mem().tracks.flatMap((track) => track["phase-ids"]))].filter((tempId) => !activePhaseTempIds.includes(tempId))
    // filter out any phases that are not in activePhaseTempIds; same for names
    mem().tracks.forEach((track) => {
        track["phase-ids"] = track["phase-ids"].filter((tempId) => !deleteablePhaseTempIds.includes(tempId))
        track["phase-names"] = track["phase-names"].filter((phaseName) => activePhaseNames.includes(phaseName))
    })
    // clean up phases in memory
    mem().phases = Object.values(mem().phases).filter((phase) => activePhaseTempIds.includes(phase.id)).reduce((acc, phase) => {
        acc[phase.name] = phase
        return acc
    }, {} as { [phaseName: string]: PhaseRecord })
}

// make the notesByBar from tracks live on the song.
export function compileTracksToNotesByBar() {
    const { tracks } = mem()
    const notesByBar = tracks.reduce((acc, track) => {
        return {
            ...acc,
            ...Object.fromEntries(Object.entries(track.notesByBar).map(([barId, notes]) => [barId, notes.map((note) => makeNoteByBar(note.note, note.tags))]))
        }
    }, {} as Record<string, NoteByBar[]>)
    mem().notesByBar = notesByBar
}

export function compileTracksToPhasesProperties() {
    const { tracks } = mem()
    tracks.forEach((track, idx) => {
        track["phase-names"] .forEach((phaseName, idx) => {
            const existingPhase = mem().phases[phaseName]
            const phaseRecord: PhaseRecord = {
                ...existingPhase,
                id: track["phase-ids"][idx],
                "follows-ids": [],
                speed: 1,
                barSizeMultiplier: 1, 
            }
            mem().phases[phaseName] = phaseRecord
        })
    })
}

export function saveSongAndTracks() {
    const songId = mem().song.id
    browser.userTables.update('song', { id: songId, data: mem().song }, {})
    Object.values(mem().phases).forEach((phase) => {
        browser.userTables.update('phase', { id: phase.id, data: phase }, {
            id: phase.id
        })
    })
    mem().tracks.forEach((track) => {
        browser.userTables.update('track', { id: track.id, data: track }, {})
    })
}