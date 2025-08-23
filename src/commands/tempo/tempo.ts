import { Module } from "peprn/util";
import { airSpeed, exportableTick, setAirSpeed, tempoFromAirSpeed } from "../phase/observables/masterTicksObservable";
import { mem } from "../../lib";
import { addTempoSlider } from "../../lib/addTempoSlider";

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