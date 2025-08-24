import { strjson } from '../../lib/helpers';
import { mem } from '../../lib/mem';
import { tickCounts } from '../phase/observables/masterTicksObservable';
import { lastTick } from '../../lib/mem-db';

import { SongRecord, TrackRecord } from './song';
import { browser } from 'user-tables';
import { mapSongToMidiTicks } from '../../lib/mapSongToTicks';
import { startCueObservable } from './observables';



const { songNames } = mem()

let namesResolver: Function | null = null

const namesPromise = new Promise((res) => {
    namesResolver = res
});

(() => {
    import('../../lib/words').then((w) => {
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
let trackReceptacleSelector: string | null = null
let doPrintNotes = false
export function setTrackReceptacleSelector(selector: string) {
    trackReceptacleSelector = selector
}
export function startPrintingNotes() {
    doPrintNotes = true
}
export function stopPrintingNotes() {
    doPrintNotes = false
}
async function trackInit() {
    const trackRecord: TrackRecord = {
        "start": 0,
        "phase-ids": []
    }
    const trackId = await browser.userTables.add('track', { data: trackRecord })
    await browser.userTables.update('song', {
        id: mem().song.id,
        data: {
            "song-tracks": [[
                trackId, 0
            ]]
        },
    }, {})

    const coll = await (browser.userTables.where('song', { id: mem().song.id }))
    const fetched = await coll.first()
    const { "song-tracks": songTracks } = fetched.data

    if (songTracks) {
        mem().track = {
            id: songTracks[0][0],
            start: 0,
            "phase-ids": []
        }
    } else {
        console.error("no tracks for song", mem().song.id)
    }

}

async function songInit() {
    const shiftedOff = songNames.shift()


    const data: SongRecord = {
        name: shiftedOff,
        tempo: 120,
        "track-ids": []
    }
    const createdId = await browser.userTables.add('song', {
        data
    })

    mem().song = {
        id: createdId,
        ...data
    }
    await trackInit()
}

export async function init() {
    await namesPromise
    const doc = document.querySelector('body')
    if (doc) {
        doc.style.backgroundColor =
            "darkblue"

    }

    await songInit()
    let tagsRoot: HTMLDivElement | null = null
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

        // for existing tags, gather those that are no longer in the range.
        (tagsRoot?.querySelectorAll('.note-tags') as NodeListOf<HTMLDivElement>)?.forEach((elem: HTMLDivElement) => {
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

        if (doPrintNotes) {
            if (!tagsRoot) {
                if (!trackReceptacleSelector) {
                    return
                }
                tagsRoot = document.querySelector(
                    trackReceptacleSelector
                ) as HTMLDivElement
                return
            }
            if (!tagsRoot) {
                return
            }
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
        }
        logItr += 1
        

    }, 10)

    // start and pause the song to get observable set up
    mem().latestMap = mapSongToMidiTicks()
    startCueObservable()
    const songName = mem().song.name
    mem().observables[songName] = mem().observables[songName] || {} 
    
    mem().songPauses[songName] = [
        null,
        0
    ]

    Object.values(mem().observables[songName] || {}).forEach((observable) => {
        observable.unsubscribe()
    })
}
    

