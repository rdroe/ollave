import * as tone from 'tone'

export type Triad = [
    note: string,
    dur: number,
    timing?: number,
    velocity?: number,
    trackIdx?: number,
] // e.g. C5, 0.125 , 29.0078125, 127, 0
export type BPM = number
export type RelativeTempoNote = [
    note: BPM,
    rel: number,
    onOrOff: 'tempo',
    ignored?: number,
    trackIdx?: number,
]
export type RelativeMusicNote = [
    note: string,
    rel: number,
    onOrOff: 'on' | 'off',
    velocity?: number,
    trackIdx?: number,
]
export type RelativeNote = RelativeMusicNote | RelativeTempoNote

export const isRelativeMusicNote = (
    note: unknown[]
): note is RelativeMusicNote => {
    return note[2] === 'on' || note[2] === 'off'
}
export const isRelativeTempoNote = (
    note: unknown[]
): note is RelativeTempoNote => {
    return note[2] === 'tempo'
}

// import { Piano } from '@tonejs/piano'
export const NOTE_LOOKUP_IDX = 0
export const REL_TIMING_LOOKUP_IDX = 1
export const ON_OR_OFF_LOOKUP_IDX = 2
export const VELOCITY_LOOKUP_IDX = 3
export const TRACK_IDX_IDX = 4
export const DEFAULT_TRACK_IDX = 0

// see both https://github.com/tambien/Piano/issues/48#issuecomment-1214324134
// and https://github.com/tambien/Piano/issues/48#issuecomment-1289622804
import { Piano } from '@tonejs/piano/build/piano/Piano'

import { DEFAULT_VELOCITY } from '../lib/shared/midiMappingCore'

import { AUDIO_BASE } from './audioHost'
import { gmProgramOf } from './gmPrograms'
import { connectGmSounders, getGmSounder } from './gmSounder'
import {
    SAMPLE_URLS,
    SAMPLED_INSTRUMENTS,
    type SampledInstrument,
} from './instrumentSamples'
import type { Sounder } from './sounderTypes'

// First trigger loading of the piano samples
// When the instance is initialized the "loaded" property will be set to true
// BUT . . . then we need to wait for the samples to be actually loaded.
const piano = new Piano({
    velocities: 2,
    url: AUDIO_BASE,
})
piano.load()

// The samples loaded promise will resolve when the piano really is ready (all samples are loaded)
let resolveAllSamplesLoadedPromise: (() => void) | null = null
let allSamplesLoadedResolved = false
const allSamplesLoadedPromise = new Promise<void>((resolve) => {
    resolveAllSamplesLoadedPromise = () => {
        allSamplesLoadedResolved = true
        resolve()
    }
})

let allLoadedTimeout: NodeJS.Timeout | null = null
if (allLoadedTimeout === null) {
    allLoadedTimeout = setInterval(() => {
        if (piano.loaded) {
            if (allLoadedTimeout) clearInterval(allLoadedTimeout)
            resolveAllSamplesLoadedPromise?.()
        }
    }, 1000)
}

const pianoSounder: Sounder = {
    keyDown: ({ note, time, velocity }) =>
        piano.keyDown({ note, time, velocity }),
    keyUp: ({ note, time }) => piano.keyUp({ note, time }),
    connect: () => {
        piano.toDestination()
    },
    isLoaded: () => allSamplesLoadedResolved,
}

const samplerSounders: Partial<Record<SampledInstrument, Sounder>> = {}

const isSampled = (name: string): name is SampledInstrument =>
    (SAMPLED_INSTRUMENTS as readonly string[]).includes(name)

const makeSamplerSounder = (name: SampledInstrument): Sounder => {
    let loaded = false
    const sampler = new tone.Sampler({
        urls: SAMPLE_URLS[name],
        baseUrl: `${AUDIO_BASE}/${name}/`,
        // Bowed strings need a long release or short notes clip audibly; the
        // Sampler default (~0.1s) cuts the sustained sample off mid-bow.
        ...(name === 'violin' || name === 'cello' ? { release: 0.8 } : {}),
        onload: () => {
            loaded = true
        },
    })
    if (didRunInit) sampler.toDestination()
    return {
        // A still-loading sampler drops its notes (matches the piano's own gate).
        keyDown: ({ note, time, velocity }) => {
            if (loaded) sampler.triggerAttack(note, time, velocity)
        },
        keyUp: ({ note, time }) => {
            if (loaded) sampler.triggerRelease(note, time)
        },
        connect: () => {
            sampler.toDestination()
        },
        isLoaded: () => loaded,
    }
}

const sounderFor = (name: string, trackIdx: number): Sounder => {
    // `gm:<program>` names play through the shared SpessaSynth soundfont, one
    // MIDI channel per track. Constructing one starts the soundfont download.
    const gmProgram = gmProgramOf(name)
    if (gmProgram !== null) {
        const sounder = getGmSounder(trackIdx, gmProgram)
        if (didRunInit) sounder.connect()
        return sounder
    }
    if (!isSampled(name)) return pianoSounder
    return (samplerSounders[name] ??= makeSamplerSounder(name))
}

let trackInstrumentNames: string[] = []

/** Point one track at an instrument; constructing it starts the sample load. */
export const setTrackInstrument = (trackIdx: number, name: string): void => {
    trackInstrumentNames[trackIdx] = name
    sounderFor(name, trackIdx)
}

/** Replace the whole track -> instrument mapping (e.g. on song load). */
export const setTrackInstruments = (names: (string | undefined)[]): void => {
    trackInstrumentNames = []
    names.forEach((name, i) => {
        if (name) setTrackInstrument(i, name)
    })
}

/** Current instrument for a track; unmapped tracks stay on the piano. */
export const getTrackInstrument = (trackIdx: number): string =>
    trackInstrumentNames[trackIdx] ?? 'piano'

const playMusic = async (json: Triad[]) => {
    json.forEach((triad) => {
        /** note, dur, timing, velocity */
        const [note, t1, t2 = 0, midiVelocity = DEFAULT_VELOCITY] = triad
        const trackIdx =
            (triad[TRACK_IDX_IDX] as number | undefined) ?? DEFAULT_TRACK_IDX
        const sounder = sounderFor(getTrackInstrument(trackIdx), trackIdx)

        const velocity = midiVelocity / 127
        const start = `+${t2}`
        const stop = `+${t2 + t1}`
        sounder.keyDown({ note: note, time: start, velocity })
        sounder.keyUp({ note: note, time: stop })
        // note-lag instrumentation: this keyDown is the deepest JS moment
        // before audio (Tone sounds it +t2 s later). Hook installed by
        // core/observables/songObservables; optional so lib stays decoupled.
        ;(window as any).__noteLagMarkSounded?.(note)
    })

    return json
}

// the sampler can only be initialized by a user action. (the
// browser will disallow sound unless the user has interacted with the page)
let didRunInit = false
const initOnUserAction = async () => {
    if (didRunInit) return Promise.resolve({})
    piano.toDestination()
    Object.values(samplerSounders).forEach((s) => s?.connect())
    connectGmSounders()
    await tone.start().catch((err) => {
        console.error('error starting tone.js sampler', err)
    })

    didRunInit = true
    return Promise.resolve({})
}

const initAndPlay = async (json: Triad[] /*, setLink*/) => {
    if (!didRunInit) {
        await initOnUserAction()
    }
    if (!allSamplesLoadedResolved) {
        return
    }
    return playMusic(json)
}

export const playTriads = (notes: Triad[]) => {
    return initAndPlay(notes)
}

export const isReady = () => {
    return allSamplesLoadedResolved
}
