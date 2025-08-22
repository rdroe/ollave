import Midi, { MidiChannel } from 'jsmidgen'
import { BPM } from './music'
type ChanneledTriad = [channel: MidiChannel, note: string, dur: number, timing?: number]
type ChanneledEvent = [channel: MidiChannel, bpm: string, rel: number, onOrOff: 'on' | 'off'] | [channel: MidiChannel, note: BPM, rel: number, onOrOff: 'tempo']

import { playTriads, RelativeNote, Triad } from './music'

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

const makeChanneledEventFn = (ch: number) => {
    if (!isMidiChannel(ch)) throw new Error(`Invalid midi channel: ${ch}`)
    return (tr: RelativeNote): ChanneledEvent => {
        return [ch, ...tr]
    }
}

const isMidiChannel = (arg: number): arg is MidiChannel => {
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].includes(arg)
}


export const addEvents = (track: Midi.Track, events: RelativeNote[]) => {
    const channeledTriads = events.map(makeChanneledEventFn(0))

    let cntr = 0
    channeledTriads.forEach((chTr: ChanneledEvent) => {

        cntr += chTr[2]
        if (chTr[3] === 'on') {
            track.noteOn(chTr[0], chTr[1], chTr[2])
        } else if (chTr[3] === 'off') {
            track.noteOff(chTr[0], chTr[1], chTr[2])
        } else if (chTr[3] ==='tempo') {
            track.setTempo(chTr[1], chTr[2])
        }
    })
}

export const addNoteEvents = (track: Midi.Track, notes: Triad[]) => {
    const channeledTriads = notes.map(makeChanneledTriadFn(0))
    channeledTriads.forEach((chTr: ChanneledTriad) => {
        track.addNote(...chTr)
    })
}

export const playNotes = async (notes: Triad[]) => {
    playTriads(notes)
    return { played: notes }
}

