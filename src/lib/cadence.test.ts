import { describe, expect, it } from 'vitest'

import {
  cadenceDefinition,
  cadenceDefinitions,
  cadenceFunctions,
  cadenceLabel,
  cadenceSpanRomans,
  cadenceSpans,
  detectCadences,
  isCadentialPair,
  romanOf,
  scaleDegreeOf,
  type CadenceType,
} from './cadence'
import { functionOf } from './harmonicFunction'

const types: CadenceType[] = [
  'PAC',
  'IAC',
  'half',
  'deceptive',
  'plagal',
  'phrygian-half',
  'evaded',
]

describe('the cadence definitions', () => {
  it('defines all seven types, each as a span of kind cadence', () => {
    expect(cadenceDefinitions).toHaveLength(7)
    for (const t of types) {
      const def = cadenceDefinition(t)
      expect(def, `missing definition for ${t}`).toBeDefined()
      expect(def!.span.kind).toBe('cadence')
      expect(def!.span.steps).toHaveLength(2)
      expect(def!.span.notes, `${t} needs prose`).toBeTruthy()
    }
  })

  it('gives every cadence bass and metric conditions, not just a chord pair', () => {
    // the point of A4: a cadence is a span WITH conditions. A PAC that says
    // only 'V then I' cannot distinguish itself from an IAC.
    for (const def of cadenceDefinitions) {
      expect(def.span.conditions, `${def.type} has no conditions`).toBeDefined()
      expect(
        def.span.conditions!.metric,
        `${def.type} must say where the arrival falls`
      ).toEqual(['weak', 'strong'])
    }
  })

  it('gives the PAC all three of its defining conditions', () => {
    const pac = cadenceDefinition('PAC')!
    // both chords root position
    expect(pac.span.conditions!.bass!.degrees).toEqual([5, 1])
    // soprano arriving on 1
    expect(pac.span.conditions!.soprano!.degrees).toEqual([2, 1])
    // arrival on the stronger beat
    expect(pac.span.conditions!.metric).toEqual(['weak', 'strong'])
  })

  it('restricts the Phrygian half cadence to minor — that IS the definition', () => {
    const ph = cadenceDefinition('phrygian-half')!
    // in major the same chords give a WHOLE step in the bass and the device
    // does not exist
    expect(ph.span.modes).toEqual(['minor'])
    expect(ph.span.conditions!.bass!.degrees).toEqual([6, 5])
    expect(ph.span.conditions!.bass!.motion).toBe('stepwise-down')
    // and the figure is definitional: iv6, not root-position iv
    expect(cadenceSpanRomans('phrygian-half')).toEqual(['IVm6', 'V'])
  })

  it('defines the evaded cadence by its figures — V42 to I6', () => {
    expect(cadenceSpanRomans('evaded')).toEqual(['V42', 'I6'])
    const ev = cadenceDefinition('evaded')!
    // the chordal seventh in the bass must fall by step, which is what forces
    // the inverted tonic and denies the phrase its close
    expect(ev.span.conditions!.bass!.degrees).toEqual([4, 3])
    expect(ev.span.conditions!.bass!.motion).toBe('stepwise-down')
  })

  it('arrives on the function each cadence is supposed to arrive on', () => {
    // authentic and plagal cadences discharge onto a tonic
    for (const t of ['PAC', 'IAC', 'plagal'] as const) {
      expect(cadenceFunctions(t).arrival, `${t} should arrive on T`).toBe('T')
    }
    // half cadences STOP on the dominant — the arrival is the dominant itself
    expect(cadenceFunctions('half').arrival).toBe('D')
    expect(cadenceFunctions('phrygian-half').arrival).toBe('D')
    // the deceptive cadence lands on a tonic SUBSTITUTE, which is why it
    // fools the ear
    expect(cadenceFunctions('deceptive').arrival).toBe('T')
    // every authentic-family cadence is approached from the dominant
    for (const t of ['PAC', 'IAC', 'deceptive', 'evaded'] as const) {
      expect(cadenceFunctions(t).approach, `${t} approached from D`).toBe('D')
    }
    // the plagal is approached from the predominant — no leading tone anywhere
    expect(cadenceFunctions('plagal').approach).toBe('PD')
  })

  it('exposes cadence spans, filtered by mode', () => {
    expect(cadenceSpans()).toHaveLength(7)
    // the Phrygian half cadence is minor-only and drops out of a major query
    const majorIds = cadenceSpans('major').map((s) => s.id)
    expect(majorIds).not.toContain('cadence-phrygian-half')
    expect(cadenceSpans('minor').map((s) => s.id)).toContain(
      'cadence-phrygian-half'
    )
  })

  it('labels every type for a human', () => {
    for (const t of types) {
      expect(cadenceLabel(t).length).toBeGreaterThan(3)
    }
    expect(cadenceLabel('PAC')).toBe('perfect authentic cadence')
    expect(cadenceLabel('phrygian-half')).toBe('Phrygian half cadence')
  })

  it('orders definitions most-specific-first and deterministically', () => {
    const spec = cadenceDefinitions.map((d) => d.specificity)
    expect(spec).toEqual([...spec].sort((a, b) => b - a))
    // the evaded cadence pins both figures and is the most specific
    expect(cadenceDefinitions[0].type).toBe('evaded')
    // repeated reads are the same array in the same order
    expect(cadenceDefinitions.map((d) => d.type)).toEqual(
      cadenceDefinitions.map((d) => d.type)
    )
  })

  it('tags every roman it names with a harmonic function', () => {
    // a cadence definition naming a roman the function table cannot tag would
    // make the pathfinder unable to weight a route to it
    for (const def of cadenceDefinitions) {
      for (const r of [...def.approach, ...def.arrival]) {
        // figured romans are tagged via their unfigured base
        expect(functionOf(r), `${def.type} names untaggable roman ${r}`).not.toBeNull()
      }
    }
  })
})

