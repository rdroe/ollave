import { Module, SyncChildCalls } from 'nyargs';
import { isString, isStringNumNum, makeSubmodule, passivelyNumberize } from '../lib/helpers'
import { interval, filter, Subscription, concatMap, Observable, map } from 'rxjs'
import { playTriads, Triad } from 'src/lib/music';
import { playNotes } from 'src/lib/midi';

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

let currBar = 0
const bar = {
    play: interval(1).pipe(concatMap(() => {
        const prev = currBar
        currBar = Math.floor(elapsed() * 1000) % masterInterval
        if (currBar > prev) return interval(1)
    }), filter((x) => {
        return x !== undefined
    }))
}

const ntsHelp = {
    description: 'Play note',
    examples: {
        'c4 64 1': 'Play C4 note with one second delay (64 is currently ignored'
    }
}

const nts = makeSubmodule('nts', async ({ positional }) => {
    const [str, num1, num2] = positional.map(passivelyNumberize)
    const tri = [str, num1, num2]
    return isStringNumNum(tri) ? playNotes([tri]) : null
}, ntsHelp)


const noteAndName = (str: string): [note: string, names?: string] => {

    const parsed = str.split(',')
    const [note, ...names] = parsed
    return names.length ? [note, names.join(',')] : [note, ','];
}

const stopHelp = {
    description: 'stop a single-note stream',
    examples: {
        'ch,myNoteName': 'stop the note named by this string'
    }
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

}, stopHelp)

const startHelp = {
    description: 'start a single-note stream',
    examples: {
        'ch,myNoteName 1 9': 'start a note stream; it will issue the note at frequency 1/9 * master interval '
    }
}


const timeInterval = (start: Date, size: number): Observable<number> => {

    let curr = 0
    return interval(100).pipe(filter((num) => {
        const prev = curr
        curr = (Date.now() - start.valueOf()) % size
        console.log('curr', curr)
        return prev === 0 || curr < prev
    }), map(() => Date.now() - start.valueOf()))
}

const subscribablePart = (size: number) => timeInterval(new Date(), size)

const test = makeSubmodule('test', async () => {
    const observable = subscribablePart(2500)
    observable.subscribe((num) => {
        console.log('a section ended', num)
    })
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
    const s = bar.play.pipe(filter((idealMs) => {

        const prev = curr
        const subInterval = Math.floor(masterInterval * numerator / divisor)
        const elap = elapsed() * 1000

        curr = Math.floor(elap) % subInterval

        return curr < prev

    }))

    const sub = s.subscribe(() => {
        const triad = [note, 0.25, PROCESS_DELAY] as Triad
        playTriads([triad])
    })

    notesNamespace.names[noteName].subscription = sub
    notesNamespace.names[noteName].interval = [numerator, divisor]
}, startHelp)


const module: Module<{}> = {
    help: {
        description: 'Create midi file contents',
        examples: {
            '': 'Generate and log example content'
        }
    },
    fn: async (args, childCalls: SyncChildCalls) => {

        return null
    },
    submodules: Object.fromEntries([nts, start, stop, test]),

}



export default module
