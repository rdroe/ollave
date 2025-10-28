// Utility functions for web worker - self-contained implementations
// These are copies of the utility functions needed by the web worker

import { DEFAULT_DURATION } from 'jsmidgen'
// const DEFAULT_DURATION = 128
export const DEFAULT_VELOCITY = 90

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
// an object with all the utility functions as properties, so names are preseserved in the worker code
export const workerBall = {
  strjson: strjson,
  isString: isString,
  peprnIsNum: peprnIsNum,
  isCsvArg: isCsvArg,
  parseCsvArg: parseCsvArg,
  isFraction: isFraction,
  parseNoteTags: parseNoteTags,
  calcFractionalDelay: calcFractionalDelay,
  calcTickDelay: calcTickDelay,
  quantizeNote: quantizeNote,
  quantizeOffset: quantizeOffset,
  mapSongToMidiTicksCore: mapSongToMidiTicksCore,
  DEFAULT_VELOCITY: DEFAULT_VELOCITY,
  DEFAULT_DURATION: DEFAULT_DURATION,
}

// Utility functions
export function strjson(arg: unknown) {
  return JSON.stringify(arg, null, 2)
}

export function isString(arg: unknown): arg is string {
  return typeof arg === 'string'
}

export function peprnIsNum(arg: string | number) {
  return typeof arg === 'number' || (arg !== '' && !isNaN(Number(arg)))
}

export function isCsvArg(str: string): str is string {
  return str.includes(',')
}

export function parseCsvArg(str: string): (string | number | boolean | null)[] {
  if (!workerBall['isCsvArg'](str)) return [str]

  const peprnIsNum = (arg: string | number) => {
    return typeof arg === 'number' || (arg !== '' && !isNaN(Number(arg)))
  }
  return str.split(',').map((splitOff) => {
    if (splitOff === 'null') return null
    if (peprnIsNum(splitOff)) return parseFloat(splitOff)
    if (splitOff === 'true') return true
    if (splitOff === 'false') return false
    return splitOff
  })
}

