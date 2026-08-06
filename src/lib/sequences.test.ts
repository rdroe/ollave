import { describe, expect, it } from 'vitest'

import { bassOf, edgeChord, edgeFigure, figureFitsChord } from './figuredBass'
import type { HarmonicSpan } from './graphData/types'
import { romanChordNameToReal } from './graphh'
import { nextChord } from './nextChord'
import { spanRomans, spanWaivedRules } from './spans'
import {
  applySequence,
  defaultStartDegree,
  degreeRoman,
  sequenceById,
  sequenceEdges,
  sequenceRomans,
  sequenceWaivedRules,
  sequences,
  sequencesOfMode,
} from './sequences'

describe('the sequence library', () => {
  it('carries the sequences B5 promised', () => {
    expect(sequences.map((s) => s.id).sort()).toEqual([
      'ascending-5-6',
      'descending-5-6',
      'descending-fifths',
      'descending-fifths-applied',
      'fonte',
      'monte',
      'ponte',
    ])
  })

  it('has a stable, unique, kebab-case id for every pattern', () => {
    const ids = sequences.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id, id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('tags every pattern as a sequence, so one registry can filter them', () => {
    for (const s of sequences) expect(s.kind, s.id).toBe('sequence')
  })

  it('gives every pattern a title, notes and a non-empty unit', () => {
    for (const s of sequences) {
      expect(s.title, s.id).toBeTruthy()
      expect(s.notes, s.id).toBeTruthy()
      expect(s.unit.length, s.id).toBeGreaterThanOrEqual(1)
      expect(s.defaultRepeats, s.id).toBeGreaterThanOrEqual(1)
    }
  })

  it('looks a pattern up by id', () => {
    expect(sequenceById('monte')?.title).toBe('Monte (Galant rising sequence)')
    expect(sequenceById('nope')).toBeUndefined()
  })
})

describe('a SequencePattern IS a HarmonicSpan (the structural extension)', () => {
  // The extension is an INTERSECTION, not a competing type: every pattern must
  // be usable by anything in spans.ts without conversion. If this ever stops
  // compiling, the extension has drifted into a parallel vocabulary.
  it('is assignable to HarmonicSpan and works with the spans.ts accessors', () => {
    for (const pattern of sequences) {
      const asSpan: HarmonicSpan = pattern
      expect(asSpan.id).toBe(pattern.id)
      // spanRomans is spans.ts's accessor, applied to a sequence unchanged
      expect(spanRomans(asSpan)).toEqual(
        pattern.steps.map((s) => {
          const f = edgeFigure(s)
          return f ? `${edgeChord(s)}${f}` : edgeChord(s)
        })
      )
      expect(spanWaivedRules(asSpan)).toEqual(sequenceWaivedRules(pattern))
    }
  })

  it('fills steps with a representative realization, so the span is well-formed', () => {
    // A consumer that knows nothing about generation still sees real steps.
    for (const s of sequences) {
      expect(s.steps.length, s.id).toBe(s.unit.length * s.defaultRepeats)
      expect(s.steps.length, s.id).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('degreeRoman — the diatonic tables the generator walks', () => {
  it('names the major-mode triads', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => degreeRoman(d, 'major'))).toEqual([
      'I',
      'IIm',
      'IIIm',
      'IV',
      'V',
      'VIm',
      'VIIdim',
    ])
  })

  it('names the minor-mode triads with a MAJOR dominant and a leading-tone vii', () => {
    // harmonic-minor practice, which is what the charts already encode
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => degreeRoman(d, 'minor'))).toEqual([
      'Im',
      'IIdim',
      'III',
      'IVm',
      'V',
      'VI',
      'VIIdim',
    ])
  })

  it('wraps out-of-range degrees in both directions', () => {
    expect(degreeRoman(7, 'major')).toBe('I')
    expect(degreeRoman(-1, 'major')).toBe('VIIdim')
    expect(degreeRoman(-7, 'major')).toBe('I')
    expect(degreeRoman(14, 'major')).toBe('I')
  })

  it('offers the diatonic sevenths as a separate quality', () => {
    expect(degreeRoman(4, 'major', 'seventh')).toBe('V7')
    expect(degreeRoman(1, 'major', 'seventh')).toBe('IIm7')
    expect(degreeRoman(6, 'major', 'seventh')).toBe('VIIm7b5')
    expect(degreeRoman(6, 'minor', 'seventh')).toBe('VIIdim7')
  })
})

describe('descending fifths — DIATONIC', () => {
  const pattern = sequenceById('descending-fifths')!

  it('falls by fifth through the whole scale and returns to the tonic', () => {
    // I - IV - vii - iii - vi - ii - V - I: the most common sequence in tonal
    // music. Hand-verified against Aldwell & Schachter ch. 27.
    expect(applySequence(pattern, 8, { mode: 'major' }).romans).toEqual([
      'I',
      'IV',
      'VIIdim',
      'IIIm',
      'VIm',
      'IIm',
      'V',
      'I',
    ])
  })

  it('does the same in minor, with the leading-tone chord', () => {
    expect(applySequence(pattern, 8, { mode: 'minor' }).romans).toEqual([
      'Im',
      'IVm',
      'VIIdim',
      'III',
      'VI',
      'IIdim',
      'V',
      'Im',
    ])
  })

  it('has exactly ONE diminished-fifth link, because it stays diatonic', () => {
    // The irregular link is a property of the diatonic scale, not a defect —
    // it is precisely why the applied-dominant form exists as its own device.
    // In C major the link is F -> Bdim, a tritone rather than a perfect fifth.
    const romans = applySequence(pattern, 8, { mode: 'major' }).romans
    const real = romans.map((r) => romanChordNameToReal('C', 'major', r))
    expect(real).toEqual(['C', 'F', 'Bdim', 'Em', 'Am', 'Dm', 'G', 'C'])
    // only one diminished triad appears, and it is the irregular link
    expect(real.filter((r) => r.endsWith('dim'))).toEqual(['Bdim'])
  })

  it('realizes correctly in a flat key', () => {
    const romans = applySequence(pattern, 8, { mode: 'major' }).romans
    expect(romans.map((r) => romanChordNameToReal('Eb', 'major', r))).toEqual([
      'Eb',
      'Ab',
      'Ddim',
      'Gm',
      'Cm',
      'Fm',
      'Bb',
      'Eb',
    ])
  })

  it('uses the leading-tone chord in A minor, not the subtonic', () => {
    // G#dim, not Gdim — harmonic-minor practice, which romanChordNameToReal
    // special-cases for the whole VII-diminished family.
    const romans = applySequence(pattern, 4, { mode: 'minor' }).romans
    expect(romans.map((r) => romanChordNameToReal('A', 'minor', r))).toEqual([
      'Am',
      'Dm',
      'G#dim',
      'C',
    ])
  })
})

describe('descending fifths — APPLIED DOMINANTS (a different object)', () => {
  const pattern = sequenceById('descending-fifths-applied')!

  it('makes every chord the dominant seventh of the next', () => {
    // V7/ii - ii - V7/V - V - V7/I - I. Starting on the supertonic is what
    // lands the chain on the tonic; see DEFAULT_START_DEGREE for why starting
    // on the tonic instead produces a tonicization of the leading-tone triad.
    expect(sequenceRomans(pattern)).toEqual([
      'V7/II',
      'IIm',
      'V7/V',
      'V',
      'V7/I',
      'I',
    ])
  })

  it('realizes as a real circle of fifths in C major', () => {
    const real = sequenceRomans(pattern).map((r) =>
      romanChordNameToReal('C', 'major', r)
    )
    // A7 -> Dm -> D7 -> G -> G7 -> C: each chord the dominant of the next
    expect(real).toEqual(['A7', 'Dm', 'D7', 'G', 'G7', 'C'])
  })

  it('realizes in a flat key and in minor', () => {
    expect(
      sequenceRomans(pattern).map((r) => romanChordNameToReal('Eb', 'major', r))
    ).toEqual(['C7', 'Fm', 'F7', 'Bb', 'Bb7', 'Eb'])
    expect(
      sequenceRomans(pattern, { mode: 'minor' }).map((r) =>
        romanChordNameToReal('A', 'minor', r)
      )
    ).toEqual(['F#7', 'Bdim', 'B7', 'E', 'E7', 'Am'])
  })

  it('is NOT the same object as the diatonic form', () => {
    // An expert wants both: one is a scalar pattern that moves by fifth, the
    // other a chain of real tonicizations. They sound and voice-lead
    // differently, so they are two library entries, not a flag on one.
    const diatonic = sequenceById('descending-fifths')!
    expect(pattern.id).not.toBe(diatonic.id)
    expect(pattern.unit.length).toBe(2)
    expect(diatonic.unit.length).toBe(1)
    expect(pattern.unit[0]!.applied).toBe('seventh')
    expect(diatonic.unit[0]!.applied).toBeUndefined()
  })
})

describe('ascending 5-6 — the sequence that avoids parallel fifths', () => {
  const pattern = sequenceById('ascending-5-6')!

  it('alternates 5/3 and 6/3 over a stepwise rising bass', () => {
    // I - vi6 - ii - vii6 - iii - I6 - IV - ii6. Each bass note carries its
    // 5th then its 6th; the 6/3 above bass degree d is the chord rooted d-2.
    expect(sequenceRomans(pattern)).toEqual([
      'I',
      'VIm6',
      'IIm',
      'VIIdim6',
      'IIIm',
      'I6',
      'IV',
      'IIm6',
    ])
  })

  it('REQUIRES first-inversion chords — the figures are the device', () => {
    // Without the 6/3s a stepwise rising bass under root-position triads
    // produces parallel fifths on every step. That is the whole point.
    const edges = sequenceEdges(applySequence(pattern, 8))
    const figured = edges.filter((e) => edgeFigure(e) !== null)
    expect(figured).toHaveLength(4)
    for (const e of figured) expect(edgeFigure(e)).toBe('6')
  })

  it('puts the bass on the same degree for each 5-6 pair', () => {
    // the 5/3's root and the following 6/3's BASS must be the same note —
    // that identity is what makes it a 5-6 rather than two unrelated chords
    for (const [tonic, scale, mode] of [
      ['C', 'major', 'major'],
      ['Eb', 'major', 'major'],
      ['A', 'minor', 'minor'],
    ] as const) {
      const chords = applySequence(pattern, 8, { mode }).chords
      for (let i = 0; i < chords.length; i += 2) {
        const five = chords[i]!
        const six = chords[i + 1]!
        const fiveReal = romanChordNameToReal(tonic, scale, edgeChord(five.edge))
        const sixReal = romanChordNameToReal(tonic, scale, edgeChord(six.edge))
        // root of the 5/3 == bass of the 6/3
        const fiveRoot = fiveReal.replace(/(m7b5|maj7|dim7|m7|dim|maj|m|7)$/, '')
        expect(bassOf(sixReal, '6'), `${tonic} ${scale} pair ${i / 2}`).toBe(
          fiveRoot
        )
      }
    }
  })

  it('realizes in three keys', () => {
    const romans = sequenceRomans(pattern)
    expect(romans.map((r) => romanChordNameToReal('C', 'major', r.replace(/6$/, '')))).toEqual(
      ['C', 'Am', 'Dm', 'Bdim', 'Em', 'C', 'F', 'Dm']
    )
    expect(
      romans.map((r) => romanChordNameToReal('Eb', 'major', r.replace(/6$/, '')))
    ).toEqual(['Eb', 'Cm', 'Fm', 'Ddim', 'Gm', 'Eb', 'Ab', 'Fm'])
    expect(
      sequenceRomans(pattern, { mode: 'minor' }).map((r) =>
        romanChordNameToReal('A', 'minor', r.replace(/6$/, ''))
      )
    ).toEqual(['Am', 'F', 'Bdim', 'G#dim', 'C', 'Am', 'Dm', 'Bdim'])
  })
})

describe('descending 5-6 — the Romanesca / Pachelbel ground', () => {
  const pattern = sequenceById('descending-5-6')!

  it('falls by step through the bass: I - V6 - vi - iii6 - IV - I6 - ii - vi6', () => {
    expect(sequenceRomans(pattern)).toEqual([
      'I',
      'V6',
      'VIm',
      'IIIm6',
      'IV',
      'I6',
      'IIm',
      'VIm6',
    ])
  })

  it('produces M-A descending-bass-idiom as its first six chords', () => {
    // Not a duplication: that span is a fixed IDIOM which breaks the pattern to
    // cadence (IV - V), while this is the GENERATOR it is a truncation of.
    // Pinning the relationship keeps the two honest about each other.
    const first6 = applySequence(pattern, 6).romans
    expect(first6).toEqual(['I', 'V6', 'VIm', 'IIIm6', 'IV', 'I6'])
  })

  it('realizes in three keys', () => {
    const romans = sequenceRomans(pattern)
    expect(
      romans.map((r) => romanChordNameToReal('C', 'major', r.replace(/6$/, '')))
    ).toEqual(['C', 'G', 'Am', 'Em', 'F', 'C', 'Dm', 'Am'])
    expect(
      romans.map((r) => romanChordNameToReal('Eb', 'major', r.replace(/6$/, '')))
    ).toEqual(['Eb', 'Bb', 'Cm', 'Gm', 'Ab', 'Eb', 'Fm', 'Cm'])
    expect(
      sequenceRomans(pattern, { mode: 'minor' }).map((r) =>
        romanChordNameToReal('A', 'minor', r.replace(/6$/, ''))
      )
    ).toEqual(['Am', 'E', 'F', 'C', 'Dm', 'Am', 'Bdim', 'F'])
  })
})

describe('the Galant schemata (Gjerdingen)', () => {
  it('MONTE rises by step through applied-dominant PAIRS', () => {
    // V7/IV - IV then V7/V - V: the canonical monte, prolonging and
    // re-approaching the dominant. NOT merely "chords going up" — the
    // applied-dominant pair is essential to the schema.
    const monte = sequenceById('monte')!
    expect(sequenceRomans(monte)).toEqual(['V7/IV', 'IV', 'V7/V', 'V'])
    expect(monte.transposition).toBe(1)
    expect(monte.unit[0]!.applied).toBe('seventh')
    expect(
      sequenceRomans(monte).map((r) => romanChordNameToReal('C', 'major', r))
    ).toEqual(['C7', 'F', 'D7', 'G'])
    expect(
      sequenceRomans(monte).map((r) => romanChordNameToReal('Eb', 'major', r))
    ).toEqual(['Eb7', 'Ab', 'F7', 'Bb'])
  })

  it('FONTE falls by step and lands on the tonic', () => {
    // V7/ii - ii then V7/I - I: the standard way back to the home key after
    // the double bar of a galant binary movement. The minor-then-major landing
    // is its audible signature.
    const fonte = sequenceById('fonte')!
    expect(sequenceRomans(fonte)).toEqual(['V7/II', 'IIm', 'V7/I', 'I'])
    expect(fonte.transposition).toBe(-1)
    expect(
      sequenceRomans(fonte).map((r) => romanChordNameToReal('C', 'major', r))
    ).toEqual(['A7', 'Dm', 'G7', 'C'])
    // it must START on the supertonic — that is what makes it land home
    expect(defaultStartDegree(fonte)).toBe(1)
  })

  it('distinguishes monte from fonte by DIRECTION, sharing the unit shape', () => {
    // Both are applied-dominant pairs; the sign of the transposition is the
    // difference, which is exactly what a generator can express and a fixed
    // chord list cannot.
    const monte = sequenceById('monte')!
    const fonte = sequenceById('fonte')!
    expect(monte.transposition).toBe(1)
    expect(fonte.transposition).toBe(-1)
    expect(monte.unit.map((u) => u.applied)).toEqual(fonte.unit.map((u) => u.applied))
  })

  it('PONTE holds the dominant and transposes NOTHING', () => {
    // A ponte is not a sequence in the strict sense: nothing moves, which is
    // the device. transposition 0 is an honest use of the generator.
    const ponte = sequenceById('ponte')!
    expect(ponte.transposition).toBe(0)
    expect(ponte.conditions?.bass?.motion).toBe('static')
    expect(applySequence(ponte, 4).romans).toEqual(['V', 'I64', 'V', 'I64'])
  })

  it('lets the ponte end on the dominant when asked for an odd length', () => {
    // the shape that hands over to whatever follows the bridge
    const ponte = sequenceById('ponte')!
    const r = applySequence(ponte, 5)
    expect(r.romans).toEqual(['V', 'I64', 'V', 'I64', 'V'])
    expect(r.stopReason).toBe('truncated-mid-unit')
  })

  it('keeps scale degree 5 in the bass throughout the ponte', () => {
    // the identity of the device: the 6/4 is over the HELD dominant, so its
    // bass must be the same note as the V it decorates
    for (const [tonic, scale, mode] of [
      ['C', 'major', 'major'],
      ['Eb', 'major', 'major'],
      ['A', 'minor', 'minor'],
    ] as const) {
      const chords = applySequence(sequenceById('ponte')!, 4, { mode }).chords
      const vReal = romanChordNameToReal(tonic, scale, edgeChord(chords[0]!.edge))
      const sixFour = romanChordNameToReal(
        tonic,
        scale,
        edgeChord(chords[1]!.edge)
      )
      const vRoot = vReal.replace(/(m7b5|maj7|dim7|m7|dim|maj|m|7)$/, '')
      expect(bassOf(sixFour, '64'), `${tonic} ${scale}`).toBe(vRoot)
    }
  })
})

describe('applySequence — length, truncation and the wrap policy', () => {
  const df = sequenceById('descending-fifths')!

  it('treats length as a NUMBER OF CHORDS, not of restatements', () => {
    expect(applySequence(df, 4).romans).toHaveLength(4)
    expect(applySequence(sequenceById('monte')!, 4).romans).toHaveLength(4)
  })

  it('reports a mid-unit cut instead of silently rounding', () => {
    // real sequences are routinely broken off mid-unit to cadence
    const cut = applySequence(sequenceById('monte')!, 3, { startDegree: 3 })
    expect(cut.romans).toEqual(['V7/IV', 'IV', 'V7/V'])
    expect(cut.stopReason).toBe('truncated-mid-unit')
    expect(applySequence(df, 4).stopReason).toBe('complete')
  })

  it('WRAPS rather than exiting the key, and says so', () => {
    // The honest answer to "what happens off the end of the diatonic set":
    // this generator keeps every chord spellable in the requested key and
    // reports the wrap, rather than silently modulating.
    const short = applySequence(df, 4)
    expect(short.wrapped).toBe(false)
    const long = applySequence(df, 10)
    expect(long.wrapped).toBe(true)
    // and every chord is still a real chord IN THE KEY
    for (const r of long.romans) {
      expect(romanChordNameToReal('C', 'major', r), r).toBeTruthy()
    }
  })

  it('comes back round to where it began after a full cycle', () => {
    const full = applySequence(df, 8)
    expect(full.romans[0]).toBe('I')
    expect(full.romans[7]).toBe('I')
  })

  it('does not flag a wrap merely because a unit step reaches outside 0..6', () => {
    // the ascending 5-6's 6/3 is written { degree: -2 } and is negative on the
    // very first chord; a per-step test would call a stationary sequence
    // wrapped. Measured against the UNIT START instead.
    expect(applySequence(sequenceById('ascending-5-6')!, 8).wrapped).toBe(false)
    expect(applySequence(sequenceById('descending-5-6')!, 8).wrapped).toBe(false)
  })

  it('starts wherever the caller asks', () => {
    expect(applySequence(df, 5, { startDegree: 5 }).romans).toEqual([
      'VIm',
      'IIm',
      'V',
      'I',
      'IV',
    ])
  })

  it('returns an empty realization for a non-positive length, never throws', () => {
    // a caller computing a length from a bar count can legitimately reach zero
    expect(applySequence(df, 0).romans).toEqual([])
    expect(applySequence(df, -3).romans).toEqual([])
    expect(applySequence(df, 0).stopReason).toBe('complete')
  })

  it('carries per-chord provenance a caller can act on', () => {
    const r = applySequence(sequenceById('monte')!, 4, { startDegree: 3 })
    expect(r.chords.map((c) => c.restatement)).toEqual([0, 0, 1, 1])
    expect(r.chords.map((c) => c.indexInUnit)).toEqual([0, 1, 0, 1])
    // an applied chord's root is chromatic, so it has no scale degree
    expect(r.chords[0]!.degree).toBeNull()
    expect(r.chords[1]!.degree).toBe(3)
  })

  it('emits chart edges the rest of the library already speaks', () => {
    const edges = sequenceEdges(applySequence(sequenceById('ascending-5-6')!, 4))
    expect(edges[0]).toBe('I')
    expect(edges[1]).toEqual({ chord: 'VIm', figure: '6' })
  })
})

describe('every realized chord is real, in every key we claim to support', () => {
  const keys: [mode: 'major' | 'minor', tonic: string, scale: string][] = [
    ['major', 'C', 'major'],
    ['major', 'Eb', 'major'],
    ['major', 'F#', 'major'],
    ['minor', 'A', 'minor'],
    ['minor', 'Bb', 'minor'],
    ['minor', 'G#', 'minor'],
  ]

  it.each(keys)('realizes every %s sequence in %s %s', (mode, tonic, scale) => {
    for (const pattern of sequencesOfMode(mode)) {
      const r = applySequence(pattern, pattern.unit.length * pattern.defaultRepeats, {
        mode,
        startDegree: defaultStartDegree(pattern),
      })
      for (const chord of r.chords) {
        const roman = edgeChord(chord.edge)
        const realized = romanChordNameToReal(tonic, scale, roman)
        expect(
          realized,
          `${pattern.id}: ${roman} in ${tonic} ${scale}`
        ).toBeTruthy()

        const figure = edgeFigure(chord.edge)
        if (figure) {
          // the figure must actually APPLY — no '42' on a triad anywhere
          expect(
            figureFitsChord(realized, figure),
            `${pattern.id}: ${roman}${figure} -> ${realized} in ${tonic} ${scale}`
          ).toBe(true)
          expect(bassOf(realized, figure)).toBeTruthy()
        }
      }
    }
  })
})

describe('waivers — declared for B1, whose checker is being built in parallel', () => {
  // Same documented set spans.test.ts pins. B1 owns the catalogue; this test is
  // what catches a typo on this side of the fence.
  const KNOWN_RULES = [
    'parallel-fifths',
    'parallel-octaves',
    'parallel-fourths',
    'doubled-leading-tone',
    'unresolved-seventh',
    'voice-crossing',
    'voice-overlap',
    'hidden-fifths',
    'hidden-octaves',
    'augmented-second',
    'spacing',
  ]

  it('uses only known rule ids', () => {
    for (const s of sequences) {
      for (const rule of sequenceWaivedRules(s)) {
        expect(KNOWN_RULES, `${s.id} waives unknown rule '${rule}'`).toContain(rule)
      }
    }
  })

  it('gives every waiver a human-readable reason', () => {
    for (const s of sequences) {
      for (const w of s.waivers ?? []) {
        expect(w.reason, `${s.id} ${w.rule}`).toBeTruthy()
        expect(w.reason.length, `${s.id} ${w.rule}`).toBeGreaterThan(20)
      }
    }
  })

  it('licenses the doubled leading tone a strict sequence tolerates', () => {
    // the classic case named in the plan: breaking the pattern to avoid it is
    // the greater fault, so the checker must not red-ink the library's own
    // output
    expect(sequenceWaivedRules(sequenceById('descending-fifths')!)).toContain(
      'doubled-leading-tone'
    )
    expect(sequenceWaivedRules(sequenceById('ascending-5-6')!)).toContain(
      'doubled-leading-tone'
    )
  })

  it('licenses the hanging seventh a truncated chain leaves behind', () => {
    expect(
      sequenceWaivedRules(sequenceById('descending-fifths-applied')!)
    ).toContain('unresolved-seventh')
  })

  it('surfaces the waived rules on every realization, so B1 need not re-derive', () => {
    const r = applySequence(sequenceById('descending-fifths')!, 8)
    expect(r.waivedRules).toContain('doubled-leading-tone')
    expect(r.waivedRules).toEqual(
      sequenceWaivedRules(sequenceById('descending-fifths')!)
    )
  })

  it('keeps step-scoped waivers within the representative span', () => {
    for (const s of sequences) {
      for (const w of s.waivers ?? []) {
        for (const idx of w.steps ?? []) {
          expect(idx, `${s.id} ${w.rule}`).toBeGreaterThanOrEqual(0)
          expect(idx, `${s.id} ${w.rule}`).toBeLessThan(s.steps.length)
        }
      }
    }
  })

  it('waives nothing on the sequences that break no rules', () => {
    // descending 5-6 and the ponte are ordinary voice leading; claiming a
    // waiver they do not need would suppress real errors in B1
    expect(sequenceWaivedRules(sequenceById('descending-5-6')!)).toEqual([])
    expect(sequenceWaivedRules(sequenceById('ponte')!)).toEqual([])
  })
})

describe('sequencesOfMode — the registry, matching spansOfKind behaviour', () => {
  it('treats a pattern with no declared modes as belonging to both', () => {
    // same rule spansOfKind applies, so the two registries behave alike
    expect(sequencesOfMode('major').map((s) => s.id).sort()).toEqual(
      sequencesOfMode('minor').map((s) => s.id).sort()
    )
    expect(sequencesOfMode('major')).toHaveLength(sequences.length)
  })
})

describe('sequences add NOTHING to the graph', () => {
  it('leaves nextChord output byte-identical', () => {
    // A sequence is a parallel, additive channel exactly as a span is. This is
    // the property this module must not break, restated from spans.test.ts.
    expect(nextChord('C,3', 'C', 'major')).toEqual([
      'C',
      'Em',
      'Am',
      'F',
      'Dm',
      'V64',
      'Bdim',
      'G',
    ])
    expect(nextChord('E,3', 'A', 'minor')).toEqual(['Am'])
  })
})
