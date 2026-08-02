import { DEFAULT_DURATION } from 'jsmidgen'
import { Observable, Subscription } from 'rxjs'

import { DEFAULT_VELOCITY } from '../../lib'
import { barsAtMidi, BarTagPercent } from '../../lib/mapSongToTicks'
import { playTriads } from '../../lib/music'
import { lastTick } from '../../lib/util/startEndUtil'
import { Mem, mem } from '../mem'
import { makeTickSubscribe } from '../subjects/masterTicksSubject'

import {
  exportableTick,
  msPerTick,
  realtimeMode,
  realtimeTick,
  startRealtimeTick,
  updateExportableTick,
} from './masterTicksObservable'

export const getSongName = () => {
  const song = mem()?.song?.name || ''
  if (!song) {
    console.error(JSON.stringify(mem(), null, 2))
    throw new Error(`Song not initialized yet`)
  }
  return song
}

let isFirstCueStart = true
// last time the .ollave-ticks display element was written (throttled ~30Hz)
let lastTickDisplayWrite = 0

// ---- Note-lag instrumentation --------------------------------------------
// Documents mis-timed notes end to end. Two probe points:
//   1. TRIGGER (here, synchronous with the tick): captures the wall time the
//      note was musically due (tick engine's __tickIntendedAt side channel).
//   2. SOUNDED (the deepest sounding call — piano.keyDown in lib/music.ts —
//      via the window.__noteLagMarkSounded hook, matched FIFO by note name):
//      the moment the note is actually issued to the audio engine. Tone
//      schedules it a fixed +10ms later, so sounded ≈ heard.
// Any note sounding later than thresholdMs past due is console-logged AS YOU
// HEAR IT, with due/fired clocks and how much of the lag arose between
// trigger and keyDown. Trigger entries never matched within DROP_AFTER_MS
// count as DROPPED (e.g. initAndPlay bails while samples load).
// Inspect / summarize from the console: __noteLag.report(), __noteLag.log,
// __noteLag.thresholdMs, __noteLag.clear().
type NoteLagEntry = {
  note: string
  tick: number
  intendedAt: number
  triggeredAt: number
  soundedAt: number | null
  lagMs: number | null
}

const noteLagLog: NoteLagEntry[] = []
const pendingByNote = new Map<string, NoteLagEntry[]>()
const DROP_AFTER_MS = 2000

const fmtClock = (ms: number) => new Date(ms).toISOString().slice(11, 23)

export const noteLag = {
  /** console-log any note sounding this many ms later than musically due */
  thresholdMs: 30,
  log: noteLagLog,
  clear() {
    noteLagLog.length = 0
    pendingByNote.clear()
  },
  /** Late counts, drops, worst offenders, and burst clusters. */
  report() {
    const now = Date.now()
    const sounded = noteLagLog.filter((e) => e.soundedAt !== null)
    const dropped = noteLagLog.filter(
      (e) => e.soundedAt === null && now - e.triggeredAt > DROP_AFTER_MS
    )
    const late = sounded.filter((e) => (e.lagMs ?? 0) > noteLag.thresholdMs)
    const worst = [...late]
      .sort((a, b) => (b.lagMs ?? 0) - (a.lagMs ?? 0))
      .slice(0, 5)
    // cluster late notes into bursts separated by gaps of on-time playing
    const bursts: { start: number; count: number; maxLagMs: number }[] = []
    for (const e of late) {
      const b = bursts[bursts.length - 1]
      if (b && (e.soundedAt ?? 0) - b.start < 250 + b.count * 5) {
        b.count++
        b.maxLagMs = Math.max(b.maxLagMs, e.lagMs ?? 0)
      } else {
        bursts.push({ start: e.soundedAt ?? 0, count: 1, maxLagMs: e.lagMs ?? 0 })
      }
    }
    return {
      totalNotes: noteLagLog.length,
      soundedNotes: sounded.length,
      droppedNotes: dropped.length,
      lateNotes: late.length,
      latePct: sounded.length
        ? Math.round((late.length / sounded.length) * 1000) / 10
        : 0,
      maxLagMs: late.length ? Math.max(...late.map((e) => e.lagMs ?? 0)) : 0,
      worst: worst.map(
        (e) =>
          `${e.note} tick=${e.tick} +${e.lagMs}ms @${fmtClock(e.soundedAt ?? 0)}`
      ),
      bursts: bursts.map(
        (b) =>
          `${b.count} late notes from ${fmtClock(b.start)} (worst +${b.maxLagMs}ms)`
      ),
    }
  },
}

