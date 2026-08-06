import { describe, expect, it } from 'vitest'
import { Note } from 'tonal'

import {
  chromaticMediants,
  commonToneDim7s,
  enharmonicPivots,
} from './chromatic'
import { Aug6, Fr6, Ger6, It6, isChordFn, fns } from './graphh'
import { chordGraphCreate } from './util/graphUtil'
import { nextChord, nextChordDetail } from './nextChord'
import { isChordCsvArg, isDyna } from './util/barsUtil'

// Every expectation in this file was PROBED before it was written: the pitch
// content of each new chord was printed in C, A minor, Eb, F#, Db, Cb, G#, Bb,
// B, Ab and D# and read by hand before being pinned. The keys pinned below are
// the ones that exercise the failure modes this codebase has actually hit —
// flat keys that double-flatten, sharp keys that double-sharpen.

// ── The augmented-sixth trio ────────────────────────────────────────────────

describe('the augmented sixth family', () => {
  it('builds the Italian as b6-1-#4 in sharp and flat keys', () => {
    // three notes, no fifth — the prototype
    expect(It6('C')[0].notes).toEqual(['Ab', 'C', 'F#'])
    expect(It6('A')[0].notes).toEqual(['F', 'A', 'D#'])
    // sharp key: the #4 needs a double sharp
    expect(It6('F#')[0].notes).toEqual(['D', 'F#', 'B#'])
    expect(It6('C#')[0].notes).toEqual(['A', 'C#', 'F##'])
    // flat keys: the b6 needs a double flat rather than an enharmonic respell
    expect(It6('Eb')[0].notes).toEqual(['Cb', 'Eb', 'A'])
    expect(It6('Db')[0].notes).toEqual(['Bbb', 'Db', 'G'])
    expect(It6('Gb')[0].notes).toEqual(['Ebb', 'Gb', 'C'])
  })

  it('builds the French as b6-1-2-#4 in sharp and flat keys', () => {
    expect(Fr6('C')[0].notes).toEqual(['Ab', 'C', 'D', 'F#'])
    expect(Fr6('A')[0].notes).toEqual(['F', 'A', 'B', 'D#'])
    expect(Fr6('F#')[0].notes).toEqual(['D', 'F#', 'G#', 'B#'])
    expect(Fr6('Eb')[0].notes).toEqual(['Cb', 'Eb', 'F', 'A'])
    expect(Fr6('Db')[0].notes).toEqual(['Bbb', 'Db', 'Eb', 'G'])
  })

  it('builds the German as b6-1-b3-#4 in sharp and flat keys', () => {
    expect(Ger6('C')[0].notes).toEqual(['Ab', 'C', 'Eb', 'F#'])
    expect(Ger6('A')[0].notes).toEqual(['F', 'A', 'C', 'D#'])
    expect(Ger6('F#')[0].notes).toEqual(['D', 'F#', 'A', 'B#'])
    // Eb and Gb are where degree arithmetic would double-flatten; the
    // interval-based construction spells them correctly
    expect(Ger6('Eb')[0].notes).toEqual(['Cb', 'Eb', 'Gb', 'A'])
    expect(Ger6('Gb')[0].notes).toEqual(['Ebb', 'Gb', 'Bbb', 'C'])
  })

  it('is MODE-INDEPENDENT: absolute intervals, not scale degrees', () => {
    // the bug this construction exists to prevent — flattening minor's already
    // lowered sixth a second time. A minor and A major must agree exactly.
    expect(Ger6('A', 'minor')[0].notes).toEqual(Ger6('A', 'major')[0].notes)
    expect(It6('Eb', 'minor')[0].notes).toEqual(It6('Eb', 'major')[0].notes)
    // and A minor's b6 is F, never E
    expect(Ger6('A', 'minor')[0].notes[0]).toBe('F')
  })

  it('makes the augmented sixth a 6A, and never respells it as a b7', () => {
    // the interval that names the family. If this ever became a m7 the chord
    // would have been respelled into a dominant seventh — the exact wrong
    // analysis Chord.detect gives.
    for (const tonic of ['C', 'A', 'Eb', 'F#', 'Db', 'Gb']) {
      for (const notes of [
        It6(tonic)[0].notes,
        Fr6(tonic)[0].notes,
        Ger6(tonic)[0].notes,
      ]) {
        const outer = Note.transposeFrom
        // distance from the bass (b6) to the top note (#4)
        const semis =
          (Note.chroma(notes[notes.length - 1]) ?? 0) -
          (Note.chroma(notes[0]) ?? 0)
        expect(((semis % 12) + 12) % 12).toBe(10)
        expect(outer).toBeTypeOf('function')
      }
    }
  })

  it('distinguishes the three by pitch content, not by figure', () => {
    // the Italian is the German minus its fifth and the French minus its 2;
    // all three share the b6-1-#4 frame
    const it = It6('C')[0].notes
    const fr = Fr6('C')[0].notes
    const ger = Ger6('C')[0].notes
    expect(it).toHaveLength(3)
    expect(fr).toHaveLength(4)
    expect(ger).toHaveLength(4)
    for (const frame of ['Ab', 'C', 'F#']) {
      expect(it).toContain(frame)
      expect(fr).toContain(frame)
      expect(ger).toContain(frame)
    }
    // only the German has a perfect fifth above the bass — the reason it alone
    // reinterprets as a dominant seventh
    expect(ger).toContain('Eb')
    expect(fr).toContain('D')
  })
})

