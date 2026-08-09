import Midi, { MidiChannel } from 'jsmidgen'

import {
  isRelativeMusicNote,
  TRACK_IDX_IDX,
  playTriads,
  RelativeNote,
  Triad,
} from './music'

export function saveRaw(bytes: any, name = 'sample-2.midi') {
  const b64 = btoa(bytes)
  const uri = 'data:audio/midi;base64,' + b64
  const link = document.createElement('a')

  link.href = uri
  link.download = name
  link.click()
}



// const makeChanneledTriadFn = (ch: number) => {
//   if (!isMidiChannel(ch)) throw new Error(`Invalid midi channel: ${ch}`)
//   return ([note, dur, timing, velocity]: Triad): ChanneledTriad => {
//     return [ch, note, dur, timing, velocity]
//   }
// }

// export const addEvents = (track: Midi.Track, events: RelativeNote[]) => {
//   const channeledTriads = events.map(makeChanneledEvent)

//   channeledTriads.forEach((chTr: SoundEvent | TempoEvent) => {
//     if (chTr[3] === 'on') {
//       track.noteOn(chTr[0], chTr[1], chTr[2], chTr[4])
//     } else if (chTr[3] === 'off') {
//       track.noteOff(chTr[0], chTr[1], chTr[2], chTr[4])
//     } else if (chTr[3] === 'tempo') {
//       track.setTempo(chTr[1], chTr[2])
//     }
//   })
// }
// export type RelativeTempoNote = [
//   note: BPM,
//   rel: number,
//   onOrOff: 'tempo',
//   ignored?: number,
//   trackIdx?: number,
// ]
// export type RelativeMusicNote = [
//   note: string, 0
//   rel: number, 1
//   onOrOff: 'on' | 'off',
//   velocity?: number, 3
//   trackIdx?: number, 4
// ]
const isMultiTrack: boolean = true

/**
 * Write events into MIDI tracks.
 *
 * `channels` maps track index -> MIDI channel. It is a PARAMETER, not a mem()
 * read, so this module stays pure and testable. Absent (or short) entries fall
 * back to min(trackIdx, 15), which is the historical behavior.
 *
 * The track index selects WHICH MIDI track an event lands on; the channel is
 * what gets written into the event. They were the same number before channels
 * were configurable, and conflating them is why a 17th track produced an
 * invalid channel.
 */
export const addEvents = (
  tracks: Midi.Track[],
  events: RelativeNote[],
  // null for playedMap downloads: the take embeds its own tempo markers
  tempo: number | null,
  file: Midi.File,
  channels?: number[]
) => {
  const channelFor = (trackIdx: number): MidiChannel => {
    const configured = channels?.[trackIdx]
    const resolved =
      typeof configured === 'number' ? configured : Math.min(trackIdx, 15)
    return Math.max(0, Math.min(15, resolved)) as MidiChannel
  }

  // refresh
  events.forEach((relNote: RelativeNote) => {
    const noteTrackIdx = (isMultiTrack ? relNote[TRACK_IDX_IDX] : 0) ?? 0
    const isNewMidiTrack = tracks[noteTrackIdx] === undefined
    tracks[noteTrackIdx] = tracks[noteTrackIdx] || new Midi.Track()
    const track = tracks[noteTrackIdx]
    //
    if (isNewMidiTrack) {
      // tempo is null for playedMap downloads (the take embeds its own tempo
      // markers). jsmidgen would write mpqn 0 for null — an invalid tempo
      // that DAWs import as a silent/collapsed file — so skip the placeholder
      // and let the embedded tempo events (or the DAW's 120 default) govern.
      if (tempo) {
        track.setTempo(tempo)
      }
      file.addTrack(track)
    }

    const channel = channelFor(noteTrackIdx)

    if (isRelativeMusicNote(relNote)) {
      if (relNote[2] === 'on') {
        track.noteOn(channel, relNote[0], relNote[1], relNote[3])
      } else if (relNote[2] === 'off') {
        track.noteOff(channel, relNote[0], relNote[1], relNote[3])
      }
    } else if (relNote[2] === 'tempo') {
      track.setTempo(relNote[0], relNote[1])
    }
  })
}

/**
 * Create MIDI tracks up front, in declared song-track order.
 *
 * addEvents() creates a track lazily on first event, which orders tracks by
 * first-note encounter and drops declared-but-empty tracks. Pre-creating them
 * makes the file's track order match the song's.
 */
export const ensureTracks = (
  tracks: Midi.Track[],
  trackCount: number,
  tempo: number | null,
  file: Midi.File
) => {
  for (let i = 0; i < trackCount; i += 1) {
    if (tracks[i] === undefined) {
      const track = new Midi.Track()
      if (tempo) {
        track.setTempo(tempo)
      }
      tracks[i] = track
      file.addTrack(track)
    }
  }
}

export const playNotes = async (notes: Triad[]) => {
  playTriads(notes)
  return { played: notes }
}

// const makeChanneledEventFn = (ch: number) => {
//   if (!isMidiChannel(ch)) throw new Error(`Invalid midi channel: ${ch}`)
//   return ([note, dur, timing, velocity]: RelativeNote): ChanneledEvent => {
//     console.log('makeChanneledTriadFn', {
//       note,
//       dur,
//       timing,
//       velocity,
//     })
//     if (typeof note !== 'string') {
//       throw new Error(`Invalid note: ${note}`)
//     }
//     // @ts-ignore this is fine
//     return [ch, note, dur, timing, velocity]
//   }
// }

// const isMidiChannel = (arg: number): arg is MidiChannel => {
//   return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].includes(arg)
// }

// export const addEvents = (track: Midi.Track, events: RelativeNote[]) => {
//   const channeledTriads = events.map(makeChanneledEventFn(0))

//   channeledTriads.forEach((chTr: ChanneledEvent) => {
//     if (chTr[3] === 'on') {
//       [ch, note, dur, timing, velocity]
//       track.noteOn(chTr[0], chTr[1], chTr[2], chTr[4])
//     } else if (chTr[3] === 'off') {
//       track.noteOff(chTr[0], chTr[1], chTr[2], chTr[4])
//     } else if (chTr[3] === 'tempo') {
//       track.setTempo(chTr[1], chTr[2])
//     }
//   })
// }
