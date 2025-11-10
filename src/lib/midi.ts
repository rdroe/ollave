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
export const addEvents = (
  tracks: Midi.Track[],
  events: RelativeNote[],
  tempo: number,
  file: Midi.File
) => {
  // refresh
  events.forEach((relNote: RelativeNote) => {
    const noteTrackIdx = isMultiTrack ? relNote[TRACK_IDX_IDX] : 0
    const isNewMidiTrack = tracks[noteTrackIdx] === undefined
    tracks[noteTrackIdx] = tracks[noteTrackIdx] || new Midi.Track()
    const track = tracks[noteTrackIdx]
    //
    if (isNewMidiTrack) {
      track.setTempo(tempo)
      file.addTrack(track)
    }

    if (isRelativeMusicNote(relNote)) {
      if (relNote[2] === 'on') {
        track.noteOn(
          noteTrackIdx as MidiChannel,
          relNote[0],
          relNote[1],
          relNote[3]
        )
      } else if (relNote[2] === 'off') {
        track.noteOff(
          noteTrackIdx as MidiChannel,
          relNote[0],
          relNote[1],
          relNote[3]
        )
      }
    } else if (relNote[2] === 'tempo') {
      track.setTempo(relNote[0], relNote[1])
    }
  })
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