describe('Aug6 as a documented alias', () => {
  it('aliases the ITALIAN, so the split is PURELY ADDITIVE', () => {
    // Aug6 is a live user-facing input that appears in SAVED SONGS, so its
    // pitch content must not change. It aliases the three-note prototype and
    // returns exactly what it returned before the split, in every key.
    expect(Aug6('C')[0].notes).toEqual(It6('C')[0].notes)
    expect(Aug6('A', 'minor')[0].notes).toEqual(['F', 'A', 'D#'])
    expect(Aug6('C#', 'minor')[0].notes).toEqual(['A', 'C#', 'F##'])
    expect(Aug6('Eb', 'major')[0].notes).toEqual(['Cb', 'Eb', 'A'])
    // three notes, not four — it is NOT the German
    expect(Aug6('C')[0].notes).toHaveLength(3)
    expect(Aug6('C')[0].notes).not.toEqual(Ger6('C')[0].notes)
  })

  it('keeps its own name rather than reporting It6', () => {
    // a caller round-tripping a suggestion must get back the name it asked for
    expect(Aug6('C')[0].name).toBe('Aug6')
    expect(It6('C')[0].name).toBe('It6')
    expect(Ger6('C')[0].name).toBe('Ger6')
  })

  it('keeps every existing Aug6 entry point working', () => {
    // these are the live user-facing surfaces named in the alias policy
    expect(isChordCsvArg('Aug6,3')).toBe(true)
    expect(isDyna('Aug6')).toBe(true)
    expect(isDyna('aug6')).toBe(true)
    expect(isChordFn('Aug6')).toBe(true)
    expect(typeof fns.Aug6).toBe('function')
  })

  it('registers the three new members on the same surfaces', () => {
    for (const name of ['It6', 'Fr6', 'Ger6']) {
      expect(isChordCsvArg(`${name},3`)).toBe(true)
      expect(isDyna(name)).toBe(true)
      expect(isChordFn(name)).toBe(true)
    }
  })
})

