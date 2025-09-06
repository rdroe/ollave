import { allScales } from "../graphh"
import { isNoteNameWithoutOctave } from "./noteValidationUtil"

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
