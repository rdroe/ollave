import { getNoteById } from '../../../core'
import { quantizeValueToAbbreviation } from '../../../lib/util/abbreviationUtil'
import { isAbbreviation } from '../../../lib/util/constantsUtil'

import { mouseDownNote } from './mousedown'

export const selectStartSlider = (noteId: string) => {
  return document.querySelector(
    `.note-timing-start-${noteId}`
  ) as HTMLInputElement
}
const selectDurationSlider = (noteId: string) => {
  return document.querySelector(
    `.note-timing-duration-${noteId}`
  ) as HTMLInputElement
}
let uiTimeout: NodeJS.Timeout | null = null

const debounce = (fn: () => void) => {
  if (uiTimeout) {
    clearTimeout(uiTimeout)
  }
  uiTimeout = setTimeout(fn, 100)
}
const requireAbbreviation = (quant: unknown) => {
  if (!isAbbreviation(quant)) {
    throw new Error('quant is not an abbreviation: ' + quant)
  }
  return quant
}
const requireNumericValueFromEventTarget = (target: EventTarget) => {
  const value = (target as HTMLInputElement).value
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    if (isNaN(parsed)) {
      throw new Error('value is not a number: ' + value)
    }
    return parsed
  }
  throw new Error('value is not a number: ' + value)
}

const lookUpQuantizedTagValue = (
  tagsObj: Record<string, (string | number | boolean)[]>
) => {
  return requireAbbreviation(tagsObj.quantize?.[0])
}
export const addStartEnd = async (noteId: string) => {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  const note = document.querySelector(`#note-${noteId}`)
  if (!note) {
    return
  }

  let controls = note.querySelector(`.note-controls`)
  if (!controls) {
    note.innerHTML += `<div class="note-controls"></div>`
  }
  controls = note.querySelector(`.note-controls`)
  if (!controls) {
    return
  }

  const startSlider1 = document.createElement('input')
  startSlider1.type = 'range'
  startSlider1.id = `note-timing-start-${noteId}`
  startSlider1.className = `note-timing-start-${noteId}`
  startSlider1.name = `note-timing-start-${noteId}`
  startSlider1.min = '0'
  startSlider1.max = '1024'
  startSlider1.value = '0'
  startSlider1.addEventListener('input', function (e) {
    const { tagsObj } = getNoteById(noteId)

    const value = requireNumericValueFromEventTarget(e.target)
    const quant = lookUpQuantizedTagValue(tagsObj)
    const newQuantizedValue = quantizeValueToAbbreviation(value, quant)

    startSlider1.value = newQuantizedValue.toString()

    if (newQuantizedValue !== value) {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      return
    }
  })
  // are both listeners needed?
  startSlider1.addEventListener('change', function (e) {
    const { tagsObj } = getNoteById(noteId)
    const value = requireNumericValueFromEventTarget(e.target)
    const quant = lookUpQuantizedTagValue(tagsObj)
    const newQuantizedValue = quantizeValueToAbbreviation(value, quant)
    startSlider1.value = newQuantizedValue.toString()

    if (newQuantizedValue !== value) {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      return
    }
  })

  controls.appendChild(startSlider1)

  const durationSlider1 = document.createElement('input')
  durationSlider1.type = 'range'
  durationSlider1.id = `note-timing-duration-${noteId}`
  durationSlider1.className = `note-timing-duration-${noteId}`
  durationSlider1.name = `note-timing-duration-${noteId}`
  durationSlider1.min = '0'
  durationSlider1.max = '1024'
  durationSlider1.value = '128'
  controls.appendChild(durationSlider1)
  durationSlider1.addEventListener('input', function (e) {
    //    console.log('durationSlider 000 input', e)
  })
}

export const sync = {
  duration: (note: {
    tagsObj: Record<string, (string | number | boolean)[]>
  }) => {
    if (!note || mouseDownNote.getState().noteId === note.tagsObj.noteId?.[0]) {
      return
    }
    const noteId = note?.tagsObj?.noteId?.[0]
    if (typeof noteId !== 'string') {
      return
    }

    const durationInput = selectDurationSlider(noteId)
    if (!durationInput) {
      return
    }
    durationInput.value = note?.tagsObj?.duration?.[0]?.toString() ?? '128'
  },
  barDelay: (note: {
    tagsObj: Record<string, (string | number | boolean)[]>
  }) => {
    const newValue = note?.tagsObj?.barDelay?.[0]
    const noteId = note?.tagsObj?.noteId?.[0]
    if (newValue === undefined || typeof noteId !== 'string') {
      return
    }
    const durationInput = selectDurationSlider(noteId)
    if (!durationInput) {
      return
    }
    durationInput.value = newValue.toString()
  },
}
