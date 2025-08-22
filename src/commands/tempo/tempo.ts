import { Module } from "peprn/util";
import { airSpeed, curr, exportableTick, setAirSpeed, tempoFromAirSpeed, trackTempo } from "../phase/observables/masterTicksObservable";
import { mem } from "src/lib";
import { addTempoSlider } from "src/lib/addTempoSlider";

export const tempo = {
    help: {
        description: 'Change the speed of a phase',
        examples: {
            '12': 'Change the speed of the track 120 * .12 (the min)',
            '825': 'Change the speed of the track 120 * .12 (the max)'
        }
    },
    fn: async ({ positionalNonCommands: [speed], addSlider = true}) => {
        if (typeof speed !== 'number') throw new Error('Speed must be a number')
        setAirSpeed(speed)
        const currTick = exportableTick()
        mem.mem().playedMap[currTick] = mem.mem().playedMap[currTick] || []
        
        mem.mem().playedMap[currTick].push({
            note: `tempo: ${tempoFromAirSpeed(airSpeed())}`,
            compositionTags: []
        })
        if (addSlider) {
            addTempoSlider('#controls-1')
        }
    }
} as Module