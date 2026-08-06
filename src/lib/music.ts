import * as tone from 'tone'

const port = window?.location?.port ?? '8080'
const host = window?.location?.hostname ?? 'localhost'
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

// First trigger loading of the piano samples
// When the instance is initialized the "loaded" property will be set to true
// BUT . . . then we need to wait for the samples to be actually loaded.
const piano = new Piano({
    velocities: 2,
    url: `//${host}:${port}/audio`,
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

const playMusic = async (json: Triad[]) => {
    json.forEach((triad) => {
        /** note, dur, timing, velocity */
        const [note, t1, t2 = 0, midiVelocity = DEFAULT_VELOCITY] = triad


        const velocity = midiVelocity / 127
        const start = `+${t2}`
        const stop = `+${t2 + t1}`
        piano.keyDown({ note: note, time: start, velocity })
        piano.keyUp({ note: note, time: stop })
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
