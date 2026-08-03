import { browser } from 'user-tables'

import { mem } from '../core/mem'
import { setLatestMap } from '../core/observables'
import {
  deleteCueObservable,
  startCueObservable,
  stopCueObservable,
} from '../core/observables/songObservables'

import { mapSongToMidiTicks } from './mapSongToTicks'
import {
  makeNoteByBar,
  NoteByBar,
  phaseRecordSchema,
  songRecordSchema,
  trackRecordSchema,
} from './schemas'
import { SongRecord, TrackRecord } from './types'
import { PhaseRecord } from './util/phaseTypes'
import { phaseCountInner, phaseFollowsPhaseInner } from './util/phaseUtil'
// Import the specific modules, NOT the './barTemplates' barrel: the barrel
// pulls in compile.ts, which imports the lib index — a cycle that left
// startCueObservable/compilationObservable uninitialized in the production
// bundle (blank page, "Cannot access X before initialization").
import { importBarTemplatesForSong } from './barTemplates/fetch'
import { BarTemplate } from './barTemplates/schemas'
import { compileTracksToNotesByBar } from './util/schemaUtil'
import { namesPromise } from './util/songNamesUtil'

export const fetchLatestSongAndTracks = async () => {
  const songs = (
    await (await browser.userTables.where('song', {})).sortBy('updatedAt')
  ).reverse()

  if (!songs.length) {
    console.error('no songs found')
    return null
  }
  return fetchSongAndTracks(songs[0].id)
}

export const fetchSongAndTracksBySongId = async (songId: number) => {
  const songs = (
    await (await browser.userTables.where('song', {})).sortBy('updatedAt')
  ).reverse()

  if (!songs.length) {
    console.error('no songs found')
    return null
  }
  const song = songs.find((song1) => {
    return song1.id === songId
  })
  if (!song) {
    console.error('song not found')
    return null
  }
  return fetchSongAndTracks(song.id)
}

export async function loadAndInitSongAndTracks(songId: number) {
  const latestSong = await fetchSongAndTracksBySongId(songId)
  if (latestSong) {
    const parsedSong = songRecordSchema.parse(latestSong.song)
    mem().song = {
      ...parsedSong,
      'track-ids': parsedSong['track-ids'] || [],
    }
    mem().tracks = [latestSong.tracks[0]]
    mem().phases = latestSong.phases.reduce(
      (acc, phase) => {
        acc[phase.name] = {
          id: phase.id,
          name: phase.name,
          'follows-ids': [],
          speed: 1,
          barSizeMultiplier: 1,
          scaleName: 'major',
          scaleTonic: 'C',
          ...(phase || {}),
        }
        return acc
      },
      {} as { [phaseName: string]: PhaseRecord }
    )
    return latestSong
  }
  await initLoadedSong()
  return latestSong
}

export async function fetchSongAndTracks(songId: number) {
  const coll = await browser.userTables.where('song', { id: songId })
  const fetched = await coll.first()
  // get the track ids  //
  const validSong = songRecordSchema.parse(fetched.data)
  const trackIds = validSong['track-ids']
    .map(([trackId]) => {
      return trackId
    })
    .filter((trackId) => {
      return trackId !== undefined
    })
  // now fetch each track
  const validatedTracks = await Promise.all(
    trackIds.map(async (trackId) => {
      const fetched = await (
        await browser.userTables.where('track', { id: trackId })
      ).first()
      return trackRecordSchema.parse(fetched.data)
    })
  )

  const allDbPhases = (
    await (await browser.userTables.where('phase', {})).toArray()
  ).map(({ data }) => data)
  const phases = await Promise.all(
    validatedTracks.flatMap((track) =>
      track['phase-ids'].map(async (phaseId) => {
        const phase = allDbPhases.find((phase) => phase.id === phaseId)
        if (!phase) {
          throw new Error(`phase ${phaseId} not found`)
        }
        return phaseRecordSchema.parse(phase)
      })
    )
  )

  return {
    song: validSong,
    tracks: validatedTracks,
    phases,
  }
}

