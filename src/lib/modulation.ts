import { cadenceLabel, romanOf, type CadenceType } from './cadence'
import { functionOf, transitionCost } from './harmonicFunction'
import { pivotSuggestions } from './pivots'
import {
  pathToCadence,
  type PathResult,
  type PathStep,
  type PathToCadenceOptions,
  type ProgressionPath,
} from './progressionPath'
import { chordGraphCreate, lookUpGraph } from './util/graphUtil'

/**
 * Modulation-targeted pathfinding (Stage M-B, B2) — the headline feature.
 *
 * "I am in A minor. Get me to a perfect authentic cadence in C major in six
 * bars, and show me the hinge." That is the query this module answers, and for
 * the audience this project serves it is ranked FIRST in delight, ahead of
 * everything else in the plan. It is also, pleasingly, mostly composition of
 * parts that already exist rather than new machinery — which is what V8 in
 * PLAN-MUSIC.md predicted.
 *
 * THE SHAPE OF THE ANSWER. A modulation is three things in sequence, and the
 * result names all three because a composer needs to see the joint, not just
 * the destination:
 *
 *   1. a route through the HOME key to a chord that both keys share
 *   2. the PIVOT itself — one chord, heard two ways, which is the hinge
 *   3. a route through the TARGET key to the requested cadence
 *
 * The pivot is the interesting part and the part a composer is really asking
 * about, so it is a first-class field of the result (`pivot`), carrying its
 * roman in BOTH keys. `Dm` is `iv` in A minor and `ii` in C major; naming both
 * is what makes the result a modulation plan rather than a chord list.
 *
 * COMPOSED FROM EXISTING PARTS, deliberately:
 *   - `pivotSuggestions` (pivots.ts, V8) enumerates the shared chords, already
 *     sorted by key-signature distance so close modulations come first;
 *   - `pathToCadence` (progressionPath.ts) does both legs of the search, so the
 *     function weighting, the determinism guarantee and the honest-scoping
 *     behaviour are inherited rather than reimplemented;
 *   - `harmonicFunction` weights the pivot choice itself.
 *
 * DESIGNED FOR B4 TO EXTEND WITHOUT CHANGING THIS SURFACE. B4 adds enharmonic
 * reinterpretation pairs — Ger6 heard as V7, the four rotations of a
 * diminished seventh — which are pivots in exactly the sense this module means:
 * one sonority, two readings, two keys. The extension point is
 * `PivotSource` and the `extraPivots` option, NOT a change to
 * `pathThroughModulation`'s signature. See the note on `PivotCandidate` for
 * precisely what B4 must supply; nothing else in this file needs to move.
 */

/**
 * One chord that can hinge between two keys.
 *
 * `kind` says HOW it hinges, and exists so B4 can add enharmonic pivots as a
 * new kind rather than as a new function. A consumer switching on it gets a
 * useful distinction (a diatonic pivot is smooth, an enharmonic one is a
 * swerve); a consumer ignoring it still gets a working modulation.
 */
export type PivotKind =
  | 'diatonic'
  /**
   * RESERVED FOR B4. A chord that belongs to both keys only under an
   * enharmonic respelling — the German sixth of one key spelled as the dominant
   * seventh of another, or a diminished seventh rotated to a new root. These
   * are not diatonic pivots and should not be presented as smooth ones, which
   * is why they get their own kind rather than being folded in.
   */
  | 'enharmonic'
  /** RESERVED FOR B4: a chromatic third relation with a common tone. */
  | 'chromatic-mediant'
  /**
   * ADDED IN STAGE M-C (C3). A chord that is CHROMATIC at home and DIATONIC in
   * the target key — the Neapolitan being the case that forced it. ♭II in C
   * major is the D♭ triad, chromatic here and the tonic there, so it hinges
   * neither by shared diatonic membership (it is not diatonic at home) nor by
   * respelling (nothing is respelled; the pitches are read as they are).
   *
   * It is its own member rather than being labelled `'chromatic-mediant'`
   * because a Neapolitan is a SECOND relation, not a third, and calling it a
   * mediant would be a false claim to anyone switching on the field — which is
   * what the field is for. Widening the union is safe: `kind` is data a
   * consumer reads, and nothing in the library switches exhaustively on it.
   */
  | 'chromatic'

