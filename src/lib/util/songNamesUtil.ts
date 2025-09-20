import { mem } from '../../core/mem'

const { songNames } = mem()

export let namesResolver: (songNames: string[]) => void | null = null

export const namesPromise = new Promise((res) => {
  namesResolver = res
})

export const getSongNames = () => {
  return namesPromise.then(() => {
    return songNames
  })
}
