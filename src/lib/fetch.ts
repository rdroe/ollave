import { browser } from 'user-tables'
import { z } from 'zod'

import { mem } from '../core/mem'
// Specific module, NOT the '../core/observables' barrel: the barrel re-exports
// songObservables, which imports lib/music.ts and constructs a Tone.js Piano at
// module scope. Importing fetch.ts should not start loading audio samples.
import { setLatestMap } from '../core/observables/compilationObservable'
import {
  deleteCueObservable,
  startCueObservable,
  stopCueObservable,
} from '../core/observables/songObservables'

import { mapSongToMidiTicks } from './mapSongToTicks'
import { setTrackInstruments } from './music'
import {
  makeNoteByBar,
  NoteByBar,
  phaseRecordSchema,
  songRecordSchema,
  trackInstrument,
  trackRecordSchema,
} from './schemas'
import { SongRecord, TrackRecord } from './types'
import { PhaseRecord } from './util/phaseTypes'
import { phaseCountInner, phaseFollowsPhaseInner } from './util/phaseUtil'
// Import the specific modules, NOT the './barTemplates' barrel: the barrel
// pulls in compile.ts, which imports the lib index — a cycle that left
// startCueObservable/compilationObservable uninitialized in the production
// bundle (blank page, "Cannot access X before initialization").
import {
  importBarTemplatesForSong,
  listBarTemplates,
} from './barTemplates/fetch'
import { BarTemplate } from './barTemplates/schemas'
import {
  compileNotesByBarToTracks,
  compileTracksToNotesByBar,
  saveSongAndTracksAwaited,
} from './util/schemaUtil'
import { createTrack } from './songApi'
import { namesPromise } from './util/songNamesUtil'

