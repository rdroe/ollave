import { browser } from "user-tables"
import { fetchLatestSongAndTracks } from "src/lib/fetch"


// list songs by fetching their names from the database
export const listSongs = {
    fn: async () => {
        const songs = (await (await browser.userTables.where('song', {})).toArray())
        return {
            formatted: {
                songs: songs.map(({ id, data }) => ({ id, name: data.name }))
            }
        }
    }
}

export const listTracks = {
    fn: async () => {
        const tracks = (await (await browser.userTables.where('track', {})).toArray())
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
        const songListInitLength = songs.length
        // delete them all
        await Promise.all(songs.map((song) => {
            return browser.userTables.delete('song', { id: song.id })
        }))

        const songListAfterDeletionLength = (await (await browser.userTables.where('song', {})).toArray()).length

        const tracks = (await (await browser.userTables.where('track', {})).toArray())
        const trackListInitLength = tracks.length
        // delete them all
        await Promise.all(tracks.map((track) => {
            return browser.userTables.delete('track', { id: track.id })
        }))
        const tracksListAfterDeletionLength = (await (await browser.userTables.where('track', {})).toArray()).length
        return { formatted: {
            songListInitLength,
            songListAfterDeletionLength,
            trackListInitLength,
            tracksListAfterDeletionLength
        }}
    }
}