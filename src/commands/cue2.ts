import { Module, SyncChildCalls } from 'nyargs';
import { fakeCli } from 'nyargs/runtime';
import { isStringNumNum, makeSubmodule, passivelyNumberize } from '../lib/helpers'
import { interval, Observable, Subscriber, } from 'rxjs'

type Cue = [
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

let tempo = 120
const msPerBeat = 60000 / tempo
const barLen = 384
const beatUnitCnt = barLen / 4

const timings = {
    tempo,
    barLen,

    tickCounts: {
        beat: beatUnitCnt,
        eighth: beatUnitCnt / 2,
        sixteenth: beatUnitCnt / 4,
        thirtysecond: beatUnitCnt / 8,
        sixtyfourth: beatUnitCnt / 16,
    },
    msCounts: {
        beat: msPerBeat,
        eighth: msPerBeat / 2,
        sixteenth: msPerBeat / 4,
        thirtysecond: msPerBeat / 8,
        sixtyfourth: msPerBeat / 16,
    }
}

console.log('seconds in bar', msPerBeat * 4)
console.log('beat length', msPerBeat)
console.log('timings', timings)


type TimeMarker = [time: number, sixtyFourth: number]
const fileStart = Date.now()

const tempoChanges: TimeMarker[

] = [
        [fileStart, 0]
    ]

let curr: TimeMarker = [fileStart, 0]
const lastChange = () => tempoChanges[tempoChanges.length - 1][0]
const priorTicksTot = () => tempoChanges.reduce((acc, [, sixtyFourth]) => acc + sixtyFourth, 0)


const masterTicks = setInterval(() => {
    const [lastTime, prev64] = curr
    const newTime = Date.now()
    const sinceLastTime = newTime - lastChange()

    const newTickMs = Math.trunc(sinceLastTime / timings.msCounts.sixtyfourth)
    const newTicks = newTickMs * timings.tickCounts.sixtyfourth + priorTicksTot()

    if (newTicks !== prev64) {

        curr = [newTime, newTicks]
    }

}, 1)

const sixtyFourthNotes = new Observable(function subscribe(subscriber: Subscriber<any>) {

    let lastPlayedAt = curr[1]

    const intervalId = setInterval(() => {

        if (curr[1] > lastPlayedAt) {
            lastPlayedAt = curr[1]
            subscriber.next(curr[1])
        }

    }, 1)

    return function unsubscribe() {
        clearInterval(intervalId);
        subscriber.complete()
    };
})

const barLen32s = timings.barLen / timings.tickCounts.thirtysecond
// utility function to create an observable (cue) that subscribing notes can use. the subscribers (notes) will be triggered at every observables interval passing.
const makeSubscribe = (parent: null | Cue) => {
    return function subscribe(subscriber: Subscriber<any>) {

        sixtyFourthNotes.subscribe({
            next: (sixtyFourth) => {
                console.log('parent called', sixtyFourth % timings.barLen)
                if (sixtyFourth % timings.barLen === 0) {
                    subscriber.next({
                        count: sixtyFourth,
                        sizeMs: timings.barLen,
                        started: fileStart
                    })
                }
            }
        })


        return function unsubscribe() {
            subscriber.complete()
        };
    }
}



// Create a new cue observable; start it; add it to the namespace
const startCueObservable = (name: string, [numerator, divisor]: [number, number], contextName = 'default') => {
    // this cue, a child cue, relates to the parent in that it is a fraction of the parent's interval

    const parentCue = findCue(contextName)

    const observable = new Observable(makeSubscribe(parentCue));

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

const start = makeSubmodule('start', async ({ positional, parent }: { positional: (string | number)[], parent?: string }) => {
    console.log('trying to start')
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
