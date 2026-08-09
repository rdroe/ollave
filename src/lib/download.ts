import Midi from 'jsmidgen'

import { parseColonTag } from './util/parseColonTag'
import { trackTempo as startTempo } from '../core/observables/masterTicksObservable'

import { mem } from '../core/mem'

import { MidiMap } from './mapSongToTicks'
import { addEvents, ensureTracks, saveRaw } from './midi'
import { DEFAULT_TRACK_IDX, RelativeNote } from './music'
import { tagsObjSchema, trackChannel } from './schemas'

type IncomingEvent =
  | {
      note: string
      abso: number
      onOrOff: 'on' | 'off'
      velocity?: number
      trackIdx?: number
    }
  | {
      tempo: number
      abso: number
      onOrOff: 'tempo'
      trackIdx?: number
    }

const downloadEvents = async (
  notes: RelativeNote[],
  tempo: number | null = startTempo,
  trackCount: number = 0,
  channels: number[] = []
) => {
  const midiTracks: Midi.Track[] = []
  const file = new Midi.File()
  // Declared song-track order, before any event is written, so track order is
  // the song's rather than first-note-encounter order.
  ensureTracks(midiTracks, trackCount, tempo, file)
  addEvents(midiTracks, notes, tempo, file, channels)
  const midi = file.toBytes()
  saveRaw(midi)
  return { downloaded: notes }
}

const addNoteEvent = (
  obj: {
    [tick: number]: IncomingEvent[]
  },
  tickNum: number,
  onOrOff: 'on' | 'off' | 'tempo',
  noteOrBpm: string | number,
  velocity?: number,
  trackIdx?: number
) => {
  obj[tickNum] = obj[tickNum] || []
  if (onOrOff === 'tempo') {
    if (typeof noteOrBpm !== 'number') {
      throw new Error('Tempo must be a number')
    }
    obj[tickNum].push({
      tempo: noteOrBpm,
      abso: tickNum,
      onOrOff,
      trackIdx,
    })
  } else {
    if (typeof noteOrBpm !== 'string') {
      throw new Error('Note must be a string')
    }
    obj[tickNum].push({
      note: noteOrBpm,
      abso: tickNum,
      onOrOff,
      velocity,
      trackIdx,
    })
  }
}
const findBarId = (compositionTags: string[]) => {
  // convert tag list to tagsObj
  const tagsObj = tagsObjSchema.parse(compositionTags)
  return tagsObj.barId?.[0]
}
const getPhaseId = (compositionTags: string[]): string | null => {
  const barId = findBarId(compositionTags)
  if (!barId || typeof barId !== 'string') {
    return null
  }
  const parsed = parseColonTag(barId)
  if (!parsed) {
    return null
  }
  return parsed[0]
}

/**
 * phaseName -> song track index, from the song's own track order.
 *
 * Replaces first-note-encounter numbering, which made a note's MIDI track
 * depend on playback order rather than on which track actually owns its phase.
 */
export const buildPhaseTrackIndex = (
  tracks: { 'phase-names': string[] }[]
): { [phaseName: string]: number } => {
  const map: { [phaseName: string]: number } = {}
  tracks.forEach((track, trackIdx) => {
    track['phase-names'].forEach((phaseName) => {
      map[phaseName] = trackIdx
    })
  })
  return map
}

