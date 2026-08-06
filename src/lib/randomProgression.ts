import { nextChordDetail, type ChordSuggestion } from './nextChord'

/**
 * One step of a generated progression.
 *
 * The first step is the starting chord and has no `via` edge (nothing led to
 * it). Every later step carries the edge that was actually taken, so callers
 * can show the roman ('V7/III'), the notes, and why the move was legal.
 */
export type ProgressionStep = {
  /** graph node name, e.g. 'Am', or a chord-function name like 'V64' */
  name: string
  /** the suggestion that was chosen to arrive here; null for the start chord */
  via: ChordSuggestion | null
}

/** Why a walk stopped before reaching the requested length. */
export type ProgressionStopReason =
  /** the requested number of chords was produced */
  | 'complete'
  /** current node has no outgoing edges at all (or is not a graph node) */
  | 'dead-end'
  /** every continuation was excluded by avoidImmediateRepeat */
  | 'no-legal-move'

export type ProgressionResult = {
  steps: ProgressionStep[]
  stoppedBecause: ProgressionStopReason
}

export type RandomProgressionOptions = {
  /** omit for a time-seeded (non-reproducible) walk; supply for determinism */
  seed?: number
  weights?: {
    /** relative weight of a solid-arrow edge (default 3) */
    strong?: number
    /** relative weight of a dashed-arrow edge (default 1) */
    dotted?: number
    /** multiplier applied to edges whose arrival context matches (default 2) */
    contextMatch?: number
  }
  /** default true; suppresses Am -> Am style self-loops */
  avoidImmediateRepeat?: boolean
  /** how many previous chords to feed nextChordDetail as context (default 2) */
  contextDepth?: number
}

const DEFAULT_STRONG = 3
const DEFAULT_DOTTED = 1
const DEFAULT_CONTEXT_MATCH = 2
const DEFAULT_CONTEXT_DEPTH = 2

/**
 * mulberry32 — a small, fast, well-distributed 32-bit PRNG.
 *
 * Deliberately local rather than `Math.random()`: identical seed and inputs
 * must reproduce a walk exactly, which is what makes the tests meaningful and
 * lets a user re-generate a progression they liked from its seed alone.
 */
export const createRng = (seed: number): (() => number) => {
  // force to uint32 so fractional or negative seeds still behave
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Weight of a single candidate edge.
 *
 * Base weight is the arrow strength (solid 3 : dashed 1) — solid arrows are
 * the chart's principal motions, dashed ones the colourful exceptions, so a
 * walk should prefer the former without ever ruling out the latter. Edges
 * whose arrival context matches the chord we actually came from are then
 * multiplied by `contextMatch` (default 2), which is what makes the walks
 * idiomatic: after F, Bdim's dominant-preparation edges outrank its
 * VIIdim/III edges because the source chart annotates them as reachable
 * from F.
 *
 * `contextMatch` is undefined when no `prev` was supplied, which reads as
 * "unranked" and takes no multiplier.
 */
const weigh = (
  sug: ChordSuggestion,
  weights: Required<NonNullable<RandomProgressionOptions['weights']>>
): number => {
  const base = sug.strength === 'strong' ? weights.strong : weights.dotted
  const bonus = sug.contextMatch === true ? weights.contextMatch : 1
  return Math.max(base * bonus, 0)
}

/** weighted pick; returns null when every candidate has zero weight */
const pickWeighted = (
  candidates: ChordSuggestion[],
  weights: Required<NonNullable<RandomProgressionOptions['weights']>>,
  rng: () => number
): ChordSuggestion | null => {
  const scored = candidates.map((sug) => weigh(sug, weights))
  const total = scored.reduce((sum, w) => sum + w, 0)
  if (total <= 0) return null

  let roll = rng() * total
  for (let i = 0; i < candidates.length; i += 1) {
    roll -= scored[i]
    if (roll < 0) return candidates[i]
  }
  // floating-point guard: fall back to the last positively-weighted candidate
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    if (scored[i] > 0) return candidates[i]
  }
  return null
}

