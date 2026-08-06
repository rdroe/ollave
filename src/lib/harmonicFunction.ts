import type { ChordProgressionGraph } from './util/graphUtil'

/**
 * Harmonic function tags — T / PD / D (Stage M-B, B2, pulled forward from P5).
 *
 * WHY THIS EXISTS AT ALL. `progressionPath.ts` searches the chord graph for a
 * route to a cadence. A search that weights every edge equally returns the
 * SHORTEST legal chain, and the shortest legal chain through this graph is
 * routinely something a composer would never write: the tonic node reaches the
 * dominant directly, so "get me from I to a PAC in four bars" answered by an
 * unweighted search is `I - I - I - V - I`, which is legal, wrong, and useless.
 * Weighting by function turns the same search into `I - IV - V - I`, because
 * T -> PD -> D -> T is cheap and T -> T -> T -> D is not. The tags are the
 * cheapest possible thing that makes the search goal-directed, which is why the
 * plan pulls them forward out of the deferred prolongation work (P5). What
 * stays deferred is true recursion — spans within spans — not this.
 *
 * WHY THE TAG IS KEYED ON THE ROMAN, NOT ON THE SCALE DEGREE OF THE ROOT.
 * This was probed before it was written, and the probe is the reason the file
 * looks like a table rather than an algorithm. Deriving function from the root's
 * scale degree gets a startling number of chart nodes wrong:
 *
 *   C major, `A7`   — root A, degree 6, which would read as TONIC (vi is a
 *                     tonic substitute). It is `V7/IIm`: an applied DOMINANT.
 *   C major, `Edim` — root E, degree 3, which would read as TONIC (iii). It is
 *                     `VIIdim/IV`: an applied dominant of the subdominant.
 *   C major, `D`    — root D, degree 2, which would read as PREDOMINANT (ii).
 *                     It is `V/V`, whose function IS predominant — but by
 *                     coincidence of this key, not by the rule.
 *   A minor, `G7`   — root G, degree 7, which would read as DOMINANT. It is
 *                     `V7/III`: an applied dominant of the mediant, so within
 *                     the home key it prolongs the mediant rather than the
 *                     tonic.
 *   A minor, `G#dim`— root G#, CHROMATIC, so degree-based tagging has no answer
 *                     at all for the one chord in the key with the strongest
 *                     dominant function of any triad.
 *
 * Every one of those is a wrong answer delivered with confidence, which for
 * this audience is worse than no answer. The roman IS the function label — that
 * is what a roman numeral is for — and the charts already carry it on every
 * node and every edge, so tagging the roman is both correct and free.
 *
 * WHAT THE THREE TAGS MEAN, and the one modelling decision inside them:
 *
 *   'T'  tonic — a point of repose, or a chord that substitutes for one
 *   'PD' predominant — prepares the dominant; the middle of the cycle
 *   'D'  dominant — creates the tension a tonic resolves
 *
 * APPLIED CHORDS ARE TAGGED BY WHAT THEY PREPARE IN THE HOME KEY, not by their
 * local function. `V7/V` is locally a dominant (of V) but within the home key
 * it is a PREDOMINANT: it is what you play before the dominant, and the chart
 * agrees — `V/V` leads to `V64`, `VIIdim` and `V`, which is exactly a
 * predominant's edge set. Tagging it 'D' would tell the search that `V/V - V`
 * is a D -> D move, i.e. harmonically static, when it is the single most
 * idiomatic approach to the dominant in the chromatic vocabulary. The other
 * applied chords (`V7/IIm`, `V7/IV`, `V7/VIm`, `V7/IIIm`) are tagged by the
 * same rule: they prepare a chord that is not the dominant, so they take the
 * function of a chord that leads to their target rather than 'D'.
 */

/**
 * The three functions of the tonal cycle.
 *
 * Deliberately three, not more. Finer schemes exist (separating the "tonic
 * substitute" iii/vi from the tonic proper, or splitting the dominant into
 * leading-tone and dominant-proper), and the search does not need them: what
 * the weighting has to know is which of the three regions a chord sits in, and
 * every finer distinction is already carried by the roman itself, which callers
 * receive alongside the tag.
 */
