import { Observable, Subscriber } from 'rxjs'

import { START_SPEED } from '../../lib/mapSongToTicks'
import {
  abbrev,
  Abbreviation,
  EIGHTH,
  ONE_TWENTY_EIGHTH,
  ppq,
  QUARTER,
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
// Finer rounding than roundToTenths: at ~3.7ms/tick, tenth-of-a-ms
// quantization alone mis-tempos playback by up to ~1.5%.
const roundTo4 = (num: number) => Math.round(num * 10000) / 10000

export const msPerTick = (/*tick: number*/) => {
  const as1 = airSpeed()
  const msPer = 60000 / (trackTempo * ppq) / as1 // fraction raises the number
  return roundTo4(msPer)
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
  // tempo relative to the fixed trackTempo (120). The historical constant
  // 113.75 over-sped playback ~5.5% — almost certainly an empirical fudge
  // compensating the old tick engine's systematic drag; with wall-clock
  // anchored emission the honest divisor is trackTempo itself.
  return tempo / trackTempo
}

type TempoChange = [tickCount: number, tempo: number]
// refactored window as any to be global types
declare global {
  interface Window {
    realtimeTickRef: {
      tick: number
      running: boolean
      mode: boolean
    }
    expTick: number
    airSpeedRef: {
      air: number
    }
    curr: TimeMarker
    /** Wall time the most recently emitted tick was musically due. */
    __tickIntendedAt: number
  }
}
window.realtimeTickRef = {
  tick: 0,
  running: false,
  mode: false,
}

export const updateRealtimeTick = () => {
  if (
    !window.realtimeTickRef.running ||
    typeof window.realtimeTickRef.tick !== 'number'
  ) {
    return
  }
  // ;(window as any).realtimeTick += 1
  window.realtimeTickRef.tick += 1
}
// True while the user has explicitly paused (the Realtime Paused checkbox).
// Distinguishes user intent from the engine's auto-start on play: without
// it, clicking play called startRealtimeTick and silently un-paused a
// pause set before playback began.
let realtimePausedExplicitly = false

export const startRealtimeTick = () => {
  realtimePausedExplicitly = false
  window.realtimeTickRef.running = true
  if (window.realtimeTickRef.tick < window.expTick) {
    window.realtimeTickRef.tick = window.expTick
  }
}
export const stopRealtimeTick = () => {
  realtimePausedExplicitly = true
  window.realtimeTickRef.running = false
  // set the exportable tick to the realtime tick so that notes don't overlap when the user resumes the song
  if (window.expTick < window.realtimeTickRef.tick) {
    window.expTick = window.realtimeTickRef.tick
  }
}
/** Engine auto-start (play): runs the realtime clock unless the user has it
 * explicitly paused — only the checkbox (startRealtimeTick) clears that. */
export const resumeRealtimeTick = () => {
  if (!realtimePausedExplicitly) {
    startRealtimeTick()
  }
}
/** Engine-internal suspend (boot priming, mode-off): stops the clock WITHOUT
 * registering a user pause. Boot's start/stop priming used stopRealtimeTick,
 * which marked every page load as "user paused" and blocked all recording. */
export const suspendRealtimeTick = () => {
  window.realtimeTickRef.running = false
}
export const setRealtimeMode = (mode: boolean) => {
  window.realtimeTickRef.mode = mode
  if (mode) {
    if (window.realtimeTickRef.tick < window.expTick) {
      window.realtimeTickRef.tick = window.expTick
    }
    // Mode-on starts the take clock immediately (jam chords record without
    // playback ever running) — unless the user has it explicitly paused.
    resumeRealtimeTick()
  } else {
    // Mode-off suspends the clock WITHOUT registering a user pause: only
    // the Realtime Paused checkbox owns that flag (stopRealtimeTick). This
    // used to call stopRealtimeTick, which would have made a later play
    // treat mere mode-off as "user paused" and never resume the clock.
    suspendRealtimeTick()
  }
}
export const realtimeTick = () => {
  return window.realtimeTickRef.tick
}
export const realtimeMode = () => {
  return window.realtimeTickRef.mode
}
/** False while "Realtime Paused": the realtime clock is frozen. */
export const realtimeRunning = () => {
  return window.realtimeTickRef.running
}

window.expTick = 0
export const updateExportableTick = () => {
  window.expTick += 1
}
export const setExportableTick = (tick: number) => {
  window.expTick = tick
}
export const exportableTick = () => {
  return window.expTick
}

// should be changeable in the future.
// right now speed can only be altered via the "plannedSpeedChanges" array, which does not change trackTempo.
export const trackTempo = 120
const airSpeedRef_ = {
  air: START_SPEED,
}
window.airSpeedRef = airSpeedRef_

export const setAirSpeed = (speedFloat: number) => {
  // 4-decimal precision: tenth-rounding quantized tempo into ~10% steps
  // (e.g. 126bpm -> air 1.1077 -> 1.1 -> plays as ~132bpm).
  window.airSpeedRef.air = roundTo4(speedFloat)
}

export const airSpeed = () => {
  return roundTo4(window.airSpeedRef.air)
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
window.curr = curr

// Wall-clock-anchored tick emission.
//
// The previous implementation advanced musical time per callback batch: it
// reset its epoch (lastPushTime = Date.now()) inside the emission loop,
// discarding the fractional remainder every batch (a constant ~4% tempo
// drag), and its nextTick = lastTick + i / lastTick = nextTick bookkeeping
// re-emitted the same tick on 1-tick batches. Any main-thread jank became
// PERMANENT time loss, so tempo degraded over a session.
//
// This version integrates elapsed wall time into a fractional tick position
// (remainder never discarded; live msPerTick changes preserve position) and
// emits monotonically increasing ticks up to the wall-clock target. Short
// stalls catch up (notes a touch late but played); stalls longer than
// MAX_CATCHUP_TICKS jump to the target without emitting the gap — musical
// position stays true to the clock and there is no note avalanche.
const MAX_CATCHUP_TICKS = 256 // ~1s of music at 120bpm

export const masterTicksObservable = new Observable(function subscribe(
  subscriber: Subscriber<any>
) {
  let lastNow = Date.now()
  let tickFloat = 0
  let lastEmitted = -1

  const intervalId = setInterval(() => {
    const now = Date.now()
    const msPer = msPerTick()
    tickFloat += (now - lastNow) / msPer
    lastNow = now
    const target = Math.floor(tickFloat)
    if (target - lastEmitted > MAX_CATCHUP_TICKS) {
      lastEmitted = target - MAX_CATCHUP_TICKS
    }
    while (lastEmitted < target) {
      lastEmitted++
      if (window.realtimeTickRef.running && window.realtimeTickRef.mode) {
        updateRealtimeTick()
      }
      // The wall time this tick SHOULD have occurred, derived from the
      // fractional accumulator (exact under tempo changes and catch-up
      // bursts). Side channel for note-lag instrumentation: emission is
      // synchronous, so downstream subscribers read it for their tick.
      window.__tickIntendedAt = now - (tickFloat - lastEmitted) * msPer
      subscriber.next(lastEmitted)
      curr = [now, lastEmitted]
    }
  }, 1)

  return function unsubscribe() {
    clearInterval(intervalId)
    subscriber.complete()
  }
})
