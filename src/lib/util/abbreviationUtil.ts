import { parseCsvArg } from './barsUtil'
import { strjson } from './common'
import {
  abbrev,
  Abbreviation,
  tickCounts,
  isAbbreviation,
} from './constantsUtil'
// Forward declarations to avoid circular imports

export const isAbbreviationCsv = (csvOrSingleFract: unknown) => {
  if (typeof csvOrSingleFract === 'string' && csvOrSingleFract.includes(',')) {
    return (
      parseCsvArg(csvOrSingleFract).find((x) => !isAbbreviation(x)) ===
      undefined
    )
  } else if (isAbbreviation(csvOrSingleFract)) {
    return true
  }
  return false
}

export const parseAbbreviationCsv = (csvOrSingleFract: string) => {
  let parsedCsvArg: Abbreviation[] | undefined
  if (csvOrSingleFract.includes(',')) {
    const parsed = parseCsvArg(csvOrSingleFract)
    const filtered: Abbreviation[] = parsed.filter((elem) =>
      isAbbreviation(elem)
    ) as Abbreviation[]
    if (filtered.length !== parsed.length) {
      throw new Error(
        `Found a non-abbreviation where all elements should have ${strjson({ parsed, filtered })}`
      )
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

export const quantizeValueToAbbreviation = (
  rawOffset: number,
  quantizeTargetAbbrev: Abbreviation
) => {
  if (isAbbreviation(quantizeTargetAbbrev)) {
    if (quantizeTargetAbbrev === '0th') {
      return rawOffset
    }
    const quantizeTargetNum = tickCounts[abbrev[quantizeTargetAbbrev]]
    return Math.round(rawOffset / quantizeTargetNum) * quantizeTargetNum
  }
  console.error(
    `${quantizeTargetAbbrev} is not a valid abbreviation for a quantization target`
  )
  return rawOffset
}