export type HarmonicFunction = 'T' | 'PD' | 'D'

/**
 * ROMAN -> FUNCTION, hand-verified against both charts.
 *
 * Every roman appearing as a node or an edge in `graphData/major.ts` and
 * `graphData/minor.ts` is present here (`harmonicFunction.test.ts` pins that
 * exhaustively, so a chart addition by another stream fails a test rather than
 * silently falling through to the default). Figured romans (`I6`, `V65`) are
 * NOT listed: a figure changes the bass, never the function, so `functionOf`
 * strips the figure before looking up. That is the musically correct reading —
 * `V65` is as dominant as `V7` — and it keeps this table one entry per chord
 * rather than one per chord per inversion.
 */
const FUNCTION_BY_ROMAN: { [roman: string]: HarmonicFunction } = {
  // --- TONIC -------------------------------------------------------------
  // The tonic proper, in both modes, with the major-mode seventh and the
  // minor-mode Picardy third ('I' appears in the MINOR chart as the Picardy
  // arrival, which is why both spellings are here).
  I: 'T',
  Im: 'T',
  Imaj7: 'T',
  Im7: 'T',
  // Tonic substitutes. iii and vi share two of the tonic's three notes and
  // stand in for it: the deceptive cadence works precisely because vi is close
  // enough to the tonic to be mistaken for it for an instant.
  IIIm: 'T',
  VIm: 'T',
  // Minor-mode III and VI are the same substitutes with the minor key's
  // spellings — III is the relative major, VI the submediant the deceptive
  // cadence lands on.
  III: 'T',
  VI: 'T',
  // The subtonic. VII in a minor key is the major triad on the LOWERED seventh
  // (G in A minor), NOT a leading-tone chord: it has no leading tone in it, and
  // the chart routes it to III, which is the modulatory move to the relative
  // major it exists for. Tagging it 'D' by its numeral would be the single
  // worst error available in this table — it would tell the search that the
  // subtonic resolves like a dominant, which is exactly what it does not do.
  VII: 'T',

  // --- PREDOMINANT -------------------------------------------------------
  // The two diatonic predominants and their sevenths, in both modes.
  IV: 'PD',
  IVm: 'PD',
  IVmaj7: 'PD',
  IVm7: 'PD',
  IIm: 'PD',
  IIm7: 'PD',
  // The minor-mode supertonic is diminished; its half-diminished seventh is the
  // ii-flat-5-7 of the minor ii-V-i. Same function as ii in major.
  IIdim: 'PD',
  IIm7b5: 'PD',
  // Chromatic predominants. Both exist only to approach the dominant, and the
  // chart gives both exactly the edges of a predominant (-> V64, -> V).
  N6: 'PD',
  Aug6: 'PD',
  // Applied dominants OF the dominant. Locally dominant, functionally
  // predominant in the home key — see the header. This is the one place the
  // table deliberately disagrees with a chord's own name, and the chart's edge
  // set is the evidence: V/V goes where ii and IV go.
  'V/V': 'PD',
  'V7/V': 'PD',
  'VIIdim/V': 'PD',
  'VIIdim7/V': 'PD',

  // --- DOMINANT ----------------------------------------------------------
  V: 'D',
  V7: 'D',
  // Leading-tone chords are dominants without a root: vii-dim shares three of
  // the four notes of V7 and resolves identically.
  VIIdim: 'D',
  VIIdim7: 'D',
  VIIm7b5: 'D',
  // The cadential 6/4 as the chart's function node. It SOUNDS like a tonic
  // triad and FUNCTIONS as a dominant — the sixth and fourth above the bass are
  // suspensions resolving to the fifth and third over a held dominant bass.
  // Tagging it 'T' because its notes spell the tonic would be the classic
  // undergraduate error, and would make the search treat `V64 - V` as a T -> D
  // move that discharges tension, when in fact both chords are the dominant.
  V64: 'D',
}

