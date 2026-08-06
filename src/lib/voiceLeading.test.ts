import { beforeAll, describe, expect, it } from 'vitest'

import {
  ascendingInversions,
  nearestVoicing,
  rankByVoiceLeading,
  voiceLeadingDistance,
  voicingDistance,
} from './voiceLeading'
import { parseChordCsvArg } from './util/barsUtil'
import { chordGraphCreate } from './util/graphUtil'
import { nextChordDetail, type ChordSuggestion } from './nextChord'
import { addChord } from './addChord'
import { mem } from '../core/mem'

const A_MINOR = { tonic: 'A', name: 'minor' }

// note-name -> midi number, mirroring the engine's own helper, so the
// assertions below check ordering independently of the implementation.
const midi = (n: string): number => {
  const m = /^([a-g])([#b]*)(-?\d+)$/i.exec(n)!
  const base: { [k: string]: number } = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
  let pc = base[m[1].toLowerCase()]
  for (const acc of m[2]) pc += acc === '#' ? 1 : -1
  return (parseInt(m[3], 10) + 1) * 12 + pc
}

describe('ascendingInversions', () => {
  it('returns strictly ascending voicings, unlike noteInversions', () => {
    // F7: noteInversions('Am') gives [[A3,C4,E4],[C4,E4,A3],[E4,A3,C4]] —
    // the 2nd and 3rd are raw rotations that descend mid-array. Every
    // voicing here must climb.
    const voicings = ascendingInversions('Am')
    expect(voicings.length).toBeGreaterThan(0)
    for (const voicing of voicings) {
      const heights = voicing.map(midi)
      for (let i = 1; i < heights.length; i++) {
        expect(heights[i]).toBeGreaterThan(heights[i - 1])
      }
    }
  })

  it('covers every inversion across the octave range', () => {
    const voicings = ascendingInversions('Am', { minOctave: 3, maxOctave: 3 })
    // three rotations of a triad, all rooted in octave 3
    expect(voicings).toEqual([
      ['A3', 'C4', 'E4'],
      ['C3', 'E3', 'A3'],
      ['E3', 'A3', 'C4'],
    ])
  })

  it('spans octaves 2-5 by default', () => {
    const voicings = ascendingInversions('Am')
    expect(voicings).toContainEqual(['A2', 'C3', 'E3'])
    expect(voicings).toContainEqual(['A5', 'C6', 'E6'])
    expect(voicings.length).toBe(12) // 4 octaves x 3 rotations
  })

  it('handles seventh chords', () => {
    const voicings = ascendingInversions('G7', { minOctave: 3, maxOctave: 3 })
    expect(voicings[0]).toEqual(['G3', 'B3', 'D4', 'F4'])
    expect(voicings.length).toBe(4)
  })

  it('returns [] for an unresolvable name', () => {
    expect(ascendingInversions('notachord')).toEqual([])
  })
})

describe('voicingDistance', () => {
  it('is 0 for identity', () => {
    expect(voicingDistance(['A3', 'C4', 'E4'], ['A3', 'C4', 'E4'])).toBe(0)
    expect(voicingDistance(['E3', 'G#3', 'B3'], ['E3', 'G#3', 'B3'])).toBe(0)
  })

  it('is symmetric', () => {
    const a = ['A3', 'C4', 'E4']
    const b = ['G#3', 'B3', 'E4']
    expect(voicingDistance(a, b)).toBe(voicingDistance(b, a))
  })

  it('charges both directions of motion', () => {
    // A3->G#3 is 1 semitone down; nothing else moves. Charged once each way.
    expect(voicingDistance(['A3'], ['G#3'])).toBe(2)
  })
})

describe('voiceLeadingDistance / nearestVoicing', () => {
  it('is 0 from a chord to itself', () => {
    expect(voiceLeadingDistance(['A3', 'C4', 'E4'], 'Am')).toBe(0)
    const { distance, voicing } = nearestVoicing(['A3', 'C4', 'E4'], 'Am')
    expect(distance).toBe(0)
    expect(voicing).toEqual(['A3', 'C4', 'E4'])
  })

  it('Am -> E prefers the G#-B-E arrangement adjacent to the Am voicing', () => {
    // Hand-verified by probe against all 12 candidates: from A3-C4-E4 the
    // winner is G#3-B3-E4 at distance 4 (A3->G#3 down 1, C4->B3 down 1,
    // E4 held), well clear of root-position E3-G#3-B3 (14) and of the
    // distant E5-G#5-B5 (94).
    const { distance, voicing } = nearestVoicing(['A3', 'C4', 'E4'], 'E')
    expect(voicing).toEqual(['G#3', 'B3', 'E4'])
    expect(distance).toBe(4)

    expect(voiceLeadingDistance(['A3', 'C4', 'E4'], 'E')).toBeLessThan(
      voicingDistance(['A3', 'C4', 'E4'], ['E3', 'G#3', 'B3'])
    )
    expect(voiceLeadingDistance(['A3', 'C4', 'E4'], 'E')).toBeLessThan(
      voicingDistance(['A3', 'C4', 'E4'], ['E5', 'G#5', 'B5'])
    )
  })

  it('handles unequal cardinality (triad -> seventh chord)', () => {
    // Am (3 notes) -> G7 (4 notes): the symmetric nearest-note mapping still
    // ranks, charging the new voice rather than ignoring it.
    const { distance, voicing } = nearestVoicing(['A3', 'C4', 'E4'], 'G7')
    expect(voicing).toEqual(['G3', 'B3', 'D4', 'F4'])
    expect(distance).toBe(10)
    expect(Number.isFinite(distance)).toBe(true)
  })

  it('handles the reverse cardinality (seventh chord -> triad)', () => {
    const { distance, voicing } = nearestVoicing(['G3', 'B3', 'D4', 'F4'], 'Am')
    expect(voicing.length).toBe(3)
    expect(distance).toBe(voicingDistance(['G3', 'B3', 'D4', 'F4'], voicing))
  })

  it('reports Infinity for an unresolvable target', () => {
    const { distance, voicing } = nearestVoicing(['A3', 'C4', 'E4'], 'notachord')
    expect(distance).toBe(Infinity)
    expect(voicing).toEqual([])
  })

  it('resolves chord-function names through a built graph', () => {
    chordGraphCreate('A', 'minor')
    const { voicing } = nearestVoicing(['A3', 'C4', 'E4'], 'V64', { scale: A_MINOR })
    expect(voicing.length).toBe(3)
    // V64 in A minor is E-A-C; ascending and drawn from those pitch classes
    expect(voicing.map((n) => n.replace(/-?\d+$/, '')).sort()).toEqual(['A', 'C', 'E'])
  })
})

describe('rankByVoiceLeading', () => {
  const sug = (
    name: string,
    extra: Partial<ChordSuggestion> = {}
  ): ChordSuggestion => ({
    name,
    roman: 'X',
    notes: [],
    strength: 'strong',
    enabledBy: null,
    ...extra,
  })

  it('sorts by ascending distance and attaches the winning voicing', () => {
    const ranked = rankByVoiceLeading(
      [sug('C'), sug('G7'), sug('E'), sug('Am')],
      ['A3', 'C4', 'E4']
    )
    // Am is the identity (0); C and E tie at 4 — both genuinely smooth from
    // A3-C4-E4 (C holds C4+E4 and steps A3->G3; E holds E4 and steps twice
    // by a semitone) — and the four-note G7 is furthest at 10.
    expect(ranked.map((r) => r.name)).toEqual(['Am', 'C', 'E', 'G7'])
    expect(ranked.map((r) => r.distance)).toEqual([0, 4, 4, 10])
    expect(ranked[0].suggestedVoicing).toEqual(['A3', 'C4', 'E4'])
    expect(ranked[2].suggestedVoicing).toEqual(['G#3', 'B3', 'E4'])
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].distance).toBeGreaterThanOrEqual(ranked[i - 1].distance)
    }
  })

  it('breaks distance ties on original input order', () => {
    // C and E are both at distance 4; whichever the caller listed first stays
    // first, preserving nextChordDetail's ordering for exact ties.
    const cFirst = rankByVoiceLeading([sug('C'), sug('E')], ['A3', 'C4', 'E4'])
    expect(cFirst.map((r) => r.name)).toEqual(['C', 'E'])
    const eFirst = rankByVoiceLeading([sug('E'), sug('C')], ['A3', 'C4', 'E4'])
    expect(eFirst.map((r) => r.name)).toEqual(['E', 'C'])
  })

  it('is pure — input is neither mutated nor reordered', () => {
    const input = [sug('C'), sug('E'), sug('Am')]
    const snapshot = JSON.parse(JSON.stringify(input))
    const ranked = rankByVoiceLeading(input, ['A3', 'C4', 'E4'])
    expect(input).toEqual(snapshot)
    expect(ranked[0]).not.toBe(input[0])
    expect('distance' in input[0]).toBe(false)
  })

  it('keeps contextMatch as the primary key, distance secondary', () => {
    // Am is distance 0 but out of context; C matches context. Context wins.
    const ranked = rankByVoiceLeading(
      [sug('Am', { contextMatch: false }), sug('C', { contextMatch: true })],
      ['A3', 'C4', 'E4']
    )
    expect(ranked.map((r) => r.name)).toEqual(['C', 'Am'])
    expect(ranked[1].distance).toBe(0)
  })

  it('ignores the context key when no suggestion carries it', () => {
    const ranked = rankByVoiceLeading([sug('C'), sug('Am')], ['A3', 'C4', 'E4'])
    expect(ranked.map((r) => r.name)).toEqual(['Am', 'C'])
  })

  it('ranks real nextChordDetail output', () => {
    chordGraphCreate('A', 'minor')
    const suggestions = nextChordDetail('Am,3', 'A', 'minor')
    const ranked = rankByVoiceLeading(suggestions, ['A3', 'C4', 'E4'], {
      scale: A_MINOR,
    })
    expect(ranked.length).toBe(suggestions.length)
    for (const r of ranked) {
      expect(r.suggestedVoicing.length).toBeGreaterThan(0)
      expect(Number.isFinite(r.distance)).toBe(true)
    }
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].distance).toBeGreaterThanOrEqual(ranked[i - 1].distance)
    }
  })
})

