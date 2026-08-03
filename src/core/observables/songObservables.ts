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

// ---- Audio lookahead -------------------------------------------------------
// Notes are handed to Tone up to NOTE_LOOKAHEAD_MS ahead of their musical due
// time, each at its exact due offset on the audio clock. A main-thread stall
// shorter than the horizon then cannot delay audio at all — the stalled
// window's notes were already scheduled before the stall began. Stalls longer
// than the horizon degrade exactly as before: bounded catch-up, notes late
// but played. scheduledUpToTick makes scheduling monotonic (each tick is
// scheduled exactly once per run), reset on every startCueObservable.
const NOTE_LOOKAHEAD_MS = 180
let scheduledUpToTick = -1

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

const recordNoteTrigger = (note: string, tick: number, aheadMs = 0) => {
  const triggeredAt = Date.now()
  const entry: NoteLagEntry = {
    note,
    tick,
    // aheadMs: with lookahead scheduling the note is handed to Tone before it
    // is musically due — its due time is the current tick's intended wall
    // time plus the scheduling offset. lagMs stays "sounded minus due":
    // negative/zero while the scheduler is healthy, positive only when the
    // main thread stalled past the lookahead horizon.
    intendedAt: (window.__tickIntendedAt ?? triggeredAt) + aheadMs,
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
  // Fresh run: nothing scheduled ahead yet (also prevents a stale horizon
  // from a previous run suppressing the first notes of this one).
  scheduledUpToTick = -1
  // Every run records its tempo marker into playedMap. This was one-shot per
  // page load, so any take recorded after the session's first play exported
  // with no tempo event at all — `dl -p` then had only the null-tempo
  // placeholder (mpqn 0), which DAWs import as a silent/collapsed file.
  isFirstCueStart = true

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
        // Key the tempo marker exactly like the note bookkeeping below
        // (rt/exp tick, not the raw engine tick): a resumed take's raw tick
        // sits far past the recorded notes, which stranded the marker at the
        // end of the exported file.
        const markerKey = rtMode ? rtTick : expTick
        mem().playedMap[markerKey] = mem().playedMap[markerKey] || []
        mem().playedMap[markerKey].push({
          note: `tempo: ${mem().song.tempo}`,
          compositionTags: [],
        })
        // No early return: playback starts at tick 0, so returning here
        // swallowed every note sitting at time 0 on the first play after a
        // page load.
      }
      // Lookahead scheduling: hand every not-yet-scheduled note due in
      // (scheduledUpToTick, tick + horizon] to Tone now, each offset to its
      // exact due time. In steady state each emission schedules exactly one
      // new tick (the one entering the horizon); after a stall, the catch-up
      // emissions advance the horizon in bulk.
      const mpt = msPerTick()
      const horizonTicks = Math.max(1, Math.ceil(NOTE_LOOKAHEAD_MS / mpt))
      const fromTick = Math.max(tick, scheduledUpToTick + 1)
      const toTick = tick + horizonTicks
      for (let schedTick = fromTick; schedTick <= toTick; schedTick++) {
        const schedCursor = getSongCursor(schedTick)
        const aheadTicks = schedTick - tick
        mem().latestMap[schedCursor]?.forEach(
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
            if (ignoreNote(schedCursor, note)) {
              return
            }

            const velocity = note.velocity ?? DEFAULT_VELOCITY
            const rasterDuration = note.duration
              ? (mpt * note.duration) / 1000
              : 0.5

            recordNoteTrigger(note.note, schedCursor, aheadTicks * mpt)
            playTriads([
              [note.note, rasterDuration, (aheadTicks * mpt) / 1000 + 0.01, velocity],
            ])
            // Debug log of what actually sounded. push + cap, NOT unshift:
            // unshift is O(n) per note and the array previously grew without
            // bound, so long listens got progressively slower. Newest last.
            mem().played.push({
              time: Date.now(),
              songTick: schedCursor,
              note: note.note,
              tags: note.compositionTags,
            })
            if (mem().played.length > 2000) {
              mem().played.splice(0, 1000)
            }
            // Bookkeeping keys shift with the lookahead so recordings land on
            // the tick the note is due, not the tick it was scheduled from.
            const bookKey = (rtMode ? rtTick : expTick) + aheadTicks
            mem().playedMap[bookKey] = mem().playedMap[bookKey] || []
            mem().playedMap[bookKey].push({
              note: note.note,
              compositionTags: note.compositionTags,
              velocity,
              duration: note.duration ?? DEFAULT_DURATION,
            })
          }
        )
      }
      scheduledUpToTick = toTick
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