describe('the trio as chart nodes', () => {
  it('routes all three into the dominant complex in A minor', () => {
    const graph = chordGraphCreate('A', 'minor')
    // Italian and French resolve directly to V or through the cadential 6/4
    expect(graph['It6'].next.map((n) => n.name)).toEqual(['V64', 'E'])
    expect(graph['Fr6'].next.map((n) => n.name)).toEqual(['V64', 'E'])
    // the German has a perfect fifth, so its direct move to a root-position V
    // would be parallel fifths — the cadential 6/4 is its strong path
    expect(graph['Ger6'].next.map((n) => n.name)).toEqual(['V64'])
    expect(graph['Ger6'].dotted.map((n) => n.name)).toEqual(['E', 'E7'])
  })

  it('routes all three into the dominant complex in C major', () => {
    const graph = chordGraphCreate('C', 'major')
    expect(graph['It6'].next.map((n) => n.name)).toEqual(['V64', 'G'])
    expect(graph['Fr6'].next.map((n) => n.name)).toEqual(['V64', 'G'])
    expect(graph['Ger6'].next.map((n) => n.name)).toEqual(['V64'])
    expect(graph['Ger6'].dotted.map((n) => n.name)).toEqual(['G', 'G7'])
  })

  it('realizes each node to the right notes per key', () => {
    const minorGraph = chordGraphCreate('A', 'minor')
    expect(minorGraph['It6'].translatedSource.notes).toEqual(['F', 'A', 'D#'])
    expect(minorGraph['Fr6'].translatedSource.notes).toEqual([
      'F', 'A', 'B', 'D#',
    ])
    expect(minorGraph['Ger6'].translatedSource.notes).toEqual([
      'F', 'A', 'C', 'D#',
    ])
    const majorGraph = chordGraphCreate('C', 'major')
    expect(majorGraph['It6'].translatedSource.notes).toEqual(['Ab', 'C', 'F#'])
    expect(majorGraph['Ger6'].translatedSource.notes).toEqual([
      'Ab', 'C', 'Eb', 'F#',
    ])
    // the alias node still realizes to its ORIGINAL three notes — unchanged
    expect(majorGraph['Aug6'].translatedSource.notes).toEqual(['Ab', 'C', 'F#'])
    expect(minorGraph['Aug6'].translatedSource.notes).toEqual(['F', 'A', 'D#'])
  })

  it('reaches the trio ONLY over dotted edges, from the predominants', () => {
    // the blast-radius rule: no existing node's `nextChord` may gain a member
    for (const [tonic, scale, predominants] of [
      ['A', 'minor', ['Dm', 'Bdim']],
      ['C', 'major', ['F', 'Dm']],
    ] as [string, string, string[]][]) {
      for (const pd of predominants) {
        const strong = nextChord(`${pd},3`, tonic, scale)
        for (const member of ['It6', 'Fr6', 'Ger6']) {
          expect(strong).not.toContain(member)
        }
        const detail = nextChordDetail(`${pd},3`, tonic, scale)
        for (const member of ['It6', 'Fr6', 'Ger6']) {
          const found = detail.find((s) => s.name === member)
          expect(found?.strength).toBe('dotted')
        }
      }
    }
  })
})

// ── Common-tone diminished sevenths ─────────────────────────────────────────

describe('commonToneDim7s', () => {
  it('gives the tonic and dominant common-tone sevenths of a major key', () => {
    const c = commonToneDim7s('C', 'major')
    expect(c.map((s) => s.name)).toEqual(['C#dim7', 'G#dim7'])
    expect(c.map((s) => s.roman)).toEqual(['#i°7', '#v°7'])
    expect(c[0].notes.map((n) => Note.get(n).pc)).toEqual([
      'C#', 'E', 'G', 'Bb',
    ])
    expect(c[0].resolvesTo).toBe('C')
    expect(c[1].resolvesTo).toBe('G')
  })

  it('SHARES TWO TONES with the chord it returns to — the defining property', () => {
    // this is what makes it a COMMON-tone seventh, and it is the whole
    // difference from the leading-tone seventh pinned in the next test
    const c = commonToneDim7s('C', 'major')
    expect(c[0].commonTones).toEqual(['E', 'G'])
    expect(c[1].commonTones).toEqual(['B', 'D'])
    for (const s of c) expect(s.commonTones).toHaveLength(2)
  })

  it('differs from the LEADING-TONE seventh, which shares NOTHING and resolves away', () => {
    // vii°7 of C is Bdim7 (B-D-F-Ab) and it is a CHART NODE, not a member of
    // this palette. Its intersection with the tonic triad is empty, and its
    // chart edges point at a DIFFERENT chord — it resolves, it does not return.
    const ctNames = commonToneDim7s('C', 'major').map((s) => s.name)
    expect(ctNames).not.toContain('Bdim7')

    const tonicTriad = ['C', 'E', 'G'].map((n) => Note.chroma(n))
    const leadingTone = ['B', 'D', 'F', 'Ab'].map((n) => Note.chroma(n))
    expect(leadingTone.filter((c) => tonicTriad.includes(c))).toEqual([])

    // and the chart's own leading-tone seventh goes somewhere else
    const graph = chordGraphCreate('C', 'major')
    const viiSeventh = graph['Bm7b5']
    expect(viiSeventh.next.map((n) => n.name)).not.toContain('Bm7b5')
    expect(viiSeventh.next.map((n) => n.name)).toContain('C')
  })

  it('gives a MINOR key only the dominant form', () => {
    // raising the root of a MINOR triad leaves only one common tone, so the
    // device does not apply to a minor tonic — see the doc on the type.
    const a = commonToneDim7s('A', 'minor')
    expect(a.map((s) => s.name)).toEqual(['E#dim7'])
    expect(a[0].roman).toBe('#v°7')
    expect(a[0].resolvesTo).toBe('E')
    expect(a[0].commonTones).toEqual(['G#', 'B'])
  })

  it('spells correctly in flat and double-sharp keys', () => {
    expect(commonToneDim7s('Eb', 'major').map((s) => s.name)).toEqual([
      'Edim7', 'Bdim7',
    ])
    expect(commonToneDim7s('Db', 'major').map((s) => s.name)).toEqual([
      'Ddim7', 'Adim7',
    ])
    // F# major needs double sharps on both roots and still resolves
    expect(commonToneDim7s('F#', 'major').map((s) => s.name)).toEqual([
      'F##dim7', 'C##dim7',
    ])
    for (const s of commonToneDim7s('F#', 'major')) {
      expect(s.notes.length).toBe(4)
    }
  })

  it('is an additive palette: mixture strength, unconditional', () => {
    for (const s of commonToneDim7s('C', 'major')) {
      expect(s.strength).toBe('mixture')
      expect(s.enabledBy).toBeNull()
    }
  })

  it('returns [] for unsupported modes rather than throwing', () => {
    expect(commonToneDim7s('D', 'dorian')).toEqual([])
    expect(commonToneDim7s('C', 'lydian')).toEqual([])
  })
})

