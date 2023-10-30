import { Module, SyncChildCalls } from 'nyargs';
import { fakeCli } from 'nyargs/runtime';
import { isStringNumNum, makeSubmodule, passivelyNumberize } from '../lib/helpers'
import { interval, Observable, Subject, Subscriber, } from 'rxjs'
const fileStart = Date.now()
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
/*
The formula is 60000 / (BPM * PPQ) (milliseconds).
Where BPM is the tempo of the track (Beats Per Minute).
(i.e. a 120 BPM track would have a MIDI time of (60000 / (120 * 192)) or 2.604 ms for 1 tick.i
*/

const PPQ = 192

const TICK_COUNTS = {
    beat: PPQ,
    eighth: PPQ / 2,
    sixteenth: PPQ / 4,
    thirtysecond: PPQ / 8,
    sixtyfourth: PPQ / 16,
    oneTwentyEigth: PPQ / 32,
}

let tick = 0

const msPerTick = (tick: number) => {
    const newSpeed = currSpeed(tick)
    return 60000 / (trackTempo * PPQ) * newSpeed
}

const msPerBeat = (
    tick: number
) => msPerTick(tick) * PPQ

const barLen = PPQ * 4

type TempoChange = [
    tickCount: number,
    tempo: number
]

const currSpeed = (tickCnt: number) => {
    if (tickCnt < 0) {
        throw new Error('tickCnt must be positive')
    }
    const prev = plannedSpeedChanges.find(([tick]) => tick <= tickCnt) ?? [0, trackTempo]
    const next = plannedSpeedChanges.find(([tick]) => tick > tickCnt) ?? [Infinity, prev[1]]

    const targetedChange = next[1] - prev[1]
    if (targetedChange === 0) return prev[1]
    const proportion = (tickCnt - prev[0]) / (next[0] - prev[0])
    return prev[1] + (targetedChange * proportion)
}

const trackTempo = 120
const plannedSpeedChanges: TempoChange[] = [
    [0, 1],
]

const timings = {
    msCounts: {
        beat: (tick: number) => msPerBeat(tick),
        eighth: (tick: number) => msPerBeat(tick) / 2,
        sixteenth: (tick: number) => msPerBeat(tick) / 4,
        thirtysecond: (tick: number) => msPerBeat(tick) / 8,
        sixtyfourth: (tick: number) => msPerBeat(tick) / 16,
        oneTwentyEigth: (tick: number) => msPerBeat(tick) / 32
    }
}

console.log('seconds in bar', msPerBeat(0) * 4)
console.log('beat length', msPerBeat)
console.log('timings', timings)

type TimeMarker = [time: number, quotient: number]

const midiTicksQueue: number[] = [0]
let curr: TimeMarker = [0,
    midiTicksQueue[midiTicksQueue.length - 1]
]


const MODE: 'air' | 'paper' = 'air'




// This interval is the sole source of midi ticks.
// It is accessed through an Observerble -> Subject pairing below (or elsewhere if they've been moved).
const masterTicks = setInterval(() => {
    const [lastTime, tick] = curr
    // This first bit of arithmetic is to determine how many ticks have passed since the last time this interval was fired.
    // (even though this interval is fired every millisecond, the number of ticks that have passed since the last time this interval was fired is not stable. setInterval is not a real-time clock.)
    const newTime = Date.now() - fileStart
    // Given that amount of time, how many ticks should have passed?
    const newTicks = Math.round(newTime / msPerTick(tick))
    let diff = newTicks - tick
    // push new ticks (which we'll calculate the numbers of, below) until we've caught up to the current time
    while (diff > 0) {
        const nextPush =
            // if the last tick in the queue is defined and is a number, then add 1 and push the next
            midiTicksQueue[midiTicksQueue.length - 1] !== undefined
                &&
                !isNaN(midiTicksQueue[midiTicksQueue.length - 1])
                ? midiTicksQueue[midiTicksQueue.length - 1] + 1 :
                // if the queue is empty, then push the current tick + 1
                (tick + 1)

        if (!isNaN(nextPush)) {
            midiTicksQueue.push(
                nextPush
            )
        }
        // one tick down; now we're closer to the current time
        diff -= 1
    }
    // update the current time and tick count.
    // do this here in case no ticks were pushed in the while loop above.
    curr = [newTime,
        midiTicksQueue[midiTicksQueue.length - 1] ?? tick
    ]

}, 0) // watch for changes every millisecond

const allTicksSubject = new Subject<number>();

// Uses the master loop (above) to multicast every single midi tick.
// The global "speed" variable determines how rapidly midi ticks are issued; however every single tick is guaranteed to be fired for subscribers to the subject of this (i.e. allTicksSubject) observable.
const allTicksObservable = new Observable(function subscribe(subscriber: Subscriber<any>) {
    const intervalId = setInterval(() => {
        // The ticks are pushed in in the master loop (above, unless it was moved).
        let tick1 = midiTicksQueue.pop()
        while (tick1 !== undefined && !isNaN(tick1)) {
            new Promise((res) => {
                res(subscriber.next(tick1))
            })
            // pop a tick for the next time around
            tick1 = midiTicksQueue.pop()
        }
    }, 1)

    return function unsubscribe() {
        clearInterval(intervalId);
        subscriber.complete()
    };
})

allTicksObservable.subscribe(allTicksSubject)

// utility function to create an observable (cue) that subscribing notes can use. the subscribers (notes) will be triggered at every observables interval passing.
const makeSubscribe = (parent: null | Cue) => {
    return function subscribe(subscriber: Subscriber<any>) {
        allTicksSubject.subscribe({
            next: (aTick) => {
                if (aTick % barLen === 0) {
                    subscriber.next({
                        count: aTick,
                        sizeMs: barLen,
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
