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
import { workerBall } from './worker-utils'
import { workerSource } from './workerBundle.gen'
import { generateInlineWorkerCode } from './workerCodeGenerator'

// Worker message types
type WorkerMessage = {
  type: 'MAP_SONG_TO_MIDI_TICKS'
  requestId: string
  data: {
    phases: SerializablePhases
    notesByBar: SerializableNotesByBar
  }
}

type WorkerResponse = {
  type: 'MAP_SONG_TO_MIDI_TICKS_RESULT'
  requestId?: string
  data: SerializableMidiMappingResult
}

type WorkerError = {
  type: 'ERROR'
  requestId?: string
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
      // Create inline worker since ollave is a library and worker files won't be served by parent apps.
      // Preferred path: the build-time bundle of worker.entry.ts — real imports,
      // type-checked, no string surgery. The legacy runtime generator remains as
      // a fallback for running straight from tsc output (workerSource empty);
      // its regex cleanup must NOT run on the bundle, since esbuild's own
      // numbered identifiers (workerBall2 etc.) are exactly what it mangles.
      const workerCode = workerSource
        ? workerSource
        : Object.keys(workerBall)
            .concat(['workerBall', 'DEFAULT_VELOCITY'])
            .reduce((acc, key) => {
              const regexx = new RegExp(`${key}[0-9]+`, 'g')
              return acc.replace(regexx, key)
            }, this.getInlineWorkerCode())

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

  // Route a worker reply to the request that produced it. Falls back to the
  // oldest pending request when the reply carries no id (a worker built from
  // older code), preserving the previous behavior for that case only.
  private takePending(requestId?: string) {
    if (requestId) {
      const pending = this.pendingRequests.get(requestId)
      if (pending) {
        this.pendingRequests.delete(requestId)
        return pending
      }
      // Reply for a request we no longer track (typically one that already
      // timed out). Drop it rather than stealing another request's slot.
      return undefined
    }
    // No id on the reply — a worker built from older code. Preserve the old
    // resolve-the-oldest behavior for that case only.
    const first = this.pendingRequests.entries().next().value
    if (!first) {
      return undefined
    }
    this.pendingRequests.delete(first[0])
    return first[1]
  }

  private handleWorkerMessage(message: WorkerMessageUnion) {
    if (message.type === 'MAP_SONG_TO_MIDI_TICKS_RESULT') {
      const firstPending = this.takePending(message.requestId)
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
      const pending = this.takePending(message.requestId)
      if (pending) {
        pending.reject(new Error(errorMessage))
      }
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
          requestId,
          data: {
            phases: serializedPhases,
            notesByBar: serializedNotesByBar,
          },
        }

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
