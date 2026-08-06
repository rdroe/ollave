import {
  cadenceDefinition,
  cadenceLabel,
  romanOf,
  type CadenceType,
} from './cadence'
import { functionOf, transitionCost, type HarmonicFunction } from './harmonicFunction'
import { chordGraphCreate, lookUpGraph } from './util/graphUtil'
import type { ChordProgressionGraph } from './util/graphUtil'

/**
 * Cadence-targeted pathfinding (Stage M-B, B2).
 *
 * THE INTERACTION-MODEL CHANGE. Everything in this library so far answers
 * "what may follow this chord" — a local, one-step question. `pathToCadence`
 * answers "get me from here to a perfect authentic cadence in four bars", which
 * is the question a composer planning a phrase actually has. The difference is
 * not depth of search but direction: the goal is given, and the search works out
 * how to reach it.
 *
 * WHY WEIGHTED, AND WHY BY FUNCTION. An unweighted shortest-path search over
 * this graph is worse than useless for the purpose, because the graph is dense
 * near the tonic: `I` reaches `V` directly, so the shortest four-bar route from
 * I to a PAC is `I - I - I - V - I`. Legal, and nothing a composer would write.
 * Weighting every edge by the FUNCTIONAL move it makes (harmonicFunction.ts)
 * makes T -> PD -> D -> T free and standing still expensive, so the same query
 * returns `I - IV - V - I`. The tags are what make the search goal-directed
 * rather than merely legal, which is why they were pulled forward out of P5.
 *
 * DETERMINISM IS A HARD REQUIREMENT, not a nicety. A composer who runs the same
 * query twice must get the same answer, or the tool cannot be reasoned with.
 * There is no `Math.random` anywhere in this module (contrast
 * `randomProgression.ts`, which takes an explicit seeded RNG), and every point
 * where paths could tie is broken by an explicit, total ordering — see
 * `comparePaths`. The traversal itself is a breadth-first enumeration in fixed
 * edge order, so even the set of candidates considered is fixed. Pinned by a
 * test that runs the same query repeatedly and compares whole results.
 *
 * HONEST SCOPING. An exact-length path frequently does not exist: ask for a
 * two-bar route from the tonic to a Phrygian half cadence in C major and there
 * is no answer, because the device is minor-only. This module NEVER throws and
 * never hangs for that. It returns a result carrying `exact: false` and a
 * `reason` naming what it could not do, plus whatever best-effort paths it did
 * find. Throwing would make the honest answer indistinguishable from a bug, and
 * silently returning a different length would be a lie about what was asked.
 *
 * THREE CADENCES ARE UNREACHABLE BY SEARCH AND FULLY SUPPORTED BY DETECTION.
 * Probed, and recorded here because the asymmetry looks like a bug and is not:
 *
 *   minor plagal     `IVm -> Im`   no such edge in the minor chart
 *   minor deceptive  `V -> VI`     no such edge in the minor chart
 *   Phrygian half    `IVm6 -> V`   no IVm6 edge ANYWHERE in the minor chart
 *
 * All three are ordinary music that composers write constantly, and
 * `detectCadences` labels all three correctly, because detection matches romans
 * rather than walking edges. The pathfinder cannot route to them because the
 * chart is a model of idiomatic CONTINUATION, not a complete catalogue of legal
 * moves, and it does not owe pathfinding an exhaustive edge set.
 *
 * The fix is to add the edges to `graphData/minor.ts` — which this stream does
 * NOT own. Inventing a route through a chord the chart does not offer would be
 * precisely the confident wrong answer the quality bar forbids, so the
 * limitation is reported rather than papered over: `unreachable-cadence` says
 * so, and says that detection still covers the device.
 */

