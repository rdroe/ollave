import { addTriads, saveRaw } from './lib/midi';
import { Triad } from './lib/music'
import Midi from 'jsmidgen'
import { MidiMap, mapSongToMidiTicks } from './mapSongToTicks';
import { mem } from './mem'
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
const addNoteEvent = (obj: {
    [tick: number]: {

        note: string;
        abso: number;
        onOrOff: 'on' | 'off'
    }[]
}, tickNum: number, onOrOff: 'on' | 'off', note: string) => {
    obj[tickNum] = obj[tickNum] || []
    obj[tickNum].push({
        note, abso: tickNum, onOrOff
    })
}

const songToTriads = async (mappedTicks: MidiMap) => {
    const triads: Triad[] = []
    let lastTick = 0
    const noteEvents: {
        [tick: number]: {
            note: string;
            abso: number;
            onOrOff: 'on' | 'off'
        }[]
    } = {}

    Object.entries(mappedTicks).forEach(([tickRaw, notes]) => {

        notes.forEach((n) => {
            addNoteEvent(noteEvents, parseInt(tickRaw), 'on', n.note)
            addNoteEvent(noteEvents, parseInt(tickRaw) + (n.duration ?? 128), 'off', n.note)
        })


        const tick = parseInt(tickRaw)
        notes.forEach((note) => {
            triads.push([note.note, 128, tick - lastTick])
            lastTick = tick
        })
    })
    console.log('noteEvents', { noteEvents, mappedTicks })
    return triads
}

export const downloadSong = async (tempo?: number) => {
    const mappedTicks = mem().latestMap
    const triads = await songToTriads(mappedTicks)
    return downloadNotes(triads, tempo)
}
