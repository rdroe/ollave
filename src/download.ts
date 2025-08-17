import { addEvents, saveRaw } from './lib/midi';
import { RelativeNote } from './lib/music'
import Midi from 'jsmidgen'
import { MidiMap } from './mapSongToTicks';
import { mem } from './mem'


const downloadEvents = async (notes: RelativeNote[], tempo?: number) => {
    var file = new Midi.File();
    var track = new Midi.Track();
    if (tempo) {
        track.setTempo(tempo)
    }
    file.addTrack(track);
    addEvents(track, notes);
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

const songToEvents = async (mappedTicks: MidiMap) => {
    const noteEvents: {
        [tick: number]: {
            note: string;
            abso: number;
            onOrOff: 'on' | 'off'
        }[]
    } = {}

    const relativized: RelativeNote[] = []

    Object.entries(mappedTicks).forEach(([tickRaw, notes]) => {
        notes.forEach((n) => {

            addNoteEvent(noteEvents, parseInt(tickRaw), 'on', n.note)
            addNoteEvent(noteEvents, parseInt(tickRaw) + (n.duration ?? 128), 'off', n.note)
        })
    })

    let max = 0
    Object.entries(noteEvents).forEach(([tickRaw, initNotes]) => {
        const notes = [...initNotes]
        const first = notes.shift()

        if (first) {
            relativized.push([first.note, first.abso - max, first.onOrOff])
            max = first.abso

            if (notes.length) {

                relativized.push(...notes.map(({ note, onOrOff }) => {
                    return [note, 0, onOrOff] as typeof relativized[number]
                }))
            }
        }
    })

    return relativized
}

export const downloadSong = async (tempo?: number, midiMap?: MidiMap) => {
    const mappedTicks = midiMap || mem().latestMap
    const events = await songToEvents(mappedTicks)
    return downloadEvents(events, tempo)
}
