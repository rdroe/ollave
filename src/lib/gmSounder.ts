/**
 * General MIDI playback via SpessaSynth + the FluidR3_GM soundfont.
 *
 * One WorkletSynthesizer serves the whole app: the soundfont is ~141MB, so it
 * is fetched lazily on the first GM note/assignment and never at all for a
 * song made only of piano and sampled tracks. Each track drives its own MIDI
 * channel on that shared synth, so tracks can hold different programs at once.
 *
 * Context: this synth CANNOT share Tone's context. Tone 14 builds on
 * `standardized-audio-context`, so `tone.getContext().rawContext` is that
 * library's wrapper, not a native `BaseAudioContext` — and SpessaSynth
 * constructs a native `AudioWorkletNode`, which rejects it with "parameter 1
 * is not of type 'BaseAudioContext'". So we own a native AudioContext here.
 *
 * Time: the `Sounder` contract hands us a Tone time string (`'+<seconds>'`),
 * but SpessaSynth wants absolute AudioContext seconds — and, because of the
 * above, seconds on OUR clock, whose epoch differs from Tone's. Scheduling is
 * therefore relative, never absolute across clocks: `ctx.currentTime +
 * lookAhead + seconds`, mirroring how Tone resolves `'+s'` as
 * `currentTime + lookAhead + s`. Both engines are handed "now + offset" at the
 * same instant against clocks driven by the same audio hardware, so sampled
 * and GM notes stay aligned, and nothing accumulates drift because every note
 * is scheduled fresh off the current time.
 */
import { WorkletSynthesizer } from 'spessasynth_lib'
import * as tone from 'tone'

import { SOUNDFONT_URL, SPESSA_WORKLET_URL } from './audioHost'
import type { Sounder } from './sounderTypes'

/** GM reserves channel 9 for percussion, so melodic tracks step over it. */
export const GM_PERCUSSION_CHANNEL = 9
export const MAX_MIDI_CHANNEL = 15

/**
 * Track index -> MIDI channel, skipping the percussion channel and clamping at
 * the last channel: 0..8 map straight through, 9 -> 10, ... 14 -> 15, and
 * every track past that shares channel 15.
 */
export const channelForTrack = (trackIdx: number): number => {
    const idx =
        Number.isFinite(trackIdx) && trackIdx > 0 ? Math.floor(trackIdx) : 0
    const channel = idx < GM_PERCUSSION_CHANNEL ? idx : idx + 1
    return Math.min(channel, MAX_MIDI_CHANNEL)
}

/**
 * Seconds out of a Tone relative-time string. Returns null for anything that
 * is not `+<number>` so callers can fall back to "now" instead of throwing.
 */
export const parseRelativeSeconds = (time: string): number | null => {
    if (typeof time !== 'string') return null
    const trimmed = time.trim()
    if (!trimmed.startsWith('+')) return null
    const rest = trimmed.slice(1)
    if (rest === '') return null
    const seconds = Number(rest)
    return Number.isFinite(seconds) ? seconds : null
}

/** Sounder velocity is 0-1; MIDI wants 1-127 (0 would mean note-off). */
export const toMidiVelocity = (velocity: number): number => {
    if (!Number.isFinite(velocity)) return 1
    return Math.min(127, Math.max(1, Math.round(velocity * 127)))
}

/** Note name -> MIDI number, or null if Tone cannot parse the name. */
export const toMidiNote = (note: string): number | null => {
    try {
        const midi = tone.Frequency(note).toMidi()
        return Number.isFinite(midi) ? Math.round(midi) : null
    } catch {
        return null
    }
}

/**
 * Our own native AudioContext — see the note at the top of this file on why
 * Tone's cannot be reused. Created on first GM use, never before.
 */
let gmContext: AudioContext | null = null
const rawContext = (): AudioContext => (gmContext ??= new AudioContext())

/** Tone's scheduling lookAhead, so GM notes land with the sampled ones. */
const lookAhead = (): number => {
    const value = Number(tone.getContext().lookAhead)
    return Number.isFinite(value) ? value : 0
}

/**
 * Absolute seconds on OUR context's clock for a Sounder time string. Relative
 * to our own currentTime — Tone's epoch is a different clock, so its absolute
 * times are meaningless here.
 */
