import { BAR, tickCounts } from './commands/phase/observables/masterTicksObservable'

import { calcFractionalDelay, calcTickDelay, parseNoteTags } from './lib/tags'
import { Mem, mem } from './mem'
import { getAllPhaseBarNotes, getFollowingPhases } from './mem-db'

// Detailed structure of a phase (possibly a phase part)
export type MidiMap = {
    [tick: number]: {
        note: string,
        velocity?: number,
        duration?: number,
        compositionTags: string[]
    }[]
}

// High-level structure of a phase
export type PhaseMap = {
    [tick: number]: {
        occassion: "BAR_START" | "BAR_END" | "NOTE_START",
        data1: string[],
        data2: number[]
    }[]
}

export type BarTagPercent = [tagName: string, percent: number]

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


export const barsAtMidi = (songTick: number): BarTagPercent[] => {

    const firstPhases = Object.entries(mem().phases).filter(([phaseName, phase]) => {
        return phase["follows-ids"].length === 0
    })

    const collector: PhaseMap[] = []
    firstPhases.forEach(([phaseName, phase]) => {
        mapPhaseData(phaseName, phase, 0, collector)
    })

    const ret: BarTagPercent[] = []

    const phaseMap: PhaseMap = collector.reduce((acc, curr) => {
        Object.entries(curr).forEach(([tickRaw, dat]) => {
            const tick = parseInt(tickRaw)
            if (!acc[tick]) {
                acc[tick] = []
            }
            acc[tick].push(...dat)

            dat.forEach((phaseMapSubelement) => {
                const { occassion, data1, data2 } = phaseMapSubelement

                if (occassion === "BAR_START") {
                    const barStart = tick
                    const [barEnd] = data2
                    const [barTag] = data1

                    if (typeof barEnd !== "number") throw new Error("We should have numeric data for the end of the bar")

                    // if  the bar starts before the sought tick
                    if (barStart < songTick && barEnd > songTick) {

                        const len = barEnd - barStart
                        const barCutoff = songTick - barStart
                        const percent = barCutoff * 100 / len

                        ret.push([barTag, Math.round(
                            percent
                        )])
                    }
                }
            })
        })
        return acc
    }, {} as PhaseMap)

    return ret as BarTagPercent[]
}


export const midiAtBar = ([soughtTagName, percent]: BarTagPercent): number => {
    const firstPhases = Object.entries(mem().phases).filter(([, phase]) => {
        return phase["follows-ids"].length === 0
    })

    const collector: PhaseMap[] = []

    firstPhases.forEach(([phaseName, phase]) => {
        mapPhaseData(phaseName, phase, 0, collector)
    })

    let ret: number = 0

    collector.forEach((curr) => {
        Object.entries(curr).forEach(([tickRaw, dat]) => {
            const tick = parseInt(tickRaw)
            dat.forEach((phaseMapSubelement) => {
                const { occassion, data1, data2 } = phaseMapSubelement
                if (occassion === "BAR_START") {
                    const barStart = tick
                    const [barEnd] = data2
                    const [barTag] = data1
                    if (typeof barEnd !== "number") throw new Error("We should have numeric data for the end of the bar")


                    if (barTag === soughtTagName) {

                        const len = barEnd - barStart
                        const tick = percent * len / 100
                        ret = barStart + Math.round(tick)

                    }
                }
            })
        })
    }, {} as PhaseMap)

    return ret

}




