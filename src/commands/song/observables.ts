import { Mem, mem } from '../../lib/mem'
import { Observable, Subscription } from 'rxjs'
import { makeTickSubscribe } from '../../core/subjects/masterTicksSubject'
import { playTriads } from '../../lib/music'
import { lastTick } from '../../lib/mem-db'
import { exportableTick, updateExportableTick } from '../../core/observables/masterTicksObservable'
import { barsAtMidi, BarTagPercent } from 'src/lib/mapSongToTicks'


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

    console.log('startCueObservable', {
        startAt,
        song: mem()?.song
    })
    const song = mem()?.song?.name

    if (!song) {
        console.error(mem())
        throw new Error(`Song not initialized`)
    }

    const songObservable = new Observable(makeTickSubscribe(startAt))
    const observables = mem().observables[song] || {}
    console.log('setting up cue observable for song', song, JSON.parse(JSON.stringify({
        'mem().observables[song]': mem().observables,
        'mem().songPauses[song]': mem().songPauses,
        'mem().functions[song]': mem().functions,
    })))

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
    console.log('setting up functions for song', song)
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

    console.log('stopping cue observable for song', songName, mem().observables)

    const observable =
        mem().observables[songName]

    if (observable) {
        mem().songPauses[songName] = barsAtMidi(publishedCursro)[0]
        console.log('setting song pause for song', songName, 'to', mem().songPauses[songName])
        Object.entries(mem().observables[songName] || {}).forEach(([fnName,observable]) => {
            console.log('unsubscribing from function', fnName, 'for song', songName)
            observable.unsubscribe()
        })
    } else {
        console.error('no observable found for song', songName)
    }
    console.log(JSON.parse(JSON.stringify({
        'mem().observables[songName]': mem().observables,
        'mem().songPauses[songName]': mem().songPauses,
        'mem().functions[songName]': mem().functions,
    })))

    Object.entries(mem().functions[songName] || {}).forEach(([fnName, fn]) => {
        console.log('unsubscribing from function', fnName, 'for song', songName)
        mem().observables[songName][fnName]?.unsubscribe()
    })

}

export const deleteCueObservable = (songName: string) => {

    console.log('deleting cue observable for song',songName,'before', songName, JSON.stringify({
        'mem().observables[songName]': mem().observables,
        'mem().songPauses[songName]': mem().songPauses,
        'mem().functions[songName]': mem().functions,
    }) , 2) 
    const observables: { [songName: string]: { [fnName: string]: Subscription } } = Object.fromEntries(Object.entries(mem().observables).filter(([key]) => key !== songName)) 
    const songPauses: { [songName: string]: BarTagPercent } = Object.fromEntries(Object.entries(mem().songPauses).filter(([key]) => key !== songName))
    const functions: { [songName: string]: { [fnName: string]: (tick: number, rawTick: number, snapShot: Mem, songName: string) => void } } = Object.fromEntries(Object.entries(mem().functions).filter(([key]) => key !== songName))
    console.log('deleting cue observable for song', songName, JSON.stringify({
        'mem().observables[songName]': mem().observables,
        'mem().songPauses[songName]': mem().songPauses,
        'mem().functions[songName]': mem().functions,
    }) , 2)

    mem().songPauses = songPauses 
    mem().observables = observables 
    mem().functions = functions 
}

