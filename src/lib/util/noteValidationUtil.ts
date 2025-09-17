// Removed helpers import to break circular dependency
import { noteNames } from '../graphh'

import { peprnIsNum } from './common'

export const isNoteNameWithoutOctave = (nm: unknown): nm is string => {
  if (typeof nm !== 'string' || nm.length === 0) return false
  if (peprnIsNum(nm[nm.length - 1])) return false
  const allButLastWithUpperFirst = nm.charAt(0).toUpperCase() + nm.slice(1)
  const result = noteNames.includes(allButLastWithUpperFirst)
  if (!result) return false
  return true
}

export const isNoteNameWithOctave = (nm: unknown): nm is string => {
  if (typeof nm !== 'string') return false
  const allButLastChar = nm.slice(0, -1)
  console.log('allButLastChar', allButLastChar)
  if (!isNoteNameWithoutOctave(allButLastChar)) {
    console.log('allButLastChar is invalid', allButLastChar)
    return false
  }
  console.log('allButLastChar is valid')
  const lastChar = nm[nm.length - 1]
  if (!peprnIsNum(lastChar)) return false
  return true
}