function mapPhaseTicks(phaseName: string, phase: Mem['phases'][string], startTick: number, collector: MidiMap[] = []) {

    const barTickFactor = tickCounts.bar

    // get the bar-sorted bar notes
    const phaseBars = getAllPhaseBarNotes(phaseName)
    // initialize the midi map where we will put each note on a numeric midi property
    const phaseMidi: MidiMap = {}
    // for each bar, use the bar semantic "tags" property to determine which notes to play on that midi tick. 
    phaseBars.forEach((barNotes, barIndex) => {
        // loop (not just multiplying by index) because later bars may have a different bar size multiplier each
        const thisBarOffset = barIndex * barTickFactor * (typeof phase?.barSizeMultiplier === 'number' ? phase.barSizeMultiplier : 1)
        // INTERPRETING INDIVIDUAL NOTES TO REAL TIMING
        barNotes.forEach((note, idx) => {
            const parsedTags = parseNoteTags(note.tags)

            let thisNoteOffset = 0
            thisNoteOffset += calcFractionalDelay(parsedTags)
            thisNoteOffset += calcTickDelay(parsedTags)
            const thisNoteTick = startTick + thisBarOffset + thisNoteOffset
            console.log('this note tick', { thisNoteTick, startTick, thisNoteOffset, thisBarOffset })
            if (!phaseMidi[thisNoteTick]) {
                phaseMidi[thisNoteTick] = []
            }
            phaseMidi[thisNoteTick].push({
                note: note.note,
                compositionTags: note.tags
            })

        })
    })
    collector.push(phaseMidi)
    const followsPhases = getFollowingPhases(phaseName)

    followsPhases.forEach(([followsPhaseName, followsPhase]) => {
        mapPhaseTicks(followsPhaseName, followsPhase, phaseBars.length * barTickFactor, collector)
    })

    return collector
}
// One use of this function is in code that gets or places the places cursor within a song, as when stopping or restarting at a certain point.
export function mapPhaseData(phaseName: string, phase: Mem['phases'][string], startTick: number, collector: PhaseMap[] = []) {
    const barTickFactor = tickCounts[BAR]


    // get the bar-sorted bar notes
    const phaseBars = getAllPhaseBarNotes(phaseName)
    // initialize the midi map where we will put each note on a numeric midi property

    const phaseData: PhaseMap = {}
    let barEndTick = startTick

    // for each bar, use the bar semantic "tags" property to determine which notes to play on that midi tick. 
    phaseBars.forEach((barNotes, barIndex) => {
        // loop (not just multiplying by index) because later bars may have a different bar size multiplier each
        const thisBarOffset = barIndex * barTickFactor * (typeof phase?.barSizeMultiplier === 'number' ? phase.barSizeMultiplier : 1)
        const thisBarLen = barTickFactor * (typeof phase?.barSizeMultiplier === 'number' ? phase.barSizeMultiplier : 1)

        barEndTick += thisBarLen
        if (!phaseData[thisBarOffset]) {
            phaseData[thisBarOffset] = []
        }

        if (barNotes.length === 0) {
            phaseData[thisBarOffset].push({
                occassion: "BAR_START",
                data1: [`${phaseName}:${barIndex}`, "emptyBar"],
                data2: [barEndTick]
            })

        } else {
            phaseData[thisBarOffset].push({
                occassion: "BAR_START",
                data1: [barNotes[0].barTag],
                data2: [barEndTick]
            })
        }
        barNotes.forEach((note, idx) => {

            const thisNoteOffset = 0
            // any need for per-note delays?
            // todo: for now, assuming not.
            const thisNoteTick = startTick + thisBarOffset + thisNoteOffset
            if (!phaseData[thisNoteTick]) {
                phaseData[thisNoteTick] = []
            }

            phaseData[thisNoteTick].push({
                occassion: "NOTE_START",
                data1: [barNotes[0].barTag],
                data2: []
            })


        })

        if (!phaseData[barEndTick]) {
            phaseData[barEndTick] = []
        }
        if (barNotes.length === 0) {
            phaseData[thisBarOffset].push({
                occassion: "BAR_END",
                data1: [`${phaseName}:${barIndex}`, "emptyBar"],
                data2: [thisBarOffset]
            })
        } else {
            phaseData[barEndTick].push({
                occassion: "BAR_END",
                data1: [barNotes[0].barTag],
                data2: [thisBarOffset]
            })
        }
    })

    collector.push(phaseData)
    const followsPhases = getFollowingPhases(phaseName)

    followsPhases.forEach(([followsPhaseName, followsPhase]) => {
        mapPhaseData(followsPhaseName, followsPhase, phaseBars.length * barTickFactor, collector)
    })

    return collector
}
