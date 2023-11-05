import { Module, } from 'peprn/util';
import { isString, passivelyNumberize } from '../../lib/helpers'
import { Observable, } from 'rxjs'
import { makeSubscribe } from './subjects/masterTicksSubject';

import { observables } from '../../mem';
export type Cue = [
    name: string,
    start: number,
    interval: number,
    observable: Observable<any> | null,
]


/*
The formula is 60000 / (BPM * PPQ) (milliseconds).
Where BPM is the tempo of the track (Beats Per Minute).
(i.e. a 120 BPM track would have a MIDI time of (60000 / (120 * 192)) or 2.604 ms for 1 tick.i
*/


// Create a new cue observable; start it; add it to the namespace
const startCueObservable = (name: string) => {
    // make a new observable that subscribes to master ticks
    observables[name] = new Observable(makeSubscribe());
}

export const findPhase = (name: string) => {
    return observables[name] || null
}

/**
Should work like this:
a cue equals a "phase" from notes.
this command should be renamed "phase" or possibly "phases". 
start cue aphro should start a new subject that subscribes to the master ticks subject. the arguments include (at least) a length in bars.
a new command 

phases and tracks
we need to add the track, song, entities and the track-song (or song-track) property on one of those. 
*/


const module: Module = {
    help: {
        description: 'Create a subscribable time interval',
    },
    fn: async (args) => {
        return null
    },
    submodules: {
        start: {
            help: {
                description: 'Start a subscribable cue',
                examples: {
                    'aphrodite': 'Start a starter. Subscribers will receive the elapsed cardinality (and other info) at 5 * 1 * length of a master interval'
                }
            },
            fn: async ({ positionalNonCommands: positional }) => {
                const [str] = positional.map(passivelyNumberize)
                if (!isString(str)) return null
                return startCueObservable(
                    str as string
                )
            }
        }
    }
}

export default module