declare global {
  interface Window {
    __noteLag: typeof noteLag
    /** Installed here; called by lib/music.ts at the piano.keyDown site. */
    __noteLagMarkSounded: (note: string) => void
  }
}
window.__noteLag = noteLag
window.__noteLagMarkSounded = (note: string) => {
  const queue = pendingByNote.get(note)
  const entry = queue?.shift()
  if (!entry) return
  entry.soundedAt = Date.now()
  entry.lagMs = Math.round(entry.soundedAt - entry.intendedAt)
  if (entry.lagMs > noteLag.thresholdMs) {
    const deepMs = entry.soundedAt - entry.triggeredAt
    console.log(
      `⏱ LATE +${entry.lagMs}ms ${entry.note} @ bar ${Math.floor(entry.tick / 512)} tick ${entry.tick} — due ${fmtClock(entry.intendedAt)}, keyDown ${fmtClock(entry.soundedAt)} (trigger→keyDown ${deepMs}ms)`
    )
  }
}

const recordNoteTrigger = (note: string, tick: number) => {
  const triggeredAt = Date.now()
  const entry: NoteLagEntry = {
    note,
    tick,
    intendedAt: window.__tickIntendedAt ?? triggeredAt,
    triggeredAt,
    soundedAt: null,
    lagMs: null,
  }
  noteLagLog.push(entry)
  if (noteLagLog.length > 5000) {
    noteLagLog.splice(0, 2500)
  }
  let queue = pendingByNote.get(note)
  if (!queue) {
    queue = []
    pendingByNote.set(note, queue)
  }
  queue.push(entry)
  // stale pendings = dropped notes; keep the queue from growing unboundedly
  while (queue.length && triggeredAt - queue[0].triggeredAt > DROP_AFTER_MS) {
    queue.shift()
  }
}
// --------------------------------------------------------------------------

export const subscribeToSongTicks = (
  song: string,
  name: string,
  fn: (tick: number, rawTick: number, snapShot: Mem, songName: string) => void
) => {
  mem().functions[song] = mem().functions[song] || {}
  mem().functions[song][name] = fn
}

export const getSongCursor = (tick: number) => {
  return tick % lastTick()
}

