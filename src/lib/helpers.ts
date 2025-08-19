import { isNumber } from "peprn/util"
import { mem } from "./mem"

import { allScales } from "./graphh"
import { isNoteNameWithoutOctave } from "../commands/bars/utils"
import { getAllPhaseBarNotes } from "./mem-db"
import { updateNoteTag } from "./tags"
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
    const randStr = randomString(length);
    if (prefix) {
        return `${prefix}.${randStr}`
    }
    return randStr
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