describe('parseChordCsvArg smooth voicing (opt-in)', () => {
  beforeAll(() => {
    chordGraphCreate('A', 'minor')
  })

  it('is byte-identical to today when prevNotes is omitted', () => {
    // the same expectations barsUtil.test.ts pins, re-asserted here so a
    // regression in the smooth path cannot silently alter the default one
    expect(parseChordCsvArg('Am,3', 'A minor')).toEqual([
      ['A3', 'C4', 'E4'],
      ['roman=Im', 'chord=Am'],
    ])
    expect(parseChordCsvArg('E,3', 'A minor')).toEqual([
      ['E3', 'G#3', 'B3'],
      ['roman=V', 'chord=E'],
    ])
    expect(parseChordCsvArg('C,4')).toEqual([['C4', 'E4', 'G4'], ['chord=C']])
  })

  it('is unchanged when prevNotes is empty', () => {
    expect(parseChordCsvArg('E,3', 'A minor', [])).toEqual(
      parseChordCsvArg('E,3', 'A minor')
    )
  })

  it('produces different, smoother notes when prevNotes is supplied', () => {
    const [defaultNotes, defaultTags] = parseChordCsvArg('E,3', 'A minor')
    const [smoothNotes, smoothTags] = parseChordCsvArg('E,3', 'A minor', [
      'A3',
      'C4',
      'E4',
    ])

    expect(defaultNotes).toEqual(['E3', 'G#3', 'B3'])
    expect(smoothNotes).toEqual(['G#3', 'B3', 'E4'])
    expect(smoothNotes).not.toEqual(defaultNotes)
    // tags are untouched by voicing choice
    expect(smoothTags).toEqual(defaultTags)

    const prev = ['A3', 'C4', 'E4']
    expect(voicingDistance(prev, smoothNotes)).toBeLessThan(
      voicingDistance(prev, defaultNotes)
    )
  })

  it('falls back to the default voicing when smoothing cannot resolve', () => {
    // a chord the engine cannot enumerate still places its default notes
    const [notes] = parseChordCsvArg('V64,3', 'A minor', ['A3', 'C4', 'E4'])
    expect(notes.length).toBe(3)
  })
})

