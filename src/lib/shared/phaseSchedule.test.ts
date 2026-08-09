import { describe, expect, it } from 'vitest'

import {
  buildPhaseSchedule,
  SchedulablePhase,
} from './phaseSchedule'

/**
 * Golden tests for the shared DAG phase scheduler.
 *
 * These pin the three defects the scheduler replaced: a child's start ignoring
 * the parent's own start tick and barSizeMultiplier, a multi-parent child
 * emitted once per parent, and cycles/missing parents recursing forever or
 * vanishing. Ticks are literal (512 per bar) rather than computed from the
 * constant, so a change to the bar length has to be stated here deliberately.
 */

const BAR = 512

const phase = (
  name: string,
  id: number,
  followsIds: number[] = [],
  barSizeMultiplier: number | null = null
): SchedulablePhase => ({
  id,
  name,
  'follows-ids': followsIds,
  barSizeMultiplier,
})

/** Build the phases map + a barCount lookup from a compact spec. */
const scheduleOf = (
  specs: [phase: SchedulablePhase, barCount: number][]
) => {
  const phases: { [name: string]: SchedulablePhase } = {}
  const barCounts: { [name: string]: number } = {}
  specs.forEach(([p, barCount]) => {
    phases[p.name] = p
    barCounts[p.name] = barCount
  })
  return buildPhaseSchedule(phases, (name) => barCounts[name] ?? 0)
}

describe('buildPhaseSchedule', () => {
  it('starts a single root at 0 and ends it after its bars', () => {
    const s = scheduleOf([[phase('A', 1), 3]])

    expect(s.phases.A.startTick).toBe(0)
    expect(s.phases.A.endTick).toBe(3 * BAR)
    expect(s.problems).toEqual([])
  })

  it('keys the bar map by full bar id, not bare bar index', () => {
    // The defect this replaces: bars were keyed '0','1',... so a second phase
    // overwrote the first phase's timings wholesale.
    const s = scheduleOf([
      [phase('A', 1), 2],
      [phase('B', 2), 2],
    ])

    expect(s.bars['A:0']).toEqual([0, BAR])
    expect(s.bars['A:1']).toEqual([BAR, 2 * BAR])
    expect(s.bars['B:0']).toEqual([0, BAR])
    expect(s.bars['B:1']).toEqual([BAR, 2 * BAR])
    expect(Object.keys(s.bars).sort()).toEqual(['A:0', 'A:1', 'B:0', 'B:1'])
  })

  it('starts two independent roots both at 0', () => {
    const s = scheduleOf([
      [phase('A', 1), 2],
      [phase('B', 2), 4],
    ])

    expect(s.phases.A.startTick).toBe(0)
    expect(s.phases.B.startTick).toBe(0)
    expect(s.phases.A.endTick).toBe(2 * BAR)
    expect(s.phases.B.endTick).toBe(4 * BAR)
  })

  it('accumulates parent start and barSizeMultiplier down a chain', () => {
    // A: 2 bars at multiplier 2 => 2048 long. B: 1 bar => starts at 2048,
    // ends 2560. C therefore starts at 2*512*2 + 1*512 = 2560.
    const s = scheduleOf([
      [phase('A', 1, [], 2), 2],
      [phase('B', 2, [1]), 1],
      [phase('C', 3, [2]), 1],
    ])

    expect(s.phases.A.endTick).toBe(2 * BAR * 2)
    expect(s.phases.B.startTick).toBe(2 * BAR * 2)
    expect(s.phases.C.startTick).toBe(2 * BAR * 2 + 1 * BAR)
    expect(s.problems).toEqual([])
  })

  it('scales a scaled phase bar map by its multiplier', () => {
    const s = scheduleOf([[phase('A', 1, [], 2), 2]])

    expect(s.bars['A:0']).toEqual([0, 1024])
    expect(s.bars['A:1']).toEqual([1024, 2048])
  })

  it('emits a diamond join once, at the max of its parents ends', () => {
    // A(1 bar) and B(3 bars) both feed C. C must appear exactly once, at 1536.
    const s = scheduleOf([
      [phase('A', 1), 1],
      [phase('B', 2), 3],
      [phase('C', 3, [1, 2]), 1],
    ])

    expect(s.phases.C.startTick).toBe(3 * BAR)
    expect(s.phases.C.endTick).toBe(4 * BAR)
    // "exactly once" is structural here: phases is keyed by name, so the real
    // assertion is that its bars were not written twice at two different ticks.
    expect(Object.keys(s.bars).filter((k) => k.startsWith('C:'))).toEqual([
      'C:0',
    ])
    expect(s.problems).toEqual([])
  })

  it('treats an empty phase as zero-length and lets its follower start with it', () => {
    const s = scheduleOf([
      [phase('A', 1), 2],
      [phase('Empty', 2, [1]), 0],
      [phase('C', 3, [2]), 1],
    ])

    expect(s.phases.Empty.startTick).toBe(2 * BAR)
    expect(s.phases.Empty.endTick).toBe(2 * BAR)
    expect(s.phases.C.startTick).toBe(2 * BAR)
    expect(Object.keys(s.bars).some((k) => k.startsWith('Empty:'))).toBe(false)
  })

  it('reports a missing parent and still schedules the orphan', () => {
    const s = scheduleOf([
      [phase('A', 1), 1],
      [phase('B', 2, [99]), 1],
    ])

    expect(s.problems).toEqual([
      { kind: 'missing-parent', phaseName: 'B', parentId: 99 },
    ])
    // Reported, not dropped: a dangling follows-id must not delete the music.
    expect(s.phases.B).toBeDefined()
    expect(s.phases.B.startTick).toBe(0)
  })

  it('reports a cycle instead of recursing forever, and still schedules it', () => {
    const s = scheduleOf([
      [phase('A', 1, [2]), 1],
      [phase('B', 2, [1]), 1],
    ])

    expect(s.problems).toEqual([
      { kind: 'cycle', phaseNames: ['A', 'B'] },
    ])
    expect(s.phases.A).toBeDefined()
    expect(s.phases.B).toBeDefined()
  })

  it('reports a self-follow as a cycle', () => {
    const s = scheduleOf([[phase('A', 1, [1]), 1]])

    expect(s.problems).toEqual([{ kind: 'cycle', phaseNames: ['A'] }])
    expect(s.phases.A.startTick).toBe(0)
  })

  it('schedules a clean DAG downstream of a cycle without hanging', () => {
    const s = scheduleOf([
      [phase('A', 1, [2]), 1],
      [phase('B', 2, [1]), 1],
      [phase('Root', 3), 2],
      [phase('Child', 4, [3]), 1],
    ])

    expect(s.phases.Root.startTick).toBe(0)
    expect(s.phases.Child.startTick).toBe(2 * BAR)
    expect(s.problems).toEqual([{ kind: 'cycle', phaseNames: ['A', 'B'] }])
  })

  it('treats an absent or non-positive multiplier as 1', () => {
    const s = scheduleOf([
      [phase('A', 1, [], null), 1],
      [phase('B', 2, [], 0), 1],
    ])

    expect(s.phases.A.endTick).toBe(BAR)
    expect(s.phases.B.endTick).toBe(BAR)
  })

  it('is deterministic across key insertion order', () => {
    const forward = scheduleOf([
      [phase('A', 1), 2],
      [phase('B', 2, [1]), 1],
    ])
    const reversed = scheduleOf([
      [phase('B', 2, [1]), 1],
      [phase('A', 1), 2],
    ])

    expect(reversed.phases).toEqual(forward.phases)
    expect(reversed.bars).toEqual(forward.bars)
  })
})
