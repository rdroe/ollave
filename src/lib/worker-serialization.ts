// Serialization utilities for web worker communication
// Handles cloning of complex objects that can't be structured cloned

import { NoteByBar } from './schemas'
import { MidiMappingResult, MidiMap } from './shared/midiMappingCore'

// Serializable versions of the data structures
export type SerializableNoteByBar = {
  note: string
  tags: string[]
  tagsObj?: { [key: string]: any } // Include parsed tags object
}

export type SerializablePhases = {
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

export type SerializableNotesByBar = {
  [barTag: string]: SerializableNoteByBar[]
}

export type SerializableMidiMap = {
  [tick: number]: {
    note: string
    velocity?: number
    duration?: number
    compositionTags: string[]
  }[]
}

export type SerializablePhaseAndBarStartAndEndTicks = {
  phases: { [phaseName: string]: [startTick: number, endTick: number] }
  bars: { [barName: string]: [startTick: number, endTick: number] }
}

export type SerializableMidiMappingResult = {
  map: SerializableMidiMap
  phaseAndBarStartAndEndTicks: SerializablePhaseAndBarStartAndEndTicks
}

// Convert NoteByBar objects to serializable format
export function serializeNoteByBar(note: NoteByBar): SerializableNoteByBar {
  return {
    note: note.note,
    tags: [...note.tags], // Create a new array to avoid proxy issues
    tagsObj: note.tagsObj ? { ...note.tagsObj } : undefined, // Create plain object copy
  }
}

// Convert notesByBar to serializable format
export function serializeNotesByBar(
  notesByBar: Record<string, NoteByBar[]>
): SerializableNotesByBar {
  const serialized: SerializableNotesByBar = {}

  for (const [barTag, notes] of Object.entries(notesByBar)) {
    serialized[barTag] = notes.map(serializeNoteByBar)
  }

  return serialized
}

// Convert phases to serializable format
export function serializePhases(phases: any): SerializablePhases {
  const serialized: SerializablePhases = {}

  for (const [phaseName, phase] of Object.entries(phases)) {
    const phaseData = phase as any
    serialized[phaseName] = {
      id: phaseData.id,
      name: phaseData.name,
      scaleName: phaseData.scaleName,
      scaleTonic: phaseData.scaleTonic,
      'follows-ids': [...phaseData['follows-ids']], // Create new array
      speed: phaseData.speed,
      barSizeMultiplier: phaseData.barSizeMultiplier,
    }
  }

  return serialized
}

// Convert MidiMap to serializable format
export function serializeMidiMap(midiMap: MidiMap): SerializableMidiMap {
  const serialized: SerializableMidiMap = {}

  for (const [tick, notes] of Object.entries(midiMap)) {
    serialized[parseInt(tick)] = notes.map((note) => ({
      note: note.note,
      velocity: note.velocity,
      duration: note.duration,
      compositionTags: [...note.compositionTags], // Create new array
    }))
  }

  return serialized
}

// Convert serializable MidiMap back to MidiMap
export function deserializeMidiMap(serialized: SerializableMidiMap): MidiMap {
  const midiMap: MidiMap = {}

  for (const [tick, notes] of Object.entries(serialized)) {
    midiMap[parseInt(tick)] = notes.map((note) => ({
      note: note.note,
      velocity: note.velocity,
      duration: note.duration,
      compositionTags: [...note.compositionTags],
    }))
  }

  return midiMap
}

// Convert serializable NoteByBar back to NoteByBar (simplified version)
export function deserializeNoteByBar(
  serialized: SerializableNoteByBar
): NoteByBar {
  // Create a simple object that matches the NoteByBar interface
  // This is a simplified version - in a real implementation you might want to use the full schema
  return {
    note: serialized.note,
    tags: [...serialized.tags],
    tagsObj: serialized.tagsObj ? { ...serialized.tagsObj } : {},
  } as NoteByBar
}

// Convert serializable notesByBar back to notesByBar
export function deserializeNotesByBar(
  serialized: SerializableNotesByBar
): Record<string, NoteByBar[]> {
  const notesByBar: Record<string, NoteByBar[]> = {}

  for (const [barTag, notes] of Object.entries(serialized)) {
    notesByBar[barTag] = notes.map(deserializeNoteByBar)
  }

  return notesByBar
}

// Convert MidiMappingResult to serializable format
export function serializeMidiMappingResult(
  result: MidiMappingResult
): SerializableMidiMappingResult {
  return {
    map: serializeMidiMap(result.map),
    phaseAndBarStartAndEndTicks: {
      phases: { ...result.phaseAndBarStartAndEndTicks.phases },
      bars: { ...result.phaseAndBarStartAndEndTicks.bars },
    },
  }
}

// Convert serializable MidiMappingResult back to MidiMappingResult
export function deserializeMidiMappingResult(
  serialized: SerializableMidiMappingResult
): MidiMappingResult {
  return {
    map: deserializeMidiMap(serialized.map),
    phaseAndBarStartAndEndTicks: {
      phases: { ...serialized.phaseAndBarStartAndEndTicks.phases },
      bars: { ...serialized.phaseAndBarStartAndEndTicks.bars },
    },
  }
}
