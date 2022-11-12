import { Module, SyncChildCalls } from 'nyargs';
import { isStringNumNum, makeSubmodule, passivelyNumberize } from '../lib/helpers'
import { Subscription, Observable, } from 'rxjs'

type Fraction = [number, number]

export const cuesNamespace: {
    initialized: boolean,
    names: {
        [noteName: string]: {
            observable: InstanceType<typeof Observable> | null,
            interval: null | Fraction, //fraction of master interval
            subscription: InstanceType<typeof Subscription> | null,
        }
    }
} = {
    initialized: false,
    names: {}
}


const masterIntervalInSeconds = 3
const masterInterval = masterIntervalInSeconds * 1000

const ntsHelp = {
    description: 'Play note',
    examples: {
        'c4 64 1': 'Play C4 note with one second delay (64 is currently ignored'
    }
}



const startCueObservable = (name: string, [numerator, divisor]: [number, number], size = masterInterval) => {

    let curr = Date.now()
    let currCardinal = 0
    const sizeSeconds = size * numerator / divisor

    const observable = new Observable(function subscribe(subscriber) {

        // Keep track of the interval resource
        const intervalId = setInterval(() => {
            const now = Date.now()
            const portion = now - curr

            if (portion > sizeSeconds) {
                curr += sizeSeconds
                currCardinal++
                subscriber.next({ count: currCardinal, size: [numerator, divisor] })
            }

        }, 5);

        // Provide a way of canceling and disposing the interval resource
        return function unsubscribe() {
            clearInterval(intervalId);
        };
    });

    if (cuesNamespace.names[name]) {
        cuesNamespace.names[name]?.subscription.unsubscribe()

    }

    cuesNamespace.names[name] = {
        interval: [numerator, divisor],
        observable,
        subscription: null
    }

}

const cuesHelp = {
    description: 'Start a subscribable cue',
    examples: {
        'aphrodite 5 1': 'Start a starter. Subscribers will receive the elapsed cardinality (and other info) at 5 * 1 * length of a master interval'
    }
}

const start = makeSubmodule('start', async ({ positional }) => {

    const [str, num1, num2] = positional.map(passivelyNumberize)

    const tri = [str, num1, num2]

    return isStringNumNum(tri) ? startCueObservable(str as string, [num1, num2] as [number, number]) : null
}, cuesHelp)



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
