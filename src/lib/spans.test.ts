import { describe, expect, it } from 'vitest'

import { bassOf, edgeChord, edgeFigure, figureFitsChord } from './figuredBass'
import type { HarmonicSpan } from './graphData/types'
import { nextChord } from './nextChord'
import {
  spanById,
  spanRomans,
  spanWaivedRules,
  spans,
  spansOfKind,
} from './spans'
import { romanChordNameToReal } from './graphh'
import { chordGraphCreate } from './util/graphUtil'

describe('the span library', () => {
  it('has a stable, unique id for every span', () => {
    const ids = spans.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id, id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('carries the devices Stage M-A promised (A6)', () => {
    expect(spans.map((s) => s.id).sort()).toEqual([
      'cadential-64',
      'descending-bass-idiom',
      'fauxbourdon',
      'lament-bass',
      'passing-64',
      'pedal-64',
    ])
  })

  it('gives every span a title and at least two steps', () => {
    for (const span of spans) {
      expect(span.title, span.id).toBeTruthy()
      // a one-chord "span" would be a node, not a template
      expect(span.steps.length, span.id).toBeGreaterThanOrEqual(2)
    }
  })

  it('looks a span up by id', () => {
    expect(spanById('lament-bass')?.title).toBe('Lament bass')
    expect(spanById('nope')).toBeUndefined()
  })
})

describe('span steps are ROMAN-keyed and realizable', () => {
  // Steps are romans, never realized chord names — a span written in realized
  // names would be a different object per key, which is the duplication the
  // roman layer exists to prevent. This test proves the romans are real.
  const modeKeys: [mode: 'major' | 'minor', tonic: string, scale: string][] = [
    ['major', 'C', 'major'],
    ['major', 'Eb', 'major'],
    ['major', 'F#', 'major'],
    ['minor', 'A', 'minor'],
    ['minor', 'Bb', 'minor'],
    ['minor', 'G#', 'minor'],
  ]

  it.each(modeKeys)(
    'every step of every %s span realizes in %s %s',
    (mode, tonic, scale) => {
      for (const span of spans) {
        if (span.modes && !span.modes.includes(mode)) continue
        for (const step of span.steps) {
          const roman = edgeChord(step)
          // chord functions (V64/N6/Aug6) are not romans; none is used here
          const realized = romanChordNameToReal(tonic, scale, roman)
          expect(realized, `${span.id}: ${roman} in ${tonic} ${scale}`).toBeTruthy()

          const figure = edgeFigure(step)
          if (figure) {
            // the figure must actually APPLY to the chord it is written on —
            // no '42' on a triad anywhere in the library
            expect(
              figureFitsChord(realized, figure),
              `${span.id}: ${roman}${figure} -> ${realized} in ${tonic} ${scale}`
            ).toBe(true)
            expect(bassOf(realized, figure)).toBeTruthy()
          }
        }
      }
    }
  )

  it('writes the romans the way a composer would', () => {
    expect(spanRomans(spanById('cadential-64')!)).toEqual(['I64', 'V'])
    expect(spanRomans(spanById('descending-bass-idiom')!)).toEqual([
      'I',
      'V6',
      'VIm',
      'IIIm6',
      'IV',
      'I6',
      'IV',
      'V',
    ])
    expect(spanRomans(spanById('fauxbourdon')!)).toEqual([
      'I6',
      'VIIdim6',
      'VIm6',
      'V6',
    ])
  })
})

describe('conditions — declared now, INERT until B1/B3', () => {
  it('gives a bass condition one degree per step where it gives degrees', () => {
    for (const span of spans) {
      const degrees = span.conditions?.bass?.degrees
      if (!degrees) continue
      expect(degrees.length, `${span.id} bass`).toBe(span.steps.length)
      for (const d of degrees) {
        expect(d, `${span.id} bass degree`).toBeGreaterThanOrEqual(1)
        expect(d, `${span.id} bass degree`).toBeLessThanOrEqual(7)
      }
    }
  })

  it('gives a soprano condition one degree per step where it gives degrees', () => {
    for (const span of spans) {
      const degrees = span.conditions?.soprano?.degrees
      if (!degrees) continue
      expect(degrees.length, `${span.id} soprano`).toBe(span.steps.length)
    }
  })

  it('never gives more metric entries than there are steps', () => {
    // a shorter array leaves later steps unconstrained; a longer one is a typo
    for (const span of spans) {
      const metric = span.conditions?.metric
      if (!metric) continue
      expect(metric.length, `${span.id} metric`).toBeLessThanOrEqual(
        span.steps.length
      )
    }
  })

  it('states the cadential 6/4 metric requirement that defines the device', () => {
    // B3 activates this. The 6/4 must be on the STRONGER beat of the pair —
    // a 6/4 on a weak beat resolving to a strong V is an accented passing
    // chord, not a cadential 6/4.
    const span = spanById('cadential-64')!
    expect(span.conditions?.metric).toEqual(['strong', 'weak'])
    expect(span.conditions?.bass?.motion).toBe('static')
  })

  it('distinguishes the three 6/4s by their conditions alone', () => {
    // The POINT of the span abstraction: all three contain the same sonority,
    // so nothing but the surrounding bass and the metre tells them apart —
    // which is exactly what a first-order edge cannot carry (V9).
    const cadential = spanById('cadential-64')!
    const passing = spanById('passing-64')!
    const pedal = spanById('pedal-64')!

    expect(cadential.conditions?.bass?.motion).toBe('static')
    expect(passing.conditions?.bass?.motion).toBe('stepwise-up')
    expect(pedal.conditions?.bass?.motion).toBe('static')

    // cadential vs pedal: both static, distinguished by WHICH degree is held
    expect(cadential.conditions?.bass?.degrees?.[0]).toBe(5)
    expect(pedal.conditions?.bass?.degrees?.[0]).toBe(1)
  })

  it('gives the lament bass its defining descending tetrachord', () => {
    const span = spanById('lament-bass')!
    expect(span.conditions?.bass?.degrees).toEqual([1, 7, 6, 5])
    expect(span.conditions?.bass?.motion).toBe('stepwise-down')
    expect(span.modes).toEqual(['minor'])
  })

  it('gives the descending-bass idiom its stepwise fall and turn', () => {
    const span = spanById('descending-bass-idiom')!
    expect(span.conditions?.bass?.degrees).toEqual([1, 7, 6, 5, 4, 3, 4, 5])
    // half the chords are inverted purely to keep that line stepwise — the
    // canonical case for figured edges
    const figured = span.steps.filter((s) => edgeFigure(s) !== null)
    expect(figured).toHaveLength(3)
  })
})

describe('waivers — LIVE data, consumed by B1', () => {
  // Every waiver id used in the library must be from this documented set. B1
  // owns the rule catalogue, so the union is not pinned in the zero-import
  // types module; this test is what catches a typo instead.
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
    for (const span of spans) {
      for (const rule of spanWaivedRules(span)) {
        expect(KNOWN_RULES, `${span.id} waives unknown rule '${rule}'`).toContain(
          rule
        )
      }
    }
  })

  it('gives every waiver a human-readable reason', () => {
    for (const span of spans) {
      for (const waiver of span.waivers ?? []) {
        expect(waiver.reason, `${span.id} ${waiver.rule}`).toBeTruthy()
        // written for a person, not a log line
        expect(waiver.reason.length, `${span.id} ${waiver.rule}`).toBeGreaterThan(
          20
        )
      }
    }
  })

  it('licenses the parallel motion fauxbourdon is MADE of', () => {
    // Without this, B1's first act would be to red-ink this library's own
    // content — the context-free nagging the waiver mechanism exists to stop.
    const rules = spanWaivedRules(spanById('fauxbourdon')!)
    expect(rules).toContain('parallel-fourths')
    expect(rules).toContain('parallel-fifths')
    expect(rules).toContain('doubled-leading-tone')
  })

  it('waives nothing on the spans that break no rules', () => {
    for (const id of ['cadential-64', 'passing-64', 'pedal-64', 'lament-bass']) {
      expect(spanWaivedRules(spanById(id)!), id).toEqual([])
    }
  })

  it('keeps step-scoped waivers within the span', () => {
    for (const span of spans) {
      for (const waiver of span.waivers ?? []) {
        for (const idx of waiver.steps ?? []) {
          expect(idx, `${span.id} ${waiver.rule}`).toBeGreaterThanOrEqual(0)
          expect(idx, `${span.id} ${waiver.rule}`).toBeLessThan(
            span.steps.length
          )
        }
      }
    }
  })
})

