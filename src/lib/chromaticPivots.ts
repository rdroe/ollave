import { Note } from 'tonal'

import { enharmonicPivots, type EnharmonicPivot } from './chromatic'
import { pivotCost, type PivotCandidate, type PivotSource } from './modulation'
import { pivotSuggestions } from './pivots'
import { isConventionalKeyName } from './scaleList'
import { chordGraphCreate, lookUpGraph } from './util/graphUtil'

/**
 * B4 → B2: the chromatic pivot sources (Stage M-C, C1 and C3).
 *
 * ── WHY AN ADAPTER AT ALL ────────────────────────────────────────────────────
 *
 * B2 and B4 designed to the same contract from opposite ends and never met, so
 * their surfaces are complementary rather than identical:
 *
 *   B2 wants a KEY PAIR IN, CANDIDATES OUT — `PivotSource` is
 *   `(fromTonic, fromScale, toTonic, toScale) => PivotCandidate[]`, because
 *   `pathThroughModulation` already knows both keys and needs to know which
 *   chords hinge between them.
 *
 *   B4 gives a CHORD IN, TARGET KEYS OUT — `enharmonicPivots(chordName,
 *   fromTonic, fromScale)` scans OUTWARD, because a reinterpretation is
 *   computed from the chord's pitches and the keys it can reach fall out of
 *   that computation rather than being asked for.
 *
 * Neither direction is wrong; they answer different questions. This module runs
 * B4's outward scan over the HOME CHART'S NODES and filters the results to the
 * key B2 asked about — which turns "where could this chord go" into "what hinges
 * between these two keys" without either side changing.
 *
 * ── THE THREE RULES EVERY SOURCE HERE FOLLOWS ───────────────────────────────
 *
 * All three are `diatonicPivots`' rules, applied to chromatic pivots for the
 * same reasons. Stating them once here rather than three times below:
 *
 *   1. **Drive from the HOME chart.** A pivot the home key's graph has no node
 *      for is not a hinge, it is a hole: the first leg of the search must be
 *      able to REACH it. So every candidate starts from a node name that is
 *      actually in the home chart.
 *
 *   2. **Require a node in the TARGET chart too**, under the target key's own
 *      spelling. PROBED, and it drops real cases rather than being defensive
 *      boilerplate: `G#dim7` in A minor is enharmonically `Ddim7`, the
 *      leading-tone seventh of E♭ — a correct reinterpretation whose `Ddim7`
 *      is NOT a node in the E♭ major chart, so the second leg would have
 *      nowhere to start. Reporting it would be offering a modulation that
 *      cannot be walked.
 *
 *   3. **Prefer the TARGET CHART's own roman.** B4 reports `vii°7`, which is
 *      correct musicology and is not the vocabulary these charts speak — the
 *      chart says `VIIdim7`. The chart's hand-authored label is what every
 *      other part of the search compares against (`functionOf`, the cadence
 *      definitions), so using B4's would make a pivot that routes but whose
 *      function tag reads `null`.
 *
 * ── WHAT `nameThere` IS FOR ─────────────────────────────────────────────────
 *
 * An enharmonic pivot is a chord SPELLED DIFFERENTLY IN THE TWO KEYS, so a
 * single `name` cannot describe it — `Ger6` is the home chart's node and `Ab7`
 * is the target chart's. `PivotCandidate.nameThere` was added in Stage M-C for
 * exactly this and is documented there. Diatonic pivots leave it unset.
 */

const graphFor = (tonic: string, scale: string) => {
  try {
    return lookUpGraph(tonic, scale) ?? chordGraphCreate(tonic, scale)
  } catch {
    return null
  }
}

/**
 * COSTS COME FROM `pivotCost`, NOT FROM A SECOND IMPLEMENTATION.
 *
 * `pivotsBetween` merges every source's candidates and sorts on `cost` WITHOUT
 * recomputing it — the number a source reports is the number it is ranked on.
 * So a source that scored itself on its own scale would compete against the
 * diatonic pivots on a different one, and the misranking would be silent.
 * `modulation.ts` exports `pivotCost` and `PIVOT_KIND_SURCHARGE` for exactly
 * this reason; the surcharge that keeps an enharmonic pivot below a smooth
 * diatonic hinge is applied by the same table for both.
 */

/**
 * Turn one of B4's `EnharmonicPivot`s into one of B2's `PivotCandidate`s, or
 * `null` if it does not survive rules 2 and 3 above.
 *
 * `homeName` is the HOME chart's node name, which is what B4 was asked about
 * and is not necessarily `pivot.from` (they agree today; keeping them separate
 * means a future B4 that normalizes names cannot silently break the first leg).
 */