/** One step of a returned progression. */
export type PathStep = {
  /** realized chord name, e.g. 'G7' */
  name: string
  /** the roman in the key being searched, e.g. 'V7' */
  roman: string
  /** T / PD / D, or null when the chord is outside the tagged vocabulary */
  function: HarmonicFunction | null
  /** figured-bass symbol when the edge specified an inversion */
  figure?: string
  /** realized bass pitch class, present exactly when `figure` is */
  bass?: string
  /** whether the edge into this chord was a solid or dashed chart arrow */
  strength?: 'strong' | 'dotted'
}

/** One candidate progression. */
export type ProgressionPath = {
  steps: PathStep[]
  /** the cadence this path ends with */
  cadence: CadenceType
  /**
   * Total functional cost, lower is better. Ordinal, not a measurement — see
   * `transitionCost`. A path of pure T -> PD -> D -> T motion scores 0.
   */
  cost: number
  /** the romans, joined — the one-line form a composer reads */
  summary: string
}

/** Why a result is not exactly what was asked for. */
export type PathReason =
  | 'exact'
  | 'no-path-of-requested-length'
  | 'cadence-unavailable-in-key'
  | 'unknown-start-chord'
  | 'unreachable-cadence'
  | 'invalid-key'
  | 'bars-too-few'

export type PathResult = {
  paths: ProgressionPath[]
  /** true when every returned path has exactly the requested number of bars */
  exact: boolean
  /** machine-readable explanation; 'exact' when nothing went wrong */
  reason: PathReason
  /** the same, in a sentence, for a human */
  message: string
}

export type PathToCadenceOptions = {
  /** how many ranked paths to return (default 5) */
  limit?: number
  /**
   * Include chart edges drawn as dashed arrows (default true).
   *
   * Dotted edges carry the sevenths and every inversion (Stage M-A puts all
   * figured edges on the dotted layer), so excluding them restricts the search
   * to root-position triads and the strongest motions — a genuinely different
   * and sometimes desirable query, which is why it is an option rather than a
   * constant.
   */
  includeDotted?: boolean
  /**
   * Return paths SHORTER or LONGER than requested when no exact-length path
   * exists (default true). With this off, an impossible request returns no
   * paths at all with a reason, rather than a best effort.
   */
  bestEffort?: boolean
}

const MAX_BARS = 12
const MAX_EXPANSIONS = 200000

const graphFor = (tonic: string, scale: string): ChordProgressionGraph | null => {
  try {
    return lookUpGraph(tonic, scale) ?? chordGraphCreate(tonic, scale)
  } catch {
    return null
  }
}

/** An edge of the realized graph, flattened into what the search needs. */
type SearchEdge = {
  name: string
  roman: string
  figure?: string
  bass?: string
  strength: 'strong' | 'dotted'
}

/**
 * Outgoing edges of a node, in a FIXED order: strong edges in chart order, then
 * dotted edges in chart order.
 *
 * The order is load-bearing for determinism. Two paths of equal cost are
 * separated by `comparePaths`, but the set of paths enumerated at all depends on
 * traversal order once `MAX_EXPANSIONS` truncates the search, so a stable edge
 * order is what makes even the truncated case reproducible.
 */
const edgesOf = (
  graph: ChordProgressionGraph,
  chordName: string,
  includeDotted: boolean
): SearchEdge[] => {
  const node = graph[chordName]
  if (!node) return []
  const out: SearchEdge[] = []
  for (const e of node.next ?? []) {
    out.push({
      name: e.name,
      roman: e.roman,
      strength: 'strong',
      ...(e.figure ? { figure: e.figure, bass: e.bass } : {}),
    })
  }
  if (includeDotted) {
    for (const e of node.dotted ?? []) {
      out.push({
        name: e.name,
        roman: e.roman,
        strength: 'dotted',
        ...(e.figure ? { figure: e.figure, bass: e.bass } : {}),
      })
    }
  }
  return out
}

/**
 * Does this pair of romans complete the requested cadence?
 *
 * Compares against the definition's accepted romans, with the figured form
 * checked too so that the evaded cadence (whose identity IS its figures) can be
 * targeted. A path is only a cadential path if its LAST TWO chords are the
 * cadence — a path that passes through a V-I in the middle and wanders on has
 * not arrived anywhere.
 */
