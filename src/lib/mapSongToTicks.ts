import { mem, Mem } from '../core/mem'

import { NoteByBar } from './schemas'
import { MidiMappingResult } from './shared/midiMappingCore'
import { BAR, tickCounts } from './util/constantsUtil'
import { getAllPhaseBarNotes } from './util/phaseNotesUtil'
import { getFollowingPhases } from './util/phaseRelationsUtil'
import { mapSongToMidiTicksCore } from './worker-utils'
import { getWorkerManager } from './workerManager'

const startSpeedRef_ = {
  START_SPEED: 1,
}

;(window as unknown as { startSpeedRef: typeof startSpeedRef_ }).startSpeedRef =
  startSpeedRef_
export const START_SPEED = (
  window as unknown as { startSpeedRef: typeof startSpeedRef_ }
).startSpeedRef.START_SPEED

// Detailed structure of a phase (possibly a phase part)
export type MidiMap = {
  [tick: number]: {
    note: string
    velocity?: number
    duration?: number
    compositionTags: string[]
  }[]
}

// High-level structure of a phase
export type PhaseMap = {
  [tick: number]: {
    occassion: 'BAR_START' | 'BAR_END' | 'NOTE_START'
    data1: string[]
    data2: number[]
  }[]
}

export type BarTagPercent = [tagName: string | null, percent: number]
let previousNotesByBar: Record<string, NoteByBar[]> = {}
export const mapSongToMidiTicks = async (): Promise<MidiMappingResult> => {
  const memData = mem()
  const workerManager = getWorkerManager()

  try {
    // Use web worker for processing
    const workerResult = await workerManager.mapSongToMidiTicks(
      memData.phases,
      memData.notesByBar
    )

    console.log(
      'getNoteDiff',
      getNoteDiff(memData.notesByBar, memData.notesByBar)
    )
    previousNotesByBar = memData.notesByBar

    return workerResult
  } catch (error) {
    console.warn(
      'Web worker failed, falling back to synchronous processing:',
      error
    )
    // Fallback to synchronous processing
    const result = mapSongToMidiTicksSync()
    console.log(
      'getNoteDiff sync',
      getNoteDiff(previousNotesByBar, memData.notesByBar)
    )
    previousNotesByBar = memData.notesByBar
    return result
  }
}

