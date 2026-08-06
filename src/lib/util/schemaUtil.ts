import { browser } from 'user-tables'

import { mem } from '../../core/mem'
import {
  makeNoteByBar,
  NoteByBar,
  notesByBarSchema,
  songRecordSchema,
} from '../schemas'

import { PhaseRecord } from './phaseTypes'
import { SongRecord, TrackRecord } from '../types'

export function initNotesByBar() {
  songRecordSchema.parse(mem().song)
  const notesByBar = mem().tracks.reduce(
    (acc, track) => {
      return {
        ...acc,
        ...track.notesByBar,
      }
    },
    {} as Record<string, NoteByBar[]>
  )
  mem().notesByBar = notesByBarSchema.parse(notesByBar)
}

export function compileNotesByBarToTracks() {
  songRecordSchema.parse(mem().song)
  const { tracks } = mem()
  const notesByBar = notesByBarSchema.parse(mem().notesByBar)

  Object.keys(notesByBar).forEach((barId) => {
    const phaseIdForBar = barId.split(':')[0]
    const owningTrack = tracks.find((track) =>
      track['phase-names'].includes(phaseIdForBar)
    )
    if (owningTrack) {
      owningTrack.notesByBar[barId] = notesByBar[barId]
      // remove excess bars from owningTrack.notesByBar
      const trackBarsToRemove = Object.keys(owningTrack.notesByBar).filter(
        (barId) => !Object.keys(notesByBar).includes(barId)
      )
      trackBarsToRemove.forEach((barId) => {
        delete owningTrack.notesByBar[barId]
      })
    }
  })
  mem().tracks = tracks
}

export function compilePhasesToTracks() {
  // get the phase names, then temp ids of phases that have bars in notesByBar
  const activePhaseNames = Object.keys(mem().notesByBar).map((barTag) => {
    return barTag.split(':')[0]
  })
  const activePhaseTempIds = activePhaseNames.map((phaseName) => {
    return mem().phases[phaseName]?.id
  })
  const deleteablePhaseTempIds = [
    ...new Set(mem().tracks.flatMap((track) => track['phase-ids'])),
  ].filter((tempId) => !activePhaseTempIds.includes(tempId))
  // filter out any phases that are not in activePhaseTempIds; same for names
  mem().tracks.forEach((track) => {
    track['phase-ids'] = track['phase-ids'].filter(
      (tempId) => !deleteablePhaseTempIds.includes(tempId)
    )
    track['phase-names'] = track['phase-names'].filter((phaseName) =>
      activePhaseNames.includes(phaseName)
    )
  })
  // clean up phases in memory
  mem().phases = Object.values(mem().phases)
    .filter((phase) => activePhaseTempIds.includes(phase.id))
    .reduce(
      (acc, phase) => {
        acc[phase.name] = {
          id: phase.id,
          name: phase.name,
          'follows-ids': phase['follows-ids'] || [],
          barSizeMultiplier: phase.barSizeMultiplier || 1,
          speed: phase.speed || 1,
          scaleName: phase.scaleName || 'C major',
          scaleTonic: phase.scaleTonic || 'C',
        }
        return acc
      },
      {} as { [phaseName: string]: PhaseRecord }
    )
}

// make the notesByBar from tracks live on the song.
export function compileTracksToNotesByBar() {
  const { tracks } = mem()
  const notesByBar = tracks.reduce(
    (acc, track) => {
      return {
        ...acc,
        ...Object.fromEntries(
          Object.entries(track.notesByBar).map(([barId, notes]) => [
            barId,
            notes.map((note) => makeNoteByBar(note.note, note.tags)),
          ])
        ),
      }
    },
    {} as Record<string, NoteByBar[]>
  )
  mem().notesByBar = notesByBar
}

export function compileTracksToPhasesProperties() {
  const { tracks } = mem()
  tracks.forEach((track, idx) => {
    track['phase-names'].forEach((phaseName, idx) => {
      const existingPhase = mem().phases[phaseName]
      // same merge as before: an existing phase's own props always win over
      // the defaults, written as a conditional so no key is dead code
      const phaseRecord: PhaseRecord = existingPhase
        ? {
            speed: 1,
            scaleName: 'major',
            scaleTonic: 'C',
            ...existingPhase,
          }
        : {
            id: track['phase-ids'][idx],
            name: phaseName,
            'follows-ids': [],
            speed: 1,
            barSizeMultiplier: 1,
            scaleName: 'major',
            scaleTonic: 'C',
          }
      mem().phases[phaseName] = phaseRecord
    })
  })
}

export function saveSongAndTracks() {
  const song = mem().song
  if (!song) {
    throw new Error('cannot save: no song in memory')
  }
  const songId = song.id
  browser.userTables.update('song', { id: songId, data: song }, {})
  Object.values(mem().phases).forEach((phase) => {
    browser.userTables.update(
      'phase',
      { id: phase.id, data: phase },
      {
        id: phase.id,
      }
    )
  })
  mem().tracks.forEach((track) => {
    browser.userTables.update('track', { id: track.id, data: track }, {})
  })
}
/**
 * Bar templates are fetched separately (async, from their own table) and
 * attached by the export command — see exportBarTemplatesForSong. Kept out of
 * this sync function so its signature and every existing caller stay intact.
 */
export function exportSongAndTracks(): {
  song: Omit<SongRecord, 'id'>,
  tracks: (Omit<TrackRecord, 'id'>)[],
  phases: Omit<PhaseRecord, 'id'>[]
} {
  const song = mem().song
  if (!song) {
    throw new Error('cannot export: no song in memory')
  }

  return {
    song: {
      name: song.name,
      tempo: song.tempo,
      'track-ids': [],

    },
    tracks: mem().tracks.map((track) => ({
      id: track.id,
      'phase-ids': track['phase-ids'],
      'phase-names': track['phase-names'],
      notesByBar: track.notesByBar,
    })),
    phases: Object.values(mem().phases).map((phase) => ({
      id: phase.id,
      name: phase.name,
      'follows-ids': phase['follows-ids'],
      speed: phase.speed,
      barSizeMultiplier: phase.barSizeMultiplier,
      scaleName: phase.scaleName,
      scaleTonic: phase.scaleTonic,
    })),
  }
}