const completesCadence = (
  approach: SearchEdge | { roman: string; figure?: string },
  arrival: SearchEdge,
  type: CadenceType
): boolean => {
  const def = cadenceDefinition(type)
  if (!def) return false
  const figured = (r: string, f?: string): string[] =>
    f ? [r, figuredFormOf(r, f)] : [r]
  const approachForms = figured(approach.roman, approach.figure)
  const arrivalForms = figured(arrival.roman, arrival.figure)

  const approachOk = approachForms.some((r) => def.approach.includes(r))
  const arrivalOk = arrivalForms.some((r) => def.arrival.includes(r))
  if (!approachOk || !arrivalOk) return false

  // The evaded cadence is defined by its figures; a root-position V7 -> I is
  // an authentic cadence, not an evaded one, so targeting 'evaded' must not
  // return one.
  if (type === 'evaded') {
    return approach.figure === '42' && arrival.figure === '6'
  }
  if (type === 'phrygian-half') {
    return approach.figure === '6'
  }
  return true
}

/**
 * The figured roman for a roman plus a figure, matching `figuredRoman`'s rule
 * that a seventh-chord figure absorbs the trailing '7' ('V7' + '42' = 'V42').
 *
 * Duplicated here rather than imported from figuredBass so this module does not
 * take a dependency on the figure TYPE for what is a string operation on data
 * the graph already produced. The graph's `roman` field already carries the
 * figured form on a figured edge, so this is a fallback for the unfigured case.
 */
const figuredFormOf = (roman: string, figure: string): string => {
  if (figure === '53' || figure === '7') return roman
  const seventhFigure = figure === '65' || figure === '43' || figure === '42'
  if (seventhFigure && roman.endsWith('7')) return `${roman.slice(0, -1)}${figure}`
  return `${roman}${figure}`
}

/**
 * Total order over paths. THE determinism guarantee.
 *
 * Every comparison is total and the final tiebreak is a string compare on the
 * summary, so no two distinct paths can ever compare equal. Ordering, in
 * priority:
 *
 *  1. functional cost, ascending — the whole point of the weighting
 *  2. fewer dotted edges — a path made of the chart's principal motions is
 *     preferred to one that leans on dashed arrows, at equal functional cost
 *  3. shorter first — only reachable when lengths differ, i.e. in best-effort
 *     results
 *  4. summary alphabetically — an arbitrary but FIXED tiebreak, which is what
 *     makes the ranking reproducible rather than dependent on enumeration order
 */
const comparePaths = (a: ProgressionPath, b: ProgressionPath): number => {
  if (a.cost !== b.cost) return a.cost - b.cost
  const dottedA = a.steps.filter((s) => s.strength === 'dotted').length
  const dottedB = b.steps.filter((s) => s.strength === 'dotted').length
  if (dottedA !== dottedB) return dottedA - dottedB
  if (a.steps.length !== b.steps.length) return a.steps.length - b.steps.length
  return a.summary.localeCompare(b.summary)
}

const toPath = (
  steps: PathStep[],
  cadence: CadenceType
): ProgressionPath => {
  let cost = 0
  for (let i = 1; i < steps.length; i++) {
    cost += transitionCost(steps[i - 1].function, steps[i].function)
  }
  return {
    steps,
    cadence,
    cost,
    summary: steps.map((s) => s.roman).join(' - '),
  }
}

