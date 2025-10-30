import { ParsedCli } from 'peprn/util'
import { Scale } from 'tonal'
import { z } from 'zod'

import { mapSongToMidiTicks, mapSongToTicks, randId } from '..'
import { Mem, mem } from '../../core/mem'
import { isAbbreviation, setLatestMap } from '../../core/observables'
import { zeroIndexedArr } from '../graphh'
import { makeNoteByBar, NoteByBar, noteByBarSchema } from '../schemas'

import {
  parseAbbreviationCsv,
  quantizeValueToAbbreviation,
} from './abbreviationUtil'
import { isCsvArg } from './barsUtil'
import { abbrev } from './constantsUtil'
import { getAllPhaseBarNotes } from './phaseUtil'
import {
  noteHasMatchingTagEntries,
  parseNoteTags,
  TagData,
  TagEntries,
} from './tagsUtil'
import { isFraction, tickCounts } from './tickUtil'

const isNoteCnt = (str: string | number) => {
  if (typeof str === 'number') return false
  return !!str.match(/[0-9]+x/)
}

export const notesByBarArraySchema = z.array(noteByBarSchema)

export const shiftDollarEntity = (
  dollar: ParsedCli['positionalNonCommands']
) => {
  const err = '"bar" or "phase" or "tag" is required'
  const phaseOrBarOrTag = z
    .union([z.literal('bar'), z.literal('phase'), z.literal('tag')], {
      error: err,
    })
    .parse(dollar.shift())

  return phaseOrBarOrTag
}

export const getNotesByEntity = (
  dollar: ParsedCli['positionalNonCommands'],
  positionalNonCommands: ParsedCli['positionalNonCommands']
) => {
  const phaseOrBar = shiftDollarEntity(dollar)
  const entityName = z.string().parse(dollar.shift())

  if (phaseOrBar === 'bar') {
    return mem().notesByBar[entityName]
  } else if (phaseOrBar === 'phase') {
    if (typeof entityName === 'number') {
      throw new Error(`Found numeric phase argument ${entityName}`)
    }
    const notes = getAllPhaseBarNotes(entityName).flat()

    return notes
  } else if (phaseOrBar === 'tag') {
    const all = Object.values(mem().notesByBar)
      .flat()
      .filter((n) => {
        const parsed = parseNoteTags(n.tags)
        return parsed.find(([tagName, data]) => {
          const tagNameMatch = tagName === entityName
          if (!tagNameMatch) return false
          if (
            positionalNonCommands === undefined ||
            positionalNonCommands.length === 0
          )
            return true

          const missingData = positionalNonCommands.find(
            (m) => !data.includes(m)
          )
          return missingData == undefined
        })
      })
    return all
  }
}

export const tuplize = (array: (string | number)[]) => {
  const allExceptPossiblyLast = array.reduce(function (r, a, i) {
    if (i % 2) {
      r[r.length - 1].push(a)
    } else {
      r.push([a])
    }

    return r
  }, [])

  if (allExceptPossiblyLast[allExceptPossiblyLast.length - 1].length === 1) {
    // when it ends in a number
    allExceptPossiblyLast[allExceptPossiblyLast.length - 1].push(null)
  }
  return allExceptPossiblyLast
}

// Re-export functions from their new locations
export {
  isAbbreviationCsv,
  parseAbbreviationCsv,
  sumAbbreviationCsv,
  quantizeValueToAbbreviation,
} from './abbreviationUtil'
export { quantizeNote } from './quantizeUtil'

