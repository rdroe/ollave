import { mapSongToMidiTicks } from 'src/mapSongToTicks'
import { mem } from '../../mem'
import { curr } from '../phase/observables/masterTicksObservable'
import { Observable } from 'rxjs'
import { makeTickSubscribe } from '../phase/subjects/masterTicksSubject'
import { playTriads } from 'src/lib/music'
import { lastTick } from 'src/mem-db'
export const startCueObservable = () => {

    // make a new observable that subscribes to master ticks
    // if the fed-in tick modular-divides to 0 on bar ticks, trigger.

    const song = mem().song.name

    if (!song) {
        throw new Error(`Song not initialized`)
    }
    const midiMappedNotes = mapSongToMidiTicks()
    const startOver = lastTick()
    mem().observables[song] = new Observable(makeTickSubscribe(curr[0]))
    console.log('start tick', curr[1], 'start over', startOver)
    let subscribedAt: null | number = null
    mem().observables[song].subscribe({
        next: ({ tick }) => {
            if (subscribedAt === null) {
                subscribedAt = curr[1]
                console.log('first tick issued', tick)
            }
            const adjustedCursor = (tick - subscribedAt) % startOver

            midiMappedNotes[adjustedCursor]?.forEach((note) => {
                console.log('playing', note.note, 'at', adjustedCursor)
                playTriads([[note.note, 0.25, 1]])
            })
        }
    })
    return midiMappedNotes
}
