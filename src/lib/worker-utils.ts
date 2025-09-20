// Utility functions for web worker - self-contained implementations
// These are copies of the utility functions needed by the web worker

// Constants
export const ppq = 128 // 128 matches GarageBand's default

export const BAR = 'bar' as const
export const HALF = 'half' as const
export const QUARTER = 'quarter' as const
export const EIGHTH = 'eighth' as const
export const SIXTEENTH = 'sixteenth' as const
export const THIRTY_SECOND = 'thirtySecond' as const
export const SIXTY_FOURTH = 'sixtyFourth' as const
export const ONE_TWENTY_EIGHTH = 'oneTwentyEighth' as const
export const ZERO = 'zero' as const

export const tickCounts = {
  [ZERO]: 0,
  [BAR]: ppq * 4, // 128 ppq * 4
  [HALF]: (ppq * 4) / 2, // 128 * 2
  [QUARTER]: (ppq * 4) / 4, // 128
  [EIGHTH]: (ppq * 4) / 8, // 64
  [SIXTEENTH]: (ppq * 4) / 16, // 32
  [THIRTY_SECOND]: (ppq * 4) / 32, // 16
  [SIXTY_FOURTH]: (ppq * 4) / 64, // 8
  [ONE_TWENTY_EIGHTH]: (ppq * 4) / 128, // 4
} as { [key: string]: number }

// Types
export type TagData = (number | string | boolean | null)[]
export type TagEntry = [name: string, data: TagData]
export type TagEntries = [name: string, data: TagData][]

// Utility functions
export const strjson = (arg: any) => JSON.stringify(arg, null, 2)

export const isString = (arg: any): arg is string => {
  return typeof arg === 'string'
}

export const peprnIsNum = (arg: string | number) => {
  return typeof arg === 'number' || (arg !== '' && !isNaN(Number(arg)))
}

export const isCsvArg = (str: string): str is string => {
  return str.includes(',')
}

export const parseCsvArg = (
  str: string
): (string | number | boolean | null)[] => {
  if (!isCsvArg(str)) return [str]

  return str.split(',').map((splitOff) => {
    if (splitOff === 'null') return null
    if (peprnIsNum(splitOff)) return parseFloat(splitOff)
    if (splitOff === 'true') return true
    if (splitOff === 'false') return false
    return splitOff
  })
}

export const isFraction = (name: string): boolean => {
  return (
    name.includes('th') ||
    name.includes('quarter') ||
    name.includes('half') ||
    name.includes('whole')
  )
}

/**
 * Input is eg ['x=1', 'y=2', 'z=3,4']
 * @param tags
 * @returns
 */
export const parseNoteTags = (tags: string[]): TagEntries => {
  const parsedTags = tags.reduce((accum, tag) => {
    if (!tag.includes('=')) {
      return [...accum, [tag, []] as [nm: string, data: TagData]]
    }
    const split = tag.split('=')
    let tagDat: TagData = []
    if (peprnIsNum(split[1])) {
      tagDat = [parseFloat(split[1])]
    } else if (isCsvArg(split[1])) {
      tagDat = parseCsvArg(split[1])
    } else {
      tagDat = [split[1]]
    }

    return [...accum, [split[0], tagDat]] as TagEntries
  }, [] as TagEntries)

  return parsedTags
}

export const calcFractionalDelay = (parsedTags: TagEntries) => {
  let newNoteDelay = 0
  parsedTags.forEach(([name, data]: [nm: string, data: TagData]) => {
    if (isFraction(name)) {
      const [num] = data
      if (typeof num === 'number') {
        const taggedTickFactor = tickCounts[name]
        newNoteDelay += taggedTickFactor * num
      } else {
        const str = strjson(parsedTags)
        throw new Error(
          `Non-numeric fractional delay ${JSON.stringify(
            num
          )} ; all tag entries: ${str}`
        )
      }
    }
  })
  return newNoteDelay
}

export const calcTickDelay = (parsedTags: TagEntries) => {
  let newNoteDelay = 0
  const delay = parsedTags.find(([name]: [nm: string, data: TagData]) => {
    return name == 'barDelay'
  })

  if (delay) {
    const [noteCnt] = delay[1]
    if (typeof noteCnt === 'number') {
      newNoteDelay += noteCnt
    } else {
      throw new Error(`Non-numeric eigth note ${JSON.stringify(delay)}`)
    }
  }
  return newNoteDelay
}

export const quantizeNote = (parsedTags: TagEntries, rawOffset: number = 0) => {
  let thisNoteOffset = rawOffset
  thisNoteOffset += calcFractionalDelay(parsedTags) // e.g half, 4th etc
  thisNoteOffset += calcTickDelay(parsedTags) // e.g barDelay=1
  thisNoteOffset = quantizeOffset(thisNoteOffset, parsedTags)
  return thisNoteOffset
}

export const quantizeOffset = (rawOffset: number, parsedTags: TagEntries) => {
  // This is a simplified version - the actual implementation would need to be moved here
  return rawOffset
}