export const startCueObservable = (
  startAt?: number,
  ignoreNote: (
    tick: number,
    note: {
      note: string
      velocity?: number
      duration?: number
      compositionTags: string[]
    }
  ) => boolean = () => false
) => {
  startRealtimeTick()
  mem().isRunning = true

  // make a new observable that subscribes to master ticks
  // if the fed-in tick modular-divides to 0 on bar ticks, trigger.
  const song = mem()?.song?.name
  if (!song) {
    console.error(mem())
    throw new Error(`Song not initialized`)
  }

  const songObservable = new Observable(makeTickSubscribe(startAt))
  const observables = mem().observables[song] || {}

  // Starting while already started used to overwrite these subscriptions
  // without unsubscribing them: the orphans kept playing forever and stop only
  // killed the latest ones — which read as "the stop button is broken".
  Object.values(observables).forEach((subscription) => {
    subscription.unsubscribe()
  })
  mem().observables[song] = observables

  observables['tick'] = songObservable.subscribe({
    next: ({ tick }) => {
      const expTick = exportableTick()
      const rtTick = realtimeTick()
      const rtMode = realtimeMode()
      // get the midi tick relative to the start of the song
      const adjustedCursor = getSongCursor(tick)
      mem().adjustedCursor = adjustedCursor
      // Display-only element: writing it every tick (hundreds/sec) forces
      // style/layout work per write; ~30Hz is indistinguishable to the eye.
      const nowMs = Date.now()
      if (nowMs - lastTickDisplayWrite > 33) {
        lastTickDisplayWrite = nowMs
        document.querySelector('.ollave-ticks').innerHTML =
          mem().adjustedCursor.toString()
      }
      if (isFirstCueStart) {
        isFirstCueStart = false
        mem().playedMap[tick] = mem().playedMap[tick] || []
        mem().playedMap[tick].push({
          note: `tempo: ${mem().song.tempo}`,
          compositionTags: [],
        })
        // No early return: playback starts at tick 0, so returning here
        // swallowed every note sitting at time 0 on the first play after a
        // page load.
      }
      mem().latestMap[adjustedCursor]?.forEach(
        (note: {
          note: string
          velocity?: number
          duration?: number
          compositionTags: string[]
        }) => {
          let doPlay = true
          if (note.compositionTags.includes('muted=true')) {
            doPlay = false
          }
          if (
            mem().exclusivePlayMode &&
            !note.compositionTags.includes('playExclusively=true')
          ) {
            doPlay = false
          }
          if (!doPlay) {
            return
          }
          if (ignoreNote(adjustedCursor, note)) {
            return
          }

          const velocity = note.velocity ?? DEFAULT_VELOCITY
          const rasterDuration = note.duration
            ? (msPerTick() * note.duration) / 1000
            : 0.5

          recordNoteTrigger(note.note, adjustedCursor)
          playTriads([[note.note, rasterDuration, 0.01, velocity]])
          // Debug log of what actually sounded. push + cap, NOT unshift:
          // unshift is O(n) per note and the array previously grew without
          // bound, so long listens got progressively slower. Newest last.
          mem().played.push({
            time: Date.now(),
            songTick: adjustedCursor,
            note: note.note,
            tags: note.compositionTags,
          })
          if (mem().played.length > 2000) {
            mem().played.splice(0, 1000)
          }
          mem().playedMap[rtMode ? rtTick : expTick] =
            mem().playedMap[rtMode ? rtTick : expTick] || []
          mem().playedMap[rtMode ? rtTick : expTick].push({
            note: note.note,
            compositionTags: note.compositionTags,
            velocity,
            duration: note.duration ?? DEFAULT_DURATION,
          })
        }
      )
      updateExportableTick()
    },
  })

  Object.entries(mem().functions[song] || {}).forEach(([fnName, fn]) => {
    observables[fnName] = songObservable.subscribe({
      next: ({ tick }) => {
        const adjustedCursor = getSongCursor(tick)
        fn(adjustedCursor, tick, mem(), song)
      },
    })
  })
}

export const stopCueObservable = () => {
  const songName = mem().song.name
  const publishedCursro = mem().adjustedCursor
  mem().isRunning = false
  const observable = mem().observables[songName]

  if (observable) {
    mem().songPauses[songName] = barsAtMidi(publishedCursro)[0]
    Object.entries(mem().observables[songName] || {}).forEach(
      ([_, observable]) => {
        observable.unsubscribe()
      }
    )
  } else {
    console.error('no observable found for song', songName)
  }

  Object.entries(mem().functions[songName] || {}).forEach(([fnName, fn]) => {
    mem().observables[songName][fnName]?.unsubscribe()
  })
}

export const deleteCueObservable = (songName: string) => {
  const observables: {
    [songName: string]: { [fnName: string]: Subscription }
  } = Object.fromEntries(
    Object.entries(mem().observables).filter(([key]) => key !== songName)
  )
  const songPauses: { [songName: string]: BarTagPercent } = Object.fromEntries(
    Object.entries(mem().songPauses).filter(([key]) => key !== songName)
  )
  const functions: {
    [songName: string]: {
      [fnName: string]: (
        tick: number,
        rawTick: number,
        snapShot: Mem,
        songName: string
      ) => void
    }
  } = Object.fromEntries(
    Object.entries(mem().functions).filter(([key]) => key !== songName)
  )
  mem().songPauses = songPauses
  mem().observables = observables
  mem().functions = functions
}