export async function loadAndInitLatestSongAndTracks() {
  const latestSong = await fetchLatestSongAndTracks()
  if (latestSong) {
    const validSong = songRecordSchema.parse(latestSong.song)
    if (!validSong.id) {
      throw new Error('song id is required')
    }
    mem().song = {
      ...validSong,
      id: validSong.id,
      'track-ids': validSong['track-ids'] || [],
    }
    mem().tracks = [latestSong.tracks[0]]
    mem().phases = latestSong.phases.reduce(
      (acc, phase) => {
        acc[phase.name] = {
          id: phase.id,
          name: phase.name,
          'follows-ids': phase['follows-ids'] || [],
          speed: phase.speed || 1,
          barSizeMultiplier: phase.barSizeMultiplier || 1,
          scaleName: phase.scaleName || 'C major',
          scaleTonic: phase.scaleTonic || 'C',
        }
        return acc
      },
      {} as { [phaseName: string]: PhaseRecord }
    )
    return latestSong
  }
  return null
}

export async function initLoadedSong() {
  // first clear any existing dom elements with the class note-slider

  let previousSongName: null | string = null
  let previousSongId: null | number = null

  if (mem().song) {
    previousSongName = mem().song.name
    previousSongId = mem().song.id
    stopCueObservable()
    deleteCueObservable(previousSongName)
  }

  const sliders = document.querySelectorAll('.note-slider')
  sliders.forEach((slider) => {
    slider.remove()
  })
  compileTracksToNotesByBar()
  await setLatestMap(mapSongToMidiTicks())
  // addSlider functionality removed - not used by web app

  startCueObservable()
  stopCueObservable()
  mem().adjustedCursor = 0
}

export async function initNewSong() {
  const songNames = mem().songNames
  // songNames is filled by an async import in songUtil, so on a cold load it is
  // still empty here, and shifting it leaves name undefined so the
  // songRecordSchema.parse below throws. Wait for it, but cap the wait — if that
  // import fails the promise never settles and song creation would hang.
  if (songNames.length === 0) {
    await Promise.race([
      namesPromise,
      new Promise((res) => setTimeout(res, 3000)),
    ])
  }
  const shiftedOff = songNames.shift() ?? `song-${Date.now()}`
  const data: Omit<SongRecord, 'id'> = {
    name: shiftedOff,
    tempo: 120,
    'track-ids': [],
  }

  const createdId = await browser.userTables.add('song', {
    data,
  })

  await browser.userTables.update(
    'song',
    {
      id: createdId,
      data: {
        id: createdId,
      },
    },
    {}
  )
  const refetched = await (
    await browser.userTables.where('song', { id: createdId })
  ).first()
  mem().song = songRecordSchema.parse(refetched.data)
  await initNewTrack()
  return createdId
}

// set up a brand new track.
async function initNewTrack() {
  const trackRecord: Omit<TrackRecord, 'id'> = {
    'phase-ids': [],
    'phase-names': [],
    notesByBar: {},
  }

  const trackId = await browser.userTables.add('track', { data: trackRecord })
  // update the track to have its id in data.
  await browser.userTables.update(
    'track',
    { id: trackId, data: { id: trackId } },
    {}
  )
  await browser.userTables.update(
    'song',
    {
      id: mem().song.id,
      data: {
        'track-ids': [[trackId, 0]],
      },
    },
    {}
  )

  const coll = await browser.userTables.where('song', { id: mem().song.id })
  const fetched = await coll.first()
  const validSong = songRecordSchema.parse(fetched.data)
  const { 'track-ids': songTracks } = validSong

  if (songTracks) {
    mem().tracks = [
      {
        id: songTracks[0][0],
        'phase-ids': [],
        'phase-names': [],
        notesByBar: {},
      },
    ]
  } else {
    console.error('no tracks for song', mem().song.id)
  }
}
export async function initLatestOrNewSong() {
  const didLoadLatest = await loadAndInitLatestSongAndTracks()
  if (didLoadLatest) {
    initLoadedSong()
    return
  }
  await initNewSong()
  return initLoadedSong()
}

