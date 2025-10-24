// Shared core logic for MIDI mapping - used by both main thread and worker
// This eliminates code duplication between mapSongToTicks.ts and mapSongToTicks.worker.ts

import { tickCounts } from '../util/constantsUtil'
import { quantizeNote } from '../util/quantizeUtil'
import { parseNoteTags } from '../util/tagsUtil'

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
const DEFAULT_DURATION = 128
export const DEFAULT_VELOCITY = 90
// Core mapping function that works with generic types
export function mapPhaseTicksCore(
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
        velocity: !isNaN(parsedVelocity) ? parsedVelocity : DEFAULT_VELOCITY,
        duration: !isNaN(parsedDuration) ? parsedDuration : DEFAULT_DURATION,
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

// Main mapping function that works with generic types
export function mapSongToMidiTicksCore(
  phases: GenericPhases,
  notesByBar: GenericNotesByBar,
  getAllPhaseBarNotes: (phaseName: string) => GenericNoteByBar[][],
  getFollowingPhases: (phaseName: string) => [string, GenericPhase][],
  tickCountsObj: any = tickCounts,
  parseNoteTagsFn: any = parseNoteTags,
  quantizeNoteFn: any = quantizeNote
): MidiMappingResult {
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

// Utility function to find first phases (phases with no follows-ids)
export function getFirstPhases(
  phases: Record<string, GenericPhase>
): Array<[string, GenericPhase]> {
  return Object.entries(phases).filter(([_, phase]) => {
    // Handle cases where follows-ids might be undefined or missing
    const followsIds = phase['follows-ids']
    return !followsIds || followsIds.length === 0
  })
}

// Utility function to reduce collector array to a single midiMap
export function reduceCollectorToMidiMap(collector: PhaseMap[]): MidiMap {
  return collector.reduce((acc, curr) => {
    Object.entries(curr).forEach(([tickRaw, notes]) => {
      const tick = parseInt(tickRaw)
      if (!acc[tick]) acc[tick] = []
      acc[tick].push(...notes)
    })
    return acc
  }, {} as MidiMap)
}

// Utility function to create the worker result structure
export function createWorkerResult(
  midiMap: MidiMap,
  phaseAndBarStartAndEndTicks: PhaseAndBarStartAndEndTicks
): MidiMappingResult {
  return {
    map: midiMap,
    phaseAndBarStartAndEndTicks: {
      phases: { ...phaseAndBarStartAndEndTicks.phases },
      bars: { ...phaseAndBarStartAndEndTicks.bars },
    },
  }
}
