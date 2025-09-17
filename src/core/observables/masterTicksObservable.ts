import { Observable, Subscriber } from 'rxjs'

import { START_SPEED } from '../../lib/mapSongToTicks'
import {
  abbrev,
  Abbreviation,
  EIGHTH,
  ONE_TWENTY_EIGHTH,
  ppq,
  QUARTER,
  roundToTenths,
  SIXTEENTH,
  SIXTY_FOURTH,
  THIRTY_SECOND,
  tickCounts,
} from '../../lib/util/constantsUtil'

/*
The formula is 60000 / (BPM * PPQ) (milliseconds).
Where BPM is the tempo of the track (Beats Per Minute).
(i.e. a 120 BPM track would have a MIDI time of (60000 / (120 * 192)) or 2.604 ms for 1 tick.i
*/

// at the moment, PPQ stays constant.
// although user can already change speed to increase playback speed, this PPQ var may be variable based on tempo in the future. this would alter the number of ticks laid down per musical entity. (e.g. a 64th note would end up on a different tick). at the time of writing this note, a 64th note is always going to fall on the same number of tick (but a different ms when the speed is tweaked).

const round = (num: number) => {
  return Math.round(num)
}

// The number of ticks per musical entity dos not change. if the user wants to speed up the pace of the music, increase the "speed" variable.
// This function calculated how many ms each tick should last. notice it accesess the capable-of-changing-in-real-time "speed" variable.x
export const msPerTick = (/*tick: number*/) => {
  const as1 = airSpeed()
  const msPer = 60000 / (trackTempo * ppq) / as1 // fraction raises the number
  return roundToTenths(msPer)
}

export const msPerQuarterNote = (/*tick: number*/) => {
  const msPerMidiTick = msPerTick(/*tick*/)
  const msPerQuarterNote = msPerMidiTick * ppq
  return msPerQuarterNote
}

// takes a number between 1 and 300 and returns a number between 0.12 and 4
export const parseAirSpeed = (speed: string) => {
  const num = parseFloat(speed) / 100
  if (num < 0.12) return 0.12
  if (num > 4) return 4
  return num
}

export const tempoFromAirSpeed = (speed: number) => {
  return round(120 * speed)
}

export const airSpeedArgFromTempo = (tempo: number) => {
  return tempo / 113.75
}

type TempoChange = [tickCount: number, tempo: number]

const expTick_ = 0
;(window as any).expTick = expTick_
export const updateExportableTick = () => {
  ;(window as any).expTick += 1
}
export const setExportableTick = (tick: number) => {
  ;(window as any).expTick = tick
}
export const exportableTick = () => {
  return (window as any).expTick
}

// should be changeable in the future.
// right now speed can only be altered via the "plannedSpeedChanges" array, which does not change trackTempo.
export const trackTempo = 120
const airSpeedRef_ = {
  air: START_SPEED,
}
;(window as any).airSpeedRef = airSpeedRef_

export const setAirSpeed = (speedFloat: number) => {
  ;(window as any).airSpeedRef.air = roundToTenths(speedFloat)
}

export const airSpeed = () => {
  return roundToTenths((window as any).airSpeedRef.air)
}

const MODE: 'air' | 'paper' = 'air'
// by default, this system presumes that speed only changes in pre-planned ways, with a linear interpolation between the planned changes.
// the user will have loaded those into the "plannedSpeedChanges" array.
// "paper" is the default mode. "air" is the mode where the user can change the speed in real time, or has switched over to do so (at which point the plannedSpeedChanges array is ignored).
// to get the speed based on pre-planned changes, this function bases it on the ticks (which are constant).
const currSpeed = (tickCnt: number) => {
  if (MODE === 'air') {
    return airSpeed()
  }

  if (MODE !== 'paper') {
    throw new Error('At the moment, only paper mode is supported.')
  }

  if (tickCnt < 0) {
    throw new Error('tickCnt must be positive')
  }

  const prev = plannedSpeedChanges.find(([tick]) => tick <= tickCnt) ?? [
    0,
    trackTempo,
  ]

  const next = plannedSpeedChanges.find(([tick]) => tick > tickCnt) ?? [
    Infinity,
    prev[1],
  ]

  const targetedChange = next[1] - prev[1]
  if (targetedChange === 0) return prev[1]
  const proportion = (tickCnt - prev[0]) / (next[0] - prev[0])
  const ret = prev[1] + targetedChange * proportion
  return ret
}

const plannedSpeedChanges: TempoChange[] = [[0, 1]]

export const isAbbreviation = (unk: unknown): unk is Abbreviation => {
  return (Object.keys(abbrev) as string[]).includes(unk as string)
}

export const isFraction = (unk: unknown): unk is keyof typeof tickCounts => {
  return !!tickCounts[unk as keyof typeof tickCounts]
}

export const timings = {
  msCounts: {
    [QUARTER]: () => msPerQuarterNote(),
    [EIGHTH]: () => msPerQuarterNote() / 2,
    [SIXTEENTH]: () => msPerQuarterNote() / 4,
    [THIRTY_SECOND]: () => msPerQuarterNote() / 8,
    [SIXTY_FOURTH]: () => msPerQuarterNote() / 16,
    [ONE_TWENTY_EIGHTH]: () => msPerQuarterNote() / 32,
  },
}

type TimeMarker = [time: number, quotient: number]

const midiTicksQueue: number[] = [0]
export let curr: TimeMarker = [0, midiTicksQueue[midiTicksQueue.length - 1]]
;(window as any).curr = curr

// pop ticks from theq queue. fire the ticks to the subscribers (which should be multi-casting subjects, btw)
export const masterTicksObservable = new Observable(function subscribe(
  subscriber: Subscriber<any>
) {
  let lastPushTime = Date.now()
  let lastTick = 0

  const intervalId = setInterval(() => {
    const msPer = msPerTick()
    const sinceLast = Date.now() - lastPushTime
    const newTicksCnt = Math.floor(Math.round(sinceLast / msPer))

    for (let i = 0; i < newTicksCnt; i++) {
      const nextTick = lastTick + i
      new Promise((res) => {
        res(subscriber.next(lastTick + i))
      })
      lastPushTime = Date.now()
      lastTick = nextTick
      curr = [lastPushTime, lastTick]
    }
  }, 1)

  return function unsubscribe() {
    clearInterval(intervalId)
    subscriber.complete()
  }
})
