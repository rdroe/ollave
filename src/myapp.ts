import { apps, createApp } from 'peprn/browser'
import play from './commands/play/play'
import phase from './commands/phase/phase'
import song from './commands/song/song'
import bars from './commands/bars/bars'
import bar from './commands/bar/bar'
import debug from './commands/debug/debug'
import notes from './commands/notes/notes'
import { chord } from './commands/chord/chord'
import { match } from 'peprn'
import { playTriads } from './lib/music'
import { mem } from './mem'
import fakeCli from 'peprn/fakeCli'
import { lastTick } from './mem-db'
import { tickCounts } from './commands/phase/observables/masterTicksObservable'
import { strjson } from './lib/helpers'
import { PEPRN_AUTO, PEPRN_MULTILINE, PEPRN_MULTILINE_INDEX, PEPRN_MULTILINE_TOTAL } from 'peprn/util'


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
const DISPLAY_EXPIRE = tickCounts.bar * 2
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

                    let start1 = end1 - DISPLAY_EXPIRE
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
                                return tickNum >= start && tickNum < end
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
                        const newHtml = `<div class="note-tags" data-noteid="${noteId}" data-tick="${songTick}">${songTick} => ${tags.join(" ")}</div>`;

                        const newElem = createElementFromHTML(newHtml);
                        tagsRoot.prepend(newElem);
                        showingIds.add(noteId)

                    })
                    logItr += 1

                }, 20)
            }
        },
        modules: {
            chord, play, phase, song, match, bars, bar, debug, notes, test: {
                fn: async () => {
                    playTriads([['cb4', 2, 0]])
                }
            }
        },
        catch: (e) => {
            console.error('error', e)
        },

        dataHandler: async (parsedCliRaw, data, id) => {
            const parsedCli = JSON.parse(JSON.stringify(parsedCliRaw))
            const rawIn = parsedCli.rawIn
            const dataContainer = apps[id].dataEl
            let didPrint: boolean = false
            const isAutomated = parsedCli[PEPRN_AUTO]
            const isChildmost = parsedCli['peprn:childmost']
            const ancDepth = parsedCli['peprn:ancestralDepth']
            const isMultiline = parsedCli[PEPRN_MULTILINE]
            const multilineTot = parsedCli[PEPRN_MULTILINE_TOTAL]
            const multilineIndex = parsedCli[PEPRN_MULTILINE_INDEX]

            const isFinalLine = !isMultiline ||
                (
                    typeof multilineTot === 'number' && typeof multilineIndex === 'number'
                    && multilineTot === multilineIndex + 1
                )

            if (isFinalLine && isMultiline) {
                console.log('multiline data', { ancDepth: parsedCli['peprn:ancestralDepth'] })

                //                console.log('multiline data', { isFinalLine, isMultiline, multilineIndex, input: parsedCli.rawIn })
            }


            if (!dataContainer) {
                console.error('could not find output region for peprn commands')
            }

            let doPrint = false

            if (isMultiline) {
                doPrint = isFinalLine && ancDepth === 0
            } else {
                doPrint = parsedCli['peprn:childmost'] === true && !parsedCli['peprn:automated']
            }

            // this condition usually gets what the user typed as the last command 
            if (
                doPrint
            ) {
                console.log('printing for ',
                    rawIn,
                    data
                )
                const printable = data?.formatted ?? data
                dataContainer.innerHTML = `${rawIn}\n${JSON.stringify(printable, null, 2)} 
${dataContainer.innerHTML}
`
                didPrint = true
                // if they created a program
                if (data?.formatted?.aaChordProgram) {
                    const program = document.querySelector('.program')
                    if (program) {

                        (program as HTMLTextAreaElement).value = data.formatted.aaChordProgram
                    }
                }
            }

            if (!didPrint) {
                console.warn('unprinted:', { parsedCli, data })
            }
            // caching behavior for the graph itself
            const nowNum = Date.now().toString()
            if (typeof parsedCli.rawIn === "string" && parsedCli.rawIn.startsWith('chord graph test')) {
                if (data && data.formatted) {
                    const [userLetter, userScale] = parsedCli.positionalNonCommands

                    const idx = userLetter && userScale ? `${userLetter} ${userScale}` : nowNum
                    mem().graphs[idx] = mem().graphs[idx] || [] as any[]
                    mem().graphs[idx].push(data.formatted)
                }
            }
        }
    })
}
