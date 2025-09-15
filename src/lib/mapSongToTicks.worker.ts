// Web Worker for mapSongToMidiTicks processing
// This worker handles the computationally intensive task of mapping song data to MIDI ticks

// Import shared core logic
import {
  mapSongToMidiTicksCore,
  MidiMappingResult,
  GenericPhase,
  GenericNotesByBar,
} from './shared/midiMappingCore'
import {
  getAllPhaseBarNotesWorker,
  getFollowingPhasesWorker,
} from './shared/workerUtils'
import { serializeMidiMappingResult } from './worker-serialization'

// Worker message types
type WorkerMessage = {
  type: 'MAP_SONG_TO_MIDI_TICKS'
  data: {
    phases: { [phaseName: string]: GenericPhase }
    notesByBar: GenericNotesByBar
  }
}

type WorkerResponse = {
  type: 'MAP_SONG_TO_MIDI_TICKS_RESULT'
  data: unknown // Will be serialized MidiMappingResult
}

// Main worker function using shared core logic
function mapSongToMidiTicksWorker(
  phases: { [phaseName: string]: GenericPhase },
  notesByBar: GenericNotesByBar
): MidiMappingResult {
  // Create wrapper functions that capture the data context
  const getAllPhaseBarNotes = (phaseName: string) =>
    getAllPhaseBarNotesWorker(phaseName, notesByBar)

  const getFollowingPhases = (phaseName: string) =>
    getFollowingPhasesWorker(phaseName, phases)

  // Use the shared core logic
  return mapSongToMidiTicksCore(
    phases,
    notesByBar,
    getAllPhaseBarNotes,
    getFollowingPhases
  )
}

// Worker message handler
self.onmessage = function (e: MessageEvent<WorkerMessage>) {
  const { type, data } = e.data

  if (type === 'MAP_SONG_TO_MIDI_TICKS') {
    try {
      const result = mapSongToMidiTicksWorker(data.phases, data.notesByBar)

      // Serialize the result for transfer
      const serializedResult = serializeMidiMappingResult(result)

      const response: WorkerResponse = {
        type: 'MAP_SONG_TO_MIDI_TICKS_RESULT',
        data: serializedResult,
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
