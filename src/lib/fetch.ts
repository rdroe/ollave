import { fetchSongAndTracks } from "src/commands/song/init"
import { browser } from "user-tables"


export const fetchLatestSongAndTracks = async () => {
    const song = (await (await browser.userTables.where('song', {})).sortBy('updatedAt')).reverse()[0]
    console.log({song})
    if (!song) {
        console.error('no song found')
        return null
    }
    return fetchSongAndTracks(song.id)

}