import { NoteByBar } from '../lib/schemas'

import { Mem } from './types'

export type { Mem }

const mem_: Mem = {
  subscriptions: {},
  songPauses: {},
  functions: {},
  observables: {},
  song: null,
  tracks: [],
  phases: {},
  notesByBar: {} as Record<string, NoteByBar[]>,
  latestPhaseAndBarStartAndEndTicks: {
    phases: {},
    bars: {},
  },
  songNames: [],
  latestMap: {},
  playedMap: {},
  graphs: {},
  played: [],
  adjustedCursor: 0,
  doLog: true,
}
declare global {
  interface Window {
    mem__: Mem
  }
}
window.mem__ = mem_
export const mem: () => Mem = () => window.mem__