export type PivotCandidate = {
  /**
   * Realized chord name AS THE HOME KEY SPELLS IT, e.g. 'Dm' — and the node
   * name the first leg of the search routes to.
   */
  name: string
  /**
   * Realized chord name AS THE TARGET KEY SPELLS IT, when that differs. The
   * second leg routes FROM this. Omit it for a diatonic pivot, where by
   * definition the two keys spell the same chord the same way.
   *
   * ── ADDED IN STAGE M-C, AND WHY (this field is the whole of C1) ───────────
   *
   * B2 built `PivotCandidate` with ONE name, which is exactly right for the
   * pivot it was built for: a diatonic pivot IS one chord, and `Dm` is a node
   * in both the A minor and the C major chart. B4 then built enharmonic pivots,
   * whose entire mechanism is that the two keys spell the sonority DIFFERENTLY
   * — a German sixth in C major is the chart node `Ger6`, and the same four
   * pitches in D♭ major are the chart node `Ab7`. Neither stream was wrong;
   * they had not met.
   *
   * PROBED before this field existed, and the failure was silent rather than
   * loud: an adapter that reported `name: 'Ger6'` got `unreachable-cadence`,
   * because the second leg looked for a `Ger6` node in the D♭ chart and there
   * is one — a D♭ German sixth, four entirely different pitches. An adapter
   * that reported `name: 'Ab7'` failed the other way, the first leg having no
   * `Ab7` node in C major. One name cannot describe a chord heard two ways,
   * which is the one thing an enharmonic pivot is.
   *
   * OPTIONAL, so every existing caller and every diatonic pivot is unchanged:
   * `nameThere ?? name` is the second leg's start, and for a diatonic pivot
   * that is `name`, which is what it always was.
   */
  nameThere?: string
  /** its roman in the key being left, e.g. 'IVm' */
  romanHere: string
  /** its roman in the key being entered, e.g. 'IIm' */
  romanThere: string
  kind: PivotKind
  /**
   * How good a hinge this is, LOWER IS BETTER. See `pivotCost`.
   */
  cost: number
  /**
   * Prose naming the reinterpretation, when there is one to name.
   *
   * Carried so B4's `EnharmonicPivot.explanation` survives the adaptation
   * rather than being thrown away at the boundary. A diatonic pivot does not
   * set it: "Dm is iv here and ii there" is already fully stated by the two
   * roman fields, and prose repeating them would be noise. An enharmonic pivot
   * is the opposite case — the romans alone say `Ger6` became `V7` without
   * saying that a ♯4 was respelled as a ♭7, which is the fact a composer needs.
   */
  explanation?: string
}

/**
 * A supplier of pivot candidates between two keys.
 *
 * THIS IS THE B4 EXTENSION POINT, and it is a function type rather than a data
 * table on purpose: an enharmonic pivot is computed (rotate a diminished
 * seventh, respell an augmented sixth), not enumerated, so a table would not
 * express it. B4 implements one of these and callers pass it in
 * `extraPivots`; `pathThroughModulation`'s signature does not change, and
 * neither does `ModulationResult`.
 *
 * The contract is deliberately minimal — two keys in, candidates out — so that
 * B4 owes this module nothing beyond the chord names and how they are heard on
 * each side.
 */
export type PivotSource = (
  fromTonic: string,
  fromScale: string,
  toTonic: string,
  toScale: string
) => PivotCandidate[]

export type ModulationOptions = PathToCadenceOptions & {
  /**
   * How many bars in the HOME key before the pivot. The pivot chord itself is
   * the last of them, since it is the chord heard in both. Default: as few as
   * the search needs.
   */
  barsBefore?: number
  /** how many modulation plans to return (default 3) */
  limit?: number
  /**
   * Extra pivot suppliers — THE B4 HOOK. Candidates from these are merged with
   * the diatonic ones and ranked by the same cost function, so an enharmonic
   * pivot competes on equal terms rather than being bolted on at the end.
   */
  extraPivots?: PivotSource[]
  /**
   * Restrict to pivots of these kinds. Defaults to all, so a caller who has
   * supplied `extraPivots` gets them considered without a second opt-in.
   */
  pivotKinds?: PivotKind[]
}

export type ModulationPlan = {
  /** the whole progression, home key then target key, as one list */
  steps: PathStep[]
  /** the hinge: one chord, two readings */
  pivot: PivotCandidate
  /** index of the pivot chord within `steps` */
  pivotIndex: number
  /** the key departed */
  fromKey: string
  /** the key arrived in */
  toKey: string
  cadence: CadenceType
  /** total functional cost of both legs plus the pivot */
  cost: number
  /**
   * The progression as a composer reads it, with the pivot shown in both keys:
   * `Im - IVm=IIm - V - I`.
   */
  summary: string
}

