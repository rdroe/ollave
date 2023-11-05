import { Module, makeSubmodule } from 'peprn/util';
import { fakeCli } from 'peprn/browser';
import { isString, isStringNumNum, passivelyNumberize } from '../../lib/helpers'
import { Observable, } from 'rxjs'
import { makeSubscribe } from './subjects/masterTicksSubject';
import { z } from 'zod';

import { observables } from '../../mem';
export type Cue = [
    name: string,
    start: number,
    interval: number,
    observable: Observable<any> | null,
]

type CuesNamespace = {
    cues: Cue[]
}

const cues2Namespace: CuesNamespace = {
    cues: []
}

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

const phaseHelp = {
    description: 'Start a subscribable cue',
    examples: {
        'aphrodite 5 1': 'Start a starter. Subscribers will receive the elapsed cardinality (and other info) at 5 * 1 * length of a master interval'
    }
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
const start = makeSubmodule('start', async ({ positionalNonCommands: positional }) => {
    const [str] = positional.map(passivelyNumberize)
    if (!isString(str)) return null
    return startCueObservable(
        str as string
    )
}, phaseHelp)

const module: Module = {
    help: {
        description: 'Create a subscribable time interval',
    },

    fn: async (args) => {

        return null
    },
    submodules: Object.fromEntries([start]),
}

export default module