/**
 * Continuations from a node, or null when the node is terminal.
 *
 * Some suggestion targets are not themselves graph nodes — in A minor the
 * Picardy 'A' is reachable from G and E but has no entry of its own, so
 * querying it throws. A walk that lands there has simply ended; it must not
 * crash. Chord-function nodes (V64, N6, Aug6) are the opposite case: their
 * names are not parseable chord symbols but the graph is keyed by the literal
 * name, so 'V64,3' resolves normally and needs no special handling.
 */
const continuationsOf = (
  name: string,
  tonic: string,
  scale: string,
  prev: string[]
): ChordSuggestion[] | null => {
  try {
    return nextChordDetail(`${name},3`, tonic, scale, { prev })
  } catch {
    return null
  }
}

/**
 * Generate a musically-plausible progression by walking the chord graph.
 *
 * A pure function over the `nextChordDetail` contract: it composes the
 * existing suggestion API rather than extending it.
 *
 * Dead-end policy: the walk stops early and returns a shorter progression
 * rather than throwing, hanging, or forcing a repeat. Reaching V64 or G#dim
 * (one edge each) is normal; reaching the terminal Picardy 'A' ends the walk.
 * `stoppedBecause` distinguishes the cases, so a caller can retry with another
 * seed if it wanted the full length.
 *
 * @param start chord csv arg, e.g. 'Am,3' — same convention as nextChordDetail
 * @param length number of chords to produce, including `start`
 */
export const randomProgressionDetail = (
  start: string,
  tonic: string,
  scale: string,
  length: number,
  opts?: RandomProgressionOptions
): ProgressionResult => {
  const weights = {
    strong: opts?.weights?.strong ?? DEFAULT_STRONG,
    dotted: opts?.weights?.dotted ?? DEFAULT_DOTTED,
    contextMatch: opts?.weights?.contextMatch ?? DEFAULT_CONTEXT_MATCH,
  }
  const avoidImmediateRepeat = opts?.avoidImmediateRepeat ?? true
  const contextDepth = opts?.contextDepth ?? DEFAULT_CONTEXT_DEPTH
  const rng = createRng(opts?.seed ?? Date.now())

  // validate the start node up front: a bad start is a caller error and should
  // throw (as nextChordDetail does), unlike a dead end reached mid-walk.
  const [startName] = start.split(',')
  nextChordDetail(start, tonic, scale)

  const steps: ProgressionStep[] = [{ name: startName, via: null }]
  if (length <= 1) return { steps: steps.slice(0, Math.max(length, 0)), stoppedBecause: 'complete' }

  while (steps.length < length) {
    const current = steps[steps.length - 1].name
    const prev = steps
      .slice(Math.max(steps.length - 1 - contextDepth, 0), steps.length - 1)
      .map((s) => s.name)

    const all = continuationsOf(current, tonic, scale, prev)
    if (all === null || all.length === 0) {
      return { steps, stoppedBecause: 'dead-end' }
    }

    const candidates = avoidImmediateRepeat
      ? all.filter((s) => s.name !== current)
      : all
    if (candidates.length === 0) {
      return { steps, stoppedBecause: 'no-legal-move' }
    }

    const chosen = pickWeighted(candidates, weights, rng)
    if (chosen === null) {
      return { steps, stoppedBecause: 'no-legal-move' }
    }

    steps.push({ name: chosen.name, via: chosen })
  }

  return { steps, stoppedBecause: 'complete' }
}

/**
 * Convenience wrapper returning just the chord names of a generated walk.
 *
 * The full result (per-edge romans, notes, stop reason) is available from
 * `randomProgressionDetail`.
 */
export const randomProgression = (
  start: string,
  tonic: string,
  scale: string,
  length: number,
  opts?: RandomProgressionOptions
): string[] =>
  randomProgressionDetail(start, tonic, scale, length, opts).steps.map(
    (s) => s.name
  )