/**
 * Find ranked progressions from a chord to a cadence, of a requested length.
 *
 * THE ALGORITHM is a bounded breadth-first enumeration rather than Dijkstra,
 * and the choice is deliberate. Dijkstra finds ONE cheapest path; a composer
 * wants several to choose between, and wants them all to be exactly `bars`
 * long. Since the length is fixed and small (capped at 12), the state space is
 * bounded and enumerating every path of that length is both feasible and
 * simpler to make deterministic than a priority queue with tie-breaking. Paths
 * are collected, then sorted by `comparePaths`, then truncated to `limit`.
 *
 * Cost accumulates over functional transitions only; it is computed once per
 * completed path rather than incrementally, so there is no pruning by cost and
 * no risk of a cheap-prefix heuristic discarding a path a composer would want.
 * `MAX_EXPANSIONS` bounds the work so the function cannot hang on a dense graph
 * — it is a safety valve, not a tuning parameter, and is far above what any
 * legal `bars` value reaches in these charts.
 *
 * @param from  realized chord name to start from, e.g. 'C' or 'Am'
 * @param cadenceType which cadence to arrive at
 * @param bars  total number of chords INCLUDING both cadence chords; minimum 2
 * @param tonic the key's tonic
 * @param scale 'major' or 'minor'
 *
 * @example four bars from the tonic to a perfect authentic cadence
 * pathToCadence('C', 'PAC', 4, 'C', 'major')
 * // -> I - IV - V - I  (cost 0: T -> PD -> D -> T, the cycle itself)
 *
 * @example an impossible request answers honestly instead of throwing
 * pathToCadence('C', 'phrygian-half', 4, 'C', 'major')
 * // -> { paths: [], exact: false, reason: 'cadence-unavailable-in-key' }
 */