describe('spansOfKind — the registry B2 and B5 will filter', () => {
  it('filters by kind', () => {
    expect(spansOfKind('idiom').map((s) => s.id).sort()).toEqual([
      'cadential-64',
      'fauxbourdon',
      'passing-64',
      'pedal-64',
    ])
    expect(spansOfKind('schema').map((s) => s.id).sort()).toEqual([
      'descending-bass-idiom',
      'lament-bass',
    ])
    // B2 and B5 have nothing here yet — that is their work, not this stage's
    expect(spansOfKind('cadence')).toEqual([])
    expect(spansOfKind('sequence')).toEqual([])
  })

  it('treats a span with no declared modes as belonging to both', () => {
    const cadentialInMajor = spansOfKind('idiom', 'major').map((s) => s.id)
    const cadentialInMinor = spansOfKind('idiom', 'minor').map((s) => s.id)
    expect(cadentialInMajor).toContain('cadential-64')
    expect(cadentialInMinor).toContain('cadential-64')
  })

  it('respects a declared mode restriction', () => {
    expect(spansOfKind('schema', 'minor').map((s) => s.id)).toEqual([
      'lament-bass',
    ])
    expect(spansOfKind('schema', 'major').map((s) => s.id)).toEqual([
      'descending-bass-idiom',
    ])
  })
})