export const parseDelayMatrixRow = (
  pattern: (string | number)[]
): {
  [idx: number]: (keyof typeof tickCounts)[]
} => {
  const entries: [noteIdx: number, fractions: string[]][] = []
  // non-arp
  // A row like '8th,4th half 4th,16th'
  if (pattern.find((elem) => typeof elem === 'string' && isCsvArg(elem))) {
    const tuples: [x: number, str: string][] = tuplize(pattern)
    const entries = tuples.map(
      ([noteNth, csvOrSingleFract]: [noteNth: number, csv: string | null]) => {
        const parsedCsvArg = parseAbbreviationCsv(csvOrSingleFract)
        const tagized = parsedCsvArg.map((elem) => {
          if (isAbbreviation(elem)) {
            const fullName = abbrev[elem]
            return `${fullName}=1`
          }
          throw new Error(`Should have been a faction abbreviation: ${elem}`)
        })

        return [noteNth, tagized]
      }
    )

    return Object.fromEntries(entries)
  }

  // arp
  pattern.forEach((elem) => {
    if (typeof elem === 'number') {
      entries.push([elem, []])
    }
  })

  let currNum = 0
  pattern.forEach((noteIdxOrFraction: string | number) => {
    if (typeof noteIdxOrFraction === 'number') {
      currNum = noteIdxOrFraction
    }

    if (typeof noteIdxOrFraction === 'string') {
      if (isAbbreviation(noteIdxOrFraction)) {
        entries.forEach(([noteNth, arr]) => {
          if (currNum <= noteNth) {
            arr.push(`${abbrev[noteIdxOrFraction]}=1`)
          }
        })
        return
      }
      throw new Error(`${noteIdxOrFraction} could not be parsed as a fraction`)
    }
  })

  const validEntries = z
    .array(
      z.tuple(
        [
          z.number(),
          z.array(
            z.string().refine((elem) => {
              return isFraction(elem.split('=')[0])
            }, 'a fraction is required (entry being returned as matrix')
          ),
        ] //close tuple def
      ) // close tuple call
    )
    .parse(entries)

  return Object.fromEntries(validEntries)
}

export const prepDelayMatrix = (
  positionalNonCommands: ParsedCli['positionalNonCommands']
): [noteIdx: string, row: (string | number)[]][] => {
  const countArrs = positionalNonCommands.reduce(
    (accum: number[], curr: string | number, idx: number) => {
      if (typeof curr === 'string' && isNoteCnt(curr)) {
        return [...accum, idx]
      }
      return accum
    },
    [] as (string | number)[]
  )

  const entries = countArrs.map((noteIdx: number, idx: number) => {
    const next = countArrs[idx + 1]
    if (next === undefined) {
      const retvar = positionalNonCommands.slice(noteIdx + 1)
      return [positionalNonCommands[noteIdx], retvar]
    }
    if (typeof next !== 'number') {
      throw new Error(`next should be a number`)
    }
    const retvar = positionalNonCommands.slice(noteIdx + 1, next)
    return [positionalNonCommands[noteIdx], retvar]
  })

  return entries as [noteIdx: string, data: (string | number)[]][]
}

const deleteSupernumeraries = (
  dmRow: ReturnType<typeof parseDelayMatrixRow>,
  cs: number
) => {
  return Object.fromEntries(
    Object.entries(dmRow).filter(([key]) => {
      return parseInt(key) <= cs
    })
  )
}

export const parseDelayMatrix = (
  entries: [chordSize: string, row: (string | number)[]][]
) => {
  return Object.fromEntries(
    entries.map(([cs, r]) => {
      const parsedRow = parseDelayMatrixRow(r)
      const chordSize = parseInt(cs)
      const idxs = zeroIndexedArr(chordSize)
      idxs.forEach((idx) => {
        parsedRow[idx] = parsedRow[idx] ?? []
      })

      return [cs, deleteSupernumeraries(parsedRow, chordSize)]
    })
  )
}

const quantizeOffset = (rawOffset: number, parsedTags: TagEntries) => {
  const quantizeAmount = parsedTags.find(
    ([name]: [nm: string, data: TagData]) => {
      return name === 'quantize'
    }
  )
  if (quantizeAmount) {
    const [quantizeTargetAbbrev] = quantizeAmount[1]
    if (isAbbreviation(quantizeTargetAbbrev)) {
      return quantizeValueToAbbreviation(rawOffset, quantizeTargetAbbrev)
    }
    console.error(
      `${quantizeTargetAbbrev} is not a valid abbreviation for a quantization target`
    )
  }
  return rawOffset
}