export type ModulationResult = {
  plans: ModulationPlan[]
  exact: boolean
  reason: PathResult['reason'] | 'no-pivot-available'
  message: string
}

const graphFor = (tonic: string, scale: string) => {
  try {
    return lookUpGraph(tonic, scale) ?? chordGraphCreate(tonic, scale)
  } catch {
    return null
  }
}

/**
 * Chord-function node names, which are NOT resolvable chord symbols.
 *
 * `V64`, `N6` and `Aug6` are node names in the charts rather than chord names —
 * probed: `pivotSuggestions('V64', ...)` THROWS ('Cannot get dynamic chord V64
 * without tonic and scale name'), because resolving them needs the key and the
 * pivot API takes only a chord name. They are skipped when enumerating pivots.
 *
 * Musically this costs nothing: a cadential 6/4 is a dominant of ONE key by
 * definition and cannot be reinterpreted in another, and the Neapolitan and the
 * augmented sixth are exactly the chromatic chords whose reinterpretation is
 * B4's subject — they arrive through `extraPivots`, spelled properly, rather
 * than through a diatonic scan that cannot even resolve their notes.
 */
const FUNCTION_NODE_NAMES = new Set(['V64', 'N6', 'Aug6'])

/**
 * Length cap. LOWER than `progressionPath`'s 12, and deliberately so.
 *
 * A modulation is not one search but two, run once per candidate pivot and once
 * per legal bar split — so the work grows as (pivots x splits x two searches)
 * rather than linearly. Probed: at 12 bars a single A minor -> C major query
 * took 6.2 seconds, which is not a hang but is well outside what "returns
 * promptly" should mean for an interactive tool.
 *
 * Eight keeps the same query well under two seconds and is exactly the length
 * of the standard period — the unit a composer actually plans a modulation
 * over. Longer spans are a different problem (they contain several cadences,
 * which is P5's hierarchical territory) rather than a bigger version of this
 * one, so raising the cap would buy slowness in exchange for answers to a
 * question this module is not the right shape for.
 */
const MAX_MODULATION_BARS = 8

/**
 * How good a hinge a pivot is. LOWER IS BETTER.
 *
 * The ordering encodes what makes a modulation feel prepared rather than
 * abrupt, and it is the one piece of genuinely new musical judgement in this
 * module:
 *
 *  - A PREDOMINANT in the target key is the best pivot there is. The whole
 *    trick of a smooth modulation is to arrive at a chord the new key can use
 *    to set up its own cadence, and a predominant is precisely that: it leads
 *    straight into the new dominant, so the new key asserts itself immediately.
 *    The textbook A minor -> C major modulation pivots on Dm exactly because Dm
 *    is `iv` at home and `ii` — a predominant — in the new key.
 *  - A TONIC in the target key is next: it establishes the new key by arrival,
 *    which works, but it spends the arrival before the cadence rather than
 *    setting one up.
 *  - A DOMINANT in the target key is the weakest diatonic pivot, because a
 *    chord that is already the new dominant leaves nowhere to go but the
 *    cadence, and the modulation lands before it was prepared.
 *
 * Then: leaving the home key from a settled place is better than leaving from
 * its dominant, since a home dominant that turns out to be a pivot has had its
 * resolution snatched away. And an enharmonic pivot pays a surcharge — not
 * because it is bad (it is often the point) but because it is a swerve, and a
 * ranking that put it level with a diatonic pivot would bury the smooth option.
 */
export const PIVOT_KIND_SURCHARGE: { [K in PivotKind]: number } = {
  diatonic: 0,
  /**
   * An enharmonic reinterpretation is a swerve BY DESIGN, and must not outrank
   * a smooth diatonic hinge in the default ordering. Three is enough to put
   * every enharmonic pivot below every predominant-arriving diatonic one while
   * leaving it comfortably reachable — which is the balance the plan asked for
   * ("reachable without burying smooth diatonic hinges").
   */
  enharmonic: 3,
  'chromatic-mediant': 4,
  /**
   * A chromatic-at-home, diatonic-there pivot (the Neapolitan). Priced between
   * the two: it does not require the ear to rehear a pitch as a different note
   * the way an enharmonic pivot does, but it does leave the key's diatonic set
   * on the way out, which a plain diatonic pivot never does.
   */
  chromatic: 3,
}

