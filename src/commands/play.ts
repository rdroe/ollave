
// var fs = require('fs');
import Midi, { MidiChannel } from 'jsmidgen'
import { Module } from 'nyargs';
import { playTriads, Triad } from '../lib/music'

type ChanneledTriad = [channel: MidiChannel, note: string, dur: number, timing?: number]
function saveRaw(bytes: any, name = 'sample-2.midi') {

    const b64 = btoa(bytes);
    const uri = 'data:audio/midi;base64,' + b64;
    const link = document.createElement('a');

    link.href = uri;
    link.download = 'music.mid';
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

const addTriads = (track: Midi.Track, notes: Triad[]) => {
    const channeledTriads = notes.map(makeChanneledTriadFn(0))
    channeledTriads.forEach((chTr: ChanneledTriad) => track.addNote(...chTr))
}

const fn = async (args: {}) => {
    const dummy: Triad[] = [['c4', 64, 4], ['d4', 64, 7]]

    var file = new Midi.File();
    var track = new Midi.Track();
    file.addTrack(track);
    addTriads(track, dummy)

    /*
    track.addNote(0, 'c4', 64, 1);
    track.addNote(0, 'd4', 64, 2);
    track.addNote(0, 'e4', 64, 3);
    track.addNote(0, 'f4', 64, 4);
    track.addNote(0, 'g4', 64, 5);
    track.addNote(0, 'a4', 64, 6);
    track.addNote(0, 'b4', 64, 7);
    track.addNote(0, 'c5', 64, 8);
    */
    const midi = file.toBytes()
    saveRaw(midi)
    playTriads(dummy)
    return { played: dummy }
}

const writePromise = async (fname: string, dat: string) => {
    var dataStr = `data:text/json;charset=utf-8,${dat.replace('\n', "\r\n")}`
    const dlAnchorElem = document.createElement('a')
    document.body.appendChild(dlAnchorElem)
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", fname);
    dlAnchorElem.click();
    dlAnchorElem.remove();
}


const module: Module = {
    help: {
        description: 'Create midi file contents',
        examples: {
            '': 'Generate and log example content'
        }
    },
    fn
}

export default module