/**
 * Updates the bar delay for a note and triggers a map update
 */
export const updateBarDelay = (
  noteData: NoteByBar,
  newBarDelay: number
): NoteByBar => {
  const notes = Object.values(mem().notesByBar).flat()
  const note = notes.find(
    (note) => note.tagsObj.noteId[0] === noteData.tagsObj.noteId[0]
  )
  if (!note) {
    throw new Error('note not found')
  }
  note.tagsObj.barDelay = [newBarDelay]

  return noteData
}

/**
 * Updates the bar delay for a note and triggers a map update
 */
export const updateBarDelays = (
  note: string,
  newBarDelay: number
): NoteByBar[] => {
  const notes = Object.values(mem().notesByBar).flat()
  const matchingNotes = notes.filter((noteObj) => noteObj.note === note)
  if (!note) {
    throw new Error('note not found')
  }
  matchingNotes.forEach((noteObj) => {
    noteObj.tagsObj.barDelay = [newBarDelay]
  })
  setLatestMap(mapSongToMidiTicks())
  return matchingNotes
}

export const moveNotesToBarById = (noteIds: string[], targetBarId: string) => {
  const currentNotesByBar = mem().notesByBar
  // current notes by bar is a record of bar ids to arrays of note by bar

  const barIds = Object.keys(currentNotesByBar)
  const notesToMove: NoteByBar[] = []

  // go through each bar and set it to the same notes filtered by note ids
  barIds.forEach((aBarId) => {
    currentNotesByBar[aBarId] = currentNotesByBar[aBarId].filter((note) => {
      const matchingNote = noteIds.includes(note.tagsObj.noteId[0] as string)
      if (matchingNote) {
        notesToMove.push(note)
        note.tagsObj.barId = [targetBarId]
      }
      return !matchingNote
    })
  })

  // remove the notes from the original bar
  currentNotesByBar[targetBarId] = [
    ...(currentNotesByBar[targetBarId] ?? []),
    ...notesToMove,
  ]
}

export const moveNotesToBarByNoteIdsAndUpdateMap = (
  noteIds: string[],
  targetBarId: string
) => {
  moveNotesToBarById(noteIds, targetBarId)
  setLatestMap(mapSongToTicks.mapSongToMidiTicks())
}

// Filter a note from any mem > notesByBar array where it is present
export const deleteNotesById = (noteIds: string[]) => {
  const notesByBar = mem().notesByBar
  Object.entries(notesByBar).forEach(([barId, notes]) => {
    notesByBar[barId] = notes.filter(
      (note) => !noteIds.includes(note.tagsObj.noteId[0] as string)
    )
  })
}

export const deleteNotesByIdAndUpdateMap = (noteIds: string[]) => {
  deleteNotesById(noteIds)
  setLatestMap(mapSongToTicks.mapSongToMidiTicks())
}

export const muteNotesById = (noteIds: string[], unmute: boolean = false) => {
  const notesByBar = mem().notesByBar
  Object.entries(notesByBar).forEach(([_, notes]) => {
    // set muted = [true] in tagsObj
    notes.forEach((note) => {
      if (noteIds.includes(z.string().parse(note.tagsObj.noteId[0]))) {
        note.tagsObj.muted = [unmute ? false : true]
      }
    })
  })
  setLatestMap(mapSongToTicks.mapSongToMidiTicks())
}

export const unmuteNotesById = (noteIds: string[]) => {
  muteNotesById(noteIds, true)
}

export const muteNotesWithTagEntries = (
  tagEntries: TagEntries,
  unmute: boolean = false
) => {
  const matchingNoteIds = Object.values(mem().notesByBar)
    .flat()
    .filter((note) => {
      return noteHasMatchingTagEntries(note, tagEntries)
    })
    .map((note) => {
      return z.string().parse(note.tagsObj.noteId[0])
    })
  muteNotesById(matchingNoteIds, unmute)
}