/**
 * EXPORTED so `chromaticPivots.ts` scores its candidates on exactly this
 * scale. `pivotsBetween` does not recompute a source's cost — the number a
 * source reports IS the number it is ranked on — so a second implementation of
 * this arithmetic would be a silent misranking waiting to happen. B4's sources
 * call this function rather than reproducing it.
 */
export const pivotCost = (
  romanHere: string,
  romanThere: string,
  kind: PivotKind
): number => {
  const there = functionOf(romanThere)
  const here = functionOf(romanHere)

  let cost = there === 'PD' ? 0 : there === 'T' ? 2 : there === 'D' ? 3 : 2
  // leaving home from its own dominant is disruptive: that chord had a
  // resolution owed to it
  if (here === 'D') cost += 2
  else if (here === null) cost += 1
  return cost + PIVOT_KIND_SURCHARGE[kind]
}

/**
 * Diatonic pivots between two keys, via `pivotSuggestions` (V8).
 *
 * Enumerates the HOME key's chart nodes and keeps those that `pivotSuggestions`
 * reports as belonging to the target key too. Driving it from the home chart —
 * rather than from every chord in the target key — is what guarantees the pivot
 * is a chord the search can actually REACH: a pivot the home key's graph has no
 * node for is not a hinge, it is a hole.
 */
export const diatonicPivots: PivotSource = (
  fromTonic,
  fromScale,
  toTonic,
  toScale
) => {
  const homeGraph = graphFor(fromTonic, fromScale)
  const targetGraph = graphFor(toTonic, toScale)
  if (!homeGraph || !targetGraph) return []
  const targetKey = `${toTonic} ${toScale}`

  const out: PivotCandidate[] = []
  for (const [name, node] of Object.entries(homeGraph)) {
    if (FUNCTION_NODE_NAMES.has(name)) continue
    // the pivot must be a node in the TARGET chart too, or the second leg has
    // nowhere to start from
    if (!targetGraph[name]) continue

    let hit
    try {
      hit = pivotSuggestions(name, fromTonic, fromScale).find(
        (p) => p.targetKey === targetKey
      )
    } catch {
      // pivotSuggestions throws on names it cannot resolve; a chord that
      // cannot be resolved cannot be a pivot, so this is a skip, not an error
      continue
    }
    if (!hit) continue

    const romanHere = node.roman
    // Prefer the TARGET GRAPH's roman over pivotSuggestions' derived one.
    // Probed: the two agree for every diatonic pivot between A minor and C
    // major, but the graph's roman is the chart's own hand-authored label and
    // is correct in the cases where the derived one is not (romanInKey returns
    // 'VII7b5' where the chart says 'VIIm7b5', and null for leading-tone chords
    // in minor).
    const romanThere = targetGraph[name].roman ?? hit.romanThere
    out.push({
      name,
      romanHere,
      romanThere,
      kind: 'diatonic',
      cost: pivotCost(romanHere, romanThere, 'diatonic'),
    })
  }
  return out
}

/**
 * Rank pivot candidates. Deterministic: cost, then the two romans, then the
 * chord name — a total order, so repeated calls cannot reorder ties.
 */
const comparePivots = (a: PivotCandidate, b: PivotCandidate): number =>
  a.cost - b.cost ||
  a.romanThere.localeCompare(b.romanThere) ||
  a.romanHere.localeCompare(b.romanHere) ||
  a.name.localeCompare(b.name)

/**
 * Every pivot between two keys, best first.
 *
 * Exported because "how do I get from here to there" is a useful question on
 * its own, before any pathfinding — a composer may just want to see the hinges.
 */
export const pivotsBetween = (
  fromTonic: string,
  fromScale: string,
  toTonic: string,
  toScale: string,
  opts?: Pick<ModulationOptions, 'extraPivots' | 'pivotKinds'>
): PivotCandidate[] => {
  const sources: PivotSource[] = [diatonicPivots, ...(opts?.extraPivots ?? [])]
  const seen = new Set<string>()
  const all: PivotCandidate[] = []
  for (const source of sources) {
    let candidates: PivotCandidate[] = []
    try {
      candidates = source(fromTonic, fromScale, toTonic, toScale)
    } catch {
      // a misbehaving extra source must not sink the whole query
      continue
    }
    for (const c of candidates) {
      if (opts?.pivotKinds && !opts.pivotKinds.includes(c.kind)) continue
      // dedupe on (name, kind): the same chord may legitimately be offered as
      // both a diatonic and an enharmonic pivot, and those are different moves
      const key = `${c.name} ${c.kind}`
      if (seen.has(key)) continue
      seen.add(key)
      all.push(c)
    }
  }
  return all.sort(comparePivots)
}

