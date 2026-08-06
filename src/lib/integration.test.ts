import { describe, expect, it } from 'vitest'

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
