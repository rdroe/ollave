
// var fs = require('fs');
import Midi, { MidiChannel } from 'jsmidgen'
import { Module, SyncChildCalls } from 'nyargs';
import { playTriads, Triad } from '../lib/music'
import { Observable, interval, take, share } from 'rxjs'
type ChanneledTriad = [channel: MidiChannel, note: string, dur: number, timing?: number]
function saveRaw(bytes: any, name = 'sample-2.midi') {

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

const addTriads = (track: Midi.Track, notes: Triad[]) => {
    const channeledTriads = notes.map(makeChanneledTriadFn(0))
    channeledTriads.forEach((chTr: ChanneledTriad) => track.addNote(...chTr))
}

const playNotes = async (notes: Triad[]) => {

    var file = new Midi.File();
    var track = new Midi.Track();
    file.addTrack(track);
    addTriads(track, notes)

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
    playTriads(notes)
    return { played: notes }
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

const passivelyNumberize = (arg: string | number): number | string => {
    if (typeof arg === 'number') return arg
    // @ts-ignore
    const isNumber = !isNaN(arg)
    return isNumber ? parseFloat(arg) : arg
}

const isNum = (arg: any): arg is number => {
    return typeof arg === 'number'
}

const isString = (arg: any): arg is string => {
    return typeof arg === 'string'
}

const isNumStringNum = (arr: any[]): arr is [string, number, number] => {
    if (arr.length !== 3) return false
    const [a, b, c] = arr
    return isString(a) && isNum(b) && isNum(c)
}


const module: Module<{}> = {
    help: {
        description: 'Create midi file contents',
        examples: {
            '': 'Generate and log example content'
        }
    },
    fn: async (args, childCalls: SyncChildCalls) => {
        console.log('child calls', childCalls)
        return null
    },
    submodules: {

        nts: {
            help: {
                description: 'play 3-element triads'
            },
            fn: async ({ positional }) => {
                const [str, num1, num2]: [any, any, any] = positional.map(passivelyNumberize)
                console.log('input', str, num1, num2, 'all', positional)
                const tri = [str, num1, num2]
                return isNumStringNum(tri) ? playNotes([tri]) : null

            }
        },
        go: {
            help: {
                description: 'play 3-element triads'
            },
            fn: async ({ positional }) => {

                const foo = new Observable((subscriber) => {
                    console.log('Hello');
                    subscriber.next(42);
                    subscriber.next(100); // "return" another value
                    subscriber.next(200); // "return" yet another
                });

                console.log('before');
                foo.subscribe((x) => {
                    console.log(x);
                });
                console.log('after');

                return 'child a'
            },
        },
        go2: {

            help: {
                description: "experiment 2"
            },
            fn: async ({ positional }) => {
                const first5SpacedNumbers = interval(1000).pipe(take(5), share())

                first5SpacedNumbers.subscribe((v) => console.log("A", v))
                // Will start logging A1... A2...

                setTimeout(() => {
                    first5SpacedNumbers.subscribe((v) => console.log("B", v))
                }, 2000)
                // Will 
            }
        }

    },

}



export default module