export const fetchLatestSongAndTracks = async () => {
  const songs = (
    await (await browser.userTables.where('song', {})).sortBy('updatedAt')
  ).reverse()

  if (!songs.length) {
    console.error('no songs found')
    return null
  }
  const [latest] = songs
  if (latest.id === undefined) {
    console.error('latest song has no id')
    return null
  }
  return fetchSongAndTracks(latest.id)
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
  if (!song || song.id === undefined) {
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
    // Every track, not just the first: truncating here silently discarded the
    // other tracks' phases and notes, and saveSongAndTracks() then wrote that
    // truncated mem() back over the stored song.
    mem().tracks = latestSong.tracks
    setTrackInstruments(mem().tracks.map((t, i) => trackInstrument(t, i)))
    mem().phases = latestSong.phases.reduce(
      (acc, phase) => {
        // id/name/'follows-ids'/barSizeMultiplier are always present on the
        // spread phase, so listing them before it was dead code
        acc[phase.name] = {
          speed: 1,
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
  if (!fetched) {
    throw new Error(`song ${songId} not found`)
  }
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
      if (!fetched) {
        throw new Error(`track ${trackId} not found`)
      }
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
    // Every track — see loadAndInitSongAndTracks above.
    mem().tracks = latestSong.tracks
    setTrackInstruments(mem().tracks.map((t, i) => trackInstrument(t, i)))
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

  const currentSong = mem().song
  if (currentSong) {
    previousSongName = currentSong.name
    previousSongId = currentSong.id ?? null
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
  if (!refetched) {
    throw new Error(`created song ${createdId} not found`)
  }
  mem().song = songRecordSchema.parse(refetched.data)
  // Switching songs: drop the previous song's tracks/phases before creating
  // the new song's first track. initNewTrack() appends, so leaving them would
  // make the new song inherit the old song's tracks.
  mem().tracks = []
  mem().phases = {}
  mem().notesByBar = {}
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

  const memSong = mem().song
  if (!memSong) {
    throw new Error('cannot init a track without a song in memory')
  }

  const trackId = await browser.userTables.add('track', { data: trackRecord })
  // update the track to have its id in data.
  await browser.userTables.update(
    'track',
    { id: trackId, data: { id: trackId } },
    {}
  )
  // APPEND: writing a fresh single-element array here dropped every track the
  // song already had. Harmless for the brand-new song this is called for, but
  // the array is the authoritative track order, so it must never be replaced.
  const existingTrackIds = memSong['track-ids'] ?? []
  const nextTrackIds: [number, number][] = [
    ...existingTrackIds,
    [z.number().parse(trackId), 0],
  ]
  await browser.userTables.update(
    'song',
    {
      id: memSong.id,
      data: {
        'track-ids': nextTrackIds,
      },
    },
    {}
  )

  const coll = await browser.userTables.where('song', { id: memSong.id })
  const fetched = await coll.first()
  if (!fetched) {
    throw new Error(`song ${memSong.id} not found while creating track`)
  }
  const validSong = songRecordSchema.parse(fetched.data)
  const { 'track-ids': songTracks } = validSong

  if (songTracks?.length) {
    memSong['track-ids'] = songTracks
    // Only the track just created is appended to mem(); the rest are left
    // alone. This is called on a brand-new song, so mem().tracks is normally
    // empty — rebuilding every entry as an empty track would blank the
    // phases/notes of any track that did exist.
    mem().tracks = [
      ...mem().tracks,
      {
        id: z.number().parse(trackId),
        'phase-ids': [],
        'phase-names': [],
        notesByBar: {},
      },
    ]
  } else {
    console.error('no tracks for song', memSong.id)
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

/**
 * The shape duplicate and import both rebuild from: ordered tracks, each with
 * its phases in order, plus the flattened bar map.
 */
type RebuildSource = {
  tracks: {
    name?: string
    channel?: number
    phases: {
      name: string
      barCount: number
      /** Names of the phases this one follows, resolved in a second pass. */
      followsNames: string[]
      scaleName?: string | null
      scaleTonic?: string | null
      speed?: number | null
      barSizeMultiplier?: number | null
    }[]
  }[]
  notesByBar: Record<string, NoteByBar[]>
}

/**
 * Rebuild a song's tracks/phases into the CURRENTLY LOADED (freshly created)
 * song, preserving track membership and follows edges.
 *
 * Three passes, deliberately sequential:
 *   1. create every target track, so a phase can be attached to the right one;
 *   2. create every phase, recording old name -> new id;
 *   3. apply follows edges, which can only be resolved once every id exists.
 *
 * The old code did one concurrent pass through phaseCountInner() with no
 * track id, which put every phase of every track onto track 0.
 */
async function rebuildSongFromSource(source: RebuildSource) {
  const memSong = mem().song
  if (!memSong) {
    throw new Error('cannot rebuild: no song in memory')
  }

  // initNewSong() already made one empty track; reuse it as track 0 so the
  // rebuilt song has exactly as many tracks as the source.
  const trackIds: number[] = mem().tracks.map((t) => t.id)

  for (let i = 0; i < source.tracks.length; i += 1) {
    const spec = source.tracks[i]
    if (i < trackIds.length) {
      const existing = mem().tracks[i]
      if (spec.name !== undefined) existing.name = spec.name
      if (spec.channel !== undefined) existing.channel = spec.channel
      await browser.userTables.update(
        'track',
        { id: existing.id, data: existing },
        {}
      )
    } else {
      const created = await createTrack({
        name: spec.name,
        channel: spec.channel,
      })
      trackIds.push(created)
    }
  }

  // Pass 2: phases, onto their own tracks, as roots for now.
  const newPhaseIdByName: { [phaseName: string]: number } = {}
  for (let i = 0; i < source.tracks.length; i += 1) {
    const trackId = trackIds[i]
    for (const phase of source.tracks[i].phases) {
      const newPhaseId = await phaseCountInner(
        phase.name,
        phase.barCount,
        true,
        trackId
      )
      if (newPhaseId != null) {
        newPhaseIdByName[phase.name] = newPhaseId
      }
      const created = mem().phases[phase.name]
      if (created) {
        created.scaleName = phase.scaleName ?? created.scaleName
        created.scaleTonic = phase.scaleTonic ?? created.scaleTonic
        created.speed = phase.speed ?? created.speed
        created.barSizeMultiplier =
          phase.barSizeMultiplier ?? created.barSizeMultiplier
        if (created.id != null) {
          newPhaseIdByName[phase.name] = created.id
        }
      }
    }
  }

  // Pass 3: follows edges, now that every phase has an id.
  for (const track of source.tracks) {
    for (const phase of track.phases) {
      if (!phase.followsNames.length) continue
      const target = mem().phases[phase.name]
      if (!target) continue
      target['follows-ids'] = phase.followsNames
        .map((parentName) => newPhaseIdByName[parentName])
        .filter((id): id is number => typeof id === 'number')
    }
  }

  mem().notesByBar = source.notesByBar
  // Bars belong to the track that owns their phase; without this the flattened
  // map never reaches the per-track rows that get saved.
  compileNotesByBarToTracks()
  await saveSongAndTracksAwaited()
}

/** Snapshot the loaded song into the rebuild shape. */
const rebuildSourceFromMem = (): RebuildSource => {
  const phaseNameById: { [id: number]: string } = {}
  Object.values(mem().phases).forEach((phase) => {
    phaseNameById[phase.id] = phase.name
  })

  const notesByBar = Object.fromEntries(
    Object.entries(mem().notesByBar).map(([barId, notes]) => [
      barId,
      notes.map((note) => makeNoteByBar(note.note, note.tags)),
    ])
  )

  return {
    tracks: mem().tracks.map((track) => ({
      name: track.name,
      channel: track.channel,
      phases: track['phase-names'].map((phaseName) => {
        const phase = mem().phases[phaseName]
        const barCount = Object.keys(notesByBar).filter((barId) =>
          barId.startsWith(`${phaseName}:`)
        ).length
        return {
          name: phaseName,
          barCount,
          followsNames: (phase?.['follows-ids'] ?? [])
            .map((id) => phaseNameById[id])
            .filter((name): name is string => typeof name === 'string'),
          scaleName: phase?.scaleName,
          scaleTonic: phase?.scaleTonic,
          speed: phase?.speed,
          barSizeMultiplier: phase?.barSizeMultiplier,
        }
      }),
    })),
    notesByBar,
  }
}

/**
 * Recreate the source song's templates under the duplicate and repoint the
 * copy's `customBarId=` placements at the new rows.
 *
 * Simpler than the import equivalent in one way: the source rows still exist,
 * so their old ids come straight off the records instead of being recovered
 * from the placements. The repointing itself is identical — a placement left
 * pointing at the ORIGINAL song's template would make edits to one song
 * silently rewrite bars in the other.
 */
async function copyBarTemplatesToDuplicate(
  sourceSongId: number | undefined,
  newSongId: number
) {
  if (sourceSongId === undefined) return
  const sourceTemplates = await listBarTemplates(sourceSongId)
  if (!sourceTemplates.length) return

  const oldIdsByName: { [name: string]: number } = {}
  sourceTemplates.forEach((t) => {
    if (t.id !== undefined) oldIdsByName[t.name] = t.id
  })
  const stripped = sourceTemplates.map(({ id: _id, ...rest }) => ({
    ...rest,
    songId: newSongId,
  }))
  const idMap = await importBarTemplatesForSong(
    newSongId,
    stripped,
    oldIdsByName
  )
  if (!Object.keys(idMap).length) return

  const notesByBar = mem().notesByBar
  Object.entries(notesByBar).forEach(([barId, notes]) => {
    notesByBar[barId] = notes.map((note) => {
      const tags = note.tags || []
      const idx = tags.findIndex((t: string) => t.startsWith('customBarId='))
      if (idx === -1) return note
      const oldId = Number(tags[idx].slice('customBarId='.length))
      const newId = idMap[oldId]
      if (newId === undefined) return note
      const rebuilt = [...tags]
      rebuilt[idx] = `customBarId=${newId}`
      // Rebuilt, not mutated: makeNoteByBar keeps tags/_tags/tagsObj in sync.
      return makeNoteByBar(note.note, rebuilt)
    })
  })
  compileNotesByBarToTracks()
}

export async function duplicateCurrentSong() {
  const origSong = mem().song
  if (!origSong) {
    throw new Error('cannot duplicate: no song in memory')
  }
  const origName = origSong.name
  const source = rebuildSourceFromMem()

  const newSongId = await initNewSong()
  await initLoadedSong()
  const loaded = await loadAndInitSongAndTracks(newSongId)
  if (!loaded) {
    throw new Error(`could not load duplicated song ${newSongId}`)
  }
  const {
    song: { name: newName },
  } = loaded

  await rebuildSongFromSource(source)

  // Bar templates and bar documents travel with the copy, exactly as they do
  // through export/import. Without this a duplicated song kept its locked
  // notes but lost the templates behind them, so those bars could no longer
  // be edited or propagated — and every focused bar document was gone.
  await copyBarTemplatesToDuplicate(origSong.id, newSongId)

  const duplicatedSong = mem().song
  if (duplicatedSong) {
    duplicatedSong.name = `${newName} <- ${origName}`
    await browser.userTables.update(
      'song',
      { id: duplicatedSong.id, data: duplicatedSong },
      {}
    )
  }

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
  // Phase id -> name, from the EXPORTED phase rows, so follows edges can be
  // remapped by name onto the new ids. The old code keyed this hash by the
  // phase's array index while looking it up by stored id, so any song whose
  // phase ids were not 0,1,2… lost its follows edges on import.
  const exportedPhaseNameById: { [id: number]: string } = {}
  phases.forEach((phase) => {
    const id = (phase as PhaseRecord).id
    if (typeof id === 'number') {
      exportedPhaseNameById[id] = phase.name
    }
  })

  const phaseByName: { [name: string]: Omit<PhaseRecord, 'id'> } = {}
  phases.forEach((phase) => {
    phaseByName[phase.name] = phase
  })

  const source: RebuildSource = {
    tracks: tracks.map((track) => ({
      name: track.name,
      channel: track.channel,
      phases: track['phase-names'].map((phaseName) => {
        const phase = phaseByName[phaseName]
        return {
          name: phaseName,
          barCount: Object.keys(notesByBar).filter((barId) =>
            barId.startsWith(`${phaseName}:`)
          ).length,
          followsNames: (phase?.['follows-ids'] ?? [])
            .map((id) => exportedPhaseNameById[id])
            .filter((name): name is string => typeof name === 'string'),
          scaleName: phase?.scaleName,
          scaleTonic: phase?.scaleTonic,
          speed: phase?.speed,
          barSizeMultiplier: phase?.barSizeMultiplier,
        }
      }),
    })),
    notesByBar,
  }

  const newSongId = await initNewSong()
  await initLoadedSong()
  const loaded = await loadAndInitSongAndTracks(newSongId)
  if (!loaded) {
    throw new Error(`could not load imported song ${newSongId}`)
  }
  const {
      song: { name: newName },
    } = loaded
  const origName = song.name

  await rebuildSongFromSource(source)

  const importedSong = mem().song
  if (importedSong) {
    importedSong.name = `${newName} <- imported <- ${origName}`
    await browser.userTables.update(
      'song',
      { id: importedSong.id, data: importedSong },
      {}
    )
  }

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