import { isNumber } from "peprn/util"
// Removed schema imports to break circular dependency
import { mem } from "../core/mem"
// Removed graphh import to break circular dependency
import { isNoteNameWithoutOctave } from "./util/noteValidationUtil"
import { getAllPhaseBarNotes } from "./util/phaseNotesUtil"
import { updateNoteTag } from "./util/tagUpdateUtil"
import { setLatestMap } from "../core/observables"
import { browser } from "user-tables"
// Removed fetch imports to break circular dependency
// Removed mapSongToMidiTicks import to break circular dependency
// Removed addSlider import to break circular dependency
// Removed types import to break circular dependency
// Removed getSongNames import to break circular dependency
// Removed songObservables import to break circular dependency
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

    const properlyCasedScaleName = properScaleName(userScale)

    phase.scaleName = properlyCasedScaleName
    phase.scaleTonic = userTonic

    if (doUpdatePhase) {
      if (!userScale || !userTonic) {
        throw new Error(`Scale and tonic must both be provided to set phase scale`)
      }
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

// Re-export functions from their new locations
export { isScaleName, isScaleNameWithTonic, properScaleName } from "./util/scaleUtil"

// Import for local use
import { properScaleName } from "./util/scaleUtil"

// Re-export schema functions from their new locations
export { initNotesByBar, compileNotesByBarToTracks, compilePhasesToTracks, compileTracksToNotesByBar, compileTracksToPhasesProperties } from "./util/schemaUtil"

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
