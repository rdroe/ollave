import { mem } from '../core/mem'
import { setLatestMap } from '../core/observables/compilationObservable'

import { addNoteToBar } from './addNote'
import { phaseScale } from './helpers'
import { mapSongToMidiTicks } from './mapSongToTicks'
import { NoteByBar } from './schemas'
import { isChordCsvArg, isStringArray, parseChordCsvArg } from './util/barsUtil'
import { randId } from './util/common'
import { abbrev, isAbbreviation, tickCounts } from './util/constantsUtil'
import { phaseCount } from './util/phaseUtil'
import { isScaleNameWithTonic } from './util/scaleUtil'
import { calcFractionalDelay, parseNoteTags } from './util/tagsUtil'

export const DEFAULT_GLISS = [
  '0th',
  'eighth',
  'quarter',
  'quarter,eighth',
  'half',
  'half,eighth',
  'half,quater',
  'half,16th',
]
export const DEFAULT_GLISS_32nd = [
  '0th',
  '32nd',
  '16th',
  '16th,32nd',
  '8th',
  '8th,32nd',
  '8th,16th',
  '8th,16th,32nd',
  'quarter',
]
export const DEFAULT_GLISS_16th = [
  '0th',
  '16th',
  '8th',
  '8th,16th',
  'quarter',
  'quarter,16th',
  '2nd',
  '2nd,16th',
]
export const DEFAULT_GLISS_8th = [
  '0th',
  '8th',
  'quarter',
  'quarter,8th',
  '2nd',
  '2nd,8th',
  '2nd,quarter',
]
export const DEFAULT_ARP = ['0th', '0th', '0th', '0th', '0th', '0th', '0th']
const DEFAULT_ARP_ZERO = DEFAULT_ARP
const DEFAULT_ARP_ONE = 'quarter|'.repeat(7).split('|').slice(0, 7)
const DEFAULT_ARP_TWO = 'half|'.repeat(7).split('|').slice(0, 7)
const DEFAULT_ARP_THREE = 'half,quarter|'.repeat(7).split('|').slice(0, 7)
export const DEFAULT_CHORD_PLACEMENTS = {
  0: DEFAULT_ARP_ZERO,
  1: DEFAULT_ARP_ONE,
  2: DEFAULT_ARP_TWO,
  3: DEFAULT_ARP_THREE,
}

export function addChord(
  chordCsvArg: string,
  phaseName: string,
  barIndex: number,
  arp: string[] | number[] | 0 | 1 | 2 | 3,
  tags: string[],
  userScaleTonic: string = 'A',
  userScaleName: string = 'minor',
  _doAddSlider: boolean = false
): {
  noteIds: string[]
  barName: string
  commonTags: string[]
  notes: NoteByBar[]
} {
  if (!isChordCsvArg(chordCsvArg)) {
    throw new Error(
      'Chord must be a valid chord name with comma-separated octave'
    )
  }
  const barTag = `${phaseName}:${barIndex}`
  const [chordName, octave] = chordCsvArg.split(',')
  if (!chordName || !octave) {
    throw new Error(
      'Chord must be a valid chord name with comma-separated octave'
    )
  }
  if (!mem().notesByBar[barTag]) {
    phaseCount(phaseName, barIndex + 1, true)
  }
  const noteIds: string[] = []

  const groupId = randId('', 6)
  const groupIdTag = `groupId=${groupId}`

  mem().notesByBar[barTag] = mem().notesByBar[barTag] || []

  const newGroupName = randId('', 3)
  const layerTag = `layer=${newGroupName}`
  const phaseTags: string[] = []

  if (userScaleTonic && userScaleName) {
    if (!isScaleNameWithTonic(`${userScaleTonic} ${userScaleName}`)) {
      throw new Error(`Scale ${userScaleTonic} ${userScaleName} not found`)
    }
    phaseScale(phaseName, userScaleName, userScaleTonic)
  }

  const currentScale = phaseScale(phaseName)

  if (currentScale.scaleName) {
    phaseTags.push(`scaleName=${currentScale.scaleName}`)
  }

  if (currentScale.scaleTonic) {
    phaseTags.push(`scaleTonic=${currentScale.scaleTonic}`)
  }

  let commonTags = [layerTag]
    .concat(phaseTags)
    .concat(tags)
    .concat([groupIdTag, `barId=${barTag}`])

  const [notes, chordTags] = parseChordCsvArg(
    chordCsvArg,
    currentScale.scaleTonic && currentScale.scaleName
      ? `${currentScale.scaleTonic} ${currentScale.scaleName}`
      : undefined
  )

  const allNotes: NoteByBar[] = []
  commonTags = commonTags.concat(chordTags)
  if (notes.length === 0) {
    throw new Error(
      `Error; ${chordCsvArg} could not be parsed to anything with notes`
    )
  }

  notes.forEach(async (note, idx) => {
    // const delayTags = Object.entries(delayTagsObj).map(([key, value]) => `${key}=${value}`)
    const noteId = randId('', 6)
    noteIds.push(noteId)
    const noteIdTag = `noteId=${noteId}`
    const totalDelay = caculateNoteDelay(arp, idx)
    const allTags = [
      ...commonTags /*, ...delayTags */,
      noteIdTag,
      `barDelay=${totalDelay}`,
    ]

    const noteObj = await addNoteToBar(note, barTag, parseNoteTags(allTags))
    allNotes.push(noteObj)

    // addSlider functionality removed - not used by web app
  })
  setLatestMap(mapSongToMidiTicks())
  return {
    noteIds,
    barName: barTag,
    commonTags,
    notes: allNotes,
  }
}

export function caculateNoteDelay(
  arp: string[] | number[] | 0 | 1 | 2 | 3,
  idx: number
) {
  if (typeof arp === 'number' || (Array.isArray(arp) && isStringArray(arp))) {
    return calculateNormalNoteDelay(arp, idx)
  } else if (Array.isArray(arp)) {
    return calculateNumbericNoteDelay(arp, idx)
  }
}
function calculateNormalNoteDelay(arp: string[] | 0 | 1 | 2 | 3, idx: number) {
  const arpArg =
    typeof arp === 'number' ? DEFAULT_CHORD_PLACEMENTS[arp][idx] : arp[idx]
  const delayTagsObj = (arpArg ?? DEFAULT_ARP[idx]).split(',').reduce(
    (acc, delay) => {
      if (isAbbreviation(delay)) {
        const _x = delay
        acc[abbrev[delay]] = acc[abbrev[delay]] ? acc[abbrev[delay]] + 1 : 1
        return acc
      }
      console.warn(`Error; ${delay} is not a valid fraction`)
      return acc
    },
    {} as {
      [key in keyof typeof tickCounts]: number
    }
  )
  // convert to e.g. quarter=1, half=2, etc; only leave barDelay
  const delayTagStrings: string[] = Object.entries(delayTagsObj).map(
    ([key, value]) => {
      return `${key}=${value}`
    }
  )

  const totalDelay = calcFractionalDelay(parseNoteTags(delayTagStrings))
  return totalDelay
}

function calculateNumbericNoteDelay(arp: number[], idx: number) {
  return arp[idx]
}