export const pathToCadence = (
  from: string,
  cadenceType: CadenceType,
  bars: number,
  tonic: string,
  scale: string,
  opts?: PathToCadenceOptions
): PathResult => {
  const limit = opts?.limit ?? 5
  const includeDotted = opts?.includeDotted ?? true
  const bestEffort = opts?.bestEffort ?? true

  const fail = (reason: PathReason, message: string): PathResult => ({
    paths: [],
    exact: false,
    reason,
    message,
  })

  if (bars < 2) {
    return fail(
      'bars-too-few',
      'A cadence is two chords, so a path to one needs at least 2 bars.'
    )
  }

  const def = cadenceDefinition(cadenceType)
  if (!def) {
    return fail('cadence-unavailable-in-key', `Unknown cadence type ${cadenceType}.`)
  }

  // A mode-restricted cadence simply does not exist in the other mode. The
  // Phrygian half cadence is the live case: its identity is a semitone bass
  // descent that only minor provides.
  if (def.span.modes && !def.span.modes.includes(scale as 'major' | 'minor')) {
    return fail(
      'cadence-unavailable-in-key',
      `The ${cadenceLabel(cadenceType)} does not exist in ${scale}: ${
        def.span.notes ?? ''
      }`.trim()
    )
  }

  const graph = graphFor(tonic, scale)
  if (!graph) {
    return fail('invalid-key', `Could not build a chord graph for ${tonic} ${scale}.`)
  }

  if (!graph[from]) {
    return fail(
      'unknown-start-chord',
      `${from} is not a chord in the ${tonic} ${scale} chart, so there is nothing to search from.`
    )
  }

  const startRoman = graph[from].roman ?? romanOf(from, tonic, scale) ?? from
  const startStep: PathStep = {
    name: from,
    roman: startRoman,
    function: functionOf(startRoman),
  }

  const cappedBars = Math.min(bars, MAX_BARS)
  const found: ProgressionPath[] = []
  // Best-effort candidates at OTHER lengths, kept separately so an exact-length
  // result is never diluted by them.
  const nearMisses: ProgressionPath[] = []
  let expansions = 0

  /**
   * Depth-first enumeration with a fixed edge order. Recursion depth is bounded
   * by `cappedBars` (<= 12), so there is no stack risk, and the expansion
   * counter bounds total work regardless.
   */
  const walk = (steps: PathStep[]): void => {
    if (expansions > MAX_EXPANSIONS) return
    const last = steps[steps.length - 1]
    const remaining = cappedBars - steps.length

    // A completed cadence: the last two chords ARE the cadence.
    if (steps.length >= 2) {
      const approach = steps[steps.length - 2]
      if (
        completesCadence(
          { roman: approach.roman, figure: approach.figure },
          {
            name: last.name,
            roman: last.roman,
            strength: last.strength ?? 'strong',
            ...(last.figure ? { figure: last.figure, bass: last.bass } : {}),
          },
          cadenceType
        )
      ) {
        const path = toPath([...steps], cadenceType)
        if (steps.length === cappedBars) found.push(path)
        else if (bestEffort) nearMisses.push(path)
      }
    }

    if (remaining <= 0) return

    for (const edge of edgesOf(graph, last.name, includeDotted)) {
      expansions++
      if (expansions > MAX_EXPANSIONS) return
      walk([
        ...steps,
        {
          name: edge.name,
          roman: edge.roman,
          function: functionOf(edge.roman),
          strength: edge.strength,
          ...(edge.figure ? { figure: edge.figure, bass: edge.bass } : {}),
        },
      ])
    }
  }

  walk([startStep])

  if (found.length > 0) {
    return {
      paths: found.sort(comparePaths).slice(0, limit),
      exact: true,
      reason: 'exact',
      message: `${Math.min(found.length, limit)} path${
        found.length === 1 ? '' : 's'
      } of ${cappedBars} bars from ${startRoman} to a ${cadenceLabel(cadenceType)}.`,
    }
  }

  if (!bestEffort || nearMisses.length === 0) {
    // Distinguish "the cadence is unreachable from here at all" from "it is
    // reachable, but not in exactly this many bars". The composer can act on
    // the difference: the first means change the starting chord or the cadence,
    // the second means change the bar count.
    //
    // `nearMisses` is only populated when bestEffort is on, so when it is off
    // we have no evidence either way and must not claim unreachability we did
    // not establish — hence the re-run below, which is cheap (the search is
    // bounded) and is the difference between a useful diagnosis and a guess.
    const reachable =
      nearMisses.length > 0 ||
      (!bestEffort &&
        pathToCadence(from, cadenceType, bars, tonic, scale, {
          ...opts,
          bestEffort: true,
          limit: 1,
        }).paths.length > 0)
    return fail(
      reachable ? 'no-path-of-requested-length' : 'unreachable-cadence',
      reachable
        ? `No ${cappedBars}-bar path from ${startRoman} to a ${cadenceLabel(cadenceType)}, though one exists at another length.`
        : `A ${cadenceLabel(cadenceType)} is not reachable from ${startRoman} in ${tonic} ${scale} within ${cappedBars} bars. ` +
          `The chart models idiomatic continuation rather than every legal move, so a cadence can be perfectly good music and still have no route here — ` +
          `detectCadences will recognize one you write yourself.`
    )
  }

  const sorted = nearMisses.sort(comparePaths).slice(0, limit)
  return {
    paths: sorted,
    exact: false,
    reason: 'no-path-of-requested-length',
    message: `No ${cappedBars}-bar path from ${startRoman} to a ${cadenceLabel(
      cadenceType
    )}; returning ${sorted.length} of length ${[
      ...new Set(sorted.map((p) => p.steps.length)),
    ].join(' or ')} instead.`,
  }
}

/**
 * Every cadence type reachable from a chord within `bars`, cheapest first.
 *
 * The exploratory form of the same question: rather than "get me to a PAC",
 * "what can I close with from here, and at what cost". Returns one best path
 * per cadence type, so the composer sees the menu rather than one answer.
 */
export const cadenceOptions = (
  from: string,
  bars: number,
  tonic: string,
  scale: string,
  opts?: PathToCadenceOptions
): { type: CadenceType; best: ProgressionPath | null; message: string }[] => {
  const types: CadenceType[] = [
    'PAC',
    'IAC',
    'half',
    'deceptive',
    'plagal',
    'phrygian-half',
    'evaded',
  ]
  return types.map((type) => {
    const r = pathToCadence(from, type, bars, tonic, scale, { ...opts, limit: 1 })
    return { type, best: r.paths[0] ?? null, message: r.message }
  })
}
