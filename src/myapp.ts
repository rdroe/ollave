import { createApp } from 'peprn/browser'

import { addChord, addNote, arrange, copy, debug, phase, song, tempo } from './commands'
import {
  deleteAllSongsAndTracks,
  deleteSongAndRelatedTracksAndPhasesBySongId,
  listSongs,
} from './commands/song/list'
import { music } from './lib'
import { updateTestMode } from './lib/schemas'
import { testRangeInner, testReadableRange, testRangeUtil } from './lib/util'
import { init as songInit } from './lib/util/songUtil'
import { createDimensionalExampleAlphadex } from './lib/songGanttDemos/dimensionalExampleAlphadex'
import { createDimensionalExampleDatetime } from './lib/songGanttDemos/dimensionalExampleDatetime'
import { createDimensionalExampleNumeric } from './lib/songGanttDemos/dimensionalExampleNumeric'
// import { playTriads } from './lib/music'
console.log('location.pathname', location.pathname)
if (location.pathname.includes('songGanttChart')) {
  updateTestMode(true)
  document.body.style.backgroundColor = 'green'
  document.body.style.color = 'white'
  console.log('creating range demo')
  createDimensionalExampleAlphadex()
  createDimensionalExampleNumeric()
  createDimensionalExampleDatetime()
  // populate the songGanttChart div with the song gantt chart
} else {
    document.body.onload = async () => {
    const { playTriads } = music
    document.body.onclick = () => {
      if (music.isReady()) {
        playTriads([['c3', 0.05, 0]])
        document.body.onclick = null
      } else {
        console.log('music is not ready')
      }
    }
    if (document.querySelector('meta[name="demo-app"]')) {
      updateTestMode(true)
      document.body.style.backgroundColor = 'blue'
      document.body.style.color = 'white'
      createApp({
        id: 'cli',
        init: async () => {
          await songInit()
          return Promise.resolve(null)
        },
        modules: {
          addNote,
          addChord,
          arrange,
          copy,
          song,
          phase,
          listSongs,
          debug,
          deleteAllSongsAndTracks,
          deleteSongById: deleteSongAndRelatedTracksAndPhasesBySongId,
          tempo,
          testRange: testRangeInner,
          testReadableRange: testReadableRange,
          testRangeUtil: testRangeUtil,
        },
      })
    }
  }
}