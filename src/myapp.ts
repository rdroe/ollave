import { apps, createApp, fakeCli } from 'peprn/browser'
import play from './commands/play/play'
import phase from './commands/phase/phase'
import song from './commands/song/song'
import bars from './commands/bars/bars'
import { chord } from './commands/chord/chord'
import { match } from 'peprn'
import { playTriads } from './lib/music'
import { mem } from './mem'
const { songNames } = mem()

let namesResolver: Function | null = null
const namesPromise = new Promise((res) => {
    namesResolver = res
});

(() => {
    import('./lib/words').then((w) => {
        const wordList = w.words.split('\n')
        for (let i = 0; i < 100; i++) {
            const rand = Math.floor(Math.random() * wordList.length);
            songNames.push(wordList[rand])
        }
        namesResolver()

    })
})()

let queue: string[] = [];

export function preprocessInput(snt: string): string | null {
    if (snt.trim() === '') {
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
        return call;
    } else {
        return snt;
    }
}


document.body.onload = () => {
    document.body.onclick = () => {
        playTriads([['c3', .05, 0]])
        document.body.onclick = null
    }
    createApp({
        id: "cli",
        init: async () => {
            await namesPromise
            const doc = document.querySelector('body')
            if (doc) {
                doc.style.backgroundColor =
                    "darkblue"

            }
            fakeCli('song init', 'cli').then(() => {

            })
        },
        modules: {
            chord, play, phase, song, match, bars, test: {
                fn: async () => {
                    playTriads([['cb4', 2, 0]])
                }
            }
        },
        catch: (e) => {
            console.error('error', e)
        },
        preprocessInput,
        dataHandler: async (parsedCli, data, id) => {
            const app = apps[id].dataEl
            console.log('data in handler', data)
            if (apps[id].dataEl) {

                apps[id].dataEl.innerHTML = `${JSON.stringify(data, null, 2)} 
${apps[id].dataEl.innerHTML}
`

            }
        },
        userEffects: [
            async () => {
                const shifted = queue.shift()
                if (shifted) {
                    fakeCli(shifted, "cli")
                }
            }
        ]
    })
}

