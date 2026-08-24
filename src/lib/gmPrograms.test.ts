import { describe, expect, it } from 'vitest'

import {
  GM_FAMILIES,
  GM_INSTRUMENT_NAMES,
  GM_PROGRAM_NAMES,
  gmFamilyOf,
  gmInstrumentName,
  gmLabel,
  gmProgramOf,
  isGmInstrument,
} from './gmPrograms'

/**
 * `gm:<program>` is the on-the-wire instrument name for every General MIDI
 * program, so its parser is the only thing standing between a stored track
 * record and a bad MIDI program change. These cover the boundaries.
 */
describe('gmProgramOf', () => {
  it('parses the ends of the valid range', () => {
    expect(gmProgramOf('gm:0')).toBe(0)
    expect(gmProgramOf('gm:127')).toBe(127)
    expect(gmProgramOf('gm:24')).toBe(24)
  })

  it('rejects out-of-range programs', () => {
    expect(gmProgramOf('gm:128')).toBeNull()
    expect(gmProgramOf('gm:999')).toBeNull()
  })

  it('rejects malformed names', () => {
    expect(gmProgramOf('gm:')).toBeNull()
    expect(gmProgramOf('gm:x')).toBeNull()
    expect(gmProgramOf('gm:1.5')).toBeNull()
    expect(gmProgramOf('gm:-1')).toBeNull()
    expect(gmProgramOf('gm: 4')).toBeNull()
  })

  it('rejects non-GM instrument names', () => {
    expect(gmProgramOf('violin')).toBeNull()
    expect(gmProgramOf('piano')).toBeNull()
    expect(gmProgramOf('')).toBeNull()
  })
})

describe('isGmInstrument', () => {
  it('is true exactly for well-formed gm names', () => {
    expect(isGmInstrument('gm:0')).toBe(true)
    expect(isGmInstrument('gm:127')).toBe(true)
    expect(isGmInstrument('gm:128')).toBe(false)
    expect(isGmInstrument('gm:')).toBe(false)
    expect(isGmInstrument('gm:x')).toBe(false)
    expect(isGmInstrument('violin')).toBe(false)
  })
})

describe('gmLabel', () => {
  it('names GM programs', () => {
    expect(gmLabel('gm:0')).toBe('Acoustic Grand Piano')
    expect(gmLabel('gm:24')).toBe('Acoustic Guitar (nylon)')
    expect(gmLabel('gm:127')).toBe('Gunshot')
  })

  it('passes non-GM names through unchanged', () => {
    expect(gmLabel('violin')).toBe('violin')
    expect(gmLabel('gm:128')).toBe('gm:128')
  })
})

describe('gmFamilyOf', () => {
  it('groups programs into the 16 standard families', () => {
    expect(gmFamilyOf(0)).toBe('Piano')
    expect(gmFamilyOf(7)).toBe('Piano')
    expect(gmFamilyOf(8)).toBe('Chromatic Percussion')
    expect(gmFamilyOf(24)).toBe('Guitar')
    expect(gmFamilyOf(127)).toBe('Sound Effects')
  })

  it('falls back rather than returning undefined out of range', () => {
    expect(gmFamilyOf(128)).toBe('Sound Effects')
    expect(gmFamilyOf(-1)).toBe('Sound Effects')
  })
})

describe('the GM tables', () => {
  it('has 128 programs and 16 families', () => {
    expect(GM_PROGRAM_NAMES).toHaveLength(128)
    expect(GM_FAMILIES).toHaveLength(16)
    expect(GM_INSTRUMENT_NAMES).toHaveLength(128)
  })

  it('round-trips every program through its name', () => {
    GM_INSTRUMENT_NAMES.forEach((name, program) => {
      expect(name).toBe(gmInstrumentName(program))
      expect(gmProgramOf(name)).toBe(program)
    })
  })
})
