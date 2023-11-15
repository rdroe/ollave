import { tickCounts } from './commands/phase/observables/masterTicksObservable'
import { Mem, mem } from './mem'
import { getAllPhaseBarNotes, getFollowingPhases } from './mem-db'

export type MidiMap = {
    [tick: number]: {
        note: string,
        velocity?: number,
        duration?: number,
    }[]
}


export const mapSongToMidiTicks = () => {
    const { song, track } = mem()
    const firstPhases = Object.entries(mem().phases).filter(([phaseName, phase]) => {
        return phase["follows-ids"].length === 0
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

const DEFAULT_STRUM_MODE = true

function mapPhaseTicks(phaseName: string, phase: Mem['phases'][string], startTick: number, collector: MidiMap[] = []) {

    const barTickFactor = tickCounts.bar
    const sixtyFourthNoteTickFactor = tickCounts.sixtyfourth

    // get the bar-sorted bar notes
    const phaseBars = getAllPhaseBarNotes(phaseName)
    // initialize the midi map where we will put each note on a numeric midi property
    const phaseMidi: MidiMap = {}
    // for each bar, use the bar semantic "tags" property to determine which notes to play on that midi tick. 
    phaseBars.forEach((barNotes, barIndex) => {
        // loop (not just multiplying by index) because later bars may have a different bar size multiplier each
        const thisBarOffset = barIndex * barTickFactor * (typeof phase?.barSizeMultiplier === 'number' ? phase.barSizeMultiplier : 1)
        barNotes.forEach((note, idx) => {
            if (DEFAULT_STRUM_MODE) {
                const thisNoteOffset = idx * sixtyFourthNoteTickFactor
                const thisNoteTick = startTick + thisBarOffset + thisNoteOffset
                if (!phaseMidi[thisNoteTick]) {
                    phaseMidi[thisNoteTick] = []
                }
                phaseMidi[thisNoteTick].push({
                    note: note.note
                })
            } else {
                console.error("TODO: implement non-default-strum mode")
            }
        })
    })
    collector.push(phaseMidi)
    const followsPhases = getFollowingPhases(phaseName)

    followsPhases.forEach(([followsPhaseName, followsPhase]) => {
        mapPhaseTicks(followsPhaseName, followsPhase, phaseBars.length * barTickFactor + barTickFactor, collector)
    })

    return collector
}
