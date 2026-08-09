// Utility functions for web worker - self-contained implementations
// These are copies of the utility functions needed by the web worker

import { DEFAULT_DURATION } from 'jsmidgen'

import { buildPhaseSchedule } from './shared/phaseSchedule'
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
  // Retained for signature compatibility with every existing caller; the DAG
  // scheduler derives follower order from 'follows-ids' itself.
  _getFollowingPhases: (phaseName: string) => [string, GenericPhase][],
  tickCountsObj: any = tickCounts,
  parseNoteTagsFn: any = parseNoteTags,
  quantizeNoteFn: any = quantizeNote
): MidiMappingResult {
  // One topological pass replaces the old recursive walk from every root: it
  // accumulates parent start ticks and multipliers, visits a multi-parent
  // child once, and terminates on cycles. See shared/phaseSchedule.ts.
  const barNotesByPhase: { [phaseName: string]: GenericNoteByBar[][] } = {}
  const barCountOf = (phaseName: string) => {
    if (!barNotesByPhase[phaseName]) {
      barNotesByPhase[phaseName] = getAllPhaseBarNotes(phaseName)
    }
    return barNotesByPhase[phaseName].length
  }

  const schedule = buildPhaseSchedule(phases, barCountOf)
  schedule.problems.forEach((problem) => {
    if (problem.kind === 'missing-parent') {
      console.warn(
        `phase "${problem.phaseName}" follows missing phase id ${problem.parentId}; treating it as a root`
      )
    } else {
      console.warn(
        `phase cycle detected among ${problem.phaseNames.join(', ')}; scheduling them after their resolvable parents`
      )
    }
  })

  const phaseAndBarStartAndEndTicks: PhaseAndBarStartAndEndTicks = {
    phases: {},
    bars: {},
  }
  const midiMap: MidiMap = {}

  Object.entries(schedule.phases).forEach(([phaseName, scheduled]) => {
    phaseAndBarStartAndEndTicks.phases[phaseName] = [
      scheduled.startTick,
      scheduled.endTick,
    ]

    const phaseBars = barNotesByPhase[phaseName] ?? []
    const barTickFactor = tickCountsObj.bar * scheduled.barSizeMultiplier

    phaseBars.forEach((barNotes, barIndex) => {
      const barStart = scheduled.startTick + barIndex * barTickFactor
      // Keyed by FULL bar id: bare '0'/'1' keys let phases overwrite each
      // other's timings, which is why a second phase's bars used to vanish.
      phaseAndBarStartAndEndTicks.bars[`${phaseName}:${barIndex}`] = [
        barStart,
        barStart + barTickFactor,
      ]

      // INTERPRETING INDIVIDUAL NOTES TO REAL TIMING
      barNotes.forEach((note) => {
        const parsedTags = parseNoteTagsFn(note.tags)
        const thisNoteTick = quantizeNoteFn(parsedTags) + barStart
        if (!midiMap[thisNoteTick]) {
          midiMap[thisNoteTick] = []
        }
        const durationRaw = note.tags
          .find((tag) => tag.startsWith('duration='))
          ?.split('=')?.[1]
          ?.split(',')?.[0]
        const parsedDuration = parseInt(durationRaw ?? '')
        const velocityRaw = note.tags
          .find((tag) => tag.startsWith('velocity='))
          ?.split('=')?.[1]
          ?.split(',')?.[0]
        const parsedVelocity = parseInt(velocityRaw ?? '')
        midiMap[thisNoteTick].push({
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
    })
  })

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
