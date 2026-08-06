import { Chord } from 'tonal'
import { describe, expect, it } from 'vitest'

import {
  composeModulation,
  composeProgression,
  composeSpan,
} from './composeProgression'
import { spanById, spanWaivedRules } from './spans'

import { detectCadences, type CadenceType } from './cadence'
import { minor } from './graphData/minor'
import type { ChartEdge } from './graphData/types'
import { edgeChord, edgeFigure } from './figuredBass'
import { nextChord } from './nextChord'
import { pathToCadence } from './progressionPath'
import { chordGraphCreate, lookUpGraph } from './util/graphUtil'

/**
 * Stage M-C — the integration suite.
 *
 * These tests exist because the failures they guard against are CROSS-STREAM:
 * each one is a fact that no single Stage M-B stream could have checked, since
 * neither side owned both files. C0's missing function tags were caught exactly
 * this way, which is the argument for the file.
 */

const graphFor = (tonic: string, scale: string) =>
  lookUpGraph(tonic, scale) ?? chordGraphCreate(tonic, scale)

/** every edge of a chart node, as `roman` or `roman+figure` */
const edgesOfNode = (node: string, layer: 'next' | 'dotted'): string[] => {
  const entries = minor[node] ?? []
  const out: string[] = []
  for (const entry of entries) {
    for (const e of (entry[layer] ?? []) as ChartEdge[]) {
      const f = edgeFigure(e)
      out.push(f && f !== '53' ? `${edgeChord(e)}${f}` : edgeChord(e))
    }
  }
  return out
}

