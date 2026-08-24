import { describe, expect, it, vi } from 'vitest'

// The real module pulls in an AudioWorklet and would fetch the 141MB FluidR3
// soundfont the moment a sounder is built. These tests cover the pure
// conversions only, so the synth is stubbed out entirely.
vi.mock('spessasynth_lib', () => ({
  WorkletSynthesizer: class {
    isReady = Promise.resolve()
    soundBankManager = { addSoundBank: () => Promise.resolve() }
    connect() {}
    programChange() {}
    noteOn() {}
    noteOff() {}
  },
}))

import {
  GM_PERCUSSION_CHANNEL,
  MAX_MIDI_CHANNEL,
  channelForTrack,
  parseRelativeSeconds,
  toMidiNote,
  toMidiVelocity,
} from './gmSounder'

/**
 * Channel 9 is GM percussion: a melodic track landing there would play drums,
 * so track indices step over it.
 */
describe('channelForTrack', () => {
  it('maps tracks below the percussion channel straight through', () => {
    expect(channelForTrack(0)).toBe(0)
    expect(channelForTrack(8)).toBe(8)
  })

  it('skips the percussion channel', () => {
    expect(channelForTrack(GM_PERCUSSION_CHANNEL)).toBe(10)
    expect(channelForTrack(10)).toBe(11)
    expect(channelForTrack(14)).toBe(15)
  })

  it('never allocates a percussion or out-of-range channel', () => {
    for (let track = 0; track < 40; track += 1) {
      const channel = channelForTrack(track)
      expect(channel).not.toBe(GM_PERCUSSION_CHANNEL)
      expect(channel).toBeGreaterThanOrEqual(0)
      expect(channel).toBeLessThanOrEqual(MAX_MIDI_CHANNEL)
    }
  })

  it('clamps tracks past the last channel', () => {
    expect(channelForTrack(15)).toBe(MAX_MIDI_CHANNEL)
    expect(channelForTrack(99)).toBe(MAX_MIDI_CHANNEL)
  })

  it('treats junk track indices as track 0', () => {
    expect(channelForTrack(-3)).toBe(0)
    expect(channelForTrack(NaN)).toBe(0)
  })
})

describe('parseRelativeSeconds', () => {
  it('reads Tone relative-time strings', () => {
    expect(parseRelativeSeconds('+0')).toBe(0)
    expect(parseRelativeSeconds('+0.01')).toBe(0.01)
    expect(parseRelativeSeconds('+1.5')).toBe(1.5)
  })

  it('returns null for anything else, so callers can sound it now', () => {
    expect(parseRelativeSeconds('+')).toBeNull()
    expect(parseRelativeSeconds('0.5')).toBeNull()
    expect(parseRelativeSeconds('+abc')).toBeNull()
    expect(parseRelativeSeconds('4n')).toBeNull()
    expect(parseRelativeSeconds('')).toBeNull()
    expect(parseRelativeSeconds(undefined as unknown as string)).toBeNull()
  })
})

describe('toMidiVelocity', () => {
  it('converts the 0-1 Sounder velocity back to MIDI', () => {
    expect(toMidiVelocity(1)).toBe(127)
    expect(toMidiVelocity(100 / 127)).toBe(100)
    expect(toMidiVelocity(0.5)).toBe(64)
  })

  it('never emits 0, which MIDI reads as a note-off', () => {
    expect(toMidiVelocity(0)).toBe(1)
    expect(toMidiVelocity(-1)).toBe(1)
    expect(toMidiVelocity(NaN)).toBe(1)
  })

  it('clamps above the top of the range', () => {
    expect(toMidiVelocity(2)).toBe(127)
  })
})

describe('toMidiNote', () => {
  it('parses note names', () => {
    expect(toMidiNote('C4')).toBe(60)
    expect(toMidiNote('A4')).toBe(69)
    expect(toMidiNote('c3')).toBe(48)
  })

  it('returns null rather than throwing on unparseable names', () => {
    expect(toMidiNote('not-a-note')).toBeNull()
    expect(toMidiNote('')).toBeNull()
  })
})