/**
 * Applied chords of a target that is NOT the dominant — `V7/IIm`, `VIIdim/IV`,
 * `V7/VIm`, `V7/III` and friends.
 *
 * These are tagged by their TARGET's function rather than being listed one by
 * one, because the rule is uniform and a table would go stale the moment B4
 * adds a chromatic node. An applied chord's job in the home key is to deliver
 * its target, so it inherits the function of the region it delivers into: an
 * applied dominant of ii is a predominant-region chord (it produces a
 * predominant), an applied dominant of vi is a tonic-region chord.
 *
 * `V/V` and its relatives are the exception and are listed explicitly above,
 * because the rule would give them 'PD' anyway and being explicit lets the
 * header document the one interesting case in the table.
 */
const appliedFunction = (roman: string): HarmonicFunction | null => {
  const slash = roman.indexOf('/')
  if (slash === -1) return null
  const target = roman.slice(slash + 1)
  // recursion is safe: a target never itself contains '/', because the charts
  // have no doubly-applied chords (`V7/V/V` is not a node in either chart).
  const targetFn = FUNCTION_BY_ROMAN[target]
  return targetFn ?? null
}

/** Figures a roman may carry, longest first so '64' wins over '6'. */
const FIGURE_SUFFIXES = ['64', '65', '43', '42', '53', '6'] as const

/**
 * Strip a figured-bass suffix from a roman: `'I6'` -> `'I'`, `'V65'` -> `'V7'`.
 *
 * A FIGURE NEVER CHANGES A FUNCTION — `V65` is as dominant as `V7`, `I6` as
 * tonic as `I` — so stripping is the correct normalization rather than a
 * shortcut, and it keeps `FUNCTION_BY_ROMAN` one row per chord instead of one
 * row per chord per inversion.
 *
 * Seventh-chord figures restore the '7' they absorbed: `figuredRoman` turns
 * `{ chord: 'V7', figure: '65' }` into `'V65'` rather than `'V765'`, so undoing
 * it has to put the seventh back or the lookup misses. Triad figures do not.
 *
 * Guarded against eating a roman that legitimately ends in those digits:
 * `'V64'` is a NODE NAME in both charts (the cadential six-four function chord)
 * and must not be stripped to `'V'`. It is in the table, and the table is
 * consulted first, so the guard is simply that stripping only happens on a miss.
 */
const stripFigure = (roman: string): string | null => {
  for (const fig of FIGURE_SUFFIXES) {
    if (!roman.endsWith(fig) || roman.length === fig.length) continue
    const base = roman.slice(0, -fig.length)
    // seventh-chord figures absorbed a trailing '7'; put it back
    if (fig === '65' || fig === '43' || fig === '42') return `${base}7`
    return base
  }
  return null
}

/**
 * The harmonic function of a roman numeral, or `null` when it is not a chord
 * this vocabulary knows.
 *
 * NULL, NOT A GUESS. An unknown roman gets no tag rather than a default,
 * because a wrong function tag propagates silently into the search weighting and
 * produces a path that is subtly aimless in a way nobody can trace back to
 * here. Callers treat null as "unweighted", which degrades the search's
 * goal-direction without corrupting it.
 *
 * @example
 * functionOf('V7')      // 'D'
 * functionOf('V65')     // 'D'  — the figure does not change the function
 * functionOf('V64')     // 'D'  — the cadential 6/4 IS a dominant
 * functionOf('VII')     // 'T'  — the minor-key subtonic is not a dominant
 * functionOf('V7/IIm')  // 'PD' — tagged by what it prepares
 */
export const functionOf = (roman: string): HarmonicFunction | null => {
  const direct = FUNCTION_BY_ROMAN[roman]
  if (direct) return direct

  const applied = appliedFunction(roman)
  if (applied) return applied

  const stripped = stripFigure(roman)
  if (stripped) {
    const viaFigure = FUNCTION_BY_ROMAN[stripped]
    if (viaFigure) return viaFigure
    const viaApplied = appliedFunction(stripped)
    if (viaApplied) return viaApplied
  }

  return null
}

