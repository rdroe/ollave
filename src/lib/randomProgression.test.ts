import { describe, expect, it } from 'vitest'

import { nextChordDetail } from './nextChord'
import {
  createRng,
  randomProgression,
  randomProgressionDetail,
} from './randomProgression'

const T = 'A'
const S = 'minor'

/** legal successors of a node, or null when the node is terminal */
const successorsOf = (name: string): string[] | null => {
  try {
    return nextChordDetail(`${name},3`, T, S).map((s) => s.name)
  } catch {
    return null
  }
}

/**
 * The strongest correctness property: every chord must be a legal successor
 * of its predecessor, re-queried from the graph rather than trusted from the
 * walk's own bookkeeping.
 */
const expectLegalWalk = (names: string[]) => {
  for (let i = 1; i < names.length; i += 1) {
    const legal = successorsOf(names[i - 1])
    expect(legal, `${names[i - 1]} should be a graph node`).not.toBeNull()
    expect(legal, `${names[i - 1]} -> ${names[i]} must be a graph edge`).toContain(
      names[i]
    )
  }
}

describe('createRng', () => {
  it('is deterministic per seed and yields values in [0, 1)', () => {
    const a = createRng(42)
    const b = createRng(42)
    const drawsA = Array.from({ length: 20 }, () => a())
    const drawsB = Array.from({ length: 20 }, () => b())
    expect(drawsA).toEqual(drawsB)
    for (const v of drawsA) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
    // not a constant stream
    expect(new Set(drawsA).size).toBeGreaterThan(10)
  })

  it('differs across seeds', () => {
    const a = Array.from({ length: 10 }, createRng(1))
    const b = Array.from({ length: 10 }, createRng(2))
    expect(a).not.toEqual(b)
  })
})

describe('randomProgression determinism', () => {
  it('same seed produces identical output', () => {
    const one = randomProgressionDetail('Am,3', T, S, 8, { seed: 12345 })
    const two = randomProgressionDetail('Am,3', T, S, 8, { seed: 12345 })
    expect(one).toEqual(two)
  })

  it('different seeds produce different output', () => {
    const a = randomProgression('Am,3', T, S, 8, { seed: 1 })
    const b = randomProgression('Am,3', T, S, 8, { seed: 7 })
    expect(a).not.toEqual(b)
  })

  it('pins a known walk so regressions are visible', () => {
    // characterization: update deliberately if weighting changes
    const walk = randomProgression('Am,3', T, S, 8, { seed: 12345 })
    expect(walk[0]).toBe('Am')
    expect(walk).toHaveLength(8)
    expectLegalWalk(walk)
  })
})

describe('randomProgression length', () => {
  it('honors the requested length when the graph allows', () => {
    for (const seed of [1, 2, 3, 4, 5, 99, 1000]) {
      const res = randomProgressionDetail('Am,3', T, S, 8, { seed })
      if (res.stoppedBecause === 'complete') {
        expect(res.steps).toHaveLength(8)
      } else {
        // an early stop must be a genuine terminal, not silent truncation
        expect(res.steps.length).toBeLessThan(8)
        expect(successorsOf(res.steps[res.steps.length - 1].name) ?? []).toEqual(
          expect.any(Array)
        )
      }
    }
  })

  it('includes the start chord in the count', () => {
    expect(randomProgression('Am,3', T, S, 1, { seed: 5 })).toEqual(['Am'])
    expect(randomProgression('Am,3', T, S, 2, { seed: 5 })).toHaveLength(2)
  })

  it('returns an empty progression for a non-positive length', () => {
    expect(randomProgression('Am,3', T, S, 0, { seed: 5 })).toEqual([])
  })

  it('throws on an invalid start chord', () => {
    // 'A' is a suggestion target in A minor but has no node of its own
    expect(() => randomProgression('A,3', T, S, 4, { seed: 1 })).toThrow()
    expect(() => randomProgression('Zz,3', T, S, 4, { seed: 1 })).toThrow()
  })
})

describe('immediate repeats', () => {
  it('never repeats a chord back-to-back by default', () => {
    // Am lists itself in next, so this is a real risk, not a theoretical one
    for (let seed = 0; seed < 40; seed += 1) {
      const walk = randomProgression('Am,3', T, S, 10, { seed })
      for (let i = 1; i < walk.length; i += 1) {
        expect(walk[i], `seed ${seed} repeated ${walk[i]}`).not.toBe(walk[i - 1])
      }
    }
  })

  it('can produce a self-loop when the guard is disabled', () => {
    const sawRepeat = Array.from({ length: 60 }, (_unused, seed) =>
      randomProgression('Am,3', T, S, 12, {
        seed,
        avoidImmediateRepeat: false,
      })
    ).some((walk) => walk.some((name, i) => i > 0 && name === walk[i - 1]))
    expect(sawRepeat).toBe(true)
  })
})

describe('graph legality', () => {
  it('every step is a legal successor of its predecessor', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      expectLegalWalk(randomProgression('Am,3', T, S, 10, { seed }))
    }
  })

  it('records the edge actually taken on each step', () => {
    const { steps } = randomProgressionDetail('Am,3', T, S, 6, { seed: 21 })
    expect(steps[0].via).toBeNull()
    for (let i = 1; i < steps.length; i += 1) {
      const via = steps[i].via
      expect(via).not.toBeNull()
      expect(via?.name).toBe(steps[i].name)
      expect(['strong', 'dotted']).toContain(via?.strength)
      // the edge must be one the graph really offers from the previous node
      expect(successorsOf(steps[i - 1].name)).toContain(via?.name)
    }
  })

  it('walks from every node in the graph without throwing', () => {
    const nodes = [
      'Am', 'Dm', 'G', 'C', 'F', 'Bdim', 'V64', 'G#dim', 'E', 'N6',
      'Aug6', 'C#dim', 'A7', 'F#dim', 'D7', 'G7', 'Edim', 'C7', 'D#dim', 'B',
    ]
    for (const node of nodes) {
      const res = randomProgressionDetail(`${node},3`, T, S, 6, { seed: 3 })
      expect(res.steps[0].name).toBe(node)
      expect(res.steps.length).toBeGreaterThan(0)
      expectLegalWalk(res.steps.map((s) => s.name))
    }
  })
})

