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

// Worker-specific implementation of getFollowingPhases
export const getFollowingPhasesWorker = (
  phaseName: string,
  phases: { [phaseName: string]: GenericPhase }
): [string, GenericPhase][] => {
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
