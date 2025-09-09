import { parseColonTag } from '../commands/phase/phase'
import { mem } from '../core/mem'

import { addSlider } from './addSlider'
import { makeNoteByBar, NoteByBar } from './schemas'
import { randId } from './util/common'
import { createNoteStoreById } from './util/noteStoreUtil'
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
  doAddSlider: boolean = false
): Promise<NoteByBar> => {
  let barObj = mem().notesByBar[barName]
  const [phaseName, barNumber] = parseColonTag(barName)
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

  if (doAddSlider) {
    // test slider sync via the noteStoreById
    addSlider(barName, noteId)
    const { store, updateTagsObj, updateNotePitch, unsubscribe } =
      createNoteStoreById(noteId)

    // to test slider sync and note pitch update etc
    // let interval2 = setInterval(() => {
    //     updateTagsObj({ barDelay: [102] }, true)
    //     const randomNumber = Math.floor(Math.random() * 3) + 2
    //     const note = noteNames[
    //         Math.floor(Math.random() * noteNames.length)
    //     ]
    //     updateNotePitch(`${note}${randomNumber}`, true)

    // }, 10000)

    // test unsubscribing
    // let interval = setInterval(() => {
    //     unsubscribe()
    // }, 10000)
  }
  return noteObj
}
