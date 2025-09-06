import { parseCsvArg } from './barsUtil'
import { strjson } from './common'
import { isFraction } from './tickUtil'
import { tickCounts } from './constantsUtil'

// Forward declarations to avoid circular imports
export type Abbreviation = string

export const abbrev: Record<string, string> = {
    // This is a simplified version - the actual implementation would need to be moved here
    'quarter': 'quarter',
    'half': 'half',
    'whole': 'whole',
    'eighth': 'eighth',
    'sixteenth': 'sixteenth',
    '32nd': '32nd',
    '64th': '64th'
}

export const isAbbreviation = (elem: any): elem is Abbreviation => {
    return typeof elem === 'string' && elem in abbrev
}

export const isAbbreviationCsv = (csvOrSingleFract: any) => {
    if (typeof csvOrSingleFract === 'string' && csvOrSingleFract.includes(',')) {
        return parseCsvArg(csvOrSingleFract).find((x) => !isAbbreviation(x)) === undefined
    } else if (isAbbreviation(csvOrSingleFract)) {
        return true
    }
    return false
}

export const parseAbbreviationCsv = (csvOrSingleFract: string) => {
    let parsedCsvArg: Abbreviation[] | undefined
    if (csvOrSingleFract.includes(',')) {
        const parsed = parseCsvArg(csvOrSingleFract)
        const filtered: Abbreviation[] = parsed.filter((elem) => isAbbreviation(elem)) as Abbreviation[]
        if (filtered.length !== parsed.length) {
            throw new Error(`Found a non-abbreviation where all elements should have ${strjson({ parsed, filtered })}`)
        }
        parsedCsvArg = filtered
    } else if (isAbbreviation(csvOrSingleFract)) {
        parsedCsvArg = [csvOrSingleFract]
    } else {
        throw new Error(`Not a valid abbreviation csv: ${csvOrSingleFract}`)
    }
    return parsedCsvArg
}

export const sumAbbreviationCsv = (csv: string) => {
    const arr = parseAbbreviationCsv(csv)
    return arr.reduce((accum, elem) => {
        if (!isAbbreviation(elem)) {
            throw new Error(`Non-abbreviation found error`)
        }
        const fract = abbrev[elem]
        return accum + tickCounts[fract]
    }, 0)
}

export const quantizeValueToAbbreviation = (rawOffset: number, quantizeTargetAbbrev: Abbreviation) => {
    if (isAbbreviation(quantizeTargetAbbrev)) {
        const quantizeTargetNum = tickCounts[abbrev[quantizeTargetAbbrev]]
        return Math.round(rawOffset / quantizeTargetNum) * quantizeTargetNum
    }
    console.error(`${quantizeTargetAbbrev} is not a valid abbreviation for a quantization target`)
    return rawOffset
}