describe('a span is NOT an edge and NOT a node', () => {
  it('adds nothing to the graph', () => {
    // spans are a parallel, additive channel like mixtureSuggestions; nothing
    // here can change a suggestion list that already existed
    for (const [tonic, scale] of [
      ['A', 'minor'],
      ['C', 'major'],
    ] as const) {
      const graph = chordGraphCreate(tonic, scale)
      for (const span of spans) {
        expect(Object.keys(graph)).not.toContain(span.id)
      }
    }
  })

  it('leaves nextChord output untouched', () => {
    // the same guarantee asserted at length in figuredBass.test.ts, restated
    // here as the property THIS module must not break
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

describe('the span type is shaped for its four downstream consumers', () => {
  it('accepts a cadence span of the shape B2 will author', () => {
    // A PAC: both chords in root position, soprano on 1, both on strong beats.
    // Compiles => the schema can express it without B2 extending the type.
    const pac: HarmonicSpan = {
      id: 'pac',
      title: 'Perfect authentic cadence',
      kind: 'cadence',
      steps: ['V', 'I'],
      conditions: {
        soprano: { degrees: [2, 1] },
        bass: { degrees: [5, 1] },
        metric: ['weak', 'strong'],
      },
    }
    expect(pac.kind).toBe('cadence')
    expect(spanRomans(pac)).toEqual(['V', 'I'])
  })

  it('accepts an evaded cadence, which is a FIGURED pair', () => {
    // V42 -> I6, B2's phrase-extension device. It needs the figure to exist at
    // all, which is why A1 had to land before B2 could be planned.
    const evaded: HarmonicSpan = {
      id: 'evaded',
      title: 'Evaded cadence',
      kind: 'cadence',
      steps: [
        { chord: 'V7', figure: '42' },
        { chord: 'I', figure: '6' },
      ],
    }
    expect(spanRomans(evaded)).toEqual(['V42', 'I6'])
  })

  it('accepts a sequence span of the shape B5 will author', () => {
    const descendingFifths: HarmonicSpan = {
      id: 'descending-fifths',
      title: 'Descending fifths',
      kind: 'sequence',
      steps: ['I', 'IV', 'VIIdim', 'IIIm'],
      waivers: [
        {
          rule: 'doubled-leading-tone',
          reason:
            'A strict sequence tolerates a doubled leading tone on a weak ' +
            'step rather than breaking the pattern.',
          steps: [2],
        },
      ],
    }
    expect(spanWaivedRules(descendingFifths)).toEqual(['doubled-leading-tone'])
    expect(descendingFifths.waivers?.[0].steps).toEqual([2])
  })
})
