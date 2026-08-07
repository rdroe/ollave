import { Attack } from './schemas'

/**
 * Figuration presets (O4) — pure, deterministic builders of `Attack[]` for
 * common voicing textures. None of these knows the actual voicing size at
 * build time (that is only known at compile time from the gesture's
 * resolved source pitches), so the arpeggio/Alberti builders cycle over a
 * fixed small index range and rely on compile.ts's `note-indexes` defense
 * (drop out-of-range, matching legacy `toneOrder` behavior) to shrink
 * gracefully against smaller voicings.
 *
 * Pure: no imports beyond `./schemas` types.
 */

/** A single block (chorale) attack: every voice sounds together at the
 * gesture's start. */
export const blockAttack = (o?: {
  velocity?: number
  durationTicks?: number
  letRing?: boolean
}): Attack[] => [
  {
    offsetTicks: 0,
    selection: { kind: 'all' },
    action: { kind: 'strum', direction: 'down', spreadTicks: 0 },
    ...o,
  },
]

export type ArpOpts = {
  count: number
  subdivisionTicks: number
  velocity?: number
}

/**
 * Arpeggio index cycles are voicing-size-agnostic: presets cannot know the
 * eventual voicing size, so they cycle indexes 0..3 (up) / 3..0 (down) and
 * rely on the compile-time `note-indexes` defense to drop indexes beyond
 * the actual voicing.
 */
const ARP_UP_CYCLE = [0, 1, 2, 3]
const ARP_DOWN_CYCLE = [3, 2, 1, 0]
/** 0,1,2,3,2,1,0,1,… — up then down, sharing the turnaround endpoints. */
const ARP_UP_DOWN_CYCLE = [0, 1, 2, 3, 2, 1]

const arpAttacksFromCycle = (o: ArpOpts, cycle: number[]): Attack[] =>
  Array.from({ length: o.count }, (_, k) => {
    const index = cycle[k % cycle.length]
    const attack: Attack = {
      offsetTicks: k * o.subdivisionTicks,
      selection: { kind: 'note-indexes', indexes: [index] },
      action: { kind: 'pluck' },
    }
    return o.velocity !== undefined ? { ...attack, velocity: o.velocity } : attack
  })

/** k-th attack (k = 0..count-1): offset k*subdivisionTicks, pluck, cycling
 * ascending voicing indexes 0,1,2,3,0,1,2,3,… */
export const arpUpAttacks = (o: ArpOpts): Attack[] =>
  arpAttacksFromCycle(o, ARP_UP_CYCLE)

/** Same as arpUpAttacks but cycling descending indexes 3,2,1,0,3,2,1,0,… */
export const arpDownAttacks = (o: ArpOpts): Attack[] =>
  arpAttacksFromCycle(o, ARP_DOWN_CYCLE)

/** Same as arpUpAttacks but cycling 0,1,2,3,2,1,0,1,2,3,2,1,0,1,… */
export const arpUpDownAttacks = (o: ArpOpts): Attack[] =>
  arpAttacksFromCycle(o, ARP_UP_DOWN_CYCLE)

/**
 * Classical Alberti bass: low-high-middle-high per cycle, indexes
 * [0],[2],[1],[2] — 4 attacks per cycle, offsets consecutive multiples of
 * subdivisionTicks. Intended for 3+-note voicings; smaller voicings degrade
 * via the compile-time note-indexes defense.
 */
const ALBERTI_PATTERN = [0, 2, 1, 2]

export const albertiAttacks = (o: {
  cycles: number
  subdivisionTicks: number
  velocity?: number
}): Attack[] =>
  Array.from({ length: o.cycles * ALBERTI_PATTERN.length }, (_, k) => {
    const index = ALBERTI_PATTERN[k % ALBERTI_PATTERN.length]
    const attack: Attack = {
      offsetTicks: k * o.subdivisionTicks,
      selection: { kind: 'note-indexes', indexes: [index] },
      action: { kind: 'pluck' },
    }
    return o.velocity !== undefined ? { ...attack, velocity: o.velocity } : attack
  })
