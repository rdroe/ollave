
import { browser } from "user-tables"
import { phaseRecordSchema, songRecordSchema, trackRecordSchema } from "./schemas"
import { compileTracksToNotesByBar } from "./util/schemaUtil"
import { mem } from "../core/mem"
import { PhaseRecord, SongRecord, TrackRecord } from "./types"
import { getSongNames } from "./util/songNamesUtil"
import { deleteCueObservable, startCueObservable, stopCueObservable } from "../core/observables/songObservables"
import { mapSongToMidiTicks } from "./mapSongToTicks"
import { setLatestMap } from "../core/observables"
import { addSlider } from "./addSlider"


export const fetchLatestSongAndTracks = async () => {
    const song = (await (await browser.userTables.where('song', {})).sortBy('updatedAt')).reverse()[0]
    if (!song) {
        console.error('no song found')
        return null
    }
    return fetchSongAndTracks(song.id)
}

export const fetchSongAndTracksBySongId = async (songId: number) => {
    const song = await (await browser.userTables.where('song', { id: songId})).first()
    if (!song) {
        console.error('no song found')
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
            "track-ids": parsedSong["track-ids"] || []
        }
        mem().tracks = [latestSong.tracks[0]]
        mem().phases = latestSong.phases.reduce((acc, phase) => {
            acc[phase.name] = {
                id: phase.id,
                name: phase.name,
                "follows-ids": [],
                speed: 1,
                barSizeMultiplier: 1,
                scaleName: 'C major',
                scaleTonic: 'C'
            }
            return acc
        }, {} as { [phaseName: string]: PhaseRecord })
        return latestSong
    }
    await initLoadedSong()
    return latestSong
}



export async function fetchSongAndTracks(songId: number) {
  const coll = await (browser.userTables.where('song', { id: songId }))
  const fetched = await coll.first()
  // get the track ids  //
  const validSong = songRecordSchema.parse(fetched.data)
  const trackIds = validSong["track-ids"].map(([trackId]) => {
      return trackId
  }).filter((trackId) => {
      return trackId !== undefined
  })
  // now fetch each track
  const validatedTracks = await Promise.all(trackIds.map(async (trackId) => {
      const fetched = await (await browser.userTables.where('track', { id: trackId })).first()
      return trackRecordSchema.parse(fetched.data)
  }))

  const allDbPhases = (await (await browser.userTables.where('phase', {})).toArray()).map(({ data }) => data)
  const phases = await Promise.all(validatedTracks.flatMap((track) => track["phase-ids"].map(async (phaseId) => {
      const phase = allDbPhases.find((phase) => phase.id === phaseId)
      if (!phase) {
          throw new Error(`phase ${phaseId} not found`)
      }
      return phaseRecordSchema.parse(phase)
  })))

  return {
      song: validSong,
      tracks: validatedTracks,
      phases
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
            "track-ids": validSong["track-ids"] || []
        }
        mem().tracks = [latestSong.tracks[0]]
        mem().phases = latestSong.phases.reduce((acc, phase) => {
            acc[phase.name] = {
                id: phase.id,
                name: phase.name,
                "follows-ids": phase["follows-ids"] || [],
                speed: phase.speed || 1,
                barSizeMultiplier: phase.barSizeMultiplier || 1,
                scaleName: phase.scaleName || 'C major',
                scaleTonic: phase.scaleTonic || 'C'
            }
            return acc
        }, {} as { [phaseName: string]: PhaseRecord })
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
    setLatestMap(mapSongToMidiTicks())
    Object.entries(mem().notesByBar).forEach(([barId, notes]) => {
        notes.forEach((note) => {
            addSlider(barId, note.tagsObj.noteId[0].toString())
        })
    })

    startCueObservable()
    stopCueObservable()
    mem().adjustedCursor = 0
}

export async function initNewSong() {
  const songNames = await getSongNames()
  const shiftedOff = songNames.shift()
  const data: Omit<SongRecord, "id"> = {
      name: shiftedOff,
      tempo: 120,
      "track-ids": []
  }

  const createdId = await browser.userTables.add('song', {
      data
  })

  await browser.userTables.update('song', { id: createdId, data: {
      id: createdId
  } }, {})
  const refetched = await (await browser.userTables.where('song', { id: createdId })).first()
  mem().song = songRecordSchema.parse(refetched.data)
  await initNewTrack()
}

// set up a brand new track.
async function initNewTrack() {
  const trackRecord: Omit<TrackRecord, "id"> = {
      "phase-ids": [],
      "phase-names": [],
      notesByBar: {}
  }

  const trackId = await browser.userTables.add('track', { data: trackRecord })
  // update the track to have its id in data.
  await browser.userTables.update('track', { id: trackId, data: { id: trackId } }, {})
  await browser.userTables.update('song', {
      id: mem().song.id,
      data: {
          "track-ids": [[
              trackId, 0
          ]]
      },
  }, {})

  const coll = await (browser.userTables.where('song', { id: mem().song.id }))
  const fetched = await coll.first()
  const validSong = songRecordSchema.parse(fetched.data)
  const { "track-ids": songTracks } = validSong

  if (songTracks) {
      mem().tracks = [{
          id: songTracks[0][0],
          "phase-ids": [],
          "phase-names": [],
          notesByBar: {}
      }]
  } else {
      console.error("no tracks for song", mem().song.id)
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
