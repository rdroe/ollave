import { mem, Mem } from "../../core/mem"
import { getAllPhaseBarNotes } from "./phaseNotesUtil"
import { getFollowingPhases } from "./phaseUtil"
import { tickCounts } from "./tickUtil"

// Forward declarations to avoid circular imports
export type StartEndTuple = [number, number]

type StartEndData = {
  [phaseName: string]: StartEndTuple[]
}

function relativeStartEnd(phaseName: string, phase: Mem['phases'][string], startTick: number, collector: StartEndData) {
  if (!collector[phaseName]) {
      collector[phaseName] = []
  }
  const myStartEnds = collector[phaseName]

  const barTickFactor = tickCounts.bar
  // get the bar-sorted bar notes
  const phaseBars = getAllPhaseBarNotes(phaseName)

  // for each bar, use the bar semantic "tags" property to determine which notes to play on that midi tick.
  // this is used multiple places; needs abstraction to separate file and exportable module
  let endTick = startTick
  phaseBars.forEach(() => {
      // loop (not just multiplying by index) because later bars may have a different bar size multiplier each
      const thisBarLen = barTickFactor * (typeof phase?.barSizeMultiplier === 'number' ? phase.barSizeMultiplier : 1)
      endTick += thisBarLen
  })

  myStartEnds.push([startTick, endTick])
  const followsPhases = getFollowingPhases(phaseName)


  followsPhases.forEach(([followsPhaseName, followsPhase]) => {
      relativeStartEnd(followsPhaseName, followsPhase, endTick, collector)
  })

  return collector
}


export const phaseBeginningsAndEnds = (): StartEndData => {
  const firstPhases = Object.entries(mem().phases).filter(([_, phase]) => {
      return phase["follows-ids"].length === 0
  })
  const collector: StartEndData = {}
  firstPhases.forEach(([phaseName, phase]) => {
      relativeStartEnd(phaseName, phase, 0, collector)
  })
  return collector
}

export const startEndData = (phaseName: string): StartEndTuple[] => {
    const startEndData = phaseBeginningsAndEnds()
    return startEndData[phaseName] || []
}

export const lastTick = () => {
    // this is called very frequently!
    const songStartEndData = phaseBeginningsAndEnds()
    const lastTick = Object.values(songStartEndData).reduce((acc, curr) => {
        const lastPhaseTick = curr[curr.length - 1][1]
        return Math.max(acc, lastPhaseTick)
    }, 0)
    return lastTick
}
