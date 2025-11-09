import { mem, Mem } from '../core/mem'

import { MidiMappingResult } from './shared/midiMappingCore'
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
    console.log(
      'comparing prevMapGlobal with worker result',
      prevMapGlobal,
      workerResult.map
    )
    console.log(
      'comparing got result:',
      getNoteDiff(prevMapGlobal, workerResult.map)
    )

    return workerResult
  } catch (error) {
    console.warn(
      'Web worker failed, falling back to synchronous processing:',
      error
    )
    // Fallback to synchronous processing
    const result = mapSongToMidiTicksSync()
    console.log(
      'comparing got result sync:',
      getNoteDiff(prevMapGlobal, result.map)
    )
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
}

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

export function mapPhaseData(
  phaseName: string,
  phase: Mem['phases'][string],
  startTick: number,
  collector: PhaseMap[] = []
) {
  const barTickFactor = tickCounts[BAR]

  const phaseBars = getAllPhaseBarNotes(phaseName)

  const phaseData: PhaseMap = {}
  let barEndTick = startTick

  phaseBars.forEach((barNotes, barIndex) => {
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
