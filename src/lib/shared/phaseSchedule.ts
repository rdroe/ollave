// The single source of truth for WHEN each phase starts.
//
// Both the worker mapping (worker-utils.ts) and the main-thread phase-map
// utilities (mapSongToTicks.ts) used to walk followers recursively from every
// root. That walk had three defects this module exists to remove:
//
//   1. a child's start tick was computed from the parent's BAR COUNT alone,
//      ignoring both the parent's own start tick and its barSizeMultiplier, so
//      any chain longer than two phases (or any scaled phase) drifted;
//   2. a phase with two parents was visited — and emitted — once per parent;
//   3. a cycle recursed until the stack blew, and a phase whose parent was
//      missing simply never appeared.
//
// A phase's start is the max of its parents' ends, which is only knowable once
// every parent is scheduled, so this is a topological walk (Kahn) rather than a
// DFS from roots.

import { BASE_BAR_TICKS } from './scheduleConstants'

export type SchedulablePhase = {
  id: number
  name: string
  'follows-ids': number[]
  barSizeMultiplier?: number | null
}

export type ScheduledPhase = {
  name: string
  id: number
  startTick: number
  endTick: number
  barCount: number
  barSizeMultiplier: number
}

export type PhaseScheduleProblem =
  | { kind: 'missing-parent'; phaseName: string; parentId: number }
  | { kind: 'cycle'; phaseNames: string[] }

export type PhaseSchedule = {
  /** Every schedulable phase, exactly once, keyed by phase name. */
  phases: { [phaseName: string]: ScheduledPhase }
  /** `${phaseName}:${barIndex}` -> [startTick, endTick]. */
  bars: { [barId: string]: [startTick: number, endTick: number] }
  /** Non-fatal defects: unresolvable parents and phases trapped in cycles. */
  problems: PhaseScheduleProblem[]
}

const multiplierOf = (phase: SchedulablePhase): number =>
  typeof phase.barSizeMultiplier === 'number' && phase.barSizeMultiplier > 0
    ? phase.barSizeMultiplier
    : 1

/**
 * Schedule every phase exactly once.
 *
 * `barCountOf` is injected rather than read from mem() so this module stays
 * pure and usable from the worker, which has no mem().
 *
 * A missing parent is reported and then IGNORED for timing — dropping the
 * child entirely is what the old code did, and it made a dangling follows-id
 * silently delete music. A phase in a cycle is reported and scheduled at the
 * max end of whatever parents did resolve (0 if none), so it still plays.
 */
export const buildPhaseSchedule = (
  phases: { [phaseName: string]: SchedulablePhase },
  barCountOf: (phaseName: string) => number
): PhaseSchedule => {
  const problems: PhaseScheduleProblem[] = []
  const entries = Object.entries(phases)

  const byId = new Map<number, SchedulablePhase>()
  entries.forEach(([, phase]) => {
    byId.set(phase.id, phase)
  })

  // Resolved parent names per phase, with dangling ids reported and dropped.
  const parentNames = new Map<string, string[]>()
  entries.forEach(([phaseName, phase]) => {
    const resolved: string[] = []
    ;(phase['follows-ids'] || []).forEach((parentId) => {
      const parent = byId.get(parentId)
      if (!parent) {
        problems.push({ kind: 'missing-parent', phaseName, parentId })
        return
      }
      // A self-follow is a one-node cycle; the cycle sweep below reports it.
      resolved.push(parent.name)
    })
    parentNames.set(phaseName, resolved)
  })

  const childNames = new Map<string, string[]>()
  parentNames.forEach((parents, phaseName) => {
    parents.forEach((parentName) => {
      const list = childNames.get(parentName)
      if (list) {
        list.push(phaseName)
      } else {
        childNames.set(parentName, [phaseName])
      }
    })
  })

  const remainingParents = new Map<string, number>()
  parentNames.forEach((parents, phaseName) => {
    remainingParents.set(phaseName, parents.length)
  })

  const scheduled: { [phaseName: string]: ScheduledPhase } = {}
  const bars: { [barId: string]: [number, number] } = {}

  const place = (phaseName: string, startTick: number) => {
    const phase = phases[phaseName]
    const barSizeMultiplier = multiplierOf(phase)
    const barCount = Math.max(0, barCountOf(phaseName))
    const barTicks = BASE_BAR_TICKS * barSizeMultiplier
    for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
      const barStart = startTick + barIndex * barTicks
      bars[`${phaseName}:${barIndex}`] = [barStart, barStart + barTicks]
    }
    scheduled[phaseName] = {
      name: phaseName,
      id: phase.id,
      startTick,
      // An empty phase is zero-length, so a follower starts where it starts.
      endTick: startTick + barCount * barTicks,
      barCount,
      barSizeMultiplier,
    }
  }

  // Kahn: a phase becomes ready only when every parent is already placed, so
  // max(parent ends) is final at the moment we place it.
  const queue = entries
    .filter(([phaseName]) => (remainingParents.get(phaseName) ?? 0) === 0)
    .map(([phaseName]) => phaseName)
    .sort()

  while (queue.length) {
    const phaseName = queue.shift() as string
    const parents = parentNames.get(phaseName) ?? []
    const startTick = parents.reduce(
      (max, parentName) => Math.max(max, scheduled[parentName]?.endTick ?? 0),
      0
    )
    place(phaseName, startTick)
    ;(childNames.get(phaseName) ?? []).forEach((childName) => {
      const left = (remainingParents.get(childName) ?? 0) - 1
      remainingParents.set(childName, left)
      if (left === 0) {
        queue.push(childName)
      }
    })
  }

  // Anything Kahn could not drain is in (or downstream of) a cycle.
  const stranded = entries
    .map(([phaseName]) => phaseName)
    .filter((phaseName) => !scheduled[phaseName])
  if (stranded.length) {
    problems.push({ kind: 'cycle', phaseNames: [...stranded].sort() })
    // Still schedule them, in a stable order, off whichever parents resolved:
    // a cycle is a data defect, but silently muting those phases would be a
    // worse failure than playing them at an approximate tick.
    stranded.sort().forEach((phaseName) => {
      const parents = parentNames.get(phaseName) ?? []
      const startTick = parents.reduce(
        (max, parentName) => Math.max(max, scheduled[parentName]?.endTick ?? 0),
        0
      )
      place(phaseName, startTick)
    })
  }

  return { phases: scheduled, bars, problems }
}
