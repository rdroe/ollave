import * as tone from 'tone'

const port = window?.location?.port ?? '8080'
const host = window?.location?.hostname ?? 'localhost'
export type Triad = [
  note: string,
  dur: number,
  timing?: number,
  velocity?: number,
] // e.g. C5, 0.125 , 29.0078125
export type BPM = number
export type RelativeNote =
  | [note: string, rel: number, onOrOff: 'on' | 'off']
  | [note: BPM, rel: number, onOrOff: 'tempo']
// import { Piano } from '@tonejs/piano'

// see both https://github.com/tambien/Piano/issues/48#issuecomment-1214324134
// and https://github.com/tambien/Piano/issues/48#issuecomment-1289622804
import { Piano } from '@tonejs/piano/build/piano/Piano'

const piano = new Piano({
  velocities: 2,
  url: `http://${host}:${port}/audio`,
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
      const [note, t1, t2, midiVelocity = 60] = triad
      const velocity = midiVelocity / 127
      const start = `+${t2}`
      const stop = `+${t2 + t1}`
      console.log('notes in playTriads', {
        stop,
        velocity,
      })
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
