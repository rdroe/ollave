import { mem } from '../core/mem'

import { makeNoteByBar, NoteByBar } from './schemas'
import { randId } from './util/common'
import { parseColonTag } from './util/parseColonTag'
import { phaseCount } from './util/phaseUtil'
import {
  calcFractionalDelay,
  getTagData,
  TagEntries,
  unparseTagEntries,
} from './util/tagsUtil'

export const addNoteToBar = async (
  note: string,
  barName: string,
  tagsIn: TagEntries,
  _doAddSlider: boolean = false
): Promise<NoteByBar> => {
  let barObj = mem().notesByBar[barName]
  const parsedBarName = parseColonTag(barName)
  if (!parsedBarName) {
    throw new Error(`${barName} is not a bar tag`)
  }
  const [phaseName, barNumber] = parsedBarName
  const tags = unparseTagEntries(tagsIn)
  if (!barObj) {
    if (phaseName) {
      phaseCount(phaseName, barNumber + 1, true)
      barObj = mem().notesByBar[barName]
    }
    if (!barObj) {
      throw new Error(`Bar ${barName} not found`)
    }
  }

  let noteId = getTagData(tagsIn, 'noteId')?.[0]
  if (!noteId) {
    noteId = randId('', 6)
    tags.push(`noteId=${noteId}`)
  }

  if (typeof noteId !== 'string') {
    throw new Error('noteId tag is missing or non-string ' + noteId)
  }

  if (typeof getTagData(tagsIn, 'barDelay')?.[0] !== 'number') {
    const fractionalDelay = calcFractionalDelay(tagsIn)
    if (typeof fractionalDelay !== 'number') {
      console.warn('timing info is missing or non-number ' + tagsIn.toString())
    }
    tags.push(`barDelay=${fractionalDelay}`)
  }

  const noteObj = makeNoteByBar(note, tags)
  barObj.push(noteObj)

  // addSlider functionality removed - not used by web app
  return noteObj
}
