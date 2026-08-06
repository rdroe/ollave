import { describe, expect, it } from 'vitest'

import { nextChord } from './nextChord'

describe('nextChord', () => {
  it('builds the graph on first use (no explicit chordGraphCreate needed)', () => {
    // regression: a cache miss used to be the hard error
    // "could not obtain graph for ..."
    expect(nextChord('Dm,3', 'D', 'minor')).toContain('A')
  })

  it('lists compatible next chords for the tonic in A minor', () => {
    expect(nextChord('Am,3', 'A', 'minor')).toEqual([
      'Am',
      'Dm',
      'G',
      'C',
      'F',
      'Bdim',
      'V64',
      'G#dim',
      'E',
    ])
  })

  it('lists compatible next chords for the dominant', () => {
    // V resolves to the tonic; V64/Aug6 approach it rather than follow it
    expect(nextChord('E,3', 'A', 'minor')).toEqual(['Am'])
  })

  it('accepts dynamic chord names', () => {
    // the cadential 6/4 resolves to the dominant
    expect(nextChord('V64,3', 'A', 'minor')).toEqual(['E'])
  })

  it('throws for an unknown scale', () => {
    expect(() => nextChord('Am,3', 'A', 'notascale')).toThrow(
      /Scale notascale not found/
    )
  })

  it('throws for an invalid chord argument', () => {
    expect(() => nextChord('notachord', 'A', 'minor')).toThrow(
      /could not get chord name/
    )
  })

  it('throws for a chord that is not in the graph', () => {
    expect(() => nextChord('Cmaj7,3', 'A', 'minor')).toThrow(
      /could not obtain Cmaj7,3 in graph/
    )
  })
})
