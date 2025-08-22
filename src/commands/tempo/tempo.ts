import { Module } from "peprn/util";
import { airSpeed, curr, exportableTick, setAirSpeed, trackTempo } from "../phase/observables/masterTicksObservable";
import { mem } from "src/lib";
import { START_SPEED } from "src/lib/mapSongToTicks";

export const tempo = {
    help: {
        description: 'Change the speed of a phase',
        examples: {
            '12': 'Change the speed of the track 120 * .12 (the min)',
            '825': 'Change the speed of the track 120 * .12 (the max)'
        }
    },
    fn: async ({ positionalNonCommands: [speed] }) => {
        if (typeof speed !== 'number') throw new Error('Speed must be a number')
        setAirSpeed(speed)
        const currTick = exportableTick()
        mem.mem().playedMap[currTick] = mem.mem().playedMap[currTick] || []
        mem.mem().playedMap[currTick].push({
            note: `tempo: ${Math.round(trackTempo / airSpeed() )}`,
            compositionTags: []
        })
    }
} as Module