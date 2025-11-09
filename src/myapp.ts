import { createApp } from 'peprn/browser'

import { addChord, addNote, phase, song, tempo } from './commands'
import {
  deleteAllSongsAndTracks,
  deleteSongAndRelatedTracksAndPhasesBySongId,
  listSongs,
} from './commands/song/list'
import { updateTestMode } from './lib/schemas'
import { testRangeInner, testReadableRange } from './lib/util'
import { init as songInit } from './lib/util/songUtil'

// import { playTriads } from './lib/music'
document.body.onload = async () => {
  const music = await import('./lib/music')
  const { playTriads } = music
  document.body.onclick = () => {
    playTriads([['c3', 0.05, 0]])
    document.body.onclick = null
  }
  if (document.querySelector('meta[name="demo-app"]')) {
    updateTestMode(true)
    document.body.style.backgroundColor = 'blue'
    document.body.style.color = 'white'
    createApp({
      id: 'cli',
      init: async () => {
        const result = await songInit()
        console.log('songInit done', result)
        return Promise.resolve(null)
      },
      modules: {
        addNote,
        addChord,
        song,
        phase,
        listSongs,
        deleteAllSongsAndTracks,
        deleteSongById: deleteSongAndRelatedTracksAndPhasesBySongId,
        tempo,
        testRange: testRangeInner,
        testReadableRange: testReadableRange,
      },
    })
  }
}
