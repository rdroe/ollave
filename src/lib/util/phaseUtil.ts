import { browser } from 'user-tables'
import { z } from 'zod'

import { mem } from '../../core/mem'
import { setLatestMap } from '../../core/observables/compilationObservable'
import { mapSongToMidiTicks } from '../mapSongToTicks'
import { cloneNoteByBar, NoteByBar, phaseRecordSchema } from '../schemas'

import { randId } from './common'
import { getAllPhaseBars } from './phaseNotesUtil'
import { PhaseRecord } from './phaseTypes'

export async function phaseFollowsPhaseInner(
  subject: string,
  objects: string[]
) {
  const { phases } = mem()
  objects.forEach((obj) => {
    if (!phases[obj]) {
      throw new Error(`phase ${obj} does not exist`)
    }
  })

  // if subject exists, add follows-ids.
  if (phases[subject]) {
    phases[subject]['follows-ids'] = phases[subject]['follows-ids'].concat(
      objects.map((obj) => phases[obj].id ?? phases[obj].id)
    )

    // if subject does not exist, create it with a default note block (1 empty bar) and the specified  follows-ids.
  } else {
    const phaseData: Omit<PhaseRecord, 'id'> = {
      'follows-ids': objects.map((obj) => phases[obj].id),
      barSizeMultiplier: null,
      speed: null,
      scaleName: null,
      scaleTonic: null,
      name: subject,
    }
    // create the phase in the db to get the id
    const phaseId = await browser.userTables.add('phase', { data: phaseData })
    phases[subject] = {
      id: z.number().parse(phaseId),
      name: subject,
      // The SAME ids that were just persisted. This used to be [], so the row
      // said "follows X" while memory said "root" — a drift that only healed
      // on the next reload, and that made duplicate/import lose follows edges
      // whenever they read the freshly created phase back out of mem().
      'follows-ids': phaseData['follows-ids'],
      barSizeMultiplier: null,
      speed: 1,
      scaleName: 'major',
      scaleTonic: 'C',
    }
  }
}
// temp-id is for in-memory only. id is for the database.
// phase <new-phase> follows <existing-phase>
export async function phaseFollowsPhase(subject: string, objects: string[]) {
  await phaseFollowsPhaseInner(subject, objects)
  setLatestMap(mapSongToMidiTicks())
}

const getPhaseId = (phaseName: string) => {
  const phase = mem().phases[phaseName]
  return phase.id
}

export async function phaseUnfollows(subject: string, objects?: string[]) {
  // remove all follows-ids from subject

  const phase = mem().phases[subject]
  if (objects) {
    if (objects.length) {
      const objectsById = objects.map(getPhaseId)
      mem().phases[subject] = {
        ...phase,
        'follows-ids': phase['follows-ids'].filter((phaseId) => {
          return !objectsById.includes(phaseId)
        }),
      }
    } else {
      // noop, noitice
    }
  }

  mem().phases[subject] = {
    ...phase,
    'follows-ids': [],
  }

  setLatestMap(mapSongToMidiTicks())
}

// Re-export functions from their new locations
export {
  sortByNumberAfterColon,
  getAllPhaseBars,
  getAllPhaseBarNotes,
} from './phaseNotesUtil'
export { lookUpGraph } from './graphUtil'
export { getFollowingPhases } from './phaseRelationsUtil'

export const phaseExists = (phase: string) => {
  const { phases } = mem()
  return phases[phase] !== undefined
}

// update phase to have n bars.
export async function phaseCountInner(
  phase: string,
  size: number,
  skipCopy: boolean = false,
  rawTrackId: number | null = null
) {
  const { phases, notesByBar } = mem()
  let newPhaseId: number | null = null
  if (!phases[phase]) {
    const phaseData: Omit<PhaseRecord, 'id'> = {
      'follows-ids': [],
      barSizeMultiplier: 1,
      speed: null,
      scaleTonic: 'C',
      scaleName: 'major',
      name: phase,
    }

    const phaseId = await browser.userTables.add('phase', { data: phaseData })
    newPhaseId = z.number().parse(phaseId)
    const songPhase = phaseRecordSchema.parse({
      ...phaseData,
      id: z.number().parse(phaseId),
    })
    phases[phase] = songPhase
    const trackId = rawTrackId ? rawTrackId : mem()?.tracks?.[0]?.id
    if (typeof trackId === 'number') {
      const track = mem().tracks.find((track) => track.id === trackId)
      if (track) {
        track['phase-ids'].push(phases[phase].id)
        track['phase-names'].push(phase)
      } else {
        throw new Error(`Track ${trackId} not found`)
      }
    } else {
      throw new Error(
        `Track id is not a number ${JSON.stringify(mem().tracks, null, 2)}`
      )
    }
  }
  // get all the phase bars.
  let allBars = getAllPhaseBars(phase)

  if (allBars.length === 0) {
    const newBarTag = `${phase}:0`
    notesByBar[newBarTag] = []
    allBars = getAllPhaseBars(phase)
  }
  // if size is less than the number of bars, remove bars from the end.
  // if size is more than the number of bars, add bars to the end (copy the existing pattern fully or partially until the size is reached)
  // if size is the same as the number of bars, do nothing.
  if (allBars.length > size) {
    const barsToKeep = allBars.slice(0, size)
    mem().notesByBar = barsToKeep.reduce(
      (acc, barTag) => {
        acc[barTag] = notesByBar[barTag]
        return acc
      },
      {} as Record<string, NoteByBar[]>
    )
    // remove bars from mem().tracks
  } else if (allBars.length < size) {
    const barsToAdd = size - allBars.length

    const lastBar = allBars[allBars.length - 1]

    const lastBarNumber = parseInt(lastBar.split(':')[1])
    const lastBarNumberPlusOne = lastBarNumber + 1

    const copyGroup = `copied:${randId('', 3)}`
    for (let i = 0; i < barsToAdd; i++) {
      const barToCopy = allBars[i % allBars.length]
      const newBarTag = `${phase}:${lastBarNumberPlusOne + i}`
      notesByBar[newBarTag] = skipCopy
        ? []
        : notesByBar[barToCopy].map((note) => {
            const clonedNote = cloneNoteByBar(note)
            if (!clonedNote) {
              throw new Error(`could not clone note in ${barToCopy}`)
            }
            clonedNote.tagsObj.barId = [newBarTag]
            clonedNote.tagsObj.copyGroup = [copyGroup]
            clonedNote.tagsObj.noteId = [randId('', 6)]
            return clonedNote
          })
    }
  }
  return newPhaseId
}

// update phase to have n bars.
export async function phaseCount(
  phase: string,
  size: number,
  skipCopy: boolean = false,
  rawTrackId: number | null = null
) {
  await phaseCountInner(phase, size, skipCopy, rawTrackId)
  setLatestMap(mapSongToMidiTicks())
}