const adaptEnharmonic = (
  pivot: EnharmonicPivot,
  homeName: string,
  homeRoman: string,
  targetGraph: { [name: string]: { roman: string } }
): PivotCandidate | null => {
  // rule 2 — the target chart must have a node under the TARGET key's spelling
  const targetNode = targetGraph[pivot.heardAs]
  if (!targetNode) return null
  // rule 3 — the chart's own roman, not B4's musicological one
  const romanThere = targetNode.roman
  return {
    name: homeName,
    ...(pivot.heardAs === homeName ? {} : { nameThere: pivot.heardAs }),
    romanHere: homeRoman,
    romanThere,
    kind: 'enharmonic',
    cost: pivotCost(homeRoman, romanThere, 'enharmonic'),
    explanation: pivot.explanation,
  }
}

/**
 * Enharmonic pivots between two keys — THE C1 DELIVERABLE.
 *
 * A `PivotSource`, so it drops straight into `ModulationOptions.extraPivots`
 * with no signature change on either side, which is what B2's contract test
 * pinned with a stand-in. This is the real one.
 *
 * Both of B4's families come through, because both are driven by home-chart
 * node names and both families' chords ARE nodes:
 *
 *   **Ger⁶ ↔ V⁷.** `Ger6` is a node in every chart (B4 added it), and its
 *   respelling `Ab7` is a node in the D♭ chart, so `C major -> Db major`
 *   hinges on one chord heard two ways. VERIFIED end to end, not merely
 *   enumerated — see `chromaticPivots.test.ts`.
 *
 *   **The four rotations of a °7.** `G#dim7` is a node in A minor; heard as
 *   `Bdim7` it is the leading-tone seventh of C minor, which is a node there.
 *   Two of the six rotations B4 reports survive rule 2, and dropping the other
 *   four is correct: a pivot whose second leg has no starting node is not a
 *   modulation the search can walk.
 *
 * The reverse direction (a dominant seventh heard as a German sixth) comes
 * through the same scan without special-casing, since `G7` is a node in C major
 * and `Ger6` is a node in B minor.
 *
 * @example the most famous enharmonic modulation in the repertoire
 * ```ts
 * pathThroughModulation('C', 'PAC', 4, 'C', 'major', 'Db', 'major', {
 *   extraPivots: [enharmonicPivotSource],
 * })
 * // pivots on Ger6 = V7: Ab-C-Eb-F# respelled Ab-C-Eb-Gb is Ab7,
 * // the dominant seventh of Db.
 * ```
 */
export const enharmonicPivotSource: PivotSource = (
  fromTonic,
  fromScale,
  toTonic,
  toScale
): PivotCandidate[] => {
  const homeGraph = graphFor(fromTonic, fromScale)
  const targetGraph = graphFor(toTonic, toScale)
  if (!homeGraph || !targetGraph) return []
  const targetKey = `${toTonic} ${toScale}`

  const out: PivotCandidate[] = []
  for (const [homeName, homeNode] of Object.entries(homeGraph)) {
    let pivots: EnharmonicPivot[] = []
    try {
      pivots = enharmonicPivots(homeName, fromTonic, fromScale)
    } catch {
      // a name B4 cannot analyse is not a pivot; skip rather than fail the query
      continue
    }
    for (const p of pivots) {
      if (p.targetKey !== targetKey) continue
      const candidate = adaptEnharmonic(p, homeName, homeNode.roman, targetGraph)
      if (candidate) out.push(candidate)
    }
  }
  return out
}

