import { mem } from '../../lib/mem'
import { Observable } from 'rxjs'
import { makeTickSubscribe } from '../phase/subjects/masterTicksSubject'
import { playTriads } from '../../lib/music'
import { lastTick } from '../../lib/mem-db'

export const startCueObservable = (startAt?: number) => {

    // make a new observable that subscribes to master ticks
    // if the fed-in tick modular-divides to 0 on bar ticks, trigger.

    const song = mem().song.name

    if (!song) {
        throw new Error(`Song not initialized`)
    }




    const songObservable = new Observable(makeTickSubscribe(startAt))

    mem().observables[song] = songObservable.subscribe({
        next: ({ tick }) => {

            // get the midi tick relative to the start of the song
            const adjustedCursor = tick % lastTick()
            mem().adjustedCursor = tick % lastTick()
            document.querySelector('.ollave-ticks').innerHTML = mem().adjustedCursor.toString()

            mem().latestMap[adjustedCursor]?.forEach((note) => {
                playTriads([[note.note, 0.5, 0.1]])
                mem().played.unshift({
                    time: Date.now(),
                    songTick: adjustedCursor,
                    note: note.note,
                    tags: note.compositionTags
                })
                mem().playedMap[tick] = mem().playedMap[tick] || []
                mem().playedMap[tick].push({
                    note: note.note,
                    compositionTags: note.compositionTags
                })
            })
        }
    })
}