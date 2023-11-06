import { Module, } from 'peprn/util';
import { isString, passivelyNumberize } from '../../lib/helpers'
import { Observable, } from 'rxjs'
import { makeSubscribe } from './subjects/masterTicksSubject';

import { observables } from '../../mem';



// Create a new cue observable; start it; add it to the namespace
const startCueObservable = (name: string) => {
    // make a new observable that subscribes to master ticks
    // if the fed-in tick modular-divides to 0 on bar ticks, trigger.
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
                    'aphrodite': 'start a phase'
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
