import { describe, expect, it } from 'vitest'

import { pivotSuggestions, romanInKey } from './pivots'

const keys = (chord: string, tonic: string, scale: string) =>
  pivotSuggestions(chord, tonic, scale).map((p) => p.targetKey)

const romanFor = (chord: string, tonic: string, scale: string, target: string) =>
  pivotSuggestions(chord, tonic, scale).find((p) => p.targetKey === target)
    ?.romanThere

describe('pivotSuggestions', () => {
  it('finds the five other keys containing an A minor triad', () => {
    // A-C-E is diatomic to exactly six major/minor keys (finding F8); the
    // current key is excluded, leaving five targets.
    expect(keys('Am', 'A', 'minor').sort()).toEqual([
      'C major',
      'D minor',
      'E minor',
      'F major',
      'G major',
    ])
  })

  it('excludes the current key', () => {
    expect(keys('Am', 'A', 'minor')).not.toContain('A minor')
    // and the same chord queried from a different current key excludes THAT one
    const fromC = keys('Am', 'C', 'major')
    expect(fromC).not.toContain('C major')
    expect(fromC).toContain('A minor')
    expect(fromC).toHaveLength(5)
  })

  it('labels the chord with its function in each target key', () => {
    // hand-verified: Am is vi of C, iii of F, ii of G, v of D minor, iv of E minor
    expect(romanFor('Am', 'A', 'minor', 'C major')).toBe('VIm')
    expect(romanFor('Am', 'A', 'minor', 'F major')).toBe('IIIm')
    expect(romanFor('Am', 'A', 'minor', 'G major')).toBe('IIm')
    expect(romanFor('Am', 'A', 'minor', 'D minor')).toBe('Vm')
    expect(romanFor('Am', 'A', 'minor', 'E minor')).toBe('IVm')
  })

  it('handles seventh chords', () => {
    // G-B-D-F fits only C major and A minor
    const g7 = pivotSuggestions('G7', 'A', 'minor')
    expect(g7.map((p) => p.targetKey)).toEqual(['C major'])
    expect(g7[0].romanThere).toBe('V7')

    // from C major the only other home for G7 is A minor, as the subtonic
    expect(romanFor('G7', 'C', 'major', 'A minor')).toBe('VII7')
  })

  it('handles chords with accidentals', () => {
    // Eb-G-Bb is diatonic to six keys; from C minor, five remain
    const eb = pivotSuggestions('Eb', 'C', 'minor')
    expect(eb.map((p) => p.targetKey).sort()).toEqual([
      'Ab major',
      'Bb major',
      'Eb major',
      'F minor',
      'G minor',
    ])
    expect(romanFor('Eb', 'C', 'minor', 'Eb major')).toBe('I')
    expect(romanFor('Eb', 'C', 'minor', 'Bb major')).toBe('IV')
    expect(romanFor('Eb', 'C', 'minor', 'Ab major')).toBe('V')

    // a sharp-side diminished chord
    expect(romanFor('F#dim', 'E', 'minor', 'G major')).toBe('VIIdim')
  })

  it('returns an empty follow list rather than throwing when the chord is not a chart node', () => {
    const all = pivotSuggestions('Am', 'A', 'minor')

    // Am IS diatonic to D minor, but the minor chart has no Vm node, so
    // nextChordDetail throws for it. That must surface as an empty follow,
    // not as a thrown error or a dropped target.
    const dMinor = all.find((p) => p.targetKey === 'D minor')
    expect(dMinor).toBeDefined()
    expect(dMinor!.romanThere).toBe('Vm')
    expect(dMinor!.follow).toEqual([])

    // ...while a target where the chord IS a node carries real continuations
    const eMinor = all.find((p) => p.targetKey === 'E minor')
    expect(eMinor!.follow.length).toBeGreaterThan(0)
    expect(eMinor!.follow.map((f) => f.name)).toContain('B')
    for (const sug of eMinor!.follow) {
      expect(typeof sug.roman).toBe('string')
      expect(['strong', 'dotted']).toContain(sug.strength)
      expect(Array.isArray(sug.notes)).toBe(true)
    }
  })

  it('orders closely related keys first', () => {
    // A minor's signature has 0 accidentals. C major shares it exactly, so it
    // leads; the four one-accidental keys follow, same-mode (minor) before
    // mode-change (major), then alphabetically.
    expect(keys('Am', 'A', 'minor')).toEqual([
      'C major',
      'D minor',
      'E minor',
      'F major',
      'G major',
    ])

    // asking from C major reverses which same-mode group sorts first
    expect(keys('Am', 'C', 'major')).toEqual([
      'A minor',
      'F major',
      'G major',
      'D minor',
      'E minor',
    ])
  })

  it('is deterministic across repeated calls', () => {
    const once = pivotSuggestions('Am', 'A', 'minor')
    const twice = pivotSuggestions('Am', 'A', 'minor')
    expect(JSON.stringify(twice)).toEqual(JSON.stringify(once))

    // and the graph cache (mem()) does not perturb a second, different query
    pivotSuggestions('E', 'A', 'minor')
    expect(JSON.stringify(pivotSuggestions('Am', 'A', 'minor'))).toEqual(
      JSON.stringify(once)
    )
  })

  it('returns an empty array for an unparseable chord', () => {
    expect(pivotSuggestions('not-a-chord', 'A', 'minor')).toEqual([])
  })

  it('reports tonic and scale split out from the key name', () => {
    const eb = pivotSuggestions('Eb', 'C', 'minor').find(
      (p) => p.targetKey === 'Ab major'
    )
    expect(eb).toMatchObject({
      targetKey: 'Ab major',
      targetTonic: 'Ab',
      targetScale: 'major',
    })
  })
})

describe('romanInKey', () => {
  it('numbers triads by degree and quality', () => {
    expect(romanInKey('C', 'C', 'major')).toBe('I')
    expect(romanInKey('Dm', 'C', 'major')).toBe('IIm')
    expect(romanInKey('Bdim', 'C', 'major')).toBe('VIIdim')
    expect(romanInKey('Am', 'C', 'major')).toBe('VIm')
  })

  it('labels minor keys from the natural minor scale', () => {
    // the subtonic is 'VII', matching the chart's vocabulary in graphData/minor
    expect(romanInKey('G', 'A', 'minor')).toBe('VII')
    expect(romanInKey('Am', 'A', 'minor')).toBe('Im')
    expect(romanInKey('Bdim', 'A', 'minor')).toBe('IIdim')
  })

  it('suffixes seventh chords by type', () => {
    expect(romanInKey('G7', 'C', 'major')).toBe('V7')
    expect(romanInKey('Cmaj7', 'C', 'major')).toBe('Imaj7')
    expect(romanInKey('Dm7', 'C', 'major')).toBe('IIm7')
    expect(romanInKey('Bm7b5', 'C', 'major')).toBe('VII7b5')
  })

  it('returns null when the root is not in the scale', () => {
    expect(romanInKey('F#', 'C', 'major')).toBeNull()
  })
})
