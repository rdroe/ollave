import Midi, { MidiChannel } from 'jsmidgen'
type ChanneledTriad = [channel: MidiChannel, note: string, dur: number, timing?: number]

import { playTriads, Triad } from './music'

export function saveRaw(bytes: any, name = 'sample-2.midi') {

    const b64 = btoa(bytes);
    const uri = 'data:audio/midi;base64,' + b64;
    const link = document.createElement('a');

    link.href = uri;
    link.download = name;
    link.click();
}

const makeChanneledTriadFn = (ch: number) => {
    if (!isMidiChannel(ch)) throw new Error(`Invalid midi channel: ${ch}`)
    return (tr: Triad): ChanneledTriad => {
        return [ch, ...tr]
    }
}

const isMidiChannel = (arg: number): arg is MidiChannel => {
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].includes(arg)
}

export const addTriads = (track: Midi.Track, notes: Triad[]) => {
    const channeledTriads = notes.map(makeChanneledTriadFn(0))
    console.log('channeledTriads', channeledTriads)
    channeledTriads.forEach((chTr: ChanneledTriad) => track.addNote(...chTr))
}

export const playNotes = async (notes: Triad[]) => {
    playTriads(notes)
    return { played: notes }
}

export const downloadNotes = async (notes: Triad[]) => {
    var file = new Midi.File();
    var track = new Midi.Track();
    file.addTrack(track);
    addTriads(track, notes);
    const midi = file.toBytes()
    saveRaw(midi)

    return { downloaded: notes }
}
