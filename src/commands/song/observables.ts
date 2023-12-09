
import { mem } from '../../mem'

import { Observable } from 'rxjs'
import { makeTickSubscribe } from '../phase/subjects/masterTicksSubject'
import { playTriads } from 'src/lib/music'
import { lastTick } from 'src/mem-db'


export const startCueObservable = (startAt?: number) => {

    // make a new observable that subscribes to master ticks
    // if the fed-in tick modular-divides to 0 on bar ticks, trigger.

    const song = mem().song.name

    if (!song) {
        throw new Error(`Song not initialized`)
    }



    const startOver = lastTick()
    const songObservable = new Observable(makeTickSubscribe(startAt))

    mem().observables[song] = songObservable.subscribe({
        next: ({ tick }) => {
            // get the midi tick relative to the start of the song
            const adjustedCursor = tick % startOver
            mem().publishedCursor = adjustedCursor

            mem().latestMap[adjustedCursor]?.forEach((note) => {
                playTriads([[note.note, 0.25, 1]])
            })
        }
    })


}
