
// var fs = require('fs');
import Midi from 'jsmidgen'
import { Module } from 'nyargs';

function saveRaw(bytes: any, name = 'sample-2.midi') {

    const b64 = btoa(bytes);
    const uri = 'data:audio/midi;base64,' + b64;
    const link = document.createElement('a');

    link.href = uri;
    link.download = 'music.mid';
    link.click();
}

const fn = async (args: {}) => {
    var file = new Midi.File();
    var track = new Midi.Track();
    file.addTrack(track);

    track.addNote(0, 'c4', 64);
    track.addNote(0, 'd4', 64);
    track.addNote(0, 'e4', 64);
    track.addNote(0, 'f4', 64);
    track.addNote(0, 'g4', 64);
    track.addNote(0, 'a4', 64);
    track.addNote(0, 'b4', 64);
    track.addNote(0, 'c5', 64);

    const midi = file.toBytes()
    saveRaw(midi)
    const ints = new Uint8Array(midi)
    // saveRaw([ints])
    //  console.log(file.toBytes())
    //fs.writeFileSync('test.mid', file.toBytes(), 'binary');
    return { played: true }
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
