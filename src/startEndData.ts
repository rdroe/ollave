import { tickCounts } from './core/observables/masterTicksObservable'
import { Mem, mem } from './lib/mem'
import { getAllPhaseBarNotes, getFollowingPhases } from './lib/util/phaseUtil'
export type StartEndTuple = [start: number, end: number]

type StartEndData = {
    [phaseName: string]: StartEndTuple[]
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
