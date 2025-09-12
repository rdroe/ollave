// Web Worker for mapSongToMidiTicks processing
// This worker handles the computationally intensive task of mapping song data to MIDI ticks

// Import self-contained utilities
import { tickCounts, parseNoteTags, quantizeNote } from './worker-utils'

// Types (copied from the main file to avoid dependencies)
export type MidiMap = {
  [tick: number]: {
    note: string
    velocity?: number
    duration?: number
    compositionTags: string[]
  }[]
}

export type PhaseMap = {
  [tick: number]: {
    occassion: 'BAR_START' | 'BAR_END' | 'NOTE_START'
    data1: string[]
    data2: number[]
  }[]
}

export type BarTagPercent = [tagName: string | null, percent: number]

// Worker message types
type SerializableNoteByBar = {
  note: string
  tags: string[]
}

type SerializablePhases = {
  [phaseName: string]: {
    id: number
    name: string
    scaleName?: string | null
    scaleTonic?: string | null
    'follows-ids': number[]
    speed?: number | null
    barSizeMultiplier?: number | null
  }
}

type SerializableNotesByBar = {
  [barTag: string]: SerializableNoteByBar[]
}

type WorkerMessage = {
  type: 'MAP_SONG_TO_MIDI_TICKS'
  data: {
    phases: SerializablePhases
    notesByBar: SerializableNotesByBar
  }
}

type WorkerResponse = {
  type: 'MAP_SONG_TO_MIDI_TICKS_RESULT'
  data: MidiMap
}

// Worker-specific implementations of functions that depend on mem()
const getAllPhaseBarNotesWorker = (
  phase: string,
  notesByBar: SerializableNotesByBar
) => {
  const sortByNumberAfterColon = (a: string, b: string) => {
    const aNumber = parseInt(a.split(':')[1])
    const bNumber = parseInt(b.split(':')[1])
    return aNumber - bNumber
  }

  const getAllPhaseBars = (phase: string) => {
    if (typeof phase !== 'string') {
      throw new Error(
        `String arg is required in getAllPhaseBars; instead ${JSON.stringify(phase)}`
      )
    }
    const lookedUp = Object.keys(notesByBar)
      .filter((barTag) => barTag.startsWith(`${phase}:`))
      .sort(sortByNumberAfterColon)
    return lookedUp
  }

  const barNames = getAllPhaseBars(phase)
  const myNoteGroups = barNames.map((barName) => notesByBar[barName])
  return myNoteGroups
}

const getFollowingPhasesWorker = (
  phaseName: string,
  phases: SerializablePhases
) => {
  const phase = phases[phaseName]
  const followsPhases = Object.entries(phases).filter(([, phaseData]) => {
    const followsIds = phaseData['follows-ids']
    return (
      (phase.id !== null && followsIds.includes(phase.id)) ||
      (phase.id !== null && followsIds.includes(phase['id']))
    )
  })

  return followsPhases
}

// Main processing function
function mapPhaseTicks(
  phaseName: string,
  phase: SerializablePhases[string],
  startTick: number,
  collector: MidiMap[] = [],
  phases: SerializablePhases,
  notesByBar: SerializableNotesByBar
) {
  const barTickFactor = tickCounts.bar

  // get the bar-sorted bar notes
  const phaseBars = getAllPhaseBarNotesWorker(phaseName, notesByBar)
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
    // INTERPRETING INDIVIDUAL NOTES TO REAL TIMING
    barNotes.forEach((note) => {
      const parsedTags = parseNoteTags(note.tags)
      const thisNoteTick = quantizeNote(parsedTags) + startTick + thisBarOffset
      if (!phaseMidi[thisNoteTick]) {
        phaseMidi[thisNoteTick] = []
      }

      phaseMidi[thisNoteTick].push({
        note: note.note,
        compositionTags: note.tags,
      })
    })
  })
  collector.push(phaseMidi)
  const followsPhases = getFollowingPhasesWorker(phaseName, phases)

  followsPhases.forEach(([followsPhaseName, followsPhase]) => {
    mapPhaseTicks(
      followsPhaseName,
      followsPhase,
      phaseBars.length * barTickFactor,
      collector,
      phases,
      notesByBar
    )
  })

  return collector
}

// Main worker function
function mapSongToMidiTicksWorker(
  phases: SerializablePhases,
  notesByBar: SerializableNotesByBar
): MidiMap {
  const firstPhases = Object.entries(phases).filter(([_, phase]) => {
    return phase['follows-ids'].length === 0
  })

  const collector: MidiMap[] = []
  firstPhases.forEach(([phaseName, phase]) => {
    mapPhaseTicks(phaseName, phase, 0, collector, phases, notesByBar)
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

  return midiMap
}

// Worker message handler
self.onmessage = function (e: MessageEvent<WorkerMessage>) {
  const { type, data } = e.data

  if (type === 'MAP_SONG_TO_MIDI_TICKS') {
    try {
      const result = mapSongToMidiTicksWorker(data.phases, data.notesByBar)

      const response: WorkerResponse = {
        type: 'MAP_SONG_TO_MIDI_TICKS_RESULT',
        data: result,
      }

      self.postMessage(response)
    } catch (error) {
      self.postMessage({
        type: 'ERROR',
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
    }
  }
}

// Export for TypeScript
export {}