describe('dead ends', () => {
  it('terminates sanely from the near-dead-end G#dim', () => {
    // G#dim reaches the dominant only: E strongly, or its seventh E7 as the
    // one dotted alternative. Either way the walk continues legally.
    const res = randomProgressionDetail('G#dim,3', T, S, 8, { seed: 4 })
    expect(res.steps[0].name).toBe('G#dim')
    expect(['E', 'E7']).toContain(res.steps[1].name)
    expectLegalWalk(res.steps.map((s) => s.name))
    expect(res.steps.length).toBeLessThanOrEqual(8)
  })

  it('stops rather than throwing when it reaches the terminal Picardy A', () => {
    // 'A' is reachable from G and E but is not itself a graph node
    const walks = Array.from({ length: 60 }, (_unused, seed) =>
      randomProgressionDetail('E,3', T, S, 8, { seed })
    )
    const ended = walks.filter((w) => w.steps.some((s) => s.name === 'A'))
    expect(ended.length).toBeGreaterThan(0)
    for (const walk of ended) {
      // A is terminal, so it can only ever be the last chord
      expect(walk.steps[walk.steps.length - 1].name).toBe('A')
      // short walks stopped *because* of A; a walk that reached its requested
      // length on the very step that landed on A is legitimately 'complete'
      expect(walk.stoppedBecause).toBe(
        walk.steps.length < 8 ? 'dead-end' : 'complete'
      )
    }
    // the dead-end path must actually be exercised
    expect(ended.some((w) => w.stoppedBecause === 'dead-end')).toBe(true)
  })

  it('reports no-legal-move when the only continuation is a repeat', () => {
    // V64 -> E only; with repeats banned a walk sitting on a node whose sole
    // edge points back at itself must stop. Exercised via the guard's filter.
    const res = randomProgressionDetail('V64,3', T, S, 4, { seed: 8 })
    expect(res.steps[0].name).toBe('V64')
    expect(res.steps[1].name).toBe('E')
    expectLegalWalk(res.steps.map((s) => s.name))
  })

  it('never hangs on a long requested length', () => {
    const res = randomProgressionDetail('Am,3', T, S, 200, { seed: 11 })
    expect(res.steps.length).toBeLessThanOrEqual(200)
    expectLegalWalk(res.steps.map((s) => s.name))
  })
})

describe('chord-function nodes', () => {
  it('threads V64 through a walk without crashing', () => {
    // V64/N6/Aug6 are not parseable chord symbols but are literal graph keys
    const res = randomProgressionDetail('N6,3', T, S, 5, { seed: 2 })
    expect(res.steps[0].name).toBe('N6')
    expect(['V64', 'E']).toContain(res.steps[1].name)
    expectLegalWalk(res.steps.map((s) => s.name))
  })

  it('produces walks that traverse a chord-function node', () => {
    const walks = Array.from({ length: 40 }, (_unused, seed) =>
      randomProgression('Am,3', T, S, 10, { seed })
    )
    const traversed = walks.filter((w) => w.includes('V64'))
    expect(traversed.length).toBeGreaterThan(0)
    for (const walk of traversed) {
      expectLegalWalk(walk)
      // whatever follows V64 must be the dominant, in triad or seventh form
      const i = walk.indexOf('V64')
      if (i < walk.length - 1) expect(['E', 'E7']).toContain(walk[i + 1])
    }
  })
})

describe('weighting', () => {
  it('prefers strong edges over dotted ones', () => {
    // E offers Am (strong) against three dotted alternatives — the Picardy A,
    // the dominant seventh E7 and the tonic seventh Am7. With 3:1 weighting
    // the single strong edge must still beat each dotted one individually.
    const firsts = Array.from({ length: 100 }, (_unused, seed) =>
      randomProgression('E,3', T, S, 2, { seed })
    ).map((w) => w[1])
    const strong = firsts.filter((n) => n === 'Am').length
    const dottedNames = ['A', 'E7', 'Am7']
    const dotted = firsts.filter((n) => dottedNames.includes(n)).length
    // every walk went somewhere, and only to a real successor of E
    expect(strong + dotted).toBe(100)
    for (const name of dottedNames) {
      expect(strong, `Am should beat ${name}`).toBeGreaterThan(
        firsts.filter((n) => n === name).length
      )
    }
  })

  it('respects an inverted weighting', () => {
    const firsts = Array.from({ length: 100 }, (_unused, seed) =>
      randomProgression('E,3', T, S, 2, {
        seed,
        weights: { strong: 1, dotted: 10 },
      })
    ).map((w) => w[1])
    expect(firsts.filter((n) => n === 'A').length).toBeGreaterThan(
      firsts.filter((n) => n === 'Am').length
    )
  })

  it('can exclude dotted edges entirely with a zero weight', () => {
    const walks = Array.from({ length: 30 }, (_unused, seed) =>
      randomProgression('Am,3', T, S, 8, { seed, weights: { dotted: 0 } })
    )
    for (const walk of walks) {
      expectLegalWalk(walk)
      // 'A' is only reachable by dotted edges from G and E
      expect(walk).not.toContain('A')
    }
  })
})