const absoluteTime = (time: string): number => {
    const ctx = rawContext()
    const seconds = parseRelativeSeconds(time)
    if (seconds === null) return ctx.currentTime
    return ctx.currentTime + lookAhead() + seconds
}

let synth: WorkletSynthesizer | null = null
let synthLoad: Promise<void> | null = null
let synthReady = false
let connectRequested = false
let didConnectSynth = false
/** channel -> program, so assignments made before load are replayed after it. */
const channelPrograms = new Map<number, number>()

const connectSynth = (): void => {
    if (!synth || !synthReady || didConnectSynth) return
    const ctx = rawContext()
    synth.connect(ctx.destination)
    didConnectSynth = true
    // Resume HERE, not at load time: connect runs from initOnUserAction, i.e.
    // after a user gesture. A context created outside a gesture is suspended,
    // and Chrome leaves resume() pending until one arrives — awaiting it during
    // load would stall the soundfont fetch forever.
    if (ctx.state === 'suspended') void ctx.resume()
}

const loadSynth = async (): Promise<void> => {
    const ctx = rawContext()
    // Deliberately NOT resuming here — see connectSynth. addModule and the
    // soundfont fetch both work fine on a suspended context.
    await ctx.audioWorklet.addModule(SPESSA_WORKLET_URL)
    const created = new WorkletSynthesizer(ctx)
    const response = await fetch(SOUNDFONT_URL)
    if (!response.ok) {
        throw new Error(
            `soundfont fetch failed: ${response.status} ${SOUNDFONT_URL}`
        )
    }
    await created.soundBankManager.addSoundBank(
        await response.arrayBuffer(),
        'main'
    )
    await created.isReady
    synth = created
    synthReady = true
    channelPrograms.forEach((program, channel) => {
        created.programChange(channel, program)
    })
    if (connectRequested) connectSynth()
}

/**
 * Kick off the one-time worklet + soundfont load. Safe to call repeatedly; a
 * failure is logged and leaves every GM sounder permanently silent rather than
 * taking playback down.
 */
const ensureSynth = (): void => {
    if (synthLoad) return
    synthLoad = loadSynth().catch((err: unknown) => {
        console.error('error loading the General MIDI synth', err)
    })
}

const setProgram = (channel: number, program: number): void => {
    if (channelPrograms.get(channel) === program) return
    channelPrograms.set(channel, program)
    if (synth && synthReady) synth.programChange(channel, program)
}

const gmSounders = new Map<number, Sounder>()

const makeGmSounder = (channel: number): Sounder => ({
    // A still-loading synth drops its notes (matches the piano's own gate).
    keyDown: ({ note, time, velocity }) => {
        if (!synth || !synthReady) return
        const midiNote = toMidiNote(note)
        if (midiNote === null) return
        synth.noteOn(channel, midiNote, toMidiVelocity(velocity), {
            time: absoluteTime(time),
        })
    },
    keyUp: ({ note, time }) => {
        if (!synth || !synthReady) return
        const midiNote = toMidiNote(note)
        if (midiNote === null) return
        synth.noteOff(channel, midiNote, { time: absoluteTime(time) })
    },
    connect: () => {
        connectRequested = true
        connectSynth()
    },
    isLoaded: () => synthReady,
})

/**
 * The GM sounder for a track, pointed at `program`. One sounder (and one MIDI
 * channel) per track; re-calling with a different program just re-programs the
 * channel. The first call starts the soundfont download.
 */
export const getGmSounder = (trackIdx: number, program: number): Sounder => {
    ensureSynth()
    const channel = channelForTrack(trackIdx)
    setProgram(channel, program)
    let sounder = gmSounders.get(trackIdx)
    if (!sounder) {
        sounder = makeGmSounder(channel)
        gmSounders.set(trackIdx, sounder)
    }
    return sounder
}

/**
 * Connect every GM sounder built so far. Called from `initOnUserAction`, which
 * may run after a sounder was already constructed; it never triggers the
 * soundfont download on its own.
 */
export const connectGmSounders = (): void => {
    if (gmSounders.size === 0) return
    connectRequested = true
    connectSynth()
}