export async function duplicateCurrentSong() {
  const origMem = {
    ...mem(),
  }
  const origName = mem().song.name
  const notesByBar = Object.fromEntries(
    Object.entries(mem().notesByBar).map(([barId, notes]) => [
      barId,
      notes.map((note) => {
        return makeNoteByBar(note.note, note.tags)
      }),
    ])
  )
  const newSongId = await initNewSong()
  await initLoadedSong()
  const {
    song: { name: newName },
  } = await loadAndInitSongAndTracks(newSongId)

  // init phases for each current phase.
  const newPhaseToNameHash: Record<number, string> = {}
  const oldPhaseToNameHash: Record<number, string> = {}
  await Promise.all(
    Object.entries(origMem.phases).map(async ([phaseName, phase]) => {
      oldPhaseToNameHash[phase.id] = phaseName
      // get phase count by looking at notesByBar; increment for every bar starting with phaseNane:
      const phaseCount = Object.keys(notesByBar).filter((barId) => {
        return barId.startsWith(phaseName)
      }).length
      const newPhaseId = await phaseCountInner(phaseName, phaseCount, true)
      mem().phases[phaseName].scaleName = phase.scaleName
      mem().phases[phaseName].scaleTonic = phase.scaleTonic
      mem().phases[phaseName].speed = phase.speed
      mem().phases[phaseName].barSizeMultiplier = phase.barSizeMultiplier
      newPhaseToNameHash[newPhaseId] = phaseName
    })
  )
  await Promise.all(
    Object.entries(oldPhaseToNameHash).map(async ([_, oldPhaseName]) => {
      const phase = origMem.phases[oldPhaseName]
      const followsIds = phase['follows-ids'] || []
      const subjectNames = followsIds.map((followId) => {
        return oldPhaseToNameHash[followId]
      })
      await phaseFollowsPhaseInner(oldPhaseName, subjectNames)
    })
  )
  mem().song.name = `${newName} <- ${origName}`
  mem().notesByBar = notesByBar

  await setLatestMap(mapSongToMidiTicks())
  return newSongId
}