describe('C2 — the minor cadence edges', () => {
  /**
   * THE BLAST-RADIUS RULE, stated as a test rather than as a comment.
   *
   * `nextChord` returns STRONG edges only, so every edge C2 added must be
   * dotted or this pin fails. It is a full snapshot of both charts' strong
   * layer rather than a spot check, because the rule's whole value is that it
   * holds for EVERY node — a rule with one unchecked exception is not a rule.
   *
   * These lists were captured by probe against the pre-C2 chart and are
   * byte-identical to it. If a future edit needs to change one, the honest move
   * is to change the pin and say what music justified it (which is what
   * `graphData/minor.ts`'s header note asks of every edit), not to relax the
   * assertion.
   */
  it('leaves nextChord byte-identical in A minor', () => {
    const g = graphFor('A', 'minor')
    const actual = Object.keys(g)
      .sort()
      .map((n) => `${n} -> ${nextChord(`${n},3`, 'A', 'minor').join(' ')}`)
    expect(actual).toEqual([
      'A7 -> F#dim D7',
      'Am -> Am Dm G C F Bdim V64 G#dim E',
      'Am7 -> Am Dm G C F Bdim V64 G#dim E',
      'Aug6 -> V64 E',
      'B -> V64 G#dim',
      'Bdim -> D#dim B V64 G#dim E Edim C7 C',
      'Bm7b5 -> D#dim B V64 G#dim E',
      'C -> Edim C7 F',
      'C#dim -> F#dim D7',
      'C7 -> Dm Bdim F',
      'D#dim -> V64 G#dim',
      'D7 -> Bdim G7 G',
      'Dm -> G D#dim B V64 G#dim E',
      'Dm7 -> G D#dim B V64 G#dim E',
      'E -> Am',
      'E7 -> Am',
      'Edim -> Dm Bdim F',
      'F -> Bdim Dm',
      'F#dim -> Bdim G7 G',
      'Fr6 -> V64 E',
      'G -> C',
      'G#dim -> E',
      'G#dim7 -> E',
      'G7 -> Edim C7 C',
      'Ger6 -> V64',
      'It6 -> V64 E',
      'N6 -> V64 E',
      'V64 -> E',
    ])
  })

  it('leaves nextChord byte-identical in C major', () => {
    // the major chart was not edited at all, so this is a guard against an
    // accidental shared-data change rather than against a graded edge
    const g = graphFor('C', 'major')
    const actual = Object.keys(g)
      .sort()
      .map((n) => `${n} -> ${nextChord(`${n},3`, 'C', 'major').join(' ')}`)
    expect(actual).toEqual([
      'A7 -> Dm',
      'Am -> F Dm',
      'Aug6 -> V64 G',
      'B7 -> Em',
      'Bdim -> C G',
      'Bm7b5 -> C G',
      'C -> C Em Am F Dm V64 Bdim G',
      'C#dim -> Dm',
      'C7 -> F',
      'Cmaj7 -> C Em Am F Dm V64 Bdim G',
      'D -> V64 Bdim G',
      'D#dim -> Em',
      'Dm -> V64 Bdim G F#dim D N6 Aug6',
      'Dm7 -> V64 Bdim G F#dim D N6 Aug6',
      'E7 -> Am',
      'Edim -> F',
      'Em -> Am F Dm',
      'F -> Dm V64 Bdim G F#dim D N6 Aug6',
      'F#dim -> V64 Bdim G',
      'Fmaj7 -> Dm V64 Bdim G F#dim D N6 Aug6',
      'Fr6 -> V64 G',
      'G -> C',
      'G#dim -> Am',
      'G7 -> C',
      'Ger6 -> V64',
      'It6 -> V64 G',
      'N6 -> V64 G',
      'V64 -> G',
    ])
  })

  it('added every C2 edge to the DOTTED layer, never the strong one', () => {
    const added: [string, string][] = [
      ['IVm', 'Im'], // the minor plagal cadence
      ['IVm', 'IVm6'], // the Phrygian half cadence's approach
      ['Im', 'IVm6'], // ... reachable in three bars, not four
      ['V', 'VI'], // the minor deceptive cadence
      ['V7', 'VI'], // ... its commoner seventh-chord form
      ['IVm7', 'Im'], // the plagal close from the subdominant seventh
    ]
    for (const [from, to] of added) {
      expect(edgesOfNode(from, 'dotted'), `${from} -> ${to}`).toContain(to)
      expect(edgesOfNode(from, 'next'), `${from} -> ${to} must not be strong`).not.toContain(to)
    }
  })

  it('makes all seven cadence types routable in minor', () => {
    // BEFORE C2: plagal, deceptive and phrygian-half all returned
    // `unreachable-cadence` at every bar count. That is the gap B2 reported and
    // could not close, because closing it meant editing a chart it did not own.
    const expected: [CadenceType, string][] = [
      ['PAC', 'Im - V - Im'],
      ['IAC', 'Im - V - Im'],
      ['half', 'Im - IIdim - V'],
      ['deceptive', 'Im - V - VI'],
      ['plagal', 'Im - IVm - Im'],
      ['phrygian-half', 'Im - IVm6 - V'],
      ['evaded', 'Im - V42 - Im6'],
    ]
    for (const [type, summary] of expected) {
      const r = pathToCadence('Am', type, 3, 'A', 'minor')
      expect(r.reason, type).toBe('exact')
      expect(r.paths[0].summary, type).toBe(summary)
    }
  })

  it('routes to cadences the detector already labelled — the two now agree', () => {
    // The point of C2 stated as a round trip: route TO a cadence, then hand the
    // realized chords back to the detector and get the same label. Before C2
    // these three could only be read, never written.
    for (const type of ['plagal', 'deceptive', 'phrygian-half'] as const) {
      const path = pathToCadence('Am', type, 3, 'A', 'minor').paths[0]
      const chords = path.steps.map((s) =>
        s.figure ? { name: s.name, figure: s.figure } : s.name
      )
      const found = detectCadences(chords, 'A', 'minor')
      expect(
        found.map((c) => c.type),
        `${type}: ${path.summary}`
      ).toContain(type)
    }
  })
})

