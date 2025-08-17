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
import { mem, NoteByBar } from './mem'
import fakeCli from 'peprn/fakeCli'
import { lastTick, phaseCount, phaseExists } from './mem-db'
import { abbrev, isAbbreviation, isFraction, tickCounts } from './commands/phase/observables/masterTicksObservable'
import { isNum, peprnIsNum, randId, strjson } from './lib/helpers'
import { PEPRN_AUTO, PEPRN_MULTILINE, PEPRN_MULTILINE_INDEX, PEPRN_MULTILINE_TOTAL } from 'peprn/util'
import { isChordCsvArg, isNoteName, isStringArray, makeFulfilledBarNote, parseChordCsvArg } from './commands/bars/utils'
import { addNoteToBar } from './lib/addNote'
import { isArray } from 'tone'
import { calcFractionalDelay, parseNoteTags, TagEntries } from './lib/tags'
import { romanChordNameToReal } from './lib/graphh'
import { z } from 'zod'
import { mapSongToMidiTicks } from './mapSongToTicks'
import { debounce } from 'rxjs'

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
            },
            addNote: {
                help: {
                    description: "",
                    examples: {
                        "c3 --barName aphrodite:0 --tags x=1 y=2 z=3,4": `Add a c3 note at 0 with these tags`
                    },
                },

                fn: async ({ positionalNonCommands, barName = 'default:1', updatePhaseScale, tags }) => { 
                    const [note] = positionalNonCommands
                    if (!isNoteName(note)) {
                        throw new Error('Note must be a valid note name')
                    }
                    if (typeof barName !== 'string') {
                        throw new Error('Bar name must be a string')
                    }
                    const [phaseName, barIndex] = barName.split(':')
                    if (!phaseName || !barIndex || !peprnIsNum(barIndex)) {
                        throw new Error('Phase should match phaseName:barIndex; instead got ' + barName)
                    }
                    if (!phaseExists(phaseName)) {
                        phaseCount(phaseName, parseInt(barIndex) + 1)
                    }
                    if (!Array.isArray(tags) || !isStringArray(tags)) {
                        throw new Error('Tags must be a string array')
                    }
                    const parsedNoteTags = parseNoteTags(tags)
                    addNoteToBar(note, barName, parsedNoteTags)

                    return {
                        positionalNonCommands,
                        barIndex,
                        barName,
                        parsedNoteTags,
                    }
                },

            },
            addChord: {
                help: {
                    description: "",
                    examples: {
                        "Cm,3 --arp 0th half,eigth half,quarter --barName aphrodite:0 --tags x=1 y=2 z=3,4": `Add a Cm chord at 0 arpeggiated so that the first note is played at 0, the second at 1/2, the third at a halfplus an eigth, and with the added tags`
                    },
                },

                fn: async ({positionalNonCommands, arp = ['0th','0th','0th','0th','0th'],barName = 'default:1', tags, scaleTonic, scaleName }) => { 
                    const [chordName] = positionalNonCommands
                    if (typeof chordName !== 'string' || !isChordCsvArg(chordName)) {
                        throw new Error('Chord must be a valid chord name with comma-separated octave')
                    } 
                    if (typeof barName !== 'string') {
                        throw new Error('Bar name must be a string')
                    }
                    const [phaseName, barIndex] = barName.split(':')
                    if (!phaseName || !barIndex || !peprnIsNum(barIndex)) {
                        throw new Error('Phase should match phaseName:barIndex; instead got ' + barName)
                    }
                    if (!phaseExists(phaseName)) {
                        phaseCount(phaseName, parseInt(barIndex) + 1)
                    } 
                    if (!Array.isArray(tags) || !isStringArray(tags)) {
                        throw new Error('Tags must be a string array')
                    }
                    if (!Array.isArray(arp) || !isStringArray(arp)) {
                        throw new Error('Arp must be a string array')
                    }
                    if (!['string', 'undefined'].includes(typeof scaleTonic) || !['string', 'undefined'].includes(typeof scaleName)) {
                        throw new Error('Scale tonic and scale name must be strings')
                    }

                    addChord(chordName, phaseName, parseInt(barIndex), arp, tags, z.string().or(z.undefined()).parse(scaleTonic), z.string().or(z.undefined()).parse(scaleName))
                    return {
                        positionalNonCommands,
                        barIndex,
                        phaseName,
                        tags,
                        scaleTonic,
                        scaleName,  
                        barName,
                        arp,
                    }
                },

            },
            romanChordNameToReal: {
                fn: async ({ positionalNonCommands }) => {
                    const [scaleTonic, scaleName, romanName] = positionalNonCommands
                    const romanName_ = z.string().parse(romanName)
                    const scaleTonic_ = z.string().parse(scaleTonic)
                    const scaleName_ = z.string().parse(scaleName)
                    return romanChordNameToReal(scaleTonic_, scaleName_, romanName_ )
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
            const ancDepth = parsedCli['peprn:ancestralDepth']
            const isMultiline = parsedCli[PEPRN_MULTILINE]
            const multilineTot = parsedCli[PEPRN_MULTILINE_TOTAL]
            const multilineIndex = parsedCli[PEPRN_MULTILINE_INDEX]
            const isFinalLine = !isMultiline ||
                (
                    typeof multilineTot === 'number' && typeof multilineIndex === 'number'
                    && multilineTot === multilineIndex + 1
                )

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
                console.log('printing for ', {
                    rawIn,
                    parsed: JSON.parse(strjson(
                        parsedCli
                    )),
                    data
                })
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
            if (!didPrint && parsedCli.rawIn.split(' ').includes('--man')) {
                dataContainer.innerHTML = `${rawIn}\n${strjson(data)} 
${dataContainer.innerHTML}                `
            }
            if (!didPrint) {
                console.warn('unprinted:', { parsedCli, data })
            }
            // caching behavior for the graph itself

        }
    })
}
//
function addChord(chordCsvArg: string, phaseName: string, barIndex: number, arp: string[], tags: string[], scaleTonic?: string, scaleName?: string)  {
    if (!isChordCsvArg(chordCsvArg)) {
        throw new Error('Chord must be a valid chord name with comma-separated octave')
    }
    const barTag = `${phaseName}:${barIndex}`
    const [chordName, octave] = chordCsvArg.split(',')
    if (!chordName || !octave) {
        throw new Error('Chord must be a valid chord name with comma-separated octave')
    }
    if (!mem().notesByBar[barTag]) {
        phaseCount(phaseName, barIndex + 1)
    }
    [chordCsvArg].forEach((str: string, objIdx: number) => {

        const groupId = randId('', 3)
        const groupIdTag = `groupId=${groupId}`

        const receptacle: NoteByBar[] = []
        mem().notesByBar[barTag] = receptacle


        const newGroupName = randId("", 3)
        const layerTag = `layer=${newGroupName}`
        const phaseTags: string[] = []

        if (scaleTonic) {
            phaseTags.push(`scaleTonic=${scaleTonic}`)
        }

        if (scaleName) {
            phaseTags.push(`scaleName=${scaleName}`)
        }

        const commonTags = [layerTag].concat(phaseTags)

        if (isChordCsvArg(str)) {

            const [notes, chordTags] = parseChordCsvArg(str, scaleTonic && scaleName ? `${scaleTonic} ${scaleName}` : undefined)
            if (notes.length === 0) {
                throw new Error(`Error; ${str} could not be parsed to anything with notes`)
            }
            notes.forEach(async(note, idx) => {
                console.log('note', {
                    note,
                    arpData: arp[idx], 

                })
                const delayTagsObj = arp[idx].split(',').reduce((acc, delay) => {
                    if (isAbbreviation(delay)) {
                        const x = delay
                        acc[abbrev[delay]] = acc[abbrev[delay]] ? acc[abbrev[delay]] + 1 : 1
                        return acc
                    } 
                    console.warn(`Error; ${delay} is not a valid fraction`)
                    return acc
                }, {} as {
                    [key in keyof typeof tickCounts]: number
                }) 
                // convert to e.g. quarter=1, half=2, etc
                const delayTagStrings: string[] = Object.entries(delayTagsObj).map(([key, value]) => {
                    return `${key}=${value}`
                })
                
                const totalDelay = calcFractionalDelay(parseNoteTags(delayTagStrings))

                const delayTags = Object.entries(delayTagsObj).map(([key, value]) => `${key}=${value}`)
                const noteId = randId('', 3)
                const noteIdTag = `noteId=${noteId}`
                console.log("tags", [...commonTags, ...delayTags, ...chordTags, noteIdTag , groupIdTag, `barDelay=${totalDelay}`])
                await addNoteToBar(note, barTag, parseNoteTags([...commonTags /*, ...delayTags */, ...chordTags, noteIdTag , groupIdTag, `barDelay=${totalDelay}`])) 
                addSlider(barTag, noteId)
            })

        } else throw new Error('Chord must be a valid chord name with comma-separated octave')
    })
}


