
import { browser } from "user-tables"
import { songRecordSchema } from "./schemas"
import { fetchSongAndTracks, initLoadedSong } from "./helpers"
import { mem } from "../core/mem"


export const fetchLatestSongAndTracks = async () => {
    const song = (await (await browser.userTables.where('song', {})).sortBy('updatedAt')).reverse()[0]
    if (!song) {
        console.error('no song found')
        return null
    }
    return fetchSongAndTracks(song.id)
}

export const fetchSongAndTracksBySongId = async (songId: number) => {
    const song = await (await browser.userTables.where('song', { id: songId})).first()
    if (!song) {
        console.error('no song found')
        return null
    }
    return fetchSongAndTracks(song.id)
}


export async function loadAndInitSongAndTracks(songId: number) {
    const latestSong = await fetchSongAndTracksBySongId(songId)
    if (latestSong) {
        mem().song = songRecordSchema.parse(latestSong.song)
        mem().tracks = [latestSong.tracks[0]]
        return latestSong
    }
    await initLoadedSong()
    return latestSong
}