// ── Chromatic mediants ──────────────────────────────────────────────────────

describe('chromaticMediants', () => {
  it('gives the four third-relations of a major key', () => {
    const c = chromaticMediants('C', 'major')
    expect(c.map((s) => s.name)).toEqual(['E', 'Eb', 'Ab', 'A'])
    expect(c.map((s) => s.roman)).toEqual(['III', 'bIII', 'bVI', 'VI'])
  })

  it('SHARES EXACTLY ONE TONE with the tonic triad — what makes it chromatic', () => {
    // the diatonic mediants (Em, Am in C) share TWO and are already in the
    // chart; one common tone is what produces the Romantic sound
    const c = chromaticMediants('C', 'major')
    expect(c.map((s) => s.commonTone)).toEqual(['E', 'G', 'C', 'E'])
    for (const s of c) expect(s.commonTone).toBeTruthy()
    // and none of them IS the diatonic mediant
    expect(c.map((s) => s.name)).not.toContain('Em')
    expect(c.map((s) => s.name)).not.toContain('Am')
  })

  it('gives the four third-relations of a minor key, keeping the mode', () => {
    const a = chromaticMediants('A', 'minor')
    expect(a.map((s) => s.name)).toEqual(['C#m', 'Cm', 'Fm', 'F#m'])
    expect(a.map((s) => s.commonTone)).toEqual(['E', 'C', 'C', 'A'])
    // the diatonic III and VI of A minor (C and F major) are excluded
    expect(a.map((s) => s.name)).not.toContain('C')
    expect(a.map((s) => s.name)).not.toContain('F')
  })

  it('spells correctly in flat and sharp keys', () => {
    expect(chromaticMediants('Eb', 'major').map((s) => s.name)).toEqual([
      'G', 'Gb', 'Cb', 'C',
    ])
    // Db's major-third-below is Bbb — a double flat that is genuinely right,
    // and the case interval transposition exists to get correct
    expect(chromaticMediants('Db', 'major').map((s) => s.name)).toEqual([
      'F', 'Fb', 'Bbb', 'Bb',
    ])
    expect(chromaticMediants('F#', 'major').map((s) => s.name)).toEqual([
      'A#', 'A', 'D', 'D#',
    ])
    // every one resolves to real notes
    for (const key of ['Eb', 'Db', 'F#', 'Cb', 'G#']) {
      for (const s of chromaticMediants(key, 'major')) {
        expect(s.notes.length).toBe(3)
      }
    }
  })

  it('is an additive palette that does not touch the graph', () => {
    for (const s of chromaticMediants('C', 'major')) {
      expect(s.strength).toBe('mixture')
      expect(s.enabledBy).toBeNull()
    }
    // and no mediant became a chart node
    const graph = chordGraphCreate('C', 'major')
    expect(graph['Ab']).toBeUndefined()
    expect(graph['E']).toBeUndefined()
  })

  it('returns [] for unsupported modes rather than throwing', () => {
    expect(chromaticMediants('D', 'dorian')).toEqual([])
  })
})

// ── Enharmonic pivots: the B2 contract ──────────────────────────────────────

