import { addTriads, saveRaw } from './lib/midi';
import { Triad } from './lib/music'
import Midi from 'jsmidgen'
import { MidiMap, mapSongToMidiTicks } from './mapSongToTicks';
import { curr, msPerTick } from './commands/phase/observables/masterTicksObservable';

const downloadNotes = async (notes: Triad[], tempo?: number) => {
    var file = new Midi.File();
    var track = new Midi.Track();
    if (tempo) {
        track.setTempo(tempo)
    }
    file.addTrack(track);
    addTriads(track, notes);
    const midi = file.toBytes()
    saveRaw(midi)
    return { downloaded: notes }
}

const songToTriads = async (mappedTicks: MidiMap) => {
    const triads: Triad[] = []
    let lastMs = 0
    let lastTick = 0
    Object.entries(mappedTicks).forEach(([tickRaw, notes]) => {
        const tick = parseInt(tickRaw)
        console.log('tick', tickRaw, tick)
        const ms = tick * msPerTick(tick)

        notes.forEach((note) => {
            //            triads.push([note.note, 0.25, ms - lastMs])
            triads.push([note.note, 0.25, tick - lastTick])
        })
        lastMs = ms
        lastTick = tick
    })
    return triads
}

export const downloadSong = async (tempo?: number) => {
    const mappedTicks = mapSongToMidiTicks()
    const triads = await songToTriads(mappedTicks)
    return downloadNotes(triads, tempo)
}
