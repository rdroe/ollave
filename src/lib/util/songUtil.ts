import { songInvocation } from '../../commands/song/song'
import { mem } from '../../core/mem'
import { setLatestMap, stopRealtimeTick } from '../../core/observables'
import {
  startCueObservable,
  stopCueObservable,
} from '../../core/observables/songObservables'
import { initLatestOrNewSong } from '../fetch'
import { mapSongToMidiTicks } from '../mapSongToTicks'
import { SongRecord } from '../types'

import { namesResolver } from './songNamesUtil'
export const onLoadSongCallbacks: ((song: SongRecord) => void)[] = []
export const addSongLoadCallback = (callback: (song: SongRecord) => void) => {
  onLoadSongCallbacks.push(callback)
}
;(() => {
  import('../words.js').then((w) => {
    const { songNames } = mem()
    const wordList = w.words.split('\n')
    for (let i = 0; i < 100; i++) {
      const rand = Math.floor(Math.random() * wordList.length)
      songNames.push(wordList[rand])
    }
    namesResolver(songNames)
  })
})()

export async function init() {
  const doc = document.querySelector('body')
  if (doc) {
    doc.style.backgroundColor = 'darkblue'
  }

  await initLatestOrNewSong()
  onLoadSongCallbacks.forEach((callback) => {
    callback(mem().song)
  })

  // start and pause the song to get observable set up
  setLatestMap(mapSongToMidiTicks())
  startCueObservable()
  stopCueObservable()
  stopRealtimeTick()
  songInvocation.setState({ ready: true })
}
