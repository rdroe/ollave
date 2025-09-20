// Worker Manager for handling mapSongToMidiTicks processing
import { MidiMappingResult } from './shared/midiMappingCore'
import {
  serializePhases,
  serializeNotesByBar,
  deserializeMidiMappingResult,
  SerializablePhases,
  SerializableNotesByBar,
  SerializableMidiMappingResult,
} from './worker-serialization'
import { generateInlineWorkerCode } from './workerCodeGenerator'

// Worker message types
type WorkerMessage = {
  type: 'MAP_SONG_TO_MIDI_TICKS'
  data: {
    phases: SerializablePhases
    notesByBar: SerializableNotesByBar
  }
}

type WorkerResponse = {
  type: 'MAP_SONG_TO_MIDI_TICKS_RESULT'
  data: SerializableMidiMappingResult
}

type WorkerError = {
  type: 'ERROR'
  error: string
}

type WorkerMessageUnion = WorkerResponse | WorkerError

class WorkerManager {
  private worker: Worker | null = null
  private pendingRequests: Map<
    string,
    {
      resolve: (value: MidiMappingResult) => void
      reject: (error: Error) => void
    }
  > = new Map()

  constructor() {
    this.initializeWorker()
  }

  private initializeWorker() {
    try {
      // Create inline worker since ollave is a library and worker files won't be served by parent apps
      const workerCode = this.getInlineWorkerCode()

      const blob = new Blob([workerCode], { type: 'application/javascript' })
      this.worker = new Worker(URL.createObjectURL(blob))

      this.worker.onmessage = (e: MessageEvent<WorkerMessageUnion>) => {
        this.handleWorkerMessage(e.data)
      }

      this.worker.onerror = (error) => {
        console.error(
          'Worker error:',
          error.message,
          'at',
          error.filename,
          ':',
          error.lineno
        )
        this.rejectAllPending('Worker error occurred')
      }
    } catch (error) {
      console.error('Failed to initialize worker:', error)
      // Fallback to synchronous processing
      this.worker = null
    }
  }

  private getWorkerUrl(): string | null {
    // Try to construct the worker URL based on the current script location
    try {
      // In a real application, this would be handled by the build system
      // For now, we'll try to load from a relative path
      const currentScript = document.currentScript as HTMLScriptElement
      if (currentScript) {
        const baseUrl = currentScript.src.replace(/\/[^\/]*$/, '/')
        return `${baseUrl}mapSongToTicksWorker.js`
      }
    } catch (error) {
      console.warn('Could not determine worker URL:', error)
    }
    return null
  }

  private getInlineWorkerCode(): string {
    // Generate worker code from shared core logic to avoid duplication
    return generateInlineWorkerCode()
  }

  private handleWorkerMessage(message: WorkerMessageUnion) {
    if (message.type === 'MAP_SONG_TO_MIDI_TICKS_RESULT') {
      // For now, resolve the first pending request
      // In a more sophisticated implementation, we'd track request IDs
      const firstPending = this.pendingRequests.values().next().value
      if (firstPending) {
        try {
          // Deserialize the result back to MidiMappingResult
          const deserializedResult = deserializeMidiMappingResult(
            message.data as any
          )
          firstPending.resolve(deserializedResult)
        } catch (error) {
          firstPending.reject(
            new Error(
              `Worker result processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          )
        }
        // Clear all pending requests since we only support one at a time for now
        this.pendingRequests.clear()
      }
    } else if (message.type === 'ERROR') {
      // Handle cases where message.error might be undefined or not a string
      console.error('Worker error received:', message)
      const errorMessage =
        typeof message.error === 'string'
          ? message.error
          : message.error
            ? String(message.error)
            : 'Unknown worker error occurred'
      this.rejectAllPending(errorMessage)
    }
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substr(2, 9)
  }

  private rejectAllPending(error: string) {
    // Handle cases where error might be undefined or not a string
    const errorMessage =
      typeof error === 'string'
        ? error
        : error
          ? String(error)
          : 'Unknown worker error occurred'

    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error(errorMessage))
    })
    this.pendingRequests.clear()
  }

  async mapSongToMidiTicks(
    phases: unknown,
    notesByBar: unknown
  ): Promise<MidiMappingResult> {
    if (!this.worker) {
      // Fallback to synchronous processing if worker is not available
      return this.fallbackMapSongToMidiTicks(phases, notesByBar)
    }

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId()
      this.pendingRequests.set(requestId, { resolve, reject })

      try {
        // Validate input data
        if (!phases || typeof phases !== 'object') {
          throw new Error('Invalid phases data: phases must be an object')
        }
        if (!notesByBar || typeof notesByBar !== 'object') {
          throw new Error(
            'Invalid notesByBar data: notesByBar must be an object'
          )
        }

        // Serialize the data to avoid proxy cloning issues
        const serializedPhases = serializePhases(phases as any)
        const serializedNotesByBar = serializeNotesByBar(notesByBar as any)

        const message: WorkerMessage = {
          type: 'MAP_SONG_TO_MIDI_TICKS',
          data: {
            phases: serializedPhases,
            notesByBar: serializedNotesByBar,
          },
        }
        console.log('worker; message', message)
        this.worker!.postMessage(message)
      } catch (error) {
        this.pendingRequests.delete(requestId)
        reject(
          new Error(
            `Serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        )
        return
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId)
          reject(new Error('Worker timeout'))
        }
      }, 30000)
    })
  }

  private fallbackMapSongToMidiTicks(
    _phases: unknown,
    _notesByBar: unknown
  ): MidiMappingResult {
    // Fallback implementation - use the synchronous version
    console.warn('Using fallback synchronous processing')

    // Import and use the synchronous implementation
    const { mapSongToMidiTicksSync } = require('./mapSongToTicks')
    return mapSongToMidiTicksSync()
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.rejectAllPending('Worker destroyed')
  }
}

// Singleton instance
let workerManager: WorkerManager | null = null

export const getWorkerManager = (): WorkerManager => {
  if (!workerManager) {
    workerManager = new WorkerManager()
  }
  return workerManager
}

export const destroyWorkerManager = () => {
  if (workerManager) {
    workerManager.destroy()
    workerManager = null
  }
}