export const unmuteNotesWithTagEntries = (tagEntries: TagEntries) => {
  muteNotesWithTagEntries(tagEntries, true)
}

export const muteNotesByBarId = (barId: string, unmute: boolean = false) => {
  const noteIds = mem().notesByBar[barId].map((note) => {
    return z.string().parse(note.tagsObj.noteId[0])
  })
  muteNotesById(noteIds, unmute)
}

export const unmuteNotesByBarId = (barId: string) => {
  muteNotesByBarId(barId, true)
}

export const muteAllNotes = (unmute: boolean = false) => {
  const noteIds = Object.values(mem().notesByBar)
    .flat()
    .map((note) => {
      return z.string().parse(note.tagsObj.noteId[0])
    })
  muteNotesById(noteIds, unmute)
}

const setTagDataByMatchingEntries = (
  tagEntriesToMatch: TagEntries,
  tagEntriesToSet: TagEntries
) => {
  const allNotes = Object.values(mem().notesByBar).flat()
  // find matching notes a la muteNotesWithTagEntries
  const matchingNotes = allNotes.filter((note) => {
    return noteHasMatchingTagEntries(note, tagEntriesToMatch)
  })
  matchingNotes.forEach((note) => {
    tagEntriesToSet.forEach(([tagName, data]) => {
      note.tagsObj[tagName] = data
    })
  })
  setLatestMap(mapSongToTicks.mapSongToMidiTicks())
}

export const unmuteAllNotes = () => {
  setTagDataByMatchingEntries([['muted', [true]]], [['muted', [false]]])
}

export const setPlayExclusivelyByMatchingEntries = (
  tagEntriesToMatch: TagEntries
) => {
  setTagDataByMatchingEntries(tagEntriesToMatch, [['playExclusively', [true]]])
}

export const unsetPlayExclusivelyByMatchingEntries = (
  tagEntriesToMatch: TagEntries
) => {
  setTagDataByMatchingEntries(tagEntriesToMatch, [['playExclusively', [false]]])
}
export const getNoteByBar = (mem: () => Mem, noteId: string) => {
  return Object.values(mem().notesByBar)
    .flat()
    .find((note) => note.tagsObj.noteId[0] === noteId)
}

export const addAllScaleNotesToBar = (
  barId: string,
  scaleTonic: string,
  scaleName: string,
  oct: number = 3
) => {
  const notes = mem().notesByBar[barId]
  if (!notes) {
    throw new Error('barId not found')
  }
  const allScaleNotes = Scale.get(`${scaleTonic} ${scaleName}`).notes.map(
    (note) => {
      return `${note}${oct}`
    }
  )

  const groupId = randId('', 6)
  const eigthNoteTicksCount = tickCounts['eighth']
  const noteObjs = allScaleNotes.map((note, idx) => {
    return makeNoteByBar(note, [
      `groupId=${groupId}`,
      `barId=${barId}`,
      `scaleTonic=${scaleTonic}`,
      `scaleName=${scaleName}`,
      `oct=${oct}`,
      `barDelay=${eigthNoteTicksCount * idx}`,
    ])
  })
  notes.push(...noteObjs)
  console.log('scale notes', noteObjs)
  setLatestMap(mapSongToMidiTicks())
  return noteObjs
}

// Additional re-exports
export { getAllPhaseBarNotes } from './phaseNotesUtil'
export { parseNoteTags } from './noteParsingUtil'
export type { TagData, TagEntries } from './noteParsingUtil'
export { isCsvArg, parseCsvArg } from './common'
// @ts-ignore this is fine
window.testScaleNotes = (tonicAndScale: string = 'C Minor') => {
  const allScaleNotes = Scale.get(tonicAndScale).notes.map((note) => {
    return `${note}`
  })
  console.log('all scale notes', {
    tonicAndScale,
    allScaleNotes,
  })
}
