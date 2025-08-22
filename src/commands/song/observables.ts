import { Mem, mem } from '../../lib/mem'
import { Observable } from 'rxjs'
import { makeTickSubscribe } from '../phase/subjects/masterTicksSubject'
import { playTriads } from '../../lib/music'
import { lastTick } from '../../lib/mem-db'
import { exportableTick, updateExportableTick } from '../phase/observables/masterTicksObservable'

export const subscribeToSong = (song: string, name: string, fn: (tick: number, rawTick: number, snapShot: Mem, songName: string) => void) => {
    mem().functions[song] = mem().functions[song] || {}
    mem().functions[song][name] = fn
}

export const getSongCursor = (tick: number) => {
    return tick % lastTick()
}

export const startCueObservable = (startAt?: number) => {

    // make a new observable that subscribes to master ticks
    // if the fed-in tick modular-divides to 0 on bar ticks, trigger.

    const song = mem().song.name

    if (!song) {
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