const getNoteDiff = (
  previousNotesByBar: Record<string, NoteByBar[]>,
  newNotesByBar: Record<string, NoteByBar[]>
): {
  changedNotes: NoteByBar[]
  removedNotes: string[]
  newNotes: string[]
} => {
  const previousNotes = Object.values(previousNotesByBar)
    .flat()
    .reduce(
      (acc, note) => {
        acc[note.note] = note
        return acc
      },
      {} as Record<string, NoteByBar>
    )
  const newNotesById = Object.values(newNotesByBar)
    .flat()
    .reduce(
      (acc, note) => {
        acc[note.note] = note
        return acc
      },
      {} as Record<string, NoteByBar>
    )
  // These are NoteByBar objects.
  // We need to compare the tags for notes present in both arguments.
  //  while also tracking for removed notes and new notes.
  const changedNotes: NoteByBar[] = []
  const removedNotes: string[] = []
  const newNotes: string[] = []
  Object.entries(previousNotes).forEach(([previousNoteId, previousNote]) => {
    if (newNotesById[previousNoteId]) {
      // not removed or new, so it may be a changed note if the barDelay or duration has changed, or the octave or velocity or pitch has changed on the tags object.
      if (
        previousNote.tagsObj.barDelay?.[0] !==
          newNotesById[previousNoteId].tagsObj.barDelay?.[0] ||
        previousNote.tagsObj.duration?.[0] !==
          newNotesById[previousNoteId].tagsObj.duration?.[0] ||
        previousNote.tagsObj.octave?.[0] !==
          newNotesById[previousNoteId].tagsObj.octave?.[0] ||
        previousNote.tagsObj.velocity?.[0] !==
          newNotesById[previousNoteId].tagsObj.velocity?.[0] ||
        previousNote.tagsObj.pitch?.[0] !==
          newNotesById[previousNoteId].tagsObj.pitch?.[0]
      ) {
        changedNotes.push(newNotesById[previousNoteId])
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

// Synchronous fallback implementation using shared core
export const mapSongToMidiTicksSync = (): MidiMappingResult => {
  const memData = mem()

  // Use the shared core logic with main thread utility functions
  return mapSongToMidiTicksCore(
    memData.phases,
    memData.notesByBar,
    getAllPhaseBarNotes,
    getFollowingPhases
  )
}

export const barsAtMidi = (songTick: number): BarTagPercent[] => {
  const firstPhases = Object.entries(mem().phases).filter(
    ([_phaseName, phase]) => {
      return phase['follows-ids'].length === 0
    }
  )

  const collector: PhaseMap[] = []
  firstPhases.forEach(([phaseName, phase]) => {
    mapPhaseData(phaseName, phase, 0, collector)
  })

  const ret: BarTagPercent[] = []

  const _: PhaseMap = collector.reduce((acc, curr) => {
    Object.entries(curr).forEach(([tickRaw, dat]) => {
      const tick = parseInt(tickRaw)
      if (!acc[tick]) {
        acc[tick] = []
      }
      acc[tick].push(...dat)

      dat.forEach(
        (phaseMapSubelement: {
          occassion: 'BAR_START' | 'BAR_END' | 'NOTE_START'
          data1: string[]
          data2: number[]
        }) => {
          const { occassion, data1, data2 } = phaseMapSubelement

          if (occassion === 'BAR_START') {
            const barStart = tick
            const [barEnd] = data2
            const [barTag] = data1

            if (typeof barEnd !== 'number')
              throw new Error(
                'We should have numeric data for the end of the bar'
              )

            // if  the bar starts before the sought tick
            if (barStart < songTick && barEnd > songTick) {
              const len = barEnd - barStart
              const barCutoff = songTick - barStart
              const percent = (barCutoff * 100) / len

              ret.push([barTag, Math.round(percent)])
            }
          }
        }
      )
    })
    return acc
  }, {} as PhaseMap)
  if (ret.length === 0) {
    ret.push([null, 0])
  }

  return ret as BarTagPercent[]
}

export const midiAtBarUtil = (mem: Mem) => {
  const firstPhases = Object.entries(mem.phases).filter(([, phase]) => {
    return phase['follows-ids'].length === 0
  })

  const collector: PhaseMap[] = []

  firstPhases.forEach(([phaseName, phase]) => {
    mapPhaseData(phaseName, phase, 0, collector)
  })

  return (soughtTagName: string, percent: number): number => {
    let ret: number = 0
    let done = false
    collector.forEach((curr) => {
      Object.entries(curr).forEach(([tickRaw, dat]) => {
        if (done) {
          return
        }
        const tick = parseInt(tickRaw)
        dat.forEach((phaseMapSubelement) => {
          const { occassion, data1, data2 } = phaseMapSubelement
          if (occassion === 'BAR_START') {
            const barStart = tick
            const [barEnd] = data2
            const [barTag] = data1
            if (typeof barEnd !== 'number')
              throw new Error(
                'We should have numeric data for the end of the bar'
              )

            if (barTag === soughtTagName || soughtTagName === null) {
              const len = barEnd - barStart
              const tick = (percent * len) / 100
              ret = barStart + Math.round(tick)
              done = true
            }
          }
        })
      })
    })
    return ret
  }
}

export const midiAtBar = ([soughtTagName, percent]: BarTagPercent): number => {
  return midiAtBarUtil(mem())(soughtTagName, percent)
} //

export const extractPhaseAndBarStartAndEndTicks = (): {
  phases: {
    [phaseName: string]: [startTick: number, endTick: number]
  }
  bars: {
    [barName: string]: [startTick: number, endTick: number]
  }
} => {
  const collector: PhaseMap[] = []
  const firstPhases = Object.entries(mem().phases).filter(([, phase]) => {
    return phase['follows-ids'].length === 0
  })
  const phaseStartEnds: {
    [phaseName: string]: [startTick: number, endTick: number]
  } = {}
  const barsStartEnds: {
    [barName: string]: [startTick: number, endTick: number]
  } = {}

  firstPhases.forEach(([phaseName, phase]) => {
    mapPhaseData(phaseName, phase, 0, collector)
  })
  const phaseNames = [
    ...new Set(collector.map((phase) => phase[0][0].data1[0].split(':')[0])),
  ]

  phaseNames.forEach((phaseName) => {
    const phaseData = collector.find(
      (phase) => phase[0][0].data1[0].split(':')[0] === phaseName
    )
    const mappedTicks = Object.keys(phaseData)
    const firstBarStartEvent = mappedTicks.find(
      (tick) => phaseData[parseInt(tick)][0].occassion === 'BAR_START'
    )
    const lastBarEndEvent = mappedTicks
      .reverse()
      .find((tick) => phaseData[parseInt(tick)][0].occassion === 'BAR_END')
    const firstBarStartTick = firstBarStartEvent
      ? parseInt(firstBarStartEvent)
      : 0
    const lastBarEndTick = lastBarEndEvent ? parseInt(lastBarEndEvent) : 0

    phaseStartEnds[phaseName] = [firstBarStartTick, lastBarEndTick]
    Object.entries(phaseData).forEach(([tick, bar]) => {
      const barStartTick = parseInt(tick)
      const barEndTick = bar[0].data2[0]
      barsStartEnds[`${bar[0].data1[0]}`] = [barStartTick, barEndTick]
    })
  })

  return {
    phases: phaseStartEnds,
    bars: barsStartEnds,
  }
}

// One use of this function is in code that gets or places the places cursor within a song, as when stopping or restarting at a certain point.
export function mapPhaseData(
  phaseName: string,
  phase: Mem['phases'][string],
  startTick: number,
  collector: PhaseMap[] = []
) {
  const barTickFactor = tickCounts[BAR]

  // get the bar-sorted bar notes
  const phaseBars = getAllPhaseBarNotes(phaseName)
  // initialize the midi map where we will put each note on a numeric midi property

  const phaseData: PhaseMap = {}
  let barEndTick = startTick

  // for each bar, use the bar semantic "tags" property to determine which notes to play on that midi tick.
  phaseBars.forEach((barNotes, barIndex) => {
    // loop (not just multiplying by index) because later bars may have a different bar size multiplier each
    const thisBarOffset =
      barIndex *
      (barTickFactor *
        (typeof phase?.barSizeMultiplier === 'number'
          ? phase.barSizeMultiplier
          : 1))
    const thisBarLen =
      barTickFactor *
      (typeof phase?.barSizeMultiplier === 'number'
        ? phase.barSizeMultiplier
        : 1)

    barEndTick += thisBarLen

    if (!phaseData[thisBarOffset]) {
      phaseData[thisBarOffset] = []
    }

    if (barNotes.length === 0) {
      phaseData[thisBarOffset].push({
        occassion: 'BAR_START',
        data1: [`${phaseName}:${barIndex}`, 'emptyBar'],
        data2: [barEndTick],
      })
    } else {
      phaseData[thisBarOffset].push({
        occassion: 'BAR_START',
        data1: [`${phaseName}:${barIndex}`],
        data2: [barEndTick],
      })
    }
    barNotes.forEach((_note, _idx) => {
      const thisNoteOffset = 0
      // any need for per-note delays?
      // todo: for now, assuming not.
      const thisNoteTick = startTick + thisBarOffset + thisNoteOffset
      if (!phaseData[thisNoteTick]) {
        phaseData[thisNoteTick] = []
      }

      phaseData[thisNoteTick].push({
        occassion: 'NOTE_START',
        data1: [`${phaseName}:${barIndex}`],
        data2: [],
      })
    })

    if (!phaseData[barEndTick]) {
      phaseData[barEndTick] = []
    }
    if (barNotes.length === 0) {
      phaseData[thisBarOffset].push({
        occassion: 'BAR_END',
        data1: [`${phaseName}:${barIndex}`, 'emptyBar'],
        data2: [thisBarOffset],
      })
    } else {
      phaseData[barEndTick].push({
        occassion: 'BAR_END',
        data1: [`${phaseName}:${barIndex}`],
        data2: [thisBarOffset],
      })
    }
  })

  collector.push(phaseData)
  const followsPhases = getFollowingPhases(phaseName)

  followsPhases.forEach(([followsPhaseName, followsPhase]) => {
    mapPhaseData(
      followsPhaseName,
      followsPhase,
      phaseBars.length * barTickFactor,
      collector
    )
  })

  return collector
}
