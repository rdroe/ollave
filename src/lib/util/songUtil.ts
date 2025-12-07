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

import { namesPromise, namesResolver } from './songNamesUtil'
let words: string[] = []
export const onLoadSongCallbacks: ((song: SongRecord) => void)[] = []
export const addSongLoadCallback = (callback: (song: SongRecord) => void) => {
  onLoadSongCallbacks.push(callback)
};(() => {

  import('../words.js').then((w) => {
    const { songNames } = mem()
    const wordList = w.words.split('\n')
    words = wordList
    for (let i = 0; i < 100; i++) {
      const rand = Math.floor(Math.random() * wordList.length)
      songNames.push(wordList[rand])
    }
    namesResolver(songNames)
  })
})()

export const getRandomWord = async () => {
  await namesPromise
  // find a short  random word (<= 7 letters) by using randomness in the index
  // in a loop, returning the first random find that is <= 7 letters
  // the index should be random. it can fail after 10000 tries.
  for (let i = 0; i < 10000; i++) {
    const randomIndex = Math.floor(Math.random() * words.length)
    const word = words[randomIndex]
    if (word.length <= 7) {
      return word
    }
  }
  throw new Error('Failed to find a short word')
} 
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

