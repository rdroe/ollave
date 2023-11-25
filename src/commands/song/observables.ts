import { mapSongToMidiTicks } from 'src/mapSongToTicks'
import { mem } from '../../mem'
import { curr } from '../phase/observables/masterTicksObservable'
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

    const midiMappedNotes = mapSongToMidiTicks()

    const startOver = lastTick()
    const songObservable = new Observable(makeTickSubscribe())

    let subscribedAt: null | number = null
    mem().observables[song] = songObservable.subscribe({
        next: ({ tick }) => {
            // cache the first world midi tick.
            // we need to subtract this to make sure we start at 0 of the song's midi tick
            if (subscribedAt === null) {
                subscribedAt = curr[1]
            }
            // get the midi tick relative to the start of the song
            const adjustedCursor = (tick - subscribedAt) % startOver

            midiMappedNotes[adjustedCursor]?.forEach((note) => {
                playTriads([[note.note, 0.25, 1]])
            })
        }
    })

    return midiMappedNotes
}