describe('romanOf — resolving a realized chord back to its function', () => {
  it('names the minor-key leading-tone chords, which romanInKey cannot', () => {
    // THE probe that decided this module's design: romanInKey measures against
    // the NATURAL minor scale and returns null for G#dim, the most
    // characteristic dominant in A minor.
    expect(romanOf('G#dim', 'A', 'minor')).toBe('VIIdim')
    expect(romanOf('G#dim7', 'A', 'minor')).toBe('VIIdim7')
  })

  it('agrees with the chart on the romans the chart carries', () => {
    expect(romanOf('C', 'C', 'major')).toBe('I')
    expect(romanOf('G7', 'C', 'major')).toBe('V7')
    expect(romanOf('Bdim', 'C', 'major')).toBe('VIIdim')
    expect(romanOf('Bm7b5', 'C', 'major')).toBe('VIIm7b5')
    expect(romanOf('Am', 'A', 'minor')).toBe('Im')
    expect(romanOf('E', 'A', 'minor')).toBe('V')
    expect(romanOf('Dm', 'A', 'minor')).toBe('IVm')
    expect(romanOf('F', 'A', 'minor')).toBe('VI')
  })

  it('disambiguates one name across two keys', () => {
    // Bdim is the leading-tone triad in C major and the supertonic in A minor
    expect(romanOf('Bdim', 'C', 'major')).toBe('VIIdim')
    expect(romanOf('Bdim', 'A', 'minor')).toBe('IIdim')
  })

  it('returns null for a chord foreign to the key rather than guessing', () => {
    expect(romanOf('Db', 'C', 'major')).toBeNull()
    expect(romanOf('Xyz', 'C', 'major')).toBeNull()
  })
})

describe('scaleDegreeOf', () => {
  it('reads degrees in major', () => {
    expect(scaleDegreeOf('C', 'C', 'major')).toBe(1)
    expect(scaleDegreeOf('E5', 'C', 'major')).toBe(3)
    expect(scaleDegreeOf('B3', 'C', 'major')).toBe(7)
  })

  it('reads the RAISED seventh in minor via harmonic minor', () => {
    // A minor's leading tone is G#, absent from the natural minor scale. A
    // degree function that only knew natural minor would call the leading tone
    // nothing at all.
    expect(scaleDegreeOf('G#', 'A', 'minor')).toBe(7)
    expect(scaleDegreeOf('G', 'A', 'minor')).toBe(7)
    expect(scaleDegreeOf('A4', 'A', 'minor')).toBe(1)
  })

  it('returns null for a note outside the key', () => {
    expect(scaleDegreeOf('C#', 'C', 'major')).toBeNull()
  })
})