/**
 * Given a note id, add a slider to move the note to a new time within the bar
 * controls-1 is the div that will contain the slider
 */
function addSlider (barName: string, noteId: string) {
    const controls1 = document.getElementById('controls-1')
    if (!controls1) {
        throw new Error('controls-1 not found')
    }
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = '0'
    slider.max = `${tickCounts.bar}`
    const noteData = mem().notesByBar[barName].find((note) => note.tags.includes(`noteId=${noteId}`))
    const noteDelay = noteData?.tags.find((tag) => tag.startsWith('barDelay='))?.split('=')[1]
    if (typeof noteDelay !== 'string' || !peprnIsNum(noteDelay)) {
        console.error('barDelay datum should be a number; insteaed got ' + noteDelay)
        console.error('noteData', noteData) 
        console.error('barName', barName)
        console.error('noteId', noteId)
        console.error('bar data', mem().notesByBar[barName])
        return
    }
    slider.value = noteDelay.toString()
    slider.oninput = () => {
        updateBarDelay(noteData, parseInt(slider.value))
    }
    controls1.appendChild(slider)
}

// on the data object, replace the barDelay index by array index value
// also call the mapSongToMidiTicks function to update the midi map, but 
// use native JS setTimeout to debounce to 100ms
function updateBarDelay (noteData: NoteByBar, newBarDelay: number) {
    const index = noteData.tags.findIndex((tag) => tag.startsWith('barDelay='))
    if (index === -1) {
        throw new Error('barDelay tag not found')
    }
    noteData.tags[index] = `barDelay=${newBarDelay}`
    setTimeout(() => {
        mem().latestMap = mapSongToMidiTicks()
    }, 100)
    return noteData
}


