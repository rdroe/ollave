// Real module entry point for the mapSongToMidiTicks web worker.
//
// This replaces the runtime string-assembly in workerCodeGenerator.ts: build.js
// bundles this file (after tsc) into a single self-contained script and writes
// it into workerBundle.gen.js as a string, which workerManager feeds to
// `new Worker(URL.createObjectURL(new Blob(...)))`. Everything here is
// type-checked, bundled with its real imports, and never regex-patched.

import {
  createWorkerMessageHandler,
  getAllPhaseBarNotesWorker,
  getFollowingPhasesWorker,
} from './shared/workerUtils'
import { tickCounts, workerBall } from './worker-utils'

declare const self: Worker & typeof globalThis

const mapSongToMidiTicksWorker = (phases: unknown, notesByBar: unknown) => {
  const getAllPhaseBarNotes = (phaseName: string) =>
    getAllPhaseBarNotesWorker(phaseName, notesByBar as never)
  const getFollowingPhases = (phaseName: string) =>
    getFollowingPhasesWorker(phaseName, phases as never)

  return workerBall.mapSongToMidiTicksCore(
    phases as never,
    notesByBar as never,
    getAllPhaseBarNotes,
    getFollowingPhases,
    tickCounts,
    workerBall.parseNoteTags,
    workerBall.quantizeNote
  )
}

self.onmessage = createWorkerMessageHandler(mapSongToMidiTicksWorker)