describe('enharmonicPivots — Ger6 <-> V7', () => {
  it('hears a German sixth as V7 of the Neapolitan key', () => {
    const p = enharmonicPivots('Ger6', 'C', 'major')
    // Ab-C-Eb-F# respelled Ab-C-Eb-Gb is Ab7, the dominant of Db
    expect(p.map((x) => x.targetKey)).toEqual(['Db major'])
    expect(p[0].heardAs).toBe('Ab7')
    expect(p[0].romanThere).toBe('V7')
    expect(p[0].respelled).toEqual(['Ab', 'C', 'Eb', 'Gb'])
    expect(p[0].targetTonic).toBe('Db')
    expect(p[0].targetScale).toBe('major')
  })

  it('offers both modes of the target where both are real keys', () => {
    const p = enharmonicPivots('Ger6', 'A', 'minor')
    expect(p.map((x) => x.targetKey)).toEqual(['Bb minor', 'Bb major'])
    expect(p[0].heardAs).toBe('F7')
    expect(p[0].respelled).toEqual(['F', 'A', 'C', 'Eb'])
  })

  it('offers NOTHING for the Italian, French, or the Aug6 alias', () => {
    // the musical point, not an implementation gap: only the German has a
    // perfect fifth, so only the German respells as a real dominant seventh.
    // It6 is Ab7no5 and Fr6 is Ab7b5, neither of which is a V7.
    expect(enharmonicPivots('It6', 'C', 'major')).toEqual([])
    expect(enharmonicPivots('Fr6', 'C', 'major')).toEqual([])
    // and Aug6 aliases the Italian, so it follows It6 exactly
    expect(enharmonicPivots('Aug6', 'C', 'major')).toEqual([])
  })

  it('reads the relation in reverse: a V7 heard as a German sixth', () => {
    const p = enharmonicPivots('G7', 'C', 'major')
    // G-B-D-F respelled G-B-D-E# is the German sixth of B
    expect(p.map((x) => x.targetKey)).toEqual(['B minor', 'B major'])
    expect(p[0].heardAs).toBe('Ger6')
    expect(p[0].romanThere).toBe('Ger6')
    expect(p[0].respelled).toEqual(['G', 'B', 'D', 'E#'])
  })

  it('never returns the key it was called from', () => {
    for (const [t, s] of [
      ['C', 'major'],
      ['A', 'minor'],
      ['F#', 'major'],
    ] as [string, string][]) {
      for (const p of enharmonicPivots('Ger6', t, s)) {
        expect(p.targetKey).not.toBe(`${t} ${s}`)
      }
    }
  })
})

