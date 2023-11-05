import { Observable, Subscriber, } from 'rxjs'
const fileStart = Date.now()

/*
The formula is 60000 / (BPM * PPQ) (milliseconds).
Where BPM is the tempo of the track (Beats Per Minute).
(i.e. a 120 BPM track would have a MIDI time of (60000 / (120 * 192)) or 2.604 ms for 1 tick.i
*/

// at the moment, PPQ stays constant.
// although user can already change speed to increase playback speed, this PPQ var may be variable based on tempo in the future. this would alter the number of ticks laid down per musical entity. (e.g. a 64th note would end up on a different tick). at the time of writing this note, a 64th note is always going to fall on the same number of tick (but a different ms when the speed is tweaked).
const ppq = 192

// The number of ticks per musical entity dos not change. if the user wants to speed up the pace of the music, increase the "speed" variable.
// This function calculated how many ms each tick should last. notice it accesess the capable-of-changing-in-real-time "speed" variable.
export const msPerQuarter = (tick: number) => {
    const newSpeed = currSpeed(tick)
    return 60000 / (trackTempo * ppq) * newSpeed
}

const msPerBeat = (
    tick: number
) => msPerQuarter(tick) * ppq

type TempoChange = [
    tickCount: number,
    tempo: number
]

const MODE: 'air' | 'paper' = 'paper'
// by default, this system presumes that speed only changes in pre-planned ways, with a linear interpolation between the planned changes.
// the user will have loaded those into the "plannedSpeedChanges" array.
// "paper" is the default mode. "air" is the mode where the user can change the speed in real time, or has switched over to do so (at which point the plannedSpeedChanges array is ignored).
// to get the speed based on pre-planned changes, this function bases it on the ticks (which are constant).
const currSpeed = (tickCnt: number) => {
    if (MODE !== 'paper') {
        throw new Error('At the moment, only paper mode is supported.')
    }

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

// should be changeable in the future.
// right now speed can only be altered via the "plannedSpeedChanges" array, which does not change trackTempo.
const trackTempo = 120
const plannedSpeedChanges: TempoChange[] = [
    [0, 1],
]
export const tickCounts = {
    bar: ppq * 4,
    quarter: ppq,
    eighth: ppq / 2,
    sixteenth: ppq / 4,
    thirtysecond: ppq / 8,
    sixtyfourth: ppq / 16,
    oneTwentyEigth: ppq / 32,
}

export const timings = {
    msCounts: {
        quarter: (tick: number) => msPerQuarter(tick),
        eighth: (tick: number) => msPerQuarter(tick) / 2,
        sixteenth: (tick: number) => msPerQuarter(tick) / 4,
        thirtysecond: (tick: number) => msPerQuarter(tick) / 8,
        sixtyfourth: (tick: number) => msPerQuarter(tick) / 16,
        oneTwentyEigth: (tick: number) => msPerQuarter(tick) / 32
    }
}

console.log('seconds in bar', msPerBeat(0) * 4)
console.log('beat length', msPerBeat)
console.log('timings', timings)

type TimeMarker = [time: number, quotient: number]

const midiTicksQueue: number[] = [0]
export let curr: TimeMarker = [0,
    midiTicksQueue[midiTicksQueue.length - 1]
]

// To a clock, push midi ticks to be ticked into a queue.
const masterTicks = setInterval(() => {
    const [lastTime, tick] = curr
    // This first bit of arithmetic is to determine how many ticks have passed since the last time this interval was fired.
    // (even though this interval is fired every millisecond, the number of ticks that have passed since the last time this interval was fired is not stable. setInterval is not a real-time clock.)
    const newTime = Date.now() - fileStart
    // Given that amount of time, how many ticks should have passed?
    const newTicks = Math.round(newTime / msPerQuarter(tick))
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

// pop ticks from theq queue. fire the ticks to the subscribers (which should be multi-casting subjects, btw)
export const masterTicksObservable = new Observable(function subscribe(subscriber: Subscriber<any>) {
    const intervalId = setInterval(() => {
        // pop a tick initially, if it's there.
        let tick1 = midiTicksQueue.pop()
        // if tick was there, and it's a number, then fire it to the subscribers
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


