import Midi from 'jsmidgen'
import { describe, expect, it, vi } from 'vitest'

// A full stub, not importActual: music.ts builds a Tone.js Piano at module
// scope, so loading the real module needs Web Audio. Only the constants and
// the type guard midi.ts actually uses are reproduced here.
vi.mock('./music', () => ({
  playTriads: () => undefined,
  isReady: () => true,
  TRACK_IDX_IDX: 4,
  DEFAULT_TRACK_IDX: 0,
  isRelativeMusicNote: (note: unknown[]) => note[2] !== 'tempo',
}))

import { buildPhaseTrackIndex } from './download'
import { addEvents, ensureTracks } from './midi'
import { RelativeNote } from './music'

/**
 * MIDI track/channel mapping.
 *
 * Tracks used to be created on first note encounter and the track index was
 * reused as the channel. These tests parse the real bytes rather than trusting
 * the writer, so track count, ordering, and per-event channels are pinned
 * against the actual file a DAW would open.
 */

// ---------------------------------------------------------------------------
// A minimal SMF reader. Only what the assertions need: chunk splitting and
// note on/off channels in order.
// ---------------------------------------------------------------------------

type ParsedNote = { type: 'on' | 'off'; channel: number; pitch: number }

const toBytes = (s: string): number[] =>
  Array.from(s, (ch) => ch.charCodeAt(0) & 0xff)

const readUint32 = (b: number[], at: number) =>
  (b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]

const parseMidi = (raw: string) => {
  const b = toBytes(raw)
  expect(String.fromCharCode(...b.slice(0, 4))).toBe('MThd')
  const format = (b[8] << 8) | b[9]
  const declaredTracks = (b[10] << 8) | b[11]

  const trackChunks: number[][] = []
  let at = 8 + readUint32(b, 4)
  while (at < b.length) {
    const id = String.fromCharCode(...b.slice(at, at + 4))
    const len = readUint32(b, at + 4)
    if (id === 'MTrk') {
      trackChunks.push(b.slice(at + 8, at + 8 + len))
    }
    at += 8 + len
  }

  const readVarLen = (data: number[], pos: number): [number, number] => {
    let value = 0
    let p = pos
    for (;;) {
      const byte = data[p]
      p += 1
      value = (value << 7) | (byte & 0x7f)
      if ((byte & 0x80) === 0) break
    }
    return [value, p]
  }

  const notesPerTrack = trackChunks.map((data) => {
    const notes: ParsedNote[] = []
    let p = 0
    let running = 0
    while (p < data.length) {
      ;[, p] = readVarLen(data, p)
      let status = data[p]
      if (status & 0x80) {
        p += 1
        running = status
      } else {
        status = running
      }
      const high = status & 0xf0
      const channel = status & 0x0f

      if (status === 0xff) {
        const metaType = data[p]
        p += 1
        const [len, after] = readVarLen(data, p)
        p = after + len
        if (metaType === 0x2f) break
        continue
      }
      if (high === 0x90 || high === 0x80) {
        const pitch = data[p]
        p += 2
        const velocity = data[p - 1]
        notes.push({
          // a note-on with velocity 0 is a note-off by convention
          type: high === 0x90 && velocity > 0 ? 'on' : 'off',
          channel,
          pitch,
        })
        continue
      }
      if (high === 0xc0 || high === 0xd0) {
        p += 1
        continue
      }
      p += 2
    }
    return notes
  })

  return { format, declaredTracks, trackChunks, notesPerTrack }
}

/** Build a file the same way download.ts does, and return its parsed bytes. */
const renderMidi = (
  events: RelativeNote[],
  trackCount: number,
  channels: number[],
  tempo: number | null = 120
) => {
  const tracks: Midi.Track[] = []
  const file = new Midi.File()
  ensureTracks(tracks, trackCount, tempo, file)
  addEvents(tracks, events, tempo, file, channels)
  return parseMidi(file.toBytes())
}

const on = (note: string, trackIdx: number, rel = 0): RelativeNote =>
  [note, rel, 'on', 90, trackIdx] as RelativeNote
const off = (note: string, trackIdx: number, rel = 128): RelativeNote =>
  [note, rel, 'off', 90, trackIdx] as RelativeNote

describe('buildPhaseTrackIndex', () => {
  it('maps every phase to the index of its owning track', () => {
    const map = buildPhaseTrackIndex([
      { 'phase-names': ['intro', 'verse'] },
      { 'phase-names': ['bassline'] },
    ])

    expect(map).toEqual({ intro: 0, verse: 0, bassline: 1 })
  })

  it('uses declared song order, not first-note encounter order', () => {
    // 'bassline' sounding before 'intro' must not renumber the tracks.
    const map = buildPhaseTrackIndex([
      { 'phase-names': ['intro'] },
      { 'phase-names': ['bassline'] },
    ])

    expect(map.intro).toBe(0)
    expect(map.bassline).toBe(1)
  })

  it('returns an empty map for a song with no tracks', () => {
    expect(buildPhaseTrackIndex([])).toEqual({})
  })
})

