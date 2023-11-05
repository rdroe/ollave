
import { createApp, fakeCli } from 'peprn/browser'
import play from './commands/play/play'
import cue from './commands/cue/cue'
import { match, Opts } from 'peprn'
import { playTriads } from './lib/music'

let queue: string[] = [];

function preprocessInput(snt: string): string | null {
    console.log('preproc, que,snt', snt, queue)
    if (snt.trim() === '') {
        console.log("returning null")
        return null;
    }
    if (snt.includes('"')) {
        throw new Error(`Do not include quotation marks`);
    }
    if (snt.includes('\n')) {
        const sntsSplit = snt.split('\n');
        const snts = sntsSplit.reduce((accum, curr) => {
            const trimed = curr.trim();
            if (!trimed) {
                return accum;
            }
            return [...accum, trimed];
        }, [] as string[]);
        const snt1 = snts.shift();
        queue = queue.concat(snts);
        const call = `${snt1}`;
        console.log('returning:', call)
        return call;
    } else {
        console.log('returning (no newlines):', snt)
        return snt;
    }
}


document.body.onload = () => {
    document.body.onclick = () => {
        console.log('click')
        playTriads([['c4', 0.25, 0]])
        document.body.onclick = null
    }
    console.log('doc loaded; creating app')
    createApp({
        id: "cli",
        modules: {
            play, cue, match
        },
        catch: (e) => {
            console.error('error', e)
        },
        preprocessInput,
        userEffects: [
            async (args, data, appId) => {
                const shifted = queue.shift()
                if (shifted) {
                    fakeCli(shifted, "cli")
                }
            }
        ]
    })
}