/**
 * Route from a chord in one key, through a pivot, to a cadence in ANOTHER key.
 *
 * THE HEADLINE FEATURE. The algorithm is three composed steps per candidate
 * pivot, and every one of them delegates to a function that is already tested:
 *
 *   1. `pathToCadence`-style search from `from` to the pivot chord, in the HOME
 *      key (`pathToChord` below, which is the same weighted enumeration with a
 *      chord rather than a cadence as its goal);
 *   2. the pivot chord, which is the LAST chord of leg one and the FIRST of leg
 *      two — one chord, not two, because that is what a pivot is;
 *   3. `pathToCadence` from the pivot to the requested cadence, in the TARGET
 *      key.
 *
 * Pivots are tried in cost order and each yields at most one plan, so the
 * result is a menu of DIFFERENT hinges rather than several variations on one.
 * That is the more useful shape: a composer choosing a modulation is choosing
 * the joint.
 *
 * Determinism is inherited: both legs are `progressionPath`'s deterministic
 * search, pivots are ranked by a total order, and plans are sorted by one.
 *
 * NEVER THROWS. Every failure mode — no pivot, no route to the pivot, no
 * cadence in the target key — returns a result with `exact: false` and a reason.
 *
 * @param bars TOTAL bars including both legs; the pivot is counted once.
 *
 * @example the textbook modulation: A minor to C major
 * pathThroughModulation('Am', 'PAC', 5, 'A', 'minor', 'C', 'major')
 * // pivot Dm — `iv` at home, `ii` in the new key — then ii - V - I in C.
 */
