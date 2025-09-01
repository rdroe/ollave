import { Mem, mem } from '../mem'
import { Observable, Subscription } from 'rxjs'
import { makeTickSubscribe } from '../subjects/masterTicksSubject'
import { playTriads } from '../../lib/music'
import { lastTick } from '../../lib/util/phaseUtil'
import { exportableTick, updateExportableTick } from './masterTicksObservable'
import { barsAtMidi, BarTagPercent } from '../../lib/mapSongToTicks'


export const getSongName = () => {
    const song = mem()?.song?.name || '' 
    if (!song) {
        console.error(JSON.stringify(mem(), null, 2))
        throw new Error(`Song not initialized yet`)
    }
    return song
}

export const subscribeToSongTicks = (song: string, name: string, fn: (tick: number, rawTick: number, snapShot: Mem, songName: string) => void) => {
    mem().functions[song] = mem().functions[song] || {}
    mem().functions[song][name] = fn
}

export const getSongCursor = (tick: number) => {
    return tick % lastTick()
}

export const startCueObservable = (startAt?: number) => {
    // make a new observable that subscribes to master ticks
    // if the fed-in tick modular-divides to 0 on bar ticks, trigger.
    const song = mem()?.song?.name
    if (!song) {
        console.error(mem())
        throw new Error(`Song not initialized`)
    }

    const songObservable = new Observable(makeTickSubscribe(startAt))
    const observables = mem().observables[song] || {}

    observables['tick'] = songObservable.subscribe({
        next: ({ tick }) => {

            const expTick = exportableTick()
            // get the midi tick relative to the start of the song
            const adjustedCursor = getSongCursor(tick)
            mem().adjustedCursor = adjustedCursor
            document.querySelector('.ollave-ticks').innerHTML = mem().adjustedCursor.toString()

            mem().latestMap[adjustedCursor]?.forEach((note) => {
                playTriads([[note.note, 0.5, 0.1]])
                mem().played.unshift({
                    time: Date.now(),
                    songTick: adjustedCursor,
                    note: note.note,
                    tags: note.compositionTags
                })
                mem().playedMap[expTick] = mem().playedMap[expTick] || []
                mem().playedMap[expTick].push({
                    note: note.note,
                    compositionTags: note.compositionTags
                })
            })
            updateExportableTick()
        }
    })

    Object.entries(mem().functions[song] || {}).forEach(([fnName, fn]) => {
        mem().observables[song][fnName] = songObservable.subscribe({
            next: ({ tick }) => {
                const adjustedCursor = getSongCursor(tick)
                fn(adjustedCursor, tick, mem(), song)
            }
        })
    })
    mem().observables[song] = observables
}


export const stopCueObservable = () => {
 
    const songName = mem().song.name
    const publishedCursro = mem().adjustedCursor

    const observable =
        mem().observables[songName]

    if (observable) {
        mem().songPauses[songName] = barsAtMidi(publishedCursro)[0]
        Object.entries(mem().observables[songName] || {}).forEach(([fnName,observable]) => {
            observable.unsubscribe()
        })
    } else {
        console.error('no observable found for song', songName)
    }

    Object.entries(mem().functions[songName] || {}).forEach(([fnName, fn]) => {
        mem().observables[songName][fnName]?.unsubscribe()
    })

}

export const deleteCueObservable = (songName: string) => {
    const observables: { [songName: string]: { [fnName: string]: Subscription } } = Object.fromEntries(Object.entries(mem().observables).filter(([key]) => key !== songName)) 
    const songPauses: { [songName: string]: BarTagPercent } = Object.fromEntries(Object.entries(mem().songPauses).filter(([key]) => key !== songName))
    const functions: { [songName: string]: { [fnName: string]: (tick: number, rawTick: number, snapShot: Mem, songName: string) => void } } = Object.fromEntries(Object.entries(mem().functions).filter(([key]) => key !== songName))
    mem().songPauses = songPauses 
    mem().observables = observables 
    mem().functions = functions 
}

