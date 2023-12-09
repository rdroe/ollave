
import { tickCounts } from './commands/phase/observables/masterTicksObservable'
import { peprnIsNum } from './lib/helpers'
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


const DEFAULT_STRUM_MODE = true
type TagData = (number | string | boolean | null)[]
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
        // INTERPRETING INDIVIDUAL NOTES TO REAL TIMING
        barNotes.forEach((note, idx) => {
            const parsedTags = note.tags.reduce((accum, tag) => {
                if (!tag.includes('=')) {
                    return [tag, []]
                }
                const split = tag.split('=')
                console.log('split', split)
                const right = peprnIsNum(split[1]) ? parseFloat(split[1]) : split[1]
                return [...accum, [
                    split[0], [right]
                ]]
            }, [] as [name: string, data: TagData][])

            if (DEFAULT_STRUM_MODE) {
                let thisNoteOffset = idx * sixtyFourthNoteTickFactor

                const eightNoteDelay = parsedTags.find(([name, data]: [nm: string, data: TagData]) => {
                    return name == '8ths'

                })
                if (eightNoteDelay) {
                    const [noteCnt] = eightNoteDelay[1]
                    if (typeof noteCnt === 'number') {
                        thisNoteOffset += (tickCounts.eighth * noteCnt)
                    } else {
                        throw new Error(`Non-numeric eigth note ${JSON.stringify(
                            eightNoteDelay
                        )}`)
                    }
                }

                const thisNoteTick = startTick + thisBarOffset + thisNoteOffset
                if (!phaseMidi[thisNoteTick]) {
                    phaseMidi[thisNoteTick] = []
                }
                phaseMidi[thisNoteTick].push({
                    note: note.note,
                    compositionTags: note.tags
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

export function mapPhaseData(phaseName: string, phase: Mem['phases'][string], startTick: number, collector: PhaseMap[] = []) {

    const barTickFactor = tickCounts.bar
    const sixtyFourthNoteTickFactor = tickCounts.sixtyfourth

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

        phaseData[thisBarOffset].push({
            occassion: "BAR_START",
            data1: [barNotes[0].barTag],
            data2: [barEndTick]
        })
        barNotes.forEach((note, idx) => {
            if (DEFAULT_STRUM_MODE) {
                const thisNoteOffset = idx * sixtyFourthNoteTickFactor
                const thisNoteTick = startTick + thisBarOffset + thisNoteOffset
                if (!phaseData[thisNoteTick]) {
                    phaseData[thisNoteTick] = []
                }

                phaseData[thisNoteTick].push({
                    occassion: "NOTE_START",
                    data1: [barNotes[0].barTag],
                    data2: []
                })
            } else {
                console.error("TODO: in mapPhaseData, implement non-default-strum mode")
            }

        })
        if (!phaseData[barEndTick]) {
            phaseData[barEndTick] = []
        }

        phaseData[barEndTick].push({
            occassion: "BAR_END",
            data1: [barNotes[0].barTag],
            data2: [thisBarOffset]
        })
    })

    collector.push(phaseData)
    const followsPhases = getFollowingPhases(phaseName)

    followsPhases.forEach(([followsPhaseName, followsPhase]) => {
        mapPhaseData(followsPhaseName, followsPhase, phaseBars.length * barTickFactor + barTickFactor, collector)
    })

    return collector
}