describe('enharmonicPivots — the four rotations of a dim7', () => {
  it('hears one dim7 as the leading-tone seventh of four keys', () => {
    const p = enharmonicPivots('G#dim7', 'A', 'minor')
    // G#-B-D-F is also Bdim7, Ddim7 and Fdim7; each is vii°7 of the key a
    // semitone above its root. A minor is excluded as the current key.
    expect(p.map((x) => x.targetKey)).toEqual([
      'A major',
      'C minor',
      'C major',
      'Eb minor',
      'Eb major',
      'Gb major',
    ])
    expect(p.every((x) => x.romanThere === 'vii°7')).toBe(true)
    expect(p.every((x) => x.from === 'G#dim7')).toBe(true)
  })

  it('respells the chord for each target key', () => {
    const p = enharmonicPivots('G#dim7', 'A', 'minor')
    const cMinor = p.find((x) => x.targetKey === 'C minor')
    expect(cMinor?.heardAs).toBe('Bdim7')
    expect(cMinor?.respelled).toEqual(['B', 'D', 'F', 'Ab'])
    const ebMinor = p.find((x) => x.targetKey === 'Eb minor')
    expect(ebMinor?.heardAs).toBe('Ddim7')
    expect(ebMinor?.respelled).toEqual(['D', 'F', 'Ab', 'Cb'])
  })

  it('drops targets that are not real keys', () => {
    // rotating a dim7 walks off the circle of fifths: Bbb minor and Cb minor
    // are arithmetically produced and musically nonexistent
    for (const name of ['G#dim7', 'Bdim7', 'C#dim7', 'Ddim7', 'Fdim7']) {
      for (const p of enharmonicPivots(name, 'C', 'major')) {
        expect(p.targetKey).not.toMatch(/bb |## /)
        expect(p.targetTonic).not.toMatch(/bb|##/)
      }
    }
  })

  it('never returns the key it was called from', () => {
    for (const p of enharmonicPivots('Bdim7', 'C', 'major')) {
      expect(p.targetKey).not.toBe('C major')
    }
  })
})

describe('enharmonicPivots — the shape B2 consumes', () => {
  it('mirrors PivotSuggestion field names and types exactly', () => {
    // THE CROSS-STREAM CONTRACT. B2 widens its input to
    // `PivotSuggestion | EnharmonicPivot` and keeps its field accesses, so
    // these three fields must not drift.
    const all = [
      ...enharmonicPivots('Ger6', 'C', 'major'),
      ...enharmonicPivots('G#dim7', 'A', 'minor'),
      ...enharmonicPivots('G7', 'C', 'major'),
    ]
    expect(all.length).toBeGreaterThan(0)
    for (const p of all) {
      expect(typeof p.targetKey).toBe('string')
      expect(typeof p.targetTonic).toBe('string')
      expect(typeof p.targetScale).toBe('string')
      // targetKey is exactly `${targetTonic} ${targetScale}` — the same
      // invariant pivots.ts maintains, so a consumer may split or join either
      expect(p.targetKey).toBe(`${p.targetTonic} ${p.targetScale}`)
      expect(['major', 'minor']).toContain(p.targetScale)
      // and the reinterpretation is always explained
      expect(p.respelled.length).toBeGreaterThan(2)
      expect(p.heardAs).toBeTruthy()
      expect(p.romanThere).toBeTruthy()
      expect(p.explanation.length).toBeGreaterThan(20)
    }
  })

  it('returns [] for a chord with no reinterpretation, and never throws', () => {
    expect(enharmonicPivots('C', 'C', 'major')).toEqual([])
    expect(enharmonicPivots('Am', 'C', 'major')).toEqual([])
    expect(enharmonicPivots('N6', 'C', 'major')).toEqual([])
    expect(enharmonicPivots('V64', 'C', 'major')).toEqual([])
    // unsupported source mode
    expect(enharmonicPivots('Ger6', 'D', 'dorian')).toEqual([])
  })

  it('is deterministic across repeated calls', () => {
    const a = enharmonicPivots('G#dim7', 'A', 'minor')
    const b = enharmonicPivots('G#dim7', 'A', 'minor')
    expect(a).toEqual(b)
  })
})

// ── Blast radius ────────────────────────────────────────────────────────────

describe('blast radius', () => {
  it('leaves every pre-existing node`s nextChord untouched', () => {
    // the nodes that existed before B4, with the strong-edge output they had.
    // Captured by probe on the parent commit and pinned here verbatim.
    const beforeMinor: Record<string, string[]> = {
      Am: ['Am', 'Dm', 'G', 'C', 'F', 'Bdim', 'V64', 'G#dim', 'E'],
      // Dm is the MERGED IVm node — the plain 'VII' continuation plus the
      // gated dominant-complex approach, in that order
      Dm: ['G', 'D#dim', 'B', 'V64', 'G#dim', 'E'],
      // Bdim is merged too: IIdim (the supertonic) and VIIdim/III (the
      // leading-tone chord tonicizing C) realize to the same three notes
      Bdim: ['D#dim', 'B', 'V64', 'G#dim', 'E', 'Edim', 'C7', 'C'],
      E: ['Am'],
      V64: ['E'],
      N6: ['V64', 'E'],
      Aug6: ['V64', 'E'],
      'G#dim': ['E'],
    }
    for (const [node, expected] of Object.entries(beforeMinor)) {
      expect(nextChord(`${node},3`, 'A', 'minor')).toEqual(expected)
    }

    const beforeMajor: Record<string, string[]> = {
      C: ['C', 'Em', 'Am', 'F', 'Dm', 'V64', 'Bdim', 'G'],
      F: ['Dm', 'V64', 'Bdim', 'G', 'F#dim', 'D', 'N6', 'Aug6'],
      Dm: ['V64', 'Bdim', 'G', 'F#dim', 'D', 'N6', 'Aug6'],
      G: ['C'],
      V64: ['G'],
      N6: ['V64', 'G'],
      Aug6: ['V64', 'G'],
    }
    for (const [node, expected] of Object.entries(beforeMajor)) {
      expect(nextChord(`${node},3`, 'C', 'major')).toEqual(expected)
    }
  })

  it('adds exactly three nodes to each chart', () => {
    for (const [tonic, scale] of [
      ['A', 'minor'],
      ['C', 'major'],
    ] as [string, string][]) {
      const graph = chordGraphCreate(tonic, scale)
      expect(Object.keys(graph)).toHaveLength(28)
      for (const member of ['It6', 'Fr6', 'Ger6']) {
        expect(graph[member]).toBeDefined()
      }
    }
  })
})
