import * as tone from 'tone'
const port = window?.location?.port ?? '8080'
export type Triad = [note: string, dur: number, timing?: number] // e.g. C5, 0.125 , 29.0078125
// import { Piano } from '@tonejs/piano'

// see both https://github.com/tambien/Piano/issues/48#issuecomment-1214324134
// and https://github.com/tambien/Piano/issues/48#issuecomment-1289622804
import { Piano } from "@tonejs/piano/build/piano/Piano";

const piano = new Piano({
    velocities: 2,
    url: `http://localhost:${port}/audio`
})


export const samplerState: {
    loaded: boolean,
    sampler: Promise<{}> | {} | null,
    firstLoad: boolean
} = {
    loaded: false,
    sampler: null,
    firstLoad: false
}

export const getSampler = async () => {
    samplerState.loaded = false
    piano.toDestination()
    await piano.load().then(() => {
        console.log('loaded!')
    })
    await tone.start()
    console.log('start complete')
    return Promise.resolve({})

}

samplerState.sampler = getSampler()

const isPromise = (arg: any): arg is Promise<any> => {
    if (arg.then) return true
    return false
}

const playMusic = async (json: Triad[]) => {

    if (isPromise(samplerState.sampler)) await samplerState.sampler
    if (samplerState.sampler === null) throw new Error(`Piano was not initialized.`)

    const prom = isPromise(samplerState.sampler) ? samplerState.sampler : Promise.resolve({})

    prom.then(() => {
        json.forEach((triad) => {
            const [note, t1, t2] = triad
            const start = `+${t2}`
            const stop = `+${t2 + 0.25}`
            piano.keyDown({ note: note, time: start })
            piano.keyUp({ note: note, time: stop })
        })
    })
    return json
}



////////////// consumer fns

const initAndPlay = async (json: Triad[] /*, setLink*/) => {
    samplerState.sampler = await getSampler()
    return playMusic(json)
}

export const playTriads = (notes: Triad[]) => {
    console.log('trying to play, now', notes[0])
    return initAndPlay(notes)
}
