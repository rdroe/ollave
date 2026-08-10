import { mem, Mem } from '../core/mem'

import { MidiMappingResult } from './shared/midiMappingCore'
import { buildPhaseSchedule } from './shared/phaseSchedule'
import { BAR, tickCounts } from './util/constantsUtil'
import { getAllPhaseBarNotes } from './util/phaseNotesUtil'
import { getFollowingPhases } from './util/phaseRelationsUtil'
import { tagEntriesCompare } from './util/tagsUtil'
import {
  mapSongToMidiTicksCore,
  parseNoteTags,
  TagEntries,
} from './worker-utils'
import { getWorkerManager } from './workerManager'

const startSpeedRef_ = {
  START_SPEED: 1,
}

;(window as unknown as { startSpeedRef: typeof startSpeedRef_ }).startSpeedRef =
  startSpeedRef_
export const START_SPEED = (
  window as unknown as { startSpeedRef: typeof startSpeedRef_ }
).startSpeedRef.START_SPEED

export type MidiMap = {
  [tick: number]: {
    note: string
    velocity?: number
    duration?: number
    compositionTags: string[]
  }[]
}

export type PhaseMap = {
  [tick: number]: {
    occassion: 'BAR_START' | 'BAR_END' | 'NOTE_START'
    data1: string[]
    data2: number[]
  }[]
}

export type BarTagPercent = [tagName: string | null, percent: number]
let prevMapGlobal: MidiMap = {}
export const mapSongToMidiTicks = async (): Promise<MidiMappingResult> => {
  const memData = mem()
  const workerManager = getWorkerManager()
  prevMapGlobal = mem().latestMap
  try {
    const workerResult = await workerManager.mapSongToMidiTicks(
      memData.phases,
      memData.notesByBar
    )

    return workerResult
  } catch (error) {
    console.warn(
      'Web worker failed, falling back to synchronous processing:',
      error
    )
    // Fallback to synchronous processing
    const result = mapSongToMidiTicksSync()

    return result
  }
}

const getNoteDiff = (
  prevMap: MidiMap,
  newMap: MidiMap
): {
  changedNotes: string[]
  removedNotes: string[]
  newNotes: string[]
} => {
  const previousNotes = Object.values(prevMap)
    .flat()
    .reduce(
      (acc, note) => {
        const noteIdTag = note.compositionTags.find((tag) =>
          tag.startsWith('noteId=')
        )
        const noteId = noteIdTag ? noteIdTag.split('=')[1] : null
        if (!noteId) {
          return acc
        }
        acc[noteId] = parseNoteTags(note.compositionTags).filter(
          ([name]) =>
            name === 'barDelay' ||
            name === 'duration' ||
            name === 'octave' ||
            name === 'velocity' ||
            name === 'pitch'
        )
        acc[noteId].push(['note', [note.note]])
        return acc
      },
      {} as Record<string, TagEntries>
    )
  const newNotesById = Object.values(newMap)
    .flat()
    .reduce(
      (acc, note) => {
        const noteIdTag = note.compositionTags.find((tag) =>
          tag.startsWith('noteId=')
        )
        const noteId = noteIdTag ? noteIdTag.split('=')[1] : null
        if (!noteId) {
          return acc
        }
        acc[noteId] = parseNoteTags(note.compositionTags).filter(
          ([name]) =>
            name === 'barDelay' ||
            name === 'duration' ||
            name === 'octave' ||
            name === 'velocity' ||
            name === 'pitch'
        )
        acc[noteId].push(['note', [note.note]])
        return acc
      },
      {} as Record<string, TagEntries>
    )
  const changedNotes: string[] = []
  const removedNotes: string[] = []
  const newNotes: string[] = []
  Object.entries(previousNotes).forEach(([previousNoteId, prevTagEntries]) => {
    if (newNotesById[previousNoteId]) {
      const newTagEntries = newNotesById[previousNoteId]
      if (!tagEntriesCompare(prevTagEntries, newTagEntries)) {
        changedNotes.push(previousNoteId)
      }
    } else {
      removedNotes.push(previousNoteId)
    }
    newNotes.forEach((newNoteId) => {
      if (!previousNotes[newNoteId]) {
        newNotes.push(newNoteId)
      }
    })
  })

  return {
    changedNotes,
    removedNotes,
    newNotes,
  }
}

export const mapSongToMidiTicksSync = (): MidiMappingResult => {
  const memData = mem()
  return mapSongToMidiTicksCore(
    memData.phases,
    memData.notesByBar,
    getAllPhaseBarNotes,
    getFollowingPhases
  )
}

/**
 * The shared schedule for the song currently in mem(), keyed by full bar id.
 * Every main-thread bar<->tick utility below reads this instead of re-walking
 * followers, so they agree with the worker mapping by construction.
 */
export const currentPhaseSchedule = () =>
  buildPhaseSchedule(
    mem().phases,
    (phaseName) => getAllPhaseBarNotes(phaseName).length
  )

export const barsAtMidi = (songTick: number): BarTagPercent[] => {
  const { bars } = currentPhaseSchedule()

  const ret: BarTagPercent[] = []
  Object.entries(bars).forEach(([barId, [barStart, barEnd]]) => {
    if (barStart < songTick && barEnd > songTick) {
      const len = barEnd - barStart
      const percent = ((songTick - barStart) * 100) / len
      ret.push([barId, Math.round(percent)])
    }
  })

  if (ret.length === 0) {
    ret.push([null, 0])
  }
  return ret as BarTagPercent[]
}

export const midiAtBarUtil = (memArg: Mem) => {
  // One pass over notesByBar for every phase at once. Filtering the whole key
  // list per phase re-walked the song once per phase.
  const barCountByPhase: { [phaseName: string]: number } = {}
  Object.keys(memArg.notesByBar).forEach((barTag) => {
    const phaseName = barTag.slice(0, barTag.lastIndexOf(':'))
    if (!phaseName) return
    barCountByPhase[phaseName] = (barCountByPhase[phaseName] ?? 0) + 1
  })

  const { bars } = buildPhaseSchedule(
    memArg.phases,
    (phaseName) => barCountByPhase[phaseName] ?? 0
  )

  // `bars` is already keyed by bar id, so the lookup is a direct index. It
  // used to rebuild an entries array and linear-scan it on EVERY call, and the
  // UI calls this once per bar — quadratic in song length, which showed up as
  // a multi-hundred-millisecond stall (and late notes) while scrolling a long
  // song. The null case wants the earliest bar, resolved once up front.
  const firstBarId = Object.keys(bars)[0]

  return (soughtTagName: string, percent: number): number => {
    const span = bars[soughtTagName ?? firstBarId]
    if (!span) {
      return 0
    }
    const [barStart, barEnd] = span
    const len = barEnd - barStart
    return barStart + Math.round((percent * len) / 100)
  }
}

export const midiAtBar = ([soughtTagName, percent]: BarTagPercent): number => {
  return midiAtBarUtil(mem())(soughtTagName as string, percent)
}

export const extractPhaseAndBarStartAndEndTicks = (): {
  phases: {
    [phaseName: string]: [startTick: number, endTick: number]
  }
  bars: {
    [barName: string]: [startTick: number, endTick: number]
  }
} => {
  const schedule = currentPhaseSchedule()
  const phases: {
    [phaseName: string]: [startTick: number, endTick: number]
  } = {}
  Object.entries(schedule.phases).forEach(([phaseName, scheduled]) => {
    phases[phaseName] = [scheduled.startTick, scheduled.endTick]
  })
  return { phases, bars: schedule.bars }
}
