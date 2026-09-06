import { Observable } from 'rxjs'

import type { ProgressionOptions } from '../lib/graphh'
import { NoteByBar } from '../lib/schemas'
import { SongRecord } from '../lib/types'
import { PhaseRecord } from '../lib/util/phaseTypes'

// Forward declarations to avoid circular imports
export type BarTagPercent = any
export type MidiMap = any

type Unsubscribe = ReturnType<Observable<any>['subscribe']>

export type Mem = {
  subscriptions: {
    [key: string]: Observable<any>['subscribe'] extends (
      ...args: any[]
    ) => infer R
      ? R
      : never
  }
  functions: {
    [songName: string]: {
      [fnName: string]: (
        tick: number,
        rawTick: number,
        snapShot: Mem,
        songName: string
      ) => void
    }
  }
  observables: {
    [songName: string]: {
      [fnName: string]: Unsubscribe
    }
  }
  songPauses: {
    [key: string]: BarTagPercent
  }
  songNames: string[]
  song: (Exclude<SongRecord, 'id'> & { id: number }) | null
  tracks: {
    id: number
    'phase-ids': number[]
    'phase-names': string[]
    notesByBar: Record<string, NoteByBar[]>
    // Optional, mirroring trackRecordSchema: absent means "derive it" (see
    // trackLabel/trackChannel), so old rows need no migration.
    name?: string
    channel?: number
    instrument?: string
    muted?: boolean
  }[]
  phases: {
    [phaseName: string]: PhaseRecord
  }
  notesByBar: {
    [barTag: string]: NoteByBar[]
  }
  latestMap: MidiMap
  latestPhaseAndBarStartAndEndTicks: {
    phases: {
      [phaseName: string]: [startTick: number, endTick: number]
    }
    bars: {
      [barName: string]: [startTick: number, endTick: number]
    }
  }
  playedMap: MidiMap
  graphs: {
    [userScaleWithTonic: string]: { [chordName: string]: ProgressionOptions }[]
  }
  played: {
    songTick: number
    note: string
    tags: string[]
    time: number
  }[]
  adjustedCursor: number
  doLog: boolean
  isRunning?: boolean
  exclusivePlayMode?: boolean
}
