import { beforeAll, describe, expect, it } from 'vitest'

import { isChordCsvArg, isDyna, parseChordCsvArg } from './barsUtil'
import { chordGraphCreate } from './graphUtil'

describe('isDyna', () => {
  it('recognizes dynamic chord names case-insensitively', () => {
    expect(isDyna('V64')).toBe(true)
    expect(isDyna('v64')).toBe(true)
    expect(isDyna('Aug6')).toBe(true)
    expect(isDyna('N6')).toBe(true)
    expect(isDyna('Am')).toBe(false)
  })
})

describe('isChordCsvArg', () => {
  it('accepts chord,octave csv strings', () => {
    expect(isChordCsvArg('Am,3')).toBe(true)
    expect(isChordCsvArg('Cmaj7,4')).toBe(true)
    expect(isChordCsvArg('V64,3')).toBe(true)
  })

  it('rejects malformed args', () => {
    expect(isChordCsvArg('Am')).toBe(false)
    expect(isChordCsvArg('notachord,3')).toBe(false)
    expect(isChordCsvArg('Am,x')).toBe(false)
  })
})

describe('parseChordCsvArg', () => {
  beforeAll(() => {
    chordGraphCreate('A', 'minor')
  })

  it('uses the graph voicing and tags roman when a scale is given', () => {
    expect(parseChordCsvArg('Am,3', 'A minor')).toEqual([
      ['A3', 'C4', 'E4'],
      ['roman=Im', 'chord=Am'],
    ])
  })

  it('resolves without a scale (no roman tag)', () => {
    expect(parseChordCsvArg('Am,3')).toEqual([
      ['A3', 'C4', 'E4'],
      ['chord=Am'],
    ])
    expect(parseChordCsvArg('C,4')).toEqual([
      ['C4', 'E4', 'G4'],
      ['chord=C'],
    ])
  })

  it('voices dynamic chords through the graph octMap', () => {
    expect(parseChordCsvArg('V64,3', 'A minor')).toEqual([
      ['E3', 'A3', 'C3'],
      ['roman=V64', 'chord=V64'],
    ])
  })

  it('throws for dynamic chords without a scale', () => {
    // previously this silently resolved to no notes (the dynamic-chord
    // branch of chordNameWithNotes was unreachable)
    expect(() => parseChordCsvArg('V64,3')).toThrow(
      /Cannot get dynamic chord V64/
    )
  })

  it('throws for non-csv input', () => {
    expect(() => parseChordCsvArg('Am')).toThrow(/not a chord csv arg/)
  })
})
