import Midi from 'jsmidgen'

import { parseColonTag } from '../commands'
import { trackTempo as startTempo } from '../core/observables/masterTicksObservable'

import { MidiMap } from './mapSongToTicks'
import { addEvents, saveRaw } from './midi'
import { DEFAULT_TRACK_IDX, RelativeNote } from './music'
import { tagsObjSchema } from './schemas'

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
  tempo: number = startTempo
) => {
  const midiTracks: Midi.Track[] = []
  const file = new Midi.File()
  addEvents(midiTracks, notes, tempo, file)
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
const pushUnique = (Array: string[], item: string): string[] => {
  if (!Array.includes(item)) {
    Array.push(item)
  }
  return Array
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
const songToEvents = async (mappedTicks: MidiMap) => {
  const uniqueTrackNames: string[] = []

  const noteEvents: {
    [tick: number]: IncomingEvent[]
  } = {}

  const relativized: RelativeNote[] = []
  // go through all the tickes, each of which has a list of notes
  Object.entries(mappedTicks).forEach(([tickRaw, notes]) => {
    notes.forEach((n) => {
      // get the track index for the note
      const trackName = getPhaseId(n.compositionTags)
      const trackIdx = trackName
        ? pushUnique(uniqueTrackNames, trackName).indexOf(trackName)
        : DEFAULT_TRACK_IDX
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
    maxes[first.trackIdx ?? 0] = maxes[first.trackIdx ?? 0] || { num: 0 }
    const maxRef = maxes[first.trackIdx]
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
          if (aNote.onOrOff === 'tempo') {
            relativized.push([
              aNote.tempo,
              // aNote.abso - max,
              aNote.abso - maxRef.num,
              aNote.onOrOff,
              undefined,
              aNote.trackIdx,
            ])
            // max = aNote.abso
            maxRef.num = aNote.abso
          } else {
            relativized.push([
              aNote.note,
              // aNote.abso - max,
              aNote.abso - maxRef.num,
              aNote.onOrOff,
              aNote.velocity,
              aNote.trackIdx,
            ])
            // max = aNote.abso
            maxRef.num = aNote.abso
          }
        })
      }
    }
  })

  return relativized
}

export const downloadSong = async (
  tempo: number = startTempo,
  midiMap: MidiMap
) => {
  const mappedTicks = midiMap
  const events = await songToEvents(mappedTicks)
  return downloadEvents(events, tempo)
}