describe('detectCadences — labelling music already written', () => {
  it('finds the authentic cadence ending I-IV-V-I', () => {
    const r = detectCadences(['C', 'F', 'G', 'C'], 'C', 'major')
    const authentic = r.find((c) => c.index === 2)!
    expect(authentic.type).toBe('IAC')
    expect(authentic.romans).toEqual(['V', 'I'])
    // no soprano was supplied, so PAC cannot be confirmed — the weaker,
    // safer label at medium confidence
    expect(authentic.confidence).toBe('medium')
    expect(authentic.reason).toMatch(/no soprano/i)
  })

  it('upgrades to PAC when the soprano and bass are supplied', () => {
    const r = detectCadences(
      [
        { name: 'G', bass: 'G2' },
        { name: 'C', soprano: 'C5', bass: 'C3' },
      ],
      'C',
      'major'
    )
    expect(r).toHaveLength(1)
    expect(r[0].type).toBe('PAC')
    expect(r[0].confidence).toBe('high')
    expect(r[0].reason).toMatch(/perfect authentic/)
  })

  it('keeps it an IAC when the soprano lands on 3', () => {
    const r = detectCadences(
      ['G', { name: 'C', soprano: 'E5', bass: 'C3' }],
      'C',
      'major'
    )
    expect(r[0].type).toBe('IAC')
    expect(r[0].confidence).toBe('high')
    expect(r[0].reason).toMatch(/soprano on 3/)
  })

  it('keeps it an IAC when a chord is inverted, even with soprano on 1', () => {
    const r = detectCadences(
      ['G', { name: 'C', figure: '6', soprano: 'C5' }],
      'C',
      'major'
    )
    expect(r[0].type).toBe('IAC')
    expect(r[0].reason).toMatch(/inversion/)
  })

  it('finds a half cadence, and rates it by where it falls', () => {
    // ending on the dominant: a real half cadence
    const ending = detectCadences(['C', 'Am', 'F', 'G'], 'C', 'major')
    const hc = ending.find((c) => c.type === 'half')!
    expect(hc.confidence).toBe('high')
    expect(hc.romans).toEqual(['IV', 'V'])

    // the same pair mid-phrase may just be a passing dominant, and a chord
    // list cannot tell — reported, but as weak
    const middle = detectCadences(['C', 'F', 'G', 'C'], 'C', 'major')
    const weak = middle.find((c) => c.type === 'half')!
    expect(weak.confidence).toBe('low')
    expect(weak.reason).toMatch(/only if the phrase stops here/)
  })

  it('finds the deceptive cadence in both modes', () => {
    const maj = detectCadences(['C', 'F', 'Dm', 'G', 'Am'], 'C', 'major')
    const d1 = maj.find((c) => c.type === 'deceptive')!
    expect(d1.romans).toEqual(['V', 'VIm'])
    expect(d1.confidence).toBe('high')

    // in minor the deceptive cadence lands on the MAJOR submediant (F in A
    // minor) and the chart spells it VI. Stage M-C (C2) gave that pair an edge
    // so it is routable too; detection never needed one.
    const min = detectCadences(['Am', 'Dm', 'E', 'F'], 'A', 'minor')
    const d2 = min.find((c) => c.type === 'deceptive')!
    expect(d2.romans).toEqual(['V', 'VI'])
    expect(d2.chords).toEqual(['E', 'F'])
  })

  it('finds the plagal cadence in MINOR, which detection never needed the chart for', () => {
    // The case that proved detection must not be chart-driven. When this test
    // was written `IVm -> Im` was absent from the minor chart and this was a
    // completely standard cadence the pathfinder could not route to; Stage M-C
    // (C2) added the edge. The assertion is unchanged and still load-bearing:
    // it pins that detection matches ROMANS, so it never depended on the fix.
    const r = detectCadences(['Am', 'Dm', 'Am'], 'A', 'minor')
    const plagal = r.find((c) => c.type === 'plagal')!
    expect(plagal.romans).toEqual(['IVm', 'Im'])
    expect(plagal.chords).toEqual(['Dm', 'Am'])
    expect(plagal.confidence).toBe('high')
  })

  it('finds the plagal cadence in major', () => {
    const r = detectCadences(['G', 'C', 'F', 'C'], 'C', 'major')
    expect(r.find((c) => c.type === 'plagal')!.romans).toEqual(['IV', 'I'])
  })

  it('finds the evaded cadence — and only when the figures are there', () => {
    const evaded = detectCadences(
      [
        { name: 'G7', figure: '42' },
        { name: 'C', figure: '6' },
      ],
      'C',
      'major'
    )
    expect(evaded[0].type).toBe('evaded')
    // the label must SHOW the figures: 'V7 -> I' would name the right chords
    // and describe the wrong device
    expect(evaded[0].romans).toEqual(['V42', 'I6'])
    expect(evaded[0].reason).toMatch(/seventh in the bass/)

    // the same chords WITHOUT figures are an ordinary authentic cadence.
    // Inferring an evaded cadence from silence would be a confident wrong
    // answer, which is the one thing this module must not do.
    const plain = detectCadences(['G7', 'C'], 'C', 'major')
    expect(plain[0].type).not.toBe('evaded')
    expect(plain[0].type).toBe('IAC')
  })

  it('finds the Phrygian half cadence in minor, on the figure', () => {
    const r = detectCadences([{ name: 'Dm', figure: '6' }, 'E'], 'A', 'minor')
    expect(r[0].type).toBe('phrygian-half')
    expect(r[0].romans).toEqual(['IVm6', 'V'])
    expect(r[0].reason).toMatch(/semitone/)
  })

  it('does NOT call root-position iv-V a Phrygian cadence', () => {
    // without the first inversion the bass does not fall by a semitone; this
    // is an ordinary half cadence
    const r = detectCadences(['Dm', 'E'], 'A', 'minor')
    expect(r[0].type).toBe('half')
  })

  it('does NOT call IV6-V in MAJOR a Phrygian cadence', () => {
    // the same chords and the same figure, but in major the bass step is a
    // WHOLE tone and the device evaporates. This is the mode restriction
    // doing real work.
    const r = detectCadences([{ name: 'F', figure: '6' }, 'G'], 'C', 'major')
    expect(r[0].type).toBe('half')
    expect(r.find((c) => c.type === 'phrygian-half')).toBeUndefined()
  })

  it('reports only one label per pair', () => {
    // a V-I is not simultaneously a PAC and an IAC
    const r = detectCadences(['G', 'C'], 'C', 'major')
    expect(r).toHaveLength(1)
  })

  it('does not label vii-dim to i — a missing label, not a wrong one', () => {
    // a strong resolution, but not a named cadence type in the standard
    // taxonomy. Inventing vocabulary would be worse than saying nothing.
    const r = detectCadences(['Am', 'G#dim', 'Am'], 'A', 'minor')
    expect(r).toEqual([])
  })

  it('never throws on degenerate input', () => {
    expect(detectCadences([], 'C', 'major')).toEqual([])
    expect(detectCadences(['C'], 'C', 'major')).toEqual([])
    expect(detectCadences(['Xyz', 'C'], 'C', 'major')).toEqual([])
    expect(detectCadences(['C', 'Xyz'], 'C', 'major')).toEqual([])
    // a nonsense key must not throw either
    expect(() => detectCadences(['C', 'G'], 'H', 'major')).not.toThrow()
  })

  it('is deterministic across repeated calls', () => {
    const prog = ['C', 'F', 'Dm', 'G', 'Am', 'F', 'G', 'C']
    const a = detectCadences(prog, 'C', 'major')
    const b = detectCadences(prog, 'C', 'major')
    expect(a).toEqual(b)
  })

  it('reports indices pointing at the APPROACH chord', () => {
    const r = detectCadences(['C', 'F', 'G', 'C'], 'C', 'major')
    for (const c of r) {
      expect(c.chords[0]).toBe(['C', 'F', 'G', 'C'][c.index])
      expect(c.chords[1]).toBe(['C', 'F', 'G', 'C'][c.index + 1])
    }
  })
})

describe('isCadentialPair', () => {
  it('recognizes the pairs each type accepts', () => {
    expect(isCadentialPair('V', 'I', 'PAC')).toBe(true)
    expect(isCadentialPair('V7', 'I', 'PAC')).toBe(true)
    expect(isCadentialPair('V', 'Im', 'PAC')).toBe(true)
    expect(isCadentialPair('V', 'VIm', 'deceptive')).toBe(true)
    expect(isCadentialPair('V', 'VI', 'deceptive')).toBe(true)
    expect(isCadentialPair('IV', 'I', 'plagal')).toBe(true)
    expect(isCadentialPair('IIm', 'V', 'half')).toBe(true)
  })

  it('rejects pairs a type does not accept', () => {
    expect(isCadentialPair('IV', 'I', 'PAC')).toBe(false)
    expect(isCadentialPair('V', 'I', 'deceptive')).toBe(false)
    expect(isCadentialPair('V', 'I', 'half')).toBe(false)
  })
})