export const pathThroughModulation = (
  from: string,
  cadenceType: CadenceType,
  bars: number,
  fromTonic: string,
  fromScale: string,
  toTonic: string,
  toScale: string,
  opts?: ModulationOptions
): ModulationResult => {
  const limit = opts?.limit ?? 3
  const fromKey = `${fromTonic} ${fromScale}`
  const toKey = `${toTonic} ${toScale}`

  const fail = (
    reason: ModulationResult['reason'],
    message: string
  ): ModulationResult => ({ plans: [], exact: false, reason, message })

  // A cadence is two chords and a pivot needs at least one chord before it in
  // the home key, so three is the floor for anything worth calling a modulation.
  if (bars < 3) {
    return fail(
      'bars-too-few',
      'A modulation needs at least 3 bars: a chord in the home key, the pivot, and a cadence.'
    )
  }

  if (fromKey === toKey) {
    return fail(
      'cadence-unavailable-in-key',
      `${fromKey} and ${toKey} are the same key — use pathToCadence for a route within one key.`
    )
  }

  const homeGraph = graphFor(fromTonic, fromScale)
  if (!homeGraph) return fail('invalid-key', `Could not build a chord graph for ${fromKey}.`)
  if (!graphFor(toTonic, toScale))
    return fail('invalid-key', `Could not build a chord graph for ${toKey}.`)
  if (!homeGraph[from])
    return fail(
      'unknown-start-chord',
      `${from} is not a chord in the ${fromKey} chart, so there is nothing to search from.`
    )

  // Cap the length, matching `pathToCadence`'s own cap. PROBED: without it,
  // `bars: 999` spent 5.6 seconds enumerating before reporting a near miss —
  // not a hang, but far outside what "never hangs" should mean in practice.
  const cappedBars = Math.min(bars, MAX_MODULATION_BARS)

  const pivots = pivotsBetween(fromTonic, fromScale, toTonic, toScale, opts)
  if (pivots.length === 0) {
    return fail(
      'no-pivot-available',
      `No chord is shared between ${fromKey} and ${toKey}, so there is no pivot to hinge on. ` +
        `A direct or enharmonic modulation would be needed (B4 supplies those via extraPivots).`
    )
  }

  const plans: ModulationPlan[] = []
  for (const pivot of pivots) {
    // SPLIT THE BAR BUDGET. The pivot is shared, so a plan of `bars` chords is
    // `before` chords ending ON the pivot, plus the target-key continuation
    // (+1 because the pivot belongs to both legs).
    //
    // `barsBefore` PINS the split when the caller supplies it, because where
    // the hinge falls is a real compositional choice — modulating in bar 2 of 8
    // is a different piece from modulating in bar 6. When it is NOT supplied,
    // every legal split is tried rather than one guessed midpoint.
    //
    // Trying them all matters more than it looks. PROBED: with a single
    // midpoint guess, a four-bar modulation gave leg one only two bars, so any
    // pivot two steps away from the start (G7 is `Am - Dm - G7`) was silently
    // dropped — a perfectly good hinge reported as unreachable because of an
    // arbitrary internal split the caller never asked for. The search is small,
    // so there is no reason to guess.
    const splits =
      opts?.barsBefore !== undefined
        ? [opts.barsBefore]
        : Array.from({ length: Math.max(0, cappedBars - 2) }, (_, i) => i + 2)

    let leg1: ProgressionPath | null = null
    let secondLeg: ProgressionPath | null = null
    for (const before of splits) {
      const after = cappedBars - before + 1
      if (after < 2 || before < 1) continue

      const first = pathToChord(from, pivot.name, before, fromTonic, fromScale, opts)
      if (!first) continue

      // The second leg starts from the chord AS THE TARGET KEY SPELLS IT. For
      // a diatonic pivot that is the same string; for an enharmonic one it is
      // the respelling, which is the pivot. See `PivotCandidate.nameThere`.
      const second = pathToCadence(
        pivot.nameThere ?? pivot.name,
        cadenceType,
        after,
        toTonic,
        toScale,
        { ...opts, limit: 1 }
      )
      if (second.paths.length === 0) continue

      // keep the cheapest split for this pivot, so each hinge contributes its
      // best plan rather than its first
      const total = first.cost + second.paths[0].cost
      if (!leg1 || !secondLeg || total < leg1.cost + secondLeg.cost) {
        leg1 = first
        secondLeg = second.paths[0]
      }
    }
    if (!leg1 || !secondLeg) continue

    // Re-read the pivot chord in the TARGET key: it is the same chord, but the
    // roman and the function tag must switch, because that reinterpretation IS
    // the modulation. Leaving it labelled with its home-key roman would make
    // the result a chord list rather than a modulation plan.
    const pivotStep: PathStep = {
      ...secondLeg.steps[0],
      roman: pivot.romanThere,
      function: functionOf(pivot.romanThere),
    }

    const steps: PathStep[] = [
      ...leg1.steps.slice(0, -1),
      pivotStep,
      ...secondLeg.steps.slice(1),
    ]
    const pivotIndex = leg1.steps.length - 1

    plans.push({
      steps,
      pivot,
      pivotIndex,
      fromKey,
      toKey,
      cadence: cadenceType,
      cost: leg1.cost + secondLeg.cost + pivot.cost,
      summary: steps
        .map((s, i) =>
          i === pivotIndex ? `${pivot.romanHere}=${pivot.romanThere}` : s.roman
        )
        .join(' - '),
    })
  }

  if (plans.length === 0) {
    return fail(
      'unreachable-cadence',
      `Found ${pivots.length} pivot${pivots.length === 1 ? '' : 's'} between ${fromKey} and ${toKey}, ` +
        `but no ${bars}-bar route from ${from} through any of them to a ${cadenceLabel(cadenceType)}.`
    )
  }

  // RANK BY THE HINGE FIRST, then by the whole path.
  //
  // Probed, and the reason is the thing this feature is for. Ranking on total
  // cost alone let `Bdim` (a vii-dim heard as ii-dim, pivot cost 2) tie `Dm`
  // (iv heard as ii, pivot cost 0) for the C major -> A minor modulation,
  // because Bdim's worse hinge was offset by a cheaper leg elsewhere. But the
  // composer asking for a modulation is CHOOSING THE JOINT — the surrounding
  // filler is what they will rewrite anyway — so a smoother pivot must not be
  // outranked by a tidier approach to a worse one.
  const sorted = plans
    .sort(
      (a, b) =>
        a.pivot.cost - b.pivot.cost ||
        a.cost - b.cost ||
        a.pivot.name.localeCompare(b.pivot.name) ||
        a.summary.localeCompare(b.summary)
    )
    .slice(0, limit)

  const exact = sorted.every((p) => p.steps.length === cappedBars)
  return {
    plans: sorted,
    exact,
    reason: exact ? 'exact' : 'no-path-of-requested-length',
    message: exact
      ? `${sorted.length} modulation${sorted.length === 1 ? '' : 's'} from ${fromKey} to a ${cadenceLabel(
          cadenceType
        )} in ${toKey}, pivoting on ${sorted.map((p) => p.pivot.name).join(', ')}.`
      : `Modulations found, but not of exactly ${bars} bars; returning the closest.`,
  }
}

