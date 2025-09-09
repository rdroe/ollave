import { Observable } from 'rxjs'

import { ProgressionOptions } from 'src/lib'
import { NoteByBar } from 'src/lib/schemas'

import { SongRecord } from '../lib/types'

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
  }[]
  phases: {
    [phaseName: string]: {
      id: number
      'follows-ids': number[]
      barSizeMultiplier: number | null
      speed: number | null
      scaleName: string | null
      scaleTonic: string | null
      name: string
    }
  }
  notesByBar: {
    [barTag: string]: NoteByBar[]
  }
  latestMap: MidiMap
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
}
