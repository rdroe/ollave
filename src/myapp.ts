import { apps, createApp } from 'peprn/browser'
import play from './commands/play/play'
import phase from './commands/phase/phase'
import song from './commands/song/song'
import bars from './commands/bars/bars'
import bar from './commands/bar/bar'
import debug from './commands/debug/debug'
import { chord } from './commands/chord/chord'
import { match } from 'peprn'
import { playTriads } from './lib/music'
import { mem } from './mem'
import fakeCli from 'peprn/fakeCli'
import { lastTick } from './mem-db'
import { tickCounts } from './commands/phase/observables/masterTicksObservable'
import { strjson } from './lib/helpers'


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
function createElementFromHTML(htmlString: string) {
    var div = document.createElement('div');
    div.innerHTML = htmlString.trim();

    // Change this to div.childNodes to support multiple top-level nodes.
    return div.firstChild;
}

const getNoteIdFromTags = (tags: string[]) => {
    const noteIdTag = tags.find((tag => tag.startsWith('noteId=')))
    let noteId: undefined | string
    if (noteIdTag) {
        noteId = noteIdTag.replace('noteId=', '')
    }

    if (!noteId) {
        throw new Error(`could not get note id from ${strjson(tags)}`)
    }
    return noteId
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

            await fakeCli('song init', 'cli').then(() => {

            })

            const tagsRoot = document.querySelector('.tags-app-root')
            if (tagsRoot) {



                let logItr = 0
                const log = (...args: any[]) => {
                    if (mem().doLog && logItr % 100 === 0) {
                        console.log(...args)
                    }
                }
                const showingIds = new Set<string>;
                setInterval(() => {
                    const adjustedCursor = mem().adjustedCursor
                    // on each tick of this interval fn, get the time ranges of what to show.
                    const end1 = adjustedCursor
                    let start1 = end1 - tickCounts.bar * 2
                    let start2: number | undefined
                    if (start1 < 0) {
                        // lastTick() gets end-of-song tick
                        start2 = lastTick() + start1
                        start1 = 0
                    }

                    const ranges = [[start1, end1]] as [start: number, end: number][]
                    if (start2 !== undefined) {
                        ranges.push([start2, lastTick()])
                    }
                    // analyze the ticks already showing
                    const showingTicks = new Set<number>; // for comparison to those we're about to add (skip if they're already added)

                    const toRemoveNumbers = new Set<number>;

                    (tagsRoot.querySelectorAll('.note-tags') as NodeListOf<HTMLDivElement>).forEach((elem: HTMLDivElement) => {
                        const dataset = elem.dataset
                        const tick = dataset.tick

                        if (tick !== undefined) {
                            const tickNum = parseInt(tick)
                            showingTicks.add(tickNum)
                            if (!ranges.find(([start, end]) => {
                                return tickNum > start && tickNum < end
                            })) {
                                toRemoveNumbers.add(tickNum)
                            }
                        }
                    });


                    toRemoveNumbers.forEach((num) => {
                        const str = num.toString()

                        document.querySelectorAll(`[data-tick="${num}"]`).forEach((elem) => {
                            const dataset = (elem as HTMLDialogElement).dataset
                            const id = dataset.noteid
                            elem.remove()
                            showingIds.delete(id)

                        })
                    })

                    mem().played = mem().played.filter(({ songTick }) => {
                        return !toRemoveNumbers.has(songTick)
                    })

                    // use them to filter the tags.
                    const toAdd = mem().played.filter(({ songTick, tags }) => {
                        const matchedRange = ranges.find(([rangeStart, rangeEnd]) => {
                            return songTick >= rangeStart && songTick < rangeEnd
                        })

                        if (!matchedRange) return false
                        const noteid = getNoteIdFromTags(tags)

                        if (showingIds.has(noteid)) return false
                        return true
                    })

                    toAdd.reverse()
                    toAdd.forEach(({ tags, songTick, }) => {
                        const noteId = getNoteIdFromTags(tags)
                        const newHtml = `<div class="note-tags" data-noteid="${noteId}" data-tick="${songTick}">${songTick} => ${JSON.stringify(tags)}</div>`;
                        const newElem = createElementFromHTML(newHtml);
                        tagsRoot.prepend(newElem);
                        showingIds.add(noteId)

                    })
                    logItr += 1

                }, 20)
            }
        },
        modules: {
            chord, play, phase, song, match, bars, bar, debug, test: {
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
