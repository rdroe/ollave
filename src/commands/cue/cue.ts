import { Module, SyncChildCalls } from 'nyargs';
import { fakeCli } from 'nyargs/runtime';
import { isStringNumNum, makeSubmodule, passivelyNumberize } from '../../lib/helpers'
import { Observable, } from 'rxjs'
import { makeSubscribe } from './subjects/masterTicksSubject';

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
const startCueObservable = (name: string, [numerator, divisor]: [number, number], contextName = 'default') => {
    // this cue, a child cue, relates to the parent in that it is a fraction of the parent's interval
    const parentCue = findCue(contextName)
    const observable = new Observable(makeSubscribe());
    cues2Namespace.cues.push([name, numerator, divisor, observable])
}

const cuesHelp = {
    description: 'Start a subscribable cue',
    examples: {
        'aphrodite 5 1': 'Start a starter. Subscribers will receive the elapsed cardinality (and other info) at 5 * 1 * length of a master interval'
    }
}

export const findCue = (name: string) => {
    return cues2Namespace.cues.find(([nm]) => nm === name) || null
}

/**
Should work like this:
a cue equls a "phase" from notes.
this command should be renamed "phase" or possibly "phases". 
start cue aphro should start a new subject that subscribes to the master ticks subject. the arguments include (at least) a length in bars.
a new command 

phases and tracks
we need to add the track, song, entities and the track-song (or song-track) property on one ofthose. these should be stored in idb, imo.  use userTables
*/
const start = makeSubmodule('start', async ({ positional, parent }: { positional: (string | number)[], parent?: string }) => {
    const [str, num1, num2] = positional.map(passivelyNumberize)
    const tri = [str, num1, num2]

    if (!isStringNumNum([str, num1, num2])) return null

    if (parent) {
        const parentCtx = findCue(parent) ?? null
        if (!parentCtx) {
            return {
                message: `Could not locate requested parent namespace "${parent}" for ${str}`
            }
        }

        const compoundName = `${parent}.${str}`

        return isStringNumNum(tri)
            ? startCueObservable(
                compoundName,
                [num1, num2] as [number, number],
                parent
            )
            : null
    }

    return isStringNumNum(tri)
        ? startCueObservable(
            str as string,
            [num1, num2] as [number, number]
        )
        : null

}, cuesHelp, [makeSubmodule('sub', async ({ positional }) => {


    const parent = positional.shift()
    const result = await fakeCli.handle(`cue start ${positional.join(' ')} --parent ${parent}`)

    return result


})])

const module: Module<{}> = {
    help: {
        description: 'Create a subscribable time interval',
    },

    fn: async (args, childCalls: SyncChildCalls) => {

        return null
    },
    submodules: Object.fromEntries([start]),
}

export default module
