import { browser } from "user-tables"
import { fetchSongAndTracks,  } from "./init"
import { fetchLatestSongAndTracks } from "src/lib/fetch"


// list songs by fetching their names from the database
export const listSongs = {
    fn: async () => {
        console.log('listing songs')

        const songs = (await (await browser.userTables.where('song', {})).toArray())
        // const initLength = songs.length
        // // delete them all
        // await Promise.all(songs.map((song) => {
        //     return browser.userTables.delete('song', { id: song.id })
        // }))

        // const songs2 = (await (await browser.userTables.where('song', {})).toArray()).length
        
        // console.log({ initLength, afterLength: songs2 }, songs)

        console.log({length: songs.length}, songs)
        return songs
    }
}

export const listTracks = {
    fn: async () => {
        const tracks = (await (await browser.userTables.where('track', {})).toArray())
        console.log({length: tracks.length}, tracks)
        // delete them all
        // await Promise.all(tracks.map((track) => {
        //     return browser.userTables.delete('track', { id: track.id })
        // }))
        // const tracks2 = (await (await browser.userTables.where('track', {})).toArray())
        // console.log({length: tracks2.length}, tracks2)
        return tracks
    }
}

export const latestSong = {
    fn: async () => {
        return fetchLatestSongAndTracks()
    }
}

export const deleteAllSongsAndTracks = {
    fn: async () => {

        const songs = (await (await browser.userTables.where('song', {})).toArray())
        const initLength = songs.length
        // delete them all
        await Promise.all(songs.map((song) => {
            return browser.userTables.delete('song', { id: song.id })
        }))

        const songs2 = (await (await browser.userTables.where('song', {})).toArray()).length
        
        console.log({ initLength, afterLength: songs2 }, songs)
        const tracks = (await (await browser.userTables.where('track', {})).toArray())
        console.log({length: tracks.length}, tracks)
        // delete them all
        await Promise.all(tracks.map((track) => {
            return browser.userTables.delete('track', { id: track.id })
        }))
        const tracks2 = (await (await browser.userTables.where('track', {})).toArray())
        console.log({length: tracks2.length}, tracks2)

    }
}