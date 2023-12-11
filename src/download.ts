import { addTriads, saveRaw } from './lib/midi';
import { Triad } from './lib/music'
import Midi from 'jsmidgen'
import { MidiMap, mapSongToMidiTicks } from './mapSongToTicks';

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
    let lastTick = 0
    Object.entries(mappedTicks).forEach(([tickRaw, notes]) => {
        const tick = parseInt(tickRaw)
        notes.forEach((note) => {
            triads.push([note.note, 128, tick - lastTick])
            lastTick = tick
        })
    })
    return triads
}

export const downloadSong = async (tempo?: number) => {
    const mappedTicks = mapSongToMidiTicks()
    const triads = await songToTriads(mappedTicks)
    return downloadNotes(triads, tempo)
}