/**
 * Weighted search from one chord to another SPECIFIC chord in one key.
 *
 * The first leg of a modulation. Deliberately a private helper rather than a
 * second public search API: `pathToCadence` is the surface a composer uses, and
 * "route me to this arbitrary chord" is a step in a modulation rather than a
 * question anyone asks on its own. If that turns out to be wrong it can be
 * exported later; exporting it now would be API surface with no caller.
 *
 * Same enumeration and same weighting as `pathToCadence`, so the two legs of a
 * modulation are scored on one scale and the totals are comparable.
 */
const pathToChord = (
  from: string,
  target: string,
  bars: number,
  tonic: string,
  scale: string,
  opts?: PathToCadenceOptions
): ProgressionPath | null => {
  const graph = graphFor(tonic, scale)
  if (!graph || !graph[from] || !graph[target]) return null
  const includeDotted = opts?.includeDotted ?? true

  if (bars < 1) return null

  const startRoman = graph[from].roman ?? romanOf(from, tonic, scale) ?? from
  const start: PathStep = {
    name: from,
    roman: startRoman,
    function: functionOf(startRoman),
  }

  // A one-bar leg means the start chord IS the pivot, which is legitimate: the
  // chord you are already on may be the hinge.
  if (bars === 1) return from === target ? makePath([start]) : null

  const found: ProgressionPath[] = []
  let expansions = 0
  const MAX = 100000

  const walk = (steps: PathStep[]): void => {
    if (expansions > MAX) return
    if (steps.length === bars) {
      if (steps[steps.length - 1].name === target) found.push(makePath([...steps]))
      return
    }
    const node = graph[steps[steps.length - 1].name]
    if (!node) return
    const edges = [
      ...(node.next ?? []).map((e) => ({ e, strength: 'strong' as const })),
      ...(includeDotted
        ? (node.dotted ?? []).map((e) => ({ e, strength: 'dotted' as const }))
        : []),
    ]
    for (const { e, strength } of edges) {
      expansions++
      if (expansions > MAX) return
      walk([
        ...steps,
        {
          name: e.name,
          roman: e.roman,
          function: functionOf(e.roman),
          strength,
          ...(e.figure ? { figure: e.figure, bass: e.bass } : {}),
        },
      ])
    }
  }
  walk([start])

  if (found.length === 0) return null
  // same total order as progressionPath's, so ties are broken identically
  return found.sort(
    (a, b) =>
      a.cost - b.cost ||
      a.steps.filter((s) => s.strength === 'dotted').length -
        b.steps.filter((s) => s.strength === 'dotted').length ||
      a.summary.localeCompare(b.summary)
  )[0]
}

const makePath = (steps: PathStep[]): ProgressionPath => {
  let cost = 0
  for (let i = 1; i < steps.length; i++) {
    cost += transitionCost(steps[i - 1].function, steps[i].function)
  }
  return {
    steps,
    // the first leg does not end in a cadence; the field is required by the
    // shared type and the modulation's cadence is carried on the plan
    cadence: 'half',
    cost,
    summary: steps.map((s) => s.roman).join(' - '),
  }
}

/**
 * The keys reachable from a chord, each with its best pivot — the exploratory
 * form of the query.
 *
 * "Where could I go from here?" rather than "take me to C major". Returns one
 * entry per candidate key, ordered by how smooth the best available hinge is.
 */
export const modulationTargets = (
  chordName: string,
  tonic: string,
  scale: string
): { targetKey: string; pivot: PivotCandidate }[] => {
  let suggestions
  try {
    suggestions = pivotSuggestions(chordName, tonic, scale)
  } catch {
    return []
  }
  const out: { targetKey: string; pivot: PivotCandidate }[] = []
  for (const s of suggestions) {
    const best = pivotsBetween(tonic, scale, s.targetTonic, s.targetScale)[0]
    if (best) out.push({ targetKey: s.targetKey, pivot: best })
  }
  return out
}
