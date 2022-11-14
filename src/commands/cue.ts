import { Module, SyncChildCalls } from 'nyargs';
import { fakeCli } from 'nyargs/runtime';
import { isStringNumNum, makeSubmodule, passivelyNumberize } from '../lib/helpers'
import { Observable, Subscriber, } from 'rxjs'

type NamedObservable = {
    observable: InstanceType<typeof Observable> | null,
    interval: null | number,
    started: number
}
export const cuesNamespace: {
    initialized: boolean,
    names: {
        [noteName: string]: NamedObservable
    }
} = {
    initialized: false,
    names: {}
}


const masterInterval = 3000
const startTime = Date.now()
const makeSubscribe = (ownCtx: NamedObservable, parent = 'default') => {

    let currCardinal = 0
    return function subscribe(subscriber: Subscriber<any>) {

        const intervalId = setInterval(() => {

            const sizeMs = ownCtx.interval
            const now = Date.now()
            const portion = now - ownCtx.started

            if (portion >= sizeMs) {
                console.log('ticking; child of ', parent, 'size v portion', sizeMs, portion)
                ownCtx.started += sizeMs
                currCardinal++
                try {
                    subscriber.next({ count: currCardinal, sizeMs, started: ownCtx.started })
                } catch (e) {
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
            started: startTime
        }
        return cuesNamespace.names[nm] ?? null
    }
}

const startCueObservable = (name: string, [numerator, divisor]: [number, number], contextName = 'default') => {
    const parentCtx = cues.get(contextName)
    const size = cues.get(contextName).interval

    const ownCtx: { observable: null | InstanceType<typeof Observable>, interval: number, started: number } = {
        interval: size * numerator / divisor,
        observable: null,
        started: parentCtx.started
    }

    cuesNamespace.names[name] = ownCtx

    const observable = new Observable(makeSubscribe(ownCtx, contextName));
    /*
    parentCtx.observable.subscribe(() => {
        ownCtx.started = Date.now()
    })
    */
    ownCtx.observable = observable
    console.log('started cue obs', cuesNamespace)

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

        return isStringNumNum(tri) ? startCueObservable(compoundName, [num1, num2] as [number, number], parent) : null
    }

    return isStringNumNum(tri) ? startCueObservable(str as string, [num1, num2] as [number, number]) : null

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
