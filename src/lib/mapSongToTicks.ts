import { mem, Mem } from '../core/mem'

import { BAR, tickCounts } from './util/constantsUtil'
import { getAllPhaseBarNotes } from './util/phaseNotesUtil'
import { getFollowingPhases } from './util/phaseRelationsUtil'
import { quantizeNote } from './util/quantizeUtil'
import { parseNoteTags } from './util/tagsUtil'
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

export const mapSongToMidiTicks = async (): Promise<MidiMap> => {
  const memData = mem()
  const workerManager = getWorkerManager()

  try {
    // Use web worker for processing
    return await workerManager.mapSongToMidiTicks(
      memData.phases,
      memData.notesByBar
    )
  } catch (error) {
    console.warn(
      'Web worker failed, falling back to synchronous processing:',
      error
    )
    // Fallback to synchronous processing
    return mapSongToMidiTicksSync()
  }
}

// Synchronous fallback implementation
export const mapSongToMidiTicksSync = (): MidiMap => {
  const firstPhases = Object.entries(mem().phases).filter(([_, phase]) => {
    return phase['follows-ids'].length === 0
  })

  const collector: MidiMap[] = []
  firstPhases.forEach(([phaseName, phase]) => {
    mapPhaseTicks(phaseName, phase, 0, collector)
  })

  // phase-level massaging here.
  const midiMap: MidiMap = collector.reduce((acc, curr) => {
    Object.entries(curr).forEach(([tickRaw, notes]) => {
      const tick = parseInt(tickRaw)
      if (!acc[tick]) {
        acc[tick] = []
      }
      acc[tick].push(...notes)
    })
    return acc
  }, {} as MidiMap)

  return midiMap
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

function mapPhaseTicks(
  phaseName: string,
  phase: Mem['phases'][string],
  startTick: number,
  collector: MidiMap[] = []
) {
  const barTickFactor = tickCounts.bar

  // get the bar-sorted bar notes
  const phaseBars = getAllPhaseBarNotes(phaseName)
  // initialize the midi map where we will put each note on a numeric midi property
  const phaseMidi: MidiMap = {}
  // for each bar, use the bar semantic "tags" property to determine which notes to play on that midi tick.
  phaseBars.forEach((barNotes, barIndex) => {
    // loop (not just multiplying by index) because later bars may have a different bar size multiplier each
    const thisBarOffset =
      barIndex *
      barTickFactor *
      (typeof phase?.barSizeMultiplier === 'number'
        ? phase.barSizeMultiplier
        : 1)
    // INTERPRETING INDIVIDUAL NOTES TO REAL TIMING
    barNotes.forEach((note) => {
      const parsedTags = parseNoteTags(note.tags)
      const thisNoteTick = quantizeNote(parsedTags) + startTick + thisBarOffset
      if (!phaseMidi[thisNoteTick]) {
        phaseMidi[thisNoteTick] = []
      }

      phaseMidi[thisNoteTick].push({
        note: note.note,
        compositionTags: note.tags,
      })
    })
  })
  collector.push(phaseMidi)
  const followsPhases = getFollowingPhases(phaseName)

  followsPhases.forEach(([followsPhaseName, followsPhase]) => {
    mapPhaseTicks(
      followsPhaseName,
      followsPhase,
      phaseBars.length * barTickFactor,
      collector
    )
  })

  return collector
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
