import { addEvents, saveRaw } from './midi';
import { RelativeNote } from './music'
import Midi from 'jsmidgen'
import { MidiMap } from './mapSongToTicks';

import { trackTempo as startTempo } from '../commands/phase/observables/masterTicksObservable';

type IncomingEvent = {
    note: string;
    abso: number;
    onOrOff: 'on' | 'off'
} | {
    tempo: number;
    abso: number;
    onOrOff: 'tempo'
}

const downloadEvents = async (notes: RelativeNote[], tempo: number = startTempo) => {
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

// todo: split this into two functions for tempo and note events
const addNoteEvent = (obj: {
    [tick: number]: IncomingEvent[]
}, tickNum: number, onOrOff: 'on' | 'off' | 'tempo', noteOrBpm: string | number) => {
    obj[tickNum] = obj[tickNum] || []
    if (onOrOff === 'tempo') {
        if (typeof noteOrBpm !== 'number') {
            throw new Error('Tempo must be a number')
        }
        obj[tickNum].push({
            tempo: noteOrBpm, abso: tickNum, onOrOff
        })
    } else {
        if (typeof noteOrBpm !== 'string') {
            throw new Error('Note must be a string')
        }
        obj[tickNum].push({
            note: noteOrBpm, abso: tickNum, onOrOff
        })
    }
}

const songToEvents = async (mappedTicks: MidiMap) => {
    const noteEvents: {
        [tick: number]: IncomingEvent[]
    } = {}

    const relativized: RelativeNote[] = []

    Object.entries(mappedTicks).forEach(([tickRaw, notes]) => {
        notes.forEach((n) => {
            if (n.note.startsWith('tempo:')) { 
                const [l , r] = n.note.split(': ') 
                if (!l || !r) {
                    throw new Error('Invalid tempo event')
                }
                const tempo = parseInt(r)
                addNoteEvent(noteEvents, parseInt(tickRaw), 'tempo', tempo)
            } else {
                addNoteEvent(noteEvents, parseInt(tickRaw), 'on', n.note)
                addNoteEvent(noteEvents, parseInt(tickRaw) + (n.duration ?? 128), 'off', n.note)
            }
        })
    })

    let max = 0
    Object.entries(noteEvents).forEach(([tickRaw, initNotes]) => {
        const notes = [...initNotes]
        const first = notes.shift()

        if (first) {
            if (first.onOrOff === 'tempo') {
                relativized.push([first.tempo, first.abso - max, first.onOrOff])
                max = first.abso
                console.log('adding tempo', first.tempo, first.abso, first.onOrOff)
            } else {
                relativized.push([first.note, first.abso - max, first.onOrOff])
                console.log('adding note', first.note, first.abso, first.onOrOff)
                max = first.abso
            }

            if (notes.length) {
                notes.forEach((aNote) => {
                    if (aNote.onOrOff === 'tempo') {
                        console.log('adding tempo 2', aNote.tempo, aNote.abso, aNote.onOrOff)
                        relativized.push([aNote.tempo, aNote.abso - max, aNote.onOrOff])
                        max = aNote.abso
                    } else {
                        console.log('adding note 2', aNote.note, aNote.abso, aNote.onOrOff)
                        relativized.push([aNote.note, aNote.abso - max, aNote.onOrOff])
                        max = aNote.abso
                    }
                })
            }
        }
    })

    console.log('original and relativized', JSON.parse(JSON.stringify({
        mappedTicks,
        relativized,
    })))

    return relativized
}

export const downloadSong = async (tempo: number = startTempo, midiMap: MidiMap) => {
    const mappedTicks = midiMap
    const events = await songToEvents(mappedTicks)
    return downloadEvents(events, tempo)
}
