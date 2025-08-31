import { strjson } from '../../lib/helpers';
import { mem, songRecordSchema, trackRecordSchema } from '../../lib/mem';
import { tickCounts } from '../phase/observables/masterTicksObservable';
import { lastTick } from '../../lib/mem-db';

import { SongRecord, TrackRecord } from './song';
import { browser } from 'user-tables';
import { mapSongToMidiTicks } from '../../lib/mapSongToTicks';
import { startCueObservable } from './observables';
import { setLatestMap } from '../phase/observables/compilationObservable';
import { z } from 'zod';
import { fetchLatestSongAndTracks } from 'src/lib/fetch';

const { songNames } = mem()

let namesResolver: Function | null = null

const namesPromise = new Promise((res) => {
    namesResolver = res
});

(() => {
    console.log('importing words')
    import('../../lib/words').then((w) => {
        console.log('words imported')
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
    const trackRecord: Omit<TrackRecord, "id"> = {
        "phase-ids": [],
        notesByBar: {}
    }
    const trackId = await browser.userTables.add('track', { data: trackRecord })
    // update the track to have its id in data. 
    await browser.userTables.update('track', { id: trackId, data: { id: trackId } }, {}) 

    await browser.userTables.update('song', {
        id: mem().song.id,
        data: {
            "track-ids": [[
                trackId, 0
            ]]
        },
    }, {})

    const coll = await (browser.userTables.where('song', { id: mem().song.id }))
    const fetched = await coll.first()
    const validSong = songRecordSchema.parse(fetched.data)
    const { "track-ids": songTracks } = validSong

    if (songTracks) {
        mem().tracks = [{
            id: songTracks[0][0],
            "phase-ids": [],
            notesByBar: {}
        }]
    } else {
        console.error("no tracks for song", mem().song.id)
    }

}

export async function fetchSongAndTracks(songId: number) {
    const coll = await (browser.userTables.where('song', { id: songId }))
    const fetched = await coll.first()
// get the track ids 
    const validSong = songRecordSchema.parse(fetched.data) 
    const trackIds = validSong["track-ids"].map(([trackId]) => {
        return trackId
    }).filter((trackId) => {
        return trackId !== undefined
    })
    // now fetch each track
    const validatedTracks = await Promise.all(trackIds.map(async (trackId) => {
        const fetched = await (await browser.userTables.where('track', { id: trackId })).first()
        console.log({fetched})
        return trackRecordSchema.parse(fetched.data)
    }))

    return {
        song: validSong,
        tracks: validatedTracks
    }
}

async function initLatestOrNewSong() {

    const latestSong = await fetchLatestSongAndTracks()
    if (latestSong) {
        mem().song = songRecordSchema.parse(latestSong.song)
        mem().tracks = [{
            id: latestSong.tracks[0].id,
            "phase-ids": latestSong.tracks[0]["phase-ids"],
            notesByBar: latestSong.tracks[0].notesByBar
        }]
        return latestSong
    }
    const shiftedOff = songNames.shift()
    const data: Omit<SongRecord, "id"> = {
        name: shiftedOff,
        tempo: 120,
        "track-ids": []
    }
    const createdId = await browser.userTables.add('song', {
        data
    })
    await browser.userTables.update('song', { id: createdId, data: {
        id: createdId
    } }, {})
    const refetched = await (await browser.userTables.where('song', { id: createdId })).first()

    mem().song = songRecordSchema.parse(refetched.data)
    await trackInit()
}

export async function init() {
    await namesPromise
    const doc = document.querySelector('body')
    if (doc) {
        doc.style.backgroundColor =
            "darkblue"

    }

    await initLatestOrNewSong()
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
    setLatestMap(mapSongToMidiTicks())
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
    