const songToEvents = async (
  mappedTicks: MidiMap,
  phaseTrackIndex: { [phaseName: string]: number } = {}
) => {
  const noteEvents: {
    [tick: number]: IncomingEvent[]
  } = {}

  const warnedPhases = new Set<string>()

  const relativized: RelativeNote[] = []
  // go through all the tickes, each of which has a list of notes
  Object.entries(mappedTicks).forEach(([tickRaw, notes]) => {
    notes.forEach((n) => {
      // Resolve the note's owning track through its phase.
      const phaseName = getPhaseId(n.compositionTags)
      let trackIdx = DEFAULT_TRACK_IDX
      if (phaseName !== null) {
        const mapped = phaseTrackIndex[phaseName]
        if (typeof mapped === 'number') {
          trackIdx = mapped
        } else if (!warnedPhases.has(phaseName)) {
          // An unknown phase means the note's bar id names a phase no track
          // claims — a data defect. Fall back to track 0 rather than dropping
          // the note, but say so once per phase.
          warnedPhases.add(phaseName)
          console.warn(
            `MIDI export: phase "${phaseName}" belongs to no track; writing its notes to track 0`
          )
        }
      }
      // if the note is a tempo event, add the tempo event to the note events
      if (n.note.startsWith('tempo:')) {
        const [l, r] = n.note.split(': ')
        if (!l || !r) {
          throw new Error('Invalid tempo event')
        }
        const tempo = parseInt(r)
        addNoteEvent(
          noteEvents,
          parseInt(tickRaw),
          'tempo',
          tempo,
          undefined,
          trackIdx
        )
      } else {
        // if the note is a note event, add the note event to the note events
        addNoteEvent(
          noteEvents,
          parseInt(tickRaw),
          'on',
          n.note,
          n.velocity,
          trackIdx
        )
        addNoteEvent(
          noteEvents,
          parseInt(tickRaw) + (n.duration ?? 128),
          'off',
          n.note,
          n.velocity,
          trackIdx
        )
      }
    })
  })

  type MaxRef = { num: number }
  const maxes: { [trackIdx: number]: MaxRef } = {}
  Object.entries(noteEvents).forEach(([_, initNotes]) => {
    const notes = [...initNotes]
    // get the first note
    const first = notes.shift()
    if (!first) return
    maxes[first.trackIdx ?? 0] = maxes[first.trackIdx ?? 0] || { num: 0 }
    const maxRef = maxes[first.trackIdx ?? 0]
    // if the first note is a tempo event, add the tempo event to the relativized notes
    if (first) {
      // if the first note is a tempo event, add the tempo event to the relativized notes
      if (first.onOrOff === 'tempo') {
        relativized.push([
          first.tempo,
          // first.abso - max,
          first.abso - maxRef.num,
          first.onOrOff,
          undefined,
          first.trackIdx,
        ])
        // max = first.abso
        maxRef.num = first.abso
      } else {
        // if the first note is a note event, add the note event to the relativized notes
        relativized.push([
          first.note,
          // first.abso - max,
          first.abso - maxRef.num,
          first.onOrOff,
          first.velocity,
          first.trackIdx,
        ])
        // max = first.abso
        maxRef.num = first.abso
      }

      // if there are more notes, add the notes to the relativized notes
      if (notes.length) {
        // go through all the notes
        notes.forEach((aNote) => {
          // Get the correct maxRef for this note's track, not the first note's track
          const aNoteTrackIdx = aNote.trackIdx ?? 0
          maxes[aNoteTrackIdx] = maxes[aNoteTrackIdx] || { num: 0 }
          const aNoteMaxRef = maxes[aNoteTrackIdx]
          
          if (aNote.onOrOff === 'tempo') {
            relativized.push([
              aNote.tempo,
              // aNote.abso - max,
              aNote.abso - aNoteMaxRef.num,
              aNote.onOrOff,
              undefined,
              aNote.trackIdx,
            ])
            // max = aNote.abso
            aNoteMaxRef.num = aNote.abso
          } else {
            relativized.push([
              aNote.note,
              // aNote.abso - max,
              aNote.abso - aNoteMaxRef.num,
              aNote.onOrOff,
              aNote.velocity,
              aNote.trackIdx,
            ])
            // max = aNote.abso
            aNoteMaxRef.num = aNote.abso
          }
        })
      }
    }
  })

  return relativized
}

export const downloadSong = async (
  tempo: number | null = startTempo,
  midiMap: MidiMap
) => {
  const mappedTicks = midiMap
  // Track membership and channels are read HERE and threaded downward, so
  // midi.ts stays free of mem().
  const tracks = mem().tracks
  const phaseTrackIndex = buildPhaseTrackIndex(tracks)
  const channels = tracks.map((track, idx) => trackChannel(track, idx))
  const events = await songToEvents(mappedTicks, phaseTrackIndex)
  return downloadEvents(events, tempo, tracks.length, channels)
}