export function isFraction(name: string): boolean {
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
export function parseNoteTags(tags: string[]): TagEntries {
  const peprnIsNum = (arg: string | number) => {
    return typeof arg === 'number' || (arg !== '' && !isNaN(Number(arg)))
  }
  const parsedTags = tags.reduce((accum, tag) => {
    if (!tag.includes('=')) {
      return [...accum, [tag, []] as [nm: string, data: TagData]]
    }
    const split = tag.split('=')
    let tagDat: TagData = []
    if (peprnIsNum(split[1])) {
      tagDat = [parseFloat(split[1])]
    } else if (workerBall.isCsvArg(split[1])) {
      tagDat = parseCsvArg(split[1])
    } else {
      tagDat = [split[1]]
    }

    return [...accum, [split[0], tagDat]] as TagEntries
  }, [] as TagEntries)

  return parsedTags
}

export function calcFractionalDelay(parsedTags: TagEntries) {
  let newNoteDelay = 0
  parsedTags.forEach(([name, data]: [nm: string, data: TagData]) => {
    if (workerBall.isFraction(name)) {
      const [num] = data
      if (typeof num === 'number') {
        const taggedTickFactor = tickCounts[name]
        newNoteDelay += taggedTickFactor * num
      } else {
        const str = workerBall.strjson(parsedTags)
        throw new Error(
          'Non-numeric fractional delay' +
            JSON.stringify(num) +
            ' ; all tag entries: ' +
            str
        )
      }
    }
  })
  return newNoteDelay
}

export function calcTickDelay(parsedTags: TagEntries) {
  let newNoteDelay = 0
  const delay = parsedTags.find(([name]: [nm: string, data: TagData]) => {
    return name == 'barDelay'
  })

  if (delay) {
    const [noteCnt] = delay[1]
    if (typeof noteCnt === 'number') {
      newNoteDelay += noteCnt
    } else {
      throw new Error('Non-numeric eigth note ' + JSON.stringify(delay))
    }
  }
  return newNoteDelay
}

export function quantizeNote(parsedTags: TagEntries, rawOffset: number = 0) {
  let thisNoteOffset = rawOffset
  thisNoteOffset += workerBall.calcFractionalDelay(parsedTags) // e.g half, 4th etc
  thisNoteOffset += workerBall.calcTickDelay(parsedTags) // e.g barDelay=1
  thisNoteOffset = workerBall.quantizeOffset(thisNoteOffset, parsedTags)
  return thisNoteOffset
}

export function quantizeOffset(rawOffset: number, parsedTags: TagEntries) {
  // This is a simplified version - the actual implementation would need to be moved here
  return rawOffset
}

export function mapSongToMidiTicksCore(
  phases: GenericPhases,
  notesByBar: GenericNotesByBar,
  getAllPhaseBarNotes: (phaseName: string) => GenericNoteByBar[][],
  getFollowingPhases: (phaseName: string) => [string, GenericPhase][],
  tickCountsObj: any = tickCounts,
  parseNoteTagsFn: any = parseNoteTags,
  quantizeNoteFn: any = quantizeNote
): MidiMappingResult {
  const mapPhaseTicksCore = function mapPhaseTicksCore(
    phaseName: string,
    phase: GenericPhase,
    startTick: number,
    collector: MidiMap[] = [],
    phaseAndBarStartAndEndTicks: PhaseAndBarStartAndEndTicks = {
      phases: {},
      bars: {},
    },
    getAllPhaseBarNotes: (phaseName: string) => GenericNoteByBar[][],
    getFollowingPhases: (phaseName: string) => [string, GenericPhase][],
    tickCountsObj: any = tickCounts,
    parseNoteTagsFn: any = parseNoteTags,
    quantizeNoteFn: any = quantizeNote
  ): {
    map: MidiMap[]
    phaseAndBarStartAndEndTicks: PhaseAndBarStartAndEndTicks
  } {
    // add phase start tick
    phaseAndBarStartAndEndTicks.phases[phaseName] = [startTick, -1]
    const barTickFactor = tickCountsObj.bar

    // get the bar-sorted bar notes
    const phaseBars = getAllPhaseBarNotes(phaseName)
    // initialize the midi map where we will put each note on a numeric midi property
    const phaseMidi: MidiMap = {}

    // for each bar, use the bar semantic "tags" property to determine which notes to play on that midi tick.
    phaseBars.forEach((barNotes, barIndex) => {
      // loop (not just multiplying by index) because later bars may have a different bar size multiplier each
      const thisBarOffset =
        barIndex *
        barTickFactor *
        (typeof phase?.barSizeMultiplier === 'number'
          ? phase.barSizeMultiplier
          : 1)

      phaseAndBarStartAndEndTicks.bars[`${barIndex}`] = [
        startTick + thisBarOffset,
        startTick +
          thisBarOffset +
          barTickFactor *
            (typeof phase?.barSizeMultiplier === 'number'
              ? phase.barSizeMultiplier
              : 1),
      ]

      // INTERPRETING INDIVIDUAL NOTES TO REAL TIMING
      barNotes.forEach((note) => {
        const parsedTags = parseNoteTagsFn(note.tags)
        const thisNoteTick =
          quantizeNoteFn(parsedTags) + startTick + thisBarOffset
        if (!phaseMidi[thisNoteTick]) {
          phaseMidi[thisNoteTick] = []
        }
        const durationRaw = note.tags
          .find((tag) => tag.startsWith('duration='))
          ?.split('=')?.[1]
          ?.split(',')?.[0]
        const parsedDuration = parseInt(durationRaw)
        const velocityRaw = note.tags
          .find((tag) => tag.startsWith('velocity='))
          ?.split('=')?.[1]
          ?.split(',')?.[0]
        const parsedVelocity = parseInt(velocityRaw)
        phaseMidi[thisNoteTick].push({
          note: note.note,
          compositionTags: note.tags,
          velocity: !isNaN(parsedVelocity)
            ? parsedVelocity
            : workerBall.DEFAULT_VELOCITY,
          duration: !isNaN(parsedDuration)
            ? parsedDuration
            : workerBall.DEFAULT_DURATION,
        })
      })

      // if last bar, add phase end tick
      if (barIndex === phaseBars.length - 1) {
        phaseAndBarStartAndEndTicks.phases[phaseName] = [
          startTick + thisBarOffset,
          startTick +
            thisBarOffset +
            barTickFactor *
              (typeof phase?.barSizeMultiplier === 'number'
                ? phase.barSizeMultiplier
                : 1),
        ]
      }
    })

    collector.push(phaseMidi)
    const followsPhases = getFollowingPhases(phaseName)

    followsPhases.forEach(([followsPhaseName, followsPhase]) => {
      mapPhaseTicksCore(
        followsPhaseName,
        followsPhase,
        phaseBars.length * barTickFactor,
        collector,
        phaseAndBarStartAndEndTicks,
        getAllPhaseBarNotes,
        getFollowingPhases,
        tickCountsObj,
        parseNoteTagsFn,
        quantizeNoteFn
      )
    })

    return { map: collector, phaseAndBarStartAndEndTicks }
  }

  const firstPhases = Object.entries(phases).filter(([_, phase]) => {
    // Handle cases where follows-ids might be undefined or missing
    const followsIds = phase['follows-ids']
    return !followsIds || followsIds.length === 0
  })

  const collector: MidiMap[] = []
  const phaseAndBarStartAndEndTicks: PhaseAndBarStartAndEndTicks = {
    phases: {},
    bars: {},
  }

  firstPhases.forEach(([phaseName, phase]) => {
    mapPhaseTicksCore(
      phaseName,
      phase,
      0,
      collector,
      phaseAndBarStartAndEndTicks,
      getAllPhaseBarNotes,
      getFollowingPhases,
      tickCountsObj,
      parseNoteTagsFn,
      quantizeNoteFn
    )
  })

  // phase-level massaging here.
  const midiMap: MidiMap = collector.reduce((acc, curr) => {
    Object.entries(curr).forEach(([tickRaw, notes]) => {
      const tick = parseInt(tickRaw)
      if (!acc[tick]) {
        acc[tick] = []
      }
      acc[tick].push(...notes)
    })
    return acc
  }, {} as MidiMap)

  return { map: midiMap, phaseAndBarStartAndEndTicks }
}

// Import PhaseMap type from mapSongToTicks.ts
export type PhaseMap = {
  [tick: number]: {
    note: string
    velocity?: number
    duration?: number
    compositionTags: string[]
  }[]
}

// Types
export type MidiMap = {
  [tick: number]: {
    note: string
    velocity?: number
    duration?: number
    compositionTags: string[]
  }[]
}

export type PhaseAndBarStartAndEndTicks = {
  phases: { [phaseName: string]: [startTick: number, endTick: number] }
  bars: { [barName: string]: [startTick: number, endTick: number] }
}

export type MidiMappingResult = {
  map: MidiMap
  phaseAndBarStartAndEndTicks: PhaseAndBarStartAndEndTicks
}

// Generic phase type that works for both main thread and worker
export type GenericPhase = {
  id: number
  name: string
  scaleName?: string | null
  scaleTonic?: string | null
  'follows-ids': number[]
  speed?: number | null
  barSizeMultiplier?: number | null
}

export type GenericNoteByBar = {
  note: string
  tags: string[]
}

export type GenericNotesByBar = {
  [barTag: string]: GenericNoteByBar[]
}

export type GenericPhases = {
  [phaseName: string]: GenericPhase
}