/**
 * Every roman this module can tag, sorted — the vocabulary, for tests and for
 * a caller that wants to show the table.
 */
export const taggedRomans = (): string[] => Object.keys(FUNCTION_BY_ROMAN).sort()

/**
 * Function tags for every node in a realized graph, keyed by realized chord
 * name.
 *
 * KEYED BY NAME BUT TAGGED BY ROMAN, which is the whole point: the graph is
 * indexed by realized chord name and two different functions can share a name
 * ACROSS keys (`Bdim` is `VIIdim` in C major and `IIdim` in A minor — probed),
 * so a name-keyed function table is only meaningful per key. Within one key the
 * names are unique, so this map is well defined; across keys it is not, and
 * that is why the map is built per graph rather than baked in as a constant.
 */
export const functionMap = (
  graph: ChordProgressionGraph
): { [chordName: string]: HarmonicFunction } => {
  const out: { [chordName: string]: HarmonicFunction } = {}
  for (const [name, node] of Object.entries(graph)) {
    const fn = functionOf(node.roman)
    if (fn) out[name] = fn
  }
  return out
}

/**
 * The cost of moving from one function to another — the weight that makes the
 * search goal-directed rather than merely legal.
 *
 * LOWER IS BETTER, and the numbers are ordinal rather than measured: nothing
 * here claims that T -> PD is exactly twice as good as PD -> PD. What they
 * encode is a strict preference order, verified against what the resulting
 * paths look like (see `progressionPath.test.ts`, which pins real output):
 *
 *   0  the cycle's own motion — T -> PD, PD -> D, D -> T. These are the three
 *      moves that ARE the tonal cycle; a path made only of them is the
 *      textbook progression and should cost nothing.
 *   1  T -> D, skipping the predominant. Extremely common (I - V - I) and
 *      perfectly good, just less shapely than going the long way round, which
 *      is exactly the preference a composer asking for a FOUR-BAR path wants.
 *   2  staying in a region — T -> T, PD -> PD, D -> D. Prolongation is real
 *      music, not an error, so this is a cost rather than a prohibition; it is
 *      what stops the search answering every query with `I - I - I - V - I`.
 *   3  retreating against the cycle — D -> PD, PD -> T. A dominant falling back
 *      to a predominant is the one motion common practice genuinely avoids
 *      (it undoes the tension it just built), so it is the most expensive move
 *      that is still permitted. NOT forbidden: `V - IV - I` is a real thing in
 *      the literature, just not what to hand someone who asked for a path.
 *
 * D -> T is 0 and appears at the END of every cadential path, which is the
 * point: the cadence itself is free, so the search spends its budget on the
 * approach.
 */
const TRANSITION_COST: {
  [from in HarmonicFunction]: { [to in HarmonicFunction]: number }
} = {
  T: { T: 2, PD: 0, D: 1 },
  PD: { T: 3, PD: 2, D: 0 },
  D: { T: 0, PD: 3, D: 2 },
}

/**
 * Cost of a functional move, for the pathfinder's edge weighting.
 *
 * An UNTAGGED chord costs `unknownCost` (default 2, the same as staying in a
 * region) at either end. That is deliberately neutral: an unknown chord should
 * neither be preferred nor effectively banned, because the vocabulary is
 * expected to grow — B4 adds chromatic nodes to these charts, and a punitive
 * default would make every one of them invisible to the search until this file
 * was updated to match.
 */
export const transitionCost = (
  from: HarmonicFunction | null,
  to: HarmonicFunction | null,
  unknownCost = 2
): number => {
  if (!from || !to) return unknownCost
  return TRANSITION_COST[from][to]
}

/**
 * A human-readable name for a function tag, for UI and for explaining a path.
 */
export const functionLabel = (fn: HarmonicFunction): string =>
  ({ T: 'tonic', PD: 'predominant', D: 'dominant' })[fn]
