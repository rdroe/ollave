import { Module, SyncChildCalls } from 'nyargs';
import { fakeCli } from 'nyargs/runtime';
import { isStringNumNum, makeSubmodule, passivelyNumberize } from '../lib/helpers'
import { Observable, Subscriber, } from 'rxjs'
import { notesNamespace } from 'src/data';

type NamedObservable = {
    observable: InstanceType<typeof Observable> | null,
    interval: null | number,
    started: number
    notes: {
        [noteId: string]: {
            lastPlayedAt: number
        }
    }
}
// in-memory namespace for cues
export const cuesNamespace: {
    initialized: boolean,
    names: {
        [noteName: string]: NamedObservable
    }
} = {
    initialized: false,
    names: {}
}

// default bar length for music tracks (1 bar per 3000 seconds)
const masterInterval = 3000

// time since file was loaded
const startTime = Date.now()

// utility function to create an observable (cue) that subscribing notes can use. the subscribers (notes) will be triggered at every observables interval passing.
const makeSubscribe = (ownCtx: NamedObservable, parent = 'default') => {

    let currCardinal = 0
    return function subscribe(subscriber: Subscriber<any>) {

        // This is the cycle on which the subscriber will be played (or run if a cue)
        const anId = Math.random().toString(36).substring(7)
        console.log('setting up interval!!!', subscriber)
        console.log(ownCtx)
        const noteStarted = Math.trunc(
            Date.now().valueOf() / ownCtx.interval
        ) * ownCtx.interval
        ownCtx.notes[anId] = {
            lastPlayedAt: noteStarted
        }
        const noteNs = ownCtx.notes[anId]
        const intervalId = setInterval(() => {

            // this particular observable offset; its time to be played
            const sizeMs = ownCtx.interval


            const portion = Date.now() - noteNs.lastPlayedAt
            // if the surpassed time is greater than the size of the cue, we trigger the subscriber

            if (portion >= sizeMs) {
                console.log('id', anId)
                //restart counting; that is, reset the started time to the current time; start a new "run"
                noteNs.lastPlayedAt += sizeMs

                currCardinal++
                try {

                    subscriber.next({
                        count: currCardinal,
                        sizeMs,
                        started: ownCtx.started
                    })
                } catch (e) {
                    console.error('error in cue observable', e)
                    subscriber.error(e)
                }

            }

        }, 5);

        return function unsubscribe() {
            clearInterval(intervalId);
            subscriber.complete()
        };
    }
}


const cues = {
    get(nm: string) {
        if (nm === 'default') return {
            observable: null,
            interval: masterInterval,
            started: startTime,
            notes: {}
        }
        return cuesNamespace.names[nm] ?? null
    }
}

// Create a new cue observable; start it; add it to the namespace
const startCueObservable = (name: string, [numerator, divisor]: [number, number], contextName = 'default') => {
    // this cue, a child cue, relates to the parent in that it is a fraction of the parent's interval
    const parentCtx = cues.get(contextName)
    const size = cues.get(contextName).interval

    const ownCtx: {
        observable: null | InstanceType<typeof Observable>,
        interval: number,
        started: number,
        notes: {
            [noteId: string]: {
                lastPlayedAt: number
            }
        }

    } = {
        interval: size * numerator / divisor,
        observable: null,
        // started: parentCtx.started  // will be file loaded time if no parent
        started: Math.trunc(Date.now().valueOf() / parentCtx.interval) * parentCtx.interval,
        notes: {}
    }

    cuesNamespace.names[name] = ownCtx

    const observable = new Observable(makeSubscribe(ownCtx, contextName));
    /*
    parentCtx.observable.subscribe(() => {
        ownCtx.started = Date.now()
    })
    */
    ownCtx.observable = observable


}

const cuesHelp = {
    description: 'Start a subscribable cue',
    examples: {
        'aphrodite 5 1': 'Start a starter. Subscribers will receive the elapsed cardinality (and other info) at 5 * 1 * length of a master interval'
    }
}


const start = makeSubmodule('start', async ({ positional, parent }: { positional: (string | number)[], parent?: string }) => {

    const [str, num1, num2] = positional.map(passivelyNumberize)
    const tri = [str, num1, num2]

    if (!isStringNumNum([str, num1, num2])) return null

    if (parent) {
        const parentCtx = cues.get(parent)?.observable ? cues.get(parent) : null
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