/**
 * Chromatic CHART-NODE pivots — THE C3 DELIVERABLE: `N6` and the augmented
 * sixths, spelled properly.
 *
 * ── THE PROBLEM THIS SOLVES ─────────────────────────────────────────────────
 *
 * `diatonicPivots` skips `V64`, `N6` and `Aug6` because `pivotSuggestions`
 * THROWS on them — they are chord-FUNCTION node names rather than chord
 * symbols, so resolving them needs the key and `pivotSuggestions` takes only a
 * name. B2 documented that skip and said these should "arrive as properly
 * spelled chromatic pivots instead". This is that arrival.
 *
 * ── WHICH OF THE SIX QUALIFY, AND WHY THE OTHER FOUR DO NOT ─────────────────
 *
 * PROBED, one at a time, and the answers are musical rather than mechanical:
 *
 *   **`N6` — YES.** Probed: in C major it is `F-Ab-Db`, which is the D♭ MAJOR
 *   TRIAD in first inversion. A major triad is diatonic to six keys, so ♭II
 *   here is `I` in D♭, `IV` in A♭, `VI` in F minor, and so on. That is a
 *   genuine hinge and a good one — the Neapolitan is a predominant at home and
 *   arrives as a stable diatonic chord in the new key, which is the smooth
 *   direction. The name changes (`N6` here, `Db` there), which is precisely
 *   what `nameThere` exists for.
 *
 *   **The augmented sixths — NO, and this is a fact about the chords.** Probed:
 *   `Chord.detect(['Ab','C','F#'])` is `['Ab7no5']`, `['Ab','C','D','F#']` is
 *   `['Ab7b5']`, and only the German `['Ab','C','Eb','F#']` is a plain
 *   `['Ab7']`. An augmented sixth is not a tertian chord; it is ♭6-1-♯4 with an
 *   augmented sixth as its outer interval, and there is no key it is DIATONIC
 *   to. It hinges by ENHARMONIC RESPELLING, not by shared membership — which is
 *   `enharmonicPivotSource`'s job and is exactly what B4 built, so routing them
 *   here as well would offer the same modulation twice under a worse
 *   description. `enharmonicPivots('Aug6', …)` correctly returns `[]` (`Aug6`
 *   aliases the ITALIAN, which has no fifth and so is not a V⁷), so the
 *   generic node genuinely has no reinterpretation and none is invented for it.
 *
 *   **`V64` — NO.** A cadential six-four is the dominant of ONE key by
 *   definition: it is tonic notes suspended over that key's fifth degree, and
 *   its identity is the resolution that follows. There is nothing to
 *   reinterpret, which `modulation.ts` already says in its own words.
 *
 * So this source has exactly one member, and the honest reason is that only one
 * of the four chromatic function nodes is a hinge of this kind. A source that
 * returned four would be padding.
 */
export const chromaticNodePivotSource: PivotSource = (
  fromTonic,
  fromScale,
  toTonic,
  toScale
): PivotCandidate[] => {
  const homeGraph = graphFor(fromTonic, fromScale)
  const targetGraph = graphFor(toTonic, toScale)
  if (!homeGraph || !targetGraph) return []
  if (!homeGraph['N6']) return []
  const targetKey = `${toTonic} ${toScale}`

  // The Neapolitan's ROOT is ♭2. The chart node spells the chord in first
  // inversion (♭2 on top, 4 in the bass), so the root has to be derived from
  // the tonic by interval rather than read off the note list — the same rule
  // `mixture.ts` and the augmented sixths follow, and for the same reason:
  // degree arithmetic double-flattens in minor and mis-spells in flat keys.
  const root = Note.transpose(fromTonic, 'm2')
  if (!root) return []

  // PROBED: in E♭ major ♭2 is F♭, and `pivotSuggestions('Fb', 'Eb', 'major')`
  // offers `Bbb major` — a key that is arithmetically correct and musically
  // nonexistent. `pivotSuggestions` does not filter these; this source does,
  // using the project's own answer to that exact problem (scaleList.ts), which
  // is what B4 filters its own targets with.
  if (!isConventionalKeyName(targetKey)) return []

  // RULE 2 — the target chart must have a node for the pivot under the TARGET
  // key's spelling, or the second leg has nowhere to start.
  const targetNode = targetGraph[root]
  if (!targetNode) return []

  let suggestions
  try {
    suggestions = pivotSuggestions(root, fromTonic, fromScale)
  } catch {
    return []
  }
  // the triad must genuinely be diatonic to the target key — that is the whole
  // claim this pivot makes, and `pivotSuggestions` is what establishes it
  const hit = suggestions.find((s) => s.targetKey === targetKey)
  if (!hit) return []

  // RULE 3 — the chart's own roman over the derived one
  const romanThere = targetNode.roman ?? hit.romanThere
  return [
    {
      name: 'N6',
      nameThere: root,
      romanHere: 'N6',
      romanThere,
      kind: 'chromatic',
      cost: pivotCost('N6', romanThere, 'chromatic'),
      explanation:
        `The Neapolitan of ${fromTonic} ${fromScale} is the ${root} major triad in ` +
        `first inversion. Heard as ${romanThere} of ${targetKey} it stops being a ` +
        `chromatic predominant and becomes a diatonic chord, which is what makes ` +
        `it a hinge rather than a colour.`,
    },
  ]
}

/**
 * Every chromatic pivot source, as one array ready for `extraPivots`.
 *
 * The convenience form, because a caller who wants "the chromatic pivots" wants
 * all of them and should not have to know that C1 and C3 were separate tasks.
 *
 * ```ts
 * pathThroughModulation('C', 'PAC', 4, 'C', 'major', 'Db', 'major', {
 *   extraPivots: chromaticPivotSources,
 * })
 * ```
 */
export const chromaticPivotSources: PivotSource[] = [
  enharmonicPivotSource,
  chromaticNodePivotSource,
]

