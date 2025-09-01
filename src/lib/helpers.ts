// This module exports utility functions for common operations.
// External packages can import individual functions like:
// import { randId, phaseScale } from 'ollave/lib/helpers'
//
// Available exports:
// - strjson: Convert object to formatted JSON string
// - isString: Type guard for strings
// - isStringNumNum: Type guard for [string, number, number] arrays
// - peprnIsNum: Check if value is a number (string or number)
// - passivelyNumberize: Convert string to number if possible
// - isNum: Type guard for numbers
// - randId: Generate random ID with optional prefix
// - randomNumber: Generate random number in range
// - randomInt: Generate random integer in range
// - phaseScale: Get or set phase scale information
// - isScaleName: Check if string is a valid scale name
// - isScaleNameWithTonic: Check if string is scale name with tonic
// - properScaleName: Format scale name properly

import { isNumber } from "peprn/util"
import { makeNoteByBar, mem, NoteByBar, notesByBarSchema, songRecordSchema, trackRecordSchema } from "./mem"

import { allScales } from "./graphh"
import { isNoteNameWithoutOctave } from "../commands/bars/utils"
import { getAllPhaseBarNotes } from "./mem-db"
import { updateNoteTag } from "./tags"
import { notes } from "src/commands"
import { browser } from "user-tables"
import { fetchLatestSongAndTracks } from "./fetch"
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

export async function loadAndInitLatestSongAndTracks() {
    const latestSong = await fetchLatestSongAndTracks()
    if (latestSong) {
        mem().song = songRecordSchema.parse(latestSong.song)
        mem().tracks = [latestSong.tracks[0]]
        return latestSong
    }
    return null
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
            mem().phases[phaseName] = {
                id: track.id,
                name: phaseName,
                "follows-ids": [],
                "temp-id": track["phase-ids"][idx],
                speed: 1,
                barSizeMultiplier: 1,
                scaleName: null,
                scaleTonic: null
            }
        })
    })
}

export function saveSongAndTracks() {

    const songId = mem().song.id
    browser.userTables.update('song', { id: songId, data: mem().song }, {})
    mem().tracks.forEach((track) => {
        browser.userTables.update('track', { id: track.id, data: track }, {})
    })
}