export async function importSongAndTracks(songAndTracks: { song: Omit<SongRecord, 'id'>, tracks: (Omit<TrackRecord, 'id'>)[], phases: Omit<PhaseRecord, 'id'>[], barTemplates?: Omit<BarTemplate, 'id'>[] }) {

  const { song, tracks, phases } = songAndTracks
  const memPhases = phases.reduce((acc, phase, idx) => {
      acc[idx] = phase
      return acc
    }, {} as { [phaseName: string]: Omit<PhaseRecord, 'id'> })

  const notesByBar: Record<string, NoteByBar[]> = {} 
  tracks.forEach((track) => {
      const barIds = Object.keys(track.notesByBar) 
      barIds.forEach((barId) => {
          notesByBar[barId] = track.notesByBar[barId].map((note) => {
              return makeNoteByBar(note.note, note.tags)
          })
      })
  })
  const newSongId = await initNewSong()
  await initLoadedSong()
  const {
      song: { name: newName },
    } = await loadAndInitSongAndTracks(newSongId)
  const origName = song.name
  // init phases for each current phase.
  const newPhaseToNameHash: Record<number, string> = {}
  const oldPhaseToNameHash: Record<number, string> = {}
  await Promise.all(
    Object.entries(memPhases).map(async ([_, phase], idx) => {
      const phaseName = phase.name
      oldPhaseToNameHash[idx] = phaseName
      // get phase count by looking at notesByBar; increment for every bar starting with phaseNane:
      const phaseCount = Object.keys(notesByBar).filter((barId) => {
        return barId.startsWith(phaseName)
      }).length
      const newPhaseId = await phaseCountInner(phaseName, phaseCount, true)
      mem().phases[phaseName].scaleName = phase.scaleName
      mem().phases[phaseName].scaleTonic = phase.scaleTonic
      mem().phases[phaseName].speed = phase.speed
      mem().phases[phaseName].barSizeMultiplier = phase.barSizeMultiplier
      newPhaseToNameHash[newPhaseId] = phaseName
    })
  )

  await Promise.all(
    Object.entries(oldPhaseToNameHash).map(async ([_, oldPhaseName]) => {

      const phase = memPhases[oldPhaseName]
      const followsIds = phase?.['follows-ids'] || []
      const subjectNames = followsIds.map((followId) => {
        return oldPhaseToNameHash[followId]
      })
      await phaseFollowsPhaseInner(oldPhaseName, subjectNames)
    })
  )

  mem().song.name = `${newName} <- imported <- ${origName}`
  mem().notesByBar = notesByBar

  // Bar templates: recreate them under the new song and repoint the
  // customBarId tags on placed notes at the new row ids, so the imported
  // song's locked bars stay editable and keep propagating. Older exports have
  // no barTemplates key — placements still import, just without their
  // templates (previous behavior).
  const barTemplates = (
    songAndTracks as { barTemplates?: Omit<BarTemplate, 'id'>[] }
  ).barTemplates
  if (barTemplates?.length) {
    // The export drops row ids, so recover each template's OLD id from the
    // placements themselves (customBar=<name> travels with customBarId).
    const oldIdsByName: { [name: string]: number } = {}
    Object.values(notesByBar).forEach((notes) => {
      notes.forEach((note) => {
        const tags = note.tags || []
        const nameTag = tags.find((t: string) => t.startsWith('customBar='))
        const idTag = tags.find((t: string) => t.startsWith('customBarId='))
        if (nameTag && idTag) {
          const name = nameTag.slice('customBar='.length)
          const oldId = Number(idTag.slice('customBarId='.length))
          if (!Number.isNaN(oldId)) {
            oldIdsByName[name] = oldId
          }
        }
      })
    })
    const idMap = await importBarTemplatesForSong(
      newSongId,
      barTemplates,
      oldIdsByName
    )
    if (Object.keys(idMap).length) {
      Object.entries(notesByBar).forEach(([barId, notes]) => {
        notesByBar[barId] = notes.map((note) => {
          const tags = note.tags || []
          const idx = tags.findIndex((t: string) =>
            t.startsWith('customBarId=')
          )
          if (idx === -1) return note
          const oldId = Number(tags[idx].slice('customBarId='.length))
          const newId = idMap[oldId]
          if (newId === undefined) return note
          const rebuilt = [...tags]
          rebuilt[idx] = `customBarId=${newId}`
          // Rebuilt, not mutated: makeNoteByBar keeps tags/_tags/tagsObj in
          // sync internally.
          return makeNoteByBar(note.note, rebuilt)
        })
      })
    }
  }

  await setLatestMap(mapSongToMidiTicks())
  return newSongId
}

// import utils for file input and download

export const addFileInputIfNotExists = () => {
  if (document.getElementById('file-input')) {
      return
  }
  const fileInput = document.createElement('input')
  // assign an id to the file input
  fileInput.id = 'file-input'
  fileInput.type = 'file'
  fileInput.accept = 'application/json' 
  fileInput.style.visibility = 'hidden'
  fileInput.onchange = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (event) => {
        const json = JSON.parse(event.target?.result as string)
        await importSongAndTracks(json)
      }
      reader.readAsText(file)
    }
  }
  document.body.appendChild(fileInput)
}

export const clickFileInput = () => {
  const fileInput = document.getElementById('file-input') as HTMLInputElement
  if (fileInput) {
      fileInput.click()
  }
}

export function downloadJson(json: BlobPart[], name = 'song.json') {
  const blob = new Blob(json, { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
}