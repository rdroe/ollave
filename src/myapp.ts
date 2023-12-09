import { apps, createApp } from 'peprn/browser'
import play from './commands/play/play'
import phase from './commands/phase/phase'
import song from './commands/song/song'
import bars from './commands/bars/bars'

import { chord } from './commands/chord/chord'
import { match } from 'peprn'
import { playTriads } from './lib/music'
import { mem } from './mem'
import fakeCli from 'peprn/fakeCli'
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


const lookUpGraph = (userTonic: string, userScale: string) => {
    const place = mem().graphs[`${userTonic} ${userScale}`]
    if (place) {
        if (place[0]) return place[0]
    }
    return null
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
            const dataContainer = apps[id].dataEl

            if (dataContainer) {
                if (parsedCli['peprn:childmost'] === true && !parsedCli['peprn:automated']) {

                    const printable = data?.formatted ?? data
                    dataContainer.innerHTML = `${parsedCli.rawIn}\n${JSON.stringify(printable, null, 2)} 
${dataContainer.innerHTML}
`

                    if (data?.formatted?.aaChordProgram) {
                        const program = document.querySelector('.program')
                        if (program) {
                            return (program as HTMLTextAreaElement).value = data.formatted.aaChordProgram
                        }
                    }
                }
            }
            const nowNum = Date.now().toString()

            if (typeof parsedCli.rawIn === "string" && parsedCli.rawIn.startsWith('chord graph test')) {

                if (data && data.formatted) {
                    const [userLetter, userScale] = parsedCli.positionalNonCommands

                    const idx = userLetter && userScale ? `${userLetter} ${userScale}` : nowNum
                    mem().graphs[idx] = mem().graphs[idx] || [] as any[]
                    mem().graphs[idx].push(data.formatted)
                }
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

