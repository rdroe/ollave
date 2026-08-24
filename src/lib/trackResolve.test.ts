import { describe, expect, it } from 'vitest'

import { buildPhaseTrackIndex, getPhaseId } from './trackResolve'

/**
 * Track identity is recovered from a note's compositionTags rather than stored
 * on the note: `barId=<phase>:<barIndex>` names the phase, and the song's own
 * track order says which track owns that phase.
 */
describe('getPhaseId', () => {
  it('reads the phase name out of a barId tag', () => {
    expect(getPhaseId(['barId=intro:0'])).toBe('intro')
    expect(getPhaseId(['duration=128', 'barId=verse:12', 'velocity=90'])).toBe(
      'verse'
    )
  })

  it('returns null when there is no barId tag', () => {
    expect(getPhaseId([])).toBeNull()
    expect(getPhaseId(['velocity=90'])).toBeNull()
  })
})

describe('buildPhaseTrackIndex', () => {
  it('maps every phase to the index of the track that owns it', () => {
    const index = buildPhaseTrackIndex([
      { 'phase-names': ['intro', 'verse'] },
      { 'phase-names': ['bassline'] },
    ])

    expect(index).toEqual({ intro: 0, verse: 0, bassline: 1 })
  })

  it('is empty for a song with no tracks, and misses read as undefined', () => {
    const index = buildPhaseTrackIndex([])

    expect(index).toEqual({})
    expect(index['nope']).toBeUndefined()
  })

  it('lets a later track win a duplicated phase name, deterministically', () => {
    const index = buildPhaseTrackIndex([
      { 'phase-names': ['shared'] },
      { 'phase-names': ['shared'] },
    ])

    expect(index['shared']).toBe(1)
  })
})
