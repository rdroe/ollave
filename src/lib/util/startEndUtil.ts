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

// lastTick is called on EVERY playback tick (getSongCursor), and computing
// it walks the whole phase graph and every bar's notes. Memoize on the
// identity of mem().latestMap and mem().notesByBar — both are replaced
// (new object) exactly when the song recompiles or a different song/scratch
// context is mounted, which is precisely when the answer can change.
let lastTickCacheKeyMap: unknown = undefined
let lastTickCacheKeyNotes: unknown = undefined
let lastTickCacheVal = 0

export const lastTick = () => {
    const keyMap = mem().latestMap
    const keyNotes = mem().notesByBar
    if (keyMap === lastTickCacheKeyMap && keyNotes === lastTickCacheKeyNotes) {
        return lastTickCacheVal
    }
    const songStartEndData = phaseBeginningsAndEnds()
    const computed = Object.values(songStartEndData).reduce((acc, curr) => {
        const lastPhaseTick = curr[curr.length - 1][1]
        return Math.max(acc, lastPhaseTick)
    }, 0)
    lastTickCacheKeyMap = keyMap
    lastTickCacheKeyNotes = keyNotes
    lastTickCacheVal = computed
    return computed
}
