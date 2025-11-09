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

const piano = new Piano({
  velocities: 2,
  url: `//${host}:${port}/audio`,
})

export const samplerState: {
  loaded: boolean
  sampler: Promise<{}> | {} | null
  firstLoad: boolean
} = {
  loaded: false,
  sampler: null,
  firstLoad: false,
}

export const getSampler = async () => {
  if (samplerState.loaded === true) return Promise.resolve({})
  samplerState.loaded = false
  piano.toDestination()
  await piano.load().then(() => {
    console.log('loaded default voice')
  })
  await tone.start()
  console.log('started tone.js sampler')
  samplerState.loaded = true
  return Promise.resolve({})
}

samplerState.sampler = getSampler()

const isPromise = (arg: any): arg is Promise<any> => {
  if (arg.then) return true
  return false
}

const playMusic = async (json: Triad[]) => {
  if (isPromise(samplerState.sampler)) await samplerState.sampler
  if (samplerState.sampler === null)
    throw new Error(`Piano was not initialized.`)

  const prom = isPromise(samplerState.sampler)
    ? samplerState.sampler
    : Promise.resolve({})

  prom.then(() => {
    json.forEach((triad) => {
      /** note, dur, timing, velocity */
      // const [note, t1, t2, midiVelocity = DEFAULT_VELOCITY] = triad
      const note = triad[NOTE_LOOKUP_IDX]
      const t1 = triad[REL_TIMING_LOOKUP_IDX]
      const t2 = triad[REL_TIMING_LOOKUP_IDX]
      const midiVelocity = triad[VELOCITY_LOOKUP_IDX] ?? DEFAULT_VELOCITY

      const velocity = midiVelocity / 127
      const start = `+${t2}`
      const stop = `+${t2 + t1}`
      piano.keyDown({ note: note, time: start, velocity })
      piano.keyUp({ note: note, time: stop })
    })
  })
  return json
}

////////////// api for outside world
const initAndPlay = async (json: Triad[] /*, setLink*/) => {
  samplerState.sampler = await getSampler()
  return playMusic(json)
}

export const playTriads = (notes: Triad[]) => {
  return initAndPlay(notes)
}
