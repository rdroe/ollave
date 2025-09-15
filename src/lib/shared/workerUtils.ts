// Shared utilities for worker implementations
// This provides worker-specific implementations of functions that depend on mem()

import {
  GenericPhase,
  GenericNotesByBar,
  GenericNoteByBar,
} from './midiMappingCore'

// Worker-specific implementation of getAllPhaseBarNotes
export const getAllPhaseBarNotesWorker = (
  phase: string,
  notesByBar: GenericNotesByBar
): GenericNoteByBar[][] => {
  // Add defensive checks
  if (typeof phase !== 'string') {
    throw new Error(
      `String arg is required in getAllPhaseBarNotesWorker; instead ${JSON.stringify(phase)}`
    )
  }

  if (!notesByBar || typeof notesByBar !== 'object') {
    throw new Error(
      `notesByBar must be an object in getAllPhaseBarNotesWorker; instead ${JSON.stringify(notesByBar)}`
    )
  }

  const sortByNumberAfterColon = (a: string, b: string) => {
    const aNumber = parseInt(a.split(':')[1])
    const bNumber = parseInt(b.split(':')[1])
    return aNumber - bNumber
  }

  const getAllPhaseBars = (phase: string) => {
    const lookedUp = Object.keys(notesByBar)
      .filter((barTag) => barTag.startsWith(`${phase}:`))
      .sort(sortByNumberAfterColon)
    return lookedUp
  }

  const barNames = getAllPhaseBars(phase)
  const myNoteGroups = barNames.map((barName) => notesByBar[barName])
  return myNoteGroups
}

// Worker-specific implementation of getFollowingPhases
export const getFollowingPhasesWorker = (
  phaseName: string,
  phases: { [phaseName: string]: GenericPhase }
): [string, GenericPhase][] => {
  // Add defensive checks
  if (typeof phaseName !== 'string') {
    throw new Error(
      `String arg is required in getFollowingPhasesWorker; instead ${JSON.stringify(phaseName)}`
    )
  }

  if (!phases || typeof phases !== 'object') {
    throw new Error(
      `phases must be an object in getFollowingPhasesWorker; instead ${JSON.stringify(phases)}`
    )
  }

  const phase = phases[phaseName]
  if (!phase) {
    throw new Error(`Phase '${phaseName}' not found in phases object`)
  }

  const followsPhases = Object.entries(phases).filter(([, phaseData]) => {
    const followsIds = phaseData['follows-ids']
    // Handle cases where follows-ids might be undefined or missing
    if (!followsIds || !Array.isArray(followsIds)) {
      return false
    }
    return (
      (phase.id !== null && followsIds.includes(phase.id)) ||
      (phase.id !== null && followsIds.includes(phase['id']))
    )
  })

  return followsPhases
}

// Utility function to create a worker message handler
export function createWorkerMessageHandler(
  workerFunction: (phases: any, notesByBar: any) => any
): (e: MessageEvent) => void {
  return function (e: MessageEvent) {
    const { type, data } = e.data
    if (type === 'MAP_SONG_TO_MIDI_TICKS') {
      try {
        // Validate input data
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid message data: data must be an object')
        }
        if (!data.phases || typeof data.phases !== 'object') {
          throw new Error('Invalid phases data: phases must be an object')
        }
        if (!data.notesByBar || typeof data.notesByBar !== 'object') {
          throw new Error(
            'Invalid notesByBar data: notesByBar must be an object'
          )
        }

        const result = workerFunction(data.phases, data.notesByBar)
        self.postMessage({
          type: 'MAP_SONG_TO_MIDI_TICKS_RESULT',
          data: result,
        })
      } catch (error) {
        console.error('Worker caught error:', error)
        const errorMessage =
          error instanceof Error
            ? error.message
            : error
              ? String(error)
              : 'Unknown error occurred'
        console.error('Worker sending error message:', errorMessage)
        self.postMessage({
          type: 'ERROR',
          error: errorMessage,
        })
      }
    }
  }
}