describe('MIDI file structure', () => {
  it('writes one chunk per declared track, in song order', () => {
    const parsed = renderMidi([on('c3', 0), off('c3', 0)], 2, [0, 1])

    expect(parsed.declaredTracks).toBe(2)
    expect(parsed.trackChunks).toHaveLength(2)
  })

  it('represents a declared track that has no notes', () => {
    // Lazy creation used to omit an empty track entirely, shifting every later
    // track up one index.
    const parsed = renderMidi([on('c3', 1), off('c3', 1)], 2, [0, 1])

    expect(parsed.trackChunks).toHaveLength(2)
    expect(parsed.notesPerTrack[0]).toHaveLength(0)
    expect(parsed.notesPerTrack[1].map((n) => n.type)).toEqual(['on', 'off'])
  })

  it('routes each note to the MIDI track its trackIdx names', () => {
    const parsed = renderMidi(
      [on('c3', 0), off('c3', 0), on('e4', 1), off('e4', 1)],
      2,
      [0, 1]
    )

    expect(parsed.notesPerTrack[0]).toHaveLength(2)
    expect(parsed.notesPerTrack[1]).toHaveLength(2)
    // different pitches prove the notes did not both land on one track
    expect(parsed.notesPerTrack[0][0].pitch).not.toBe(
      parsed.notesPerTrack[1][0].pitch
    )
  })
})

describe('MIDI channels', () => {
  it('writes each track configured channel into its events', () => {
    const parsed = renderMidi(
      [on('c3', 0), off('c3', 0), on('e4', 1), off('e4', 1)],
      2,
      [5, 11]
    )

    expect(parsed.notesPerTrack[0].every((n) => n.channel === 5)).toBe(true)
    expect(parsed.notesPerTrack[1].every((n) => n.channel === 11)).toBe(true)
  })

  it('falls back to min(trackIdx, 15) when no channel is configured', () => {
    const parsed = renderMidi(
      [on('c3', 0), off('c3', 0), on('e4', 1), off('e4', 1)],
      2,
      []
    )

    expect(parsed.notesPerTrack[0][0].channel).toBe(0)
    expect(parsed.notesPerTrack[1][0].channel).toBe(1)
  })

  it('does not skip channel 9', () => {
    const parsed = renderMidi([on('c3', 0), off('c3', 0)], 1, [9])

    expect(parsed.notesPerTrack[0][0].channel).toBe(9)
  })

  it('clamps an out-of-range channel into 0-15', () => {
    const parsed = renderMidi([on('c3', 0), off('c3', 0)], 1, [99])

    expect(parsed.notesPerTrack[0][0].channel).toBe(15)
  })

  it('lets two tracks share one channel', () => {
    const parsed = renderMidi(
      [on('c3', 0), off('c3', 0), on('e4', 1), off('e4', 1)],
      2,
      [3, 3]
    )

    expect(parsed.notesPerTrack[0][0].channel).toBe(3)
    expect(parsed.notesPerTrack[1][0].channel).toBe(3)
  })
})

describe('one-track backward compatibility', () => {
  /**
   * The semantic pin for existing songs: one track, no configured channels.
   * Everything must land on track 0 / channel 0 exactly as it did before
   * channels were threaded through.
   */
  const events: RelativeNote[] = [
    on('c3', 0),
    on('e3', 0, 0),
    off('c3', 0),
    off('e3', 0, 0),
  ]

  it('produces a single track on channel 0', () => {
    const parsed = renderMidi(events, 1, [0])

    expect(parsed.trackChunks).toHaveLength(1)
    expect(parsed.notesPerTrack[0].every((n) => n.channel === 0)).toBe(true)
  })

  it('is byte-identical with and without the channels argument', () => {
    const withChannels = (() => {
      const tracks: Midi.Track[] = []
      const file = new Midi.File()
      ensureTracks(tracks, 1, 120, file)
      addEvents(tracks, events, 120, file, [0])
      return file.toBytes()
    })()

    const withoutChannels = (() => {
      const tracks: Midi.Track[] = []
      const file = new Midi.File()
      ensureTracks(tracks, 1, 120, file)
      addEvents(tracks, events, 120, file)
      return file.toBytes()
    })()

    expect(withChannels).toBe(withoutChannels)
  })

  it('preserves note order within the track', () => {
    const parsed = renderMidi(events, 1, [0])

    expect(parsed.notesPerTrack[0].map((n) => n.type)).toEqual([
      'on',
      'on',
      'off',
      'off',
    ])
  })
})
