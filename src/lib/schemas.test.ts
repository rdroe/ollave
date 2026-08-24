import { describe, expect, it } from 'vitest'

import { trackInstrument, trackRecordSchema } from './schemas'

const baseTrack = {
  id: 1,
  'phase-ids': [],
  'phase-names': [],
  notesByBar: {},
}

/**
 * The instrument follows the same derive-don't-store rule as name/channel:
 * zod strips unknown keys, so the field has to be declared for a stored choice
 * to survive a load, and its absence must keep meaning "piano".
 */
describe('trackRecordSchema instrument', () => {
  it('keeps a stored instrument through a parse', () => {
    const parsed = trackRecordSchema.parse({
      ...baseTrack,
      instrument: 'violin',
    })

    expect(parsed.instrument).toBe('violin')
  })

  it('leaves instrument undefined on a row that never stored one', () => {
    const parsed = trackRecordSchema.parse(baseTrack)

    expect(parsed.instrument).toBeUndefined()
  })
})

describe('trackInstrument', () => {
  it('falls back to piano when nothing is stored', () => {
    expect(trackInstrument({}, 0)).toBe('piano')
    expect(trackInstrument({ instrument: undefined }, 3)).toBe('piano')
  })

  it('returns the stored choice regardless of track index', () => {
    expect(trackInstrument({ instrument: 'cello' }, 0)).toBe('cello')
    expect(trackInstrument({ instrument: 'cello' }, 7)).toBe('cello')
  })
})