describe('addChord placement', () => {
  // minimal in-memory song: addChord needs a phase to exist and setLatestMap
  // needs a song + track, but nothing here touches the DB.
  const makePhase = (name: string, id: number) => {
    mem().phases[name] = {
      id,
      'follows-ids': [],
      barSizeMultiplier: 1,
      speed: null,
      scaleTonic: 'A',
      scaleName: 'minor',
      name,
    } as never
    for (let i = 0; i < 4; i++) mem().notesByBar[`${name}:${i}`] = []
  }

  const notesIn = (barTag: string): string[] =>
    mem().notesByBar[barTag].map((note) => note.note)

  beforeAll(() => {
    chordGraphCreate('A', 'minor')
    // addChord's compile step dispatches a CustomEvent, which the node test
    // environment lacks. Local shim: the event is fire-and-forget and no
    // assertion here depends on it.
    const g = globalThis as { CustomEvent?: unknown }
    if (typeof g.CustomEvent === 'undefined') {
      g.CustomEvent = class extends Event {
        constructor(type: string, init?: EventInit) {
          super(type, init)
        }
      }
    }
    mem().song = { id: 1, name: 'vl', tempo: 120, 'track-ids': [] } as never
    mem().tracks = [
      {
        id: 1,
        'phase-ids': [9991, 9992, 9993],
        'phase-names': ['vlDefault', 'vlSmooth', 'vlNoPrev'],
        notesByBar: {},
      } as never,
    ]
    makePhase('vlDefault', 9991)
    makePhase('vlSmooth', 9992)
    makePhase('vlNoPrev', 9993)
  })

  it('places the same notes as today without the tag', () => {
    addChord('Am,3', 'vlDefault', 0, 0, [], 'A', 'minor')
    addChord('E,3', 'vlDefault', 1, 0, [], 'A', 'minor')

    expect(notesIn('vlDefault:0')).toEqual(['A3', 'C4', 'E4'])
    // root position at the requested octave — unchanged behavior
    expect(notesIn('vlDefault:1')).toEqual(['E3', 'G#3', 'B3'])
  })

  it('voices smoothly against the previous chord with voicing=smooth', () => {
    addChord('Am,3', 'vlSmooth', 0, 0, [], 'A', 'minor')
    addChord('E,3', 'vlSmooth', 1, 0, ['voicing=smooth'], 'A', 'minor')

    expect(notesIn('vlSmooth:0')).toEqual(['A3', 'C4', 'E4'])
    // the nearest E to A3-C4-E4, not root position
    expect(notesIn('vlSmooth:1')).toEqual(['G#3', 'B3', 'E4'])
    expect(notesIn('vlSmooth:1')).not.toEqual(notesIn('vlDefault:1'))
  })

  it('falls back to the default voicing when there is no previous chord', () => {
    addChord('E,3', 'vlNoPrev', 0, 0, ['voicing=smooth'], 'A', 'minor')
    expect(notesIn('vlNoPrev:0')).toEqual(['E3', 'G#3', 'B3'])
  })
})