describe('integration proper — the composed entry point', () => {
  /**
   * THE ACCEPTANCE RULE, from the plan: "the two headline features —
   * modulation-aware targeting and whole-progression realization — must work
   * end-to-end before any API sugar is added."
   *
   * These tests are that acceptance. Every value in them was PROBED against the
   * real implementation before it was pinned; none is a guess about what the
   * library ought to produce.
   */

  it('HEADLINE 1: a cadence-targeted phrase, realized in four voices and placed', () => {
    const p = composeProgression('C', 'PAC', 4, 'C', 'major')
    // B2 chose the chords
    expect(p.summary).toBe('I - IIm - V - I')
    // B1 wrote them in four voices, legally
    expect(p.bars.map((b) => b.voicing)).toEqual([
      ['C3', 'C4', 'E4', 'G4'],
      ['D3', 'A3', 'D4', 'F4'],
      ['G3', 'B3', 'D4', 'G4'],
      ['C3', 'C4', 'E4', 'G4'],
    ])
    expect(p.legal).toBe(true)
    expect(p.violations).toEqual([])
    // B3 placed them in the bar
    expect(p.meter).toBe('4/4')
    expect(p.bars.map((b) => b.placement!.barDelay)).toEqual([0, 128, 256, 384])
    expect(p.bars[0].placement!.position.level).toBe('downbeat')
    // and the function tags rode through
    expect(p.bars.map((b) => b.function)).toEqual(['T', 'PD', 'D', 'T'])
  })

  it('HEADLINE 2: a MODULATING phrase names its hinge and realizes it', () => {
    const p = composeModulation('Am', 'PAC', 4, 'A', 'minor', 'C', 'major')
    // the textbook modulation, pivoting on iv = ii
    expect(p.summary).toBe('Im - IVm=IIm - V - I')
    expect(p.fromKey).toBe('A minor')
    expect(p.toKey).toBe('C major')
    expect(p.pivot!.name).toBe('Dm')
    expect(p.pivot!.romanHere).toBe('IVm')
    expect(p.pivot!.romanThere).toBe('IIm')
    expect(p.pivotIndex).toBe(1)
    expect(p.bars.map((b) => b.chord)).toEqual(['Am', 'Dm', 'G', 'C'])
    expect(p.legal).toBe(true)
    // the pivot bar is a REAL bar with a REAL voicing, not a marker
    expect(p.bars[1].voicing).toEqual(['D3', 'D4', 'F4', 'A4'])
    expect(p.notes[0]).toContain('Dm is IVm in A minor and IIm in C major')
  })

  it('HEADLINE 2, chromatically: the Ger6 <-> V7 modulation, realized', () => {
    // C major and Db major share NO diatonic chord, so this modulation exists
    // ONLY because C1 wired B4's enharmonic pivots in. Chromatic sources are on
    // by default in `composeModulation` for exactly this reason.
    const p = composeModulation('C', 'PAC', 4, 'C', 'major', 'Db', 'major')
    expect(p.summary).toBe('I - IIm - Ger6=V7 - I')
    expect(p.pivot!.kind).toBe('enharmonic')
    expect(p.pivot!.name).toBe('Ger6')
    expect(p.pivot!.nameThere).toBe('Ab7')
    expect(p.bars.map((b) => b.chord)).toEqual(['C', 'Dm', 'Ab7', 'Db'])
    expect(p.bars.map((b) => b.voicing)).toEqual([
      ['C3', 'E3', 'E4', 'G4'],
      ['D3', 'A3', 'D4', 'F4'],
      ['Ab2', 'Ab3', 'C4', 'Eb4'],
      ['Db3', 'Ab3', 'Db4', 'F4'],
    ])
    expect(p.legal).toBe(true)
    // B4's prose survived the adaptation
    expect(p.notes.join(' ')).toMatch(/respelling F# as Gb/)
  })

  it('translates chord-FUNCTION nodes, which realizeProgression cannot name', () => {
    // THE FIRST IMPEDANCE MISMATCH. Probed before this module existed:
    // `realizeProgression(['Am','Bdim','V64','E'])` returns
    // `incomplete: "could not realize 'V64'"` and emits two chords.
    const p = composeProgression('Am', 'half', 4, 'A', 'minor')
    expect(p.summary).toBe('Im - IIdim - V64 - V')
    expect(p.bars).toHaveLength(4)
    expect(p.incomplete).toBeUndefined()
    // the node keeps its chart name, and gains a realizable one
    expect(p.bars[2].node).toBe('V64')
    expect(p.bars[2].chord).toBe('Am')
    expect(p.bars[2].figure).toBe('64')
    expect(p.bars[2].resolvedFrom).toBe('V64')
    // a cadential 6/4 doubles its BASS — the fifth degree, E in A minor
    expect(p.bars[2].voicing).toEqual(['E3', 'A3', 'E4', 'C5'])
    expect(p.legal).toBe(true)
    // and the caller is TOLD, rather than silently handed a different chord
    expect(p.notes.join(' ')).toContain('V64 is a chord-function node')
  })

  it('voices an augmented sixth from its notes, never through chord detection', () => {
    // THE SECOND IMPEDANCE MISMATCH, and the one with a wrong answer waiting:
    // Chord.detect(['F','A','D#']) is ['F7no5'], which respells D# as Eb and
    // turns an outward-resolving augmented sixth into a dominant seventh.
    expect(Chord.detect(['F', 'A', 'D#'])).toEqual(['F7no5'])

    const p = composeProgression('Ger6', 'half', 3, 'A', 'minor')
    expect(p.bars[0].node).toBe('Ger6')
    // no chord symbol is correct for it, and none is invented
    expect(p.bars[0].chord).toBeNull()
    // b6 in the bass, #4 on top — the augmented sixth intact, D# not Eb
    expect(p.bars[0].voicing).toEqual(['F2', 'A2', 'C4', 'D#4'])
    expect(p.legal).toBe(true)
    expect(p.notes.join(' ')).toContain('not a tertian chord')
  })

  it('honours a span\'s own waivers, and says which it applied', () => {
    // THE ANTI-NAGGING REQUIREMENT: the library must not red-ink its own
    // shipped content. `composeSpan` applies `spanWaivedRules(span)` without
    // the caller having to ask.
    const span = spanById('fauxbourdon')!
    expect(spanWaivedRules(span)).toEqual([
      'parallel-fourths',
      'parallel-fifths',
      'doubled-leading-tone',
    ])
    const p = composeSpan(span, 'C', 'major')
    expect(p.summary).toBe('I6 - VIIdim6 - VIm6 - V6')
    expect(p.legal).toBe(true)
    expect(p.notes.join(' ')).toContain('waived for this span (fauxbourdon)')
    // the figures survive: every chord of a fauxbourdon is in first inversion,
    // which is the device
    expect(p.bars.every((b) => b.figure === '6')).toBe(true)
    // WORTH RECORDING: the realizer finds a legal four-voice setting of these
    // chords rather than needing the waivers, because the beam is free to pick
    // doublings that avoid the parallels. The waivers are wired regardless —
    // they must be, since a caller who supplies a starting voicing or a
    // three-voice texture WILL hit them. B1's `partWriting.test.ts` pins the
    // rule-level proof on a strict three-voice fauxbourdon.
    expect(p.violations).toEqual([])
  })

  it('reports the mode a span was authored for rather than silently realizing it', () => {
    const p = composeSpan(spanById('lament-bass')!, 'C', 'major')
    expect(p.notes.join(' ')).toContain('minor-only')
    // and it still realizes, because refusing would be less useful than saying so
    expect(p.bars).toHaveLength(4)
  })

  it('places to the meter it is given', () => {
    const p = composeProgression('C', 'PAC', 4, 'C', 'major', { meter: '3/4' })
    expect(p.meter).toBe('3/4')
    // a 3/4 bar is 384 ticks, so the fourth chord starts the next bar —
    // B3's finding that tickCounts[BAR] is the CONTAINER, not the meter
    expect(p.bars.map((b) => b.placement!.bar)).toEqual([0, 0, 0, 1])
    expect(p.bars[3].placement!.position.level).toBe('downbeat')
  })

  it('NEVER THROWS: an impossible request returns a reason', () => {
    const p = composeProgression('C', 'phrygian-half', 4, 'C', 'major')
    expect(p.bars).toEqual([])
    expect(p.incomplete).toMatch(/does not exist in major/)
    expect(() => composeProgression('Zz', 'PAC', 4, 'Q', 'nonsense')).not.toThrow()
    expect(() =>
      composeModulation('C', 'PAC', 4, 'C', 'major', 'C', 'major')
    ).not.toThrow()
  })

  it('is deterministic', () => {
    const a = JSON.stringify(composeModulation('C', 'PAC', 4, 'C', 'major', 'Db', 'major'))
    const b = JSON.stringify(composeModulation('C', 'PAC', 4, 'C', 'major', 'Db', 'major'))
    expect(a).toBe(b)
  })
})
