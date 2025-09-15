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
        console.error('Worker error:', error)
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
    // Inline worker code that contains all the necessary logic
    // This avoids the need for external worker files when ollave is used as a library
    return `
      // Inline Web Worker for mapSongToMidiTicks processing
      // This contains the shared core logic inline to avoid external file dependencies

      // Constants
      const ppq = 128
      const BAR = 'bar'
      const tickCounts = {
        'zero': 0,
        'bar': ppq * 4,
        'half': ppq * 4 / 2,
        'quarter': ppq * 4 / 4,
        'eighth': ppq * 4 / 8,
        'sixteenth': ppq * 4 / 16,
        'thirtySecond': ppq * 4 / 32,
        'sixtyFourth': ppq * 4 / 64,
        'oneTwentyEighth': ppq * 4 / 128,
      }

      // Utility functions
      const peprnIsNum = (arg) => typeof arg === 'number' || arg !== "" && !isNaN(Number(arg))
      const isCsvArg = (str) => str.includes(',')
      const parseCsvArg = (str) => {
        if (!isCsvArg(str)) return [str]
        return str.split(',').map((splitOff) => {
          if (splitOff === 'null') return null
          if (peprnIsNum(splitOff)) return parseFloat(splitOff)
          if (splitOff === 'true') return true
          if (splitOff === 'false') return false
          return splitOff
        })
      }
      const isFraction = (name) => name.includes('th') || name.includes('quarter') || name.includes('half') || name.includes('whole')

      const parseNoteTags = (tags) => {
        return tags.reduce((accum, tag) => {
          if (!tag.includes('=')) return [...accum, [tag, []]]
          const split = tag.split('=')
          let tagDat = []
          if (peprnIsNum(split[1])) {
            tagDat = [parseFloat(split[1])]
          } else if (isCsvArg(split[1])) {
            tagDat = parseCsvArg(split[1])
          } else {
            tagDat = [split[1]]
          }
          return [...accum, [split[0], tagDat]]
        }, [])
      }

      const calcFractionalDelay = (parsedTags) => {
        let newNoteDelay = 0
        parsedTags.forEach(([name, data]) => {
          if (isFraction(name)) {
            const [num] = data
            if (typeof num === 'number') {
              const taggedTickFactor = tickCounts[name]
              newNoteDelay += taggedTickFactor * num
            }
          }
        })
        return newNoteDelay
      }

      const calcTickDelay = (parsedTags) => {
        let newNoteDelay = 0
        const delay = parsedTags.find(([name]) => name == 'barDelay')
        if (delay) {
          const [noteCnt] = delay[1]
          if (typeof noteCnt === 'number') {
            newNoteDelay += noteCnt
          }
        }
        return newNoteDelay
      }

      const quantizeNote = (parsedTags, rawOffset = 0) => {
        let thisNoteOffset = rawOffset
        thisNoteOffset += calcFractionalDelay(parsedTags)
        thisNoteOffset += calcTickDelay(parsedTags)
        return thisNoteOffset
      }

      const getAllPhaseBarNotesWorker = (phase, notesByBar) => {
        const sortByNumberAfterColon = (a, b) => {
          const aNumber = parseInt(a.split(':')[1])
          const bNumber = parseInt(b.split(':')[1])
          return aNumber - bNumber
        }
        const getAllPhaseBars = (phase) => {
          if (typeof phase !== 'string') throw new Error('String arg is required')
          return Object.keys(notesByBar).filter((barTag) => barTag.startsWith(phase + ':')).sort(sortByNumberAfterColon)
        }
        const barNames = getAllPhaseBars(phase)
        return barNames.map((barName) => notesByBar[barName])
      }

      const getFollowingPhasesWorker = (phaseName, phases) => {
        const phase = phases[phaseName]
        return Object.entries(phases).filter(([, { "follows-ids": followsIds }]) =>
          phase.id !== null && followsIds.includes(phase.id) || phase.id !== null && followsIds.includes(phase["id"]))
      }

      // Core mapping function with phase and bar timing
      function mapPhaseTicksCore(phaseName, phase, startTick, collector = [], phaseAndBarStartAndEndTicks, phases, notesByBar) {
        // add phase start tick
        phaseAndBarStartAndEndTicks.phases[phaseName] = [startTick, -1]
        const barTickFactor = tickCounts.bar

        // get the bar-sorted bar notes
        const phaseBars = getAllPhaseBarNotesWorker(phaseName, notesByBar)
        // initialize the midi map where we will put each note on a numeric midi property
        const phaseMidi = {}

        // for each bar, use the bar semantic "tags" property to determine which notes to play on that midi tick.
        phaseBars.forEach((barNotes, barIndex) => {
          // loop (not just multiplying by index) because later bars may have a different bar size multiplier each
          const thisBarOffset = barIndex * barTickFactor * (typeof phase?.barSizeMultiplier === 'number' ? phase.barSizeMultiplier : 1)

          phaseAndBarStartAndEndTicks.bars[barIndex] = [
            startTick + thisBarOffset,
            startTick + thisBarOffset + barTickFactor * (typeof phase?.barSizeMultiplier === 'number' ? phase.barSizeMultiplier : 1),
          ]

          // INTERPRETING INDIVIDUAL NOTES TO REAL TIMING
          barNotes.forEach((note) => {
            const parsedTags = parseNoteTags(note.tags)
            const thisNoteTick = quantizeNote(parsedTags) + startTick + thisBarOffset
            if (!phaseMidi[thisNoteTick]) phaseMidi[thisNoteTick] = []
            phaseMidi[thisNoteTick].push({
              note: note.note,
              compositionTags: note.tags,
            })
          })

          // if last bar, add phase end tick
          if (barIndex === phaseBars.length - 1) {
            phaseAndBarStartAndEndTicks.phases[phaseName] = [
              startTick + thisBarOffset,
              startTick + thisBarOffset + barTickFactor * (typeof phase?.barSizeMultiplier === 'number' ? phase.barSizeMultiplier : 1),
            ]
          }
        })

        collector.push(phaseMidi)
        const followsPhases = getFollowingPhasesWorker(phaseName, phases)
        followsPhases.forEach(([followsPhaseName, followsPhase]) => {
          mapPhaseTicksCore(followsPhaseName, followsPhase, phaseBars.length * barTickFactor, collector, phaseAndBarStartAndEndTicks, phases, notesByBar)
        })

        return collector
      }

      // Main worker function
      function mapSongToMidiTicksWorker(phases, notesByBar) {
        const firstPhases = Object.entries(phases).filter(([_, phase]) => phase['follows-ids'].length === 0)
        const collector = []
        const phaseAndBarStartAndEndTicks = {
          phases: {},
          bars: {},
        }

        firstPhases.forEach(([phaseName, phase]) => {
          mapPhaseTicksCore(phaseName, phase, 0, collector, phaseAndBarStartAndEndTicks, phases, notesByBar)
        })

        // phase-level massaging here.
        const midiMap = collector.reduce((acc, curr) => {
          Object.entries(curr).forEach(([tickRaw, notes]) => {
            const tick = parseInt(tickRaw)
            if (!acc[tick]) acc[tick] = []
            acc[tick].push(...notes)
          })
          return acc
        }, {})

        return { map: midiMap, phaseAndBarStartAndEndTicks }
      }

      // Worker message handler
      self.onmessage = function(e) {
        const { type, data } = e.data
        if (type === 'MAP_SONG_TO_MIDI_TICKS') {
          try {
            const result = mapSongToMidiTicksWorker(data.phases, data.notesByBar)
            self.postMessage({
              type: 'MAP_SONG_TO_MIDI_TICKS_RESULT',
              data: result
            })
          } catch (error) {
            self.postMessage({
              type: 'ERROR',
              error: error instanceof Error ? error.message : 'Unknown error occurred'
            })
          }
        }
      }
    `
  }

  private handleWorkerMessage(message: WorkerMessageUnion) {
    if (message.type === 'MAP_SONG_TO_MIDI_TICKS_RESULT') {
      // For now, resolve the first pending request
      // In a more sophisticated implementation, we'd track request IDs
      const firstPending = this.pendingRequests.values().next().value
      if (firstPending) {
        try {
          // The inline worker returns data directly, no need for deserialization
          firstPending.resolve(message.data as MidiMappingResult)
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
      this.rejectAllPending(message.error)
    }
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substr(2, 9)
  }

  private rejectAllPending(error: string) {
    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error(error))
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
        // Send data directly to inline worker (no serialization needed)
        const message: WorkerMessage = {
          type: 'MAP_SONG_TO_MIDI_TICKS',
          data: {
            phases: phases as any,
            notesByBar: notesByBar as any,
          },
        }

        this.worker!.postMessage(message)
      } catch (error) {
        this.pendingRequests.delete(requestId)
        reject(
          new Error(
            `Worker message failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
