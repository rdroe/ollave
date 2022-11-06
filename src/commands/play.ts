
// var fs = require('fs');

import { Module, SyncChildCalls } from 'nyargs';
import { isString, isStringNumNum, makeSubmodule, passivelyNumberize } from '../lib/helpers'
import { Observable, interval, take, share, filter, Subscription } from 'rxjs'
import { playNotes } from 'src/lib/midi';
import { playTriads, Triad } from 'src/lib/music';

const test1 = makeSubmodule('test', async ({ positional }) => {
    const foo = new Observable((subscriber) => {
        console.log('Hello');
        subscriber.next(42);
        subscriber.next(100); // "return" another value
        subscriber.next(200); // "return" yet another
    });

    console.log('before');
    foo.subscribe((x) => {
        console.log(x);
    });
    console.log('after');

    return 'child a'
})

const test2 = makeSubmodule('test2', async ({ positional }) => {
    const first5SpacedNumbers = interval(1000).pipe(take(5), share())

    first5SpacedNumbers.subscribe((v) => console.log("A", v))
    // Will start logging A1... A2...

    setTimeout(() => {
        first5SpacedNumbers.subscribe((v) => console.log("B", v))
    }, 2000)
    // Will 
})

const nts = makeSubmodule('nts', async ({ positional }) => {
    const [str, num1, num2] = positional.map(passivelyNumberize)
    console.log('input', str, num1, num2, 'all', positional)
    const tri = [str, num1, num2]
    return isStringNumNum(tri) ? playNotes([tri]) : null
})


type Fraction = [number, number]
const PROCESS_DELAY = 0.1
const time = Date.now() / 1000
const elapsed = () => (Date.now() / 1000) - time

const notesNamespace: {
    initialized: boolean,
    names: {
        [noteName: string]: {
            interval: null | Fraction,
            subscription: Subscription
        }
    }
} = {
    initialized: false,
    names: {}
}



const masterIntervalInSeconds = 3
const masterInterval = masterIntervalInSeconds * 1000

const observables = {
    play: interval(1000)
}


const noteAndName = (str: string): [note: string, names?: string] => {

    const parsed = str.split(',')
    const [note, ...names] = parsed
    return names.length ? [note, names.join(',')] : [note, ','];
}

const stop = makeSubmodule('stop', async ({ positional }) => {
    const [noteNameData] = positional
    if (!isString(noteNameData)) return null

    const [note, names] = noteAndName(noteNameData)
    const noteName = `${note}${names}`

    if (notesNamespace.names[noteName]) {
        notesNamespace.names[noteName].subscription.unsubscribe()
        notesNamespace.names[noteName].interval = null
        return { 'did': 'unsubscribed ' + noteName }
    }
    return null

})

const start = makeSubmodule('start', async ({ positional }) => {
    const positionalArgs = positional.map(passivelyNumberize)
    if (!isStringNumNum(positionalArgs)) return null

    const [noteNameData, numerator, divisor] = positionalArgs
    const [note, nm] = noteAndName(noteNameData)
    const noteName = `${note}${nm}`

    // possible unsubscribe
    if (notesNamespace.names[noteName]) {
        notesNamespace.names[noteName].subscription.unsubscribe()
        notesNamespace.names[noteName].interval = [numerator, divisor]
    }

    // initialize if necessary
    notesNamespace.names[noteName] = notesNamespace.names[noteName] ?? {
        subscription: null,
        interval: [numerator, divisor]
    }
    let curr = 0
    const subscribable = observables.play
        .pipe(filter((/* idealMs */) => {
            const prev = curr
            const subInterval = Math.round(masterInterval * numerator / divisor)
            curr = Math.floor(elapsed() % subInterval)
            return curr > prev

        }))

    const sub = subscribable.subscribe((x) => {
        const triad = [note, 0.25, PROCESS_DELAY] as Triad
        playTriads([triad])
    })

    notesNamespace.names[noteName].subscription = sub
    notesNamespace.names[noteName].interval = [numerator, divisor]
})


const module: Module<{}> = {
    help: {
        description: 'Create midi file contents',
        examples: {
            '': 'Generate and log example content'
        }
    },
    fn: async (args, childCalls: SyncChildCalls) => {
        console.log('child calls', childCalls)
        return null
    },
    submodules: Object.fromEntries([nts, test1, test2, start, stop]),

}



export default module
