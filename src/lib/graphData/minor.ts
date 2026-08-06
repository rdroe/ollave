import type { ProgressionChart } from './types'

/**
 * Minor-key harmonic flowchart.
 *
 * ORIGIN (history, not a specification): this data started as a transcription
 * of a minor-key boxes-and-arrows figure. The region comments below —
 * "double-box top", "big confusing box", "non-box with sixes",
 * "upper boxesssssss ltr", "small upper fork", "downward arrow" — are kept
 * verbatim because they are useful landmarks when reading the data, and they
 * let it be diffed against that original picture.
 *
 * The chart has since been corrected against classical practice where the two
 * disagreed (see the dominant-complex note below, and the leading-tone
 * spelling of VIIdim). It is ordinary maintained data: ADD, REMOVE OR RESPELL
 * EDGES FREELY when the music justifies it. The only obligation is to say what
 * changed and why, as the note below does.
 *
 * Solid arrows become `next`; dashed arrows become `dotted`. Where a node is
 * reachable only from certain predecessors, that arrival context is recorded
 * as `prev` and becomes each edge's `enabler`.
 *
 * CORRECTION — the dominant complex (V64 / N6 / Aug6).
 * As originally transcribed the arrows ran `V -> V64` and
 * `V64 -> {N6, Aug6, I, Im}`, i.e. the cadential 6/4 came *after* the dominant
 * and the sixth chords came after that. That is backwards for common-practice
 * harmony and has been flipped to the classical direction:
 *
 *   - The cadential 6/4 is not a tonic chord. It is tonic notes suspended over
 *     scale degree 5 in the bass, functioning as dominant; its 6 and 4 resolve
 *     down to 5 and 3 over a held bass. So it resolves *to* V, and `V64 -> V`
 *     is its only strong edge. `V64 -> {I, Im}` was removed: a 6/4 moving
 *     straight to a root-position tonic is a passing or pedal 6/4, a different
 *     object from the cadential 6/4 this chart models.
 *   - N6 and Aug6 are predominants. Both approach the dominant, so each now
 *     leads to `V64` (the decorated arrival) as well as directly to `V`.
 *   - V therefore no longer lists V64/Aug6 as successors. It resolves to Im,
 *     with the dotted I retained as the Picardy third.
 *
 * Edges *into* the dominant complex from predominants (Im, IVm, IIdim,
 * VIIdim/V, V/V all list V64) are unchanged and correct: arriving at the
 * cadential 6/4 from a predominant is exactly the standard approach.
 *
 * DIATONIC SEVENTHS (Im7, IIm7b5, IVm7, V7, VIIdim7) are first-class nodes.
 * Three decisions govern them, applied uniformly here and in major.ts:
 *
 *   1. A seventh sits BESIDE its triad, never replacing it. `Im -> IVm` still
 *      offers Dm in A minor; Dm7 is offered as well. Both are correct choices
 *      and a caller that asked for the triad keeps getting it.
 *   2. A seventh's OUTGOING edges mirror its triad's, because adding a seventh
 *      does not change a chord's function: IIm7b5 is still the predominant
 *      IIdim is, so it goes everywhere IIdim goes. V7 accordingly inherits V's
 *      dotted Picardy edge to I as well as the strong resolution to Im — it is
 *      the strongest dominant in the idiom and resolves exactly as V does.
 *   3. A seventh is reached over a DOTTED edge, wherever its triad is reached.
 *      This is what keeps the promotion honest: sevenths are colour available
 *      on top of the principal motion, not a competing principal motion. It
 *      also means `nextChord` (strong edges only) returns byte-identical
 *      results to before this change — verified by probe across every node in
 *      A minor and C major.
 *
 * V7 is deliberately NOT an exception to rule 3. Offering it as a strong
 * target would grow default suggestion lists ~12% here (~18% in major) while
 * buying nothing a dotted edge does not already provide: V7's own outgoing
 * edges are strong either way, so once a caller takes the V7 edge the cadence
 * it leads to is undiminished.
 *
 * The Im7 node is reachable but leads onward exactly as Im does. Note Im lists
 * ITSELF among its successors, so Im also reaches Im7 — the tonic may take its
 * seventh as a colouring without leaving tonic function.
 */
export const minor: ProgressionChart = {
  Im: [
    {
      name: 'Im',
      next: ['Im', 'IVm', 'VII', 'III', 'VI', 'IIdim', 'V64', 'VIIdim', 'V'],
      // seventh colour on the chords this node already reaches (rule 3)
      dotted: ['Im7', 'IVm7', 'IIm7b5', 'VIIdim7', 'V7'],
    },
  ],

  IVm: [
    {
      name: 'IVm',
      next: ['VII'],
      dotted: ['VIIdim/III', 'V7/III'],
    },
    // double-box top
    {
      name: 'IVm',
      prev: ['VI', 'VIIdim/VIm', 'V7/VIm'],
      next: [
        'VIIdim/V',
        'V/V', // small upper fork
        'V64',
        'VIIdim',
        'V',
      ], // big confusing box
      dotted: ['VIIdim7', 'V7'],
    },
  ],
  VII: [
    {
      name: 'VII',
      next: ['III'],
      dotted: ['I'],
    },
  ],
  III: [
    {
      name: 'III',
      next: ['VIIdim/VIm', 'V7/VIm', 'VI'],
    },
  ],
  VI: [
    {
      name: 'VI',
      next: ['IIdim', 'IVm' /* N6 Aug6 */],
      dotted: ['IIm7b5', 'IVm7'],
    },
  ],
  // double-box bottom
  IIdim: [
    {
      name: 'IIdim',
      prev: ['VI'],
      next: [
        'VIIdim/V',
        'V/V', // small upper fork
        'V64',
        'VIIdim',
        'V',
      ], // big confusing box
      dotted: ['VIIdim7', 'V7'],
    },
  ],
  // big confusing box v64 — cadential 6/4, resolves to V (see header note)
  V64: [
    {
      name: 'V64',
      next: ['V'],
      dotted: ['V7'],
    },
  ],
  // big confusing box viio (must play V before leaving ???)
  VIIdim: [
    {
      name: 'VIIdim',
      prev: ['IVm', 'IIdim'],
      next: ['V'],
      dotted: ['V7'],
    },
  ],
  // big confusing box V
  V: [
    {
      name: 'V',
      next: ['Im'],
      // the Picardy third, plus the dominant's own seventh: V -> V7 is the
      // ordinary move of adding the seventh before resolving
      dotted: ['I', 'V7', 'Im7'],
    },
  ],
  // non-box with sixes N6
  N6: [
    {
      name: 'N6',
      next: ['V64', 'V'],
      dotted: ['V7'],
    },
  ],
  // non-box with sixes Aug6
  Aug6: [
    {
      name: 'Aug6',
      next: ['V64', 'V'],
      dotted: ['V7'],
    },
  ],
  // upper boxesssssss ltr
  // 1
  'VIIdim/IV': [
    {
      name: 'VIIdim/IV',
      next: ['VIIdim/VII', 'V7/VII'],
    },
  ],
  'V7/IV': [
    {
      name: 'V7/IV',
      next: ['VIIdim/VII', 'V7/VII'],
    },
  ],
  // 2
  'VIIdim/VII': [
    {
      name: 'VIIdim/VII',
      next: ['VIIdim/III', 'V7/III', /*downward arrow*/ 'VII'],
    },
  ],
  'V7/VII': [
    {
      name: 'V7/VII',
      next: ['VIIdim/III', 'V7/III', /*downward arrow*/ 'VII'],
    },
  ],
  // 3
  'VIIdim/III': [
    {
      name: 'VIIdim/III',
      next: ['VIIdim/VIm', 'V7/VIm', /*downward arrow*/ 'III'],
    },
  ],
  'V7/III': [
    {
      name: 'V7/III',
      next: ['VIIdim/VIm', 'V7/VIm', /*downward arrow*/ 'III'],
    },
  ],
  // 4
  'VIIdim/VIm': [
    {
      name: 'VIIdim/VIm',
      next: ['IVm', 'IIdim', /*downward arrow */ 'VI'],
      dotted: ['IVm7', 'IIm7b5'],
    },
  ],
  'V7/VIm': [
    {
      name: 'V7/VIm',
      next: ['IVm', 'IIdim', /*downward arrow */ 'VI'],
      dotted: ['IVm7', 'IIm7b5'],
    },
  ],
  // 5
  'VIIdim/V': [
    {
      name: 'VIIdim/V',
      next: ['V64', 'VIIdim'],
      dotted: ['VIIdim7'],
    },
  ],
  'V/V': [
    {
      name: 'V/V',
      next: ['V64', 'VIIdim'],
      dotted: ['VIIdim7'],
    },
  ],

  // Diatonic sevenths ------------------------------------------------------
  // Each mirrors its triad's outgoing edges (rule 2 in the header note): the
  // seventh does not change the chord's function, so it leads where the triad
  // leads. Reached only over dotted edges from the triads above (rule 3).

  // tonic seventh — colour on the tonic, not a new function. Goes everywhere
  // Im goes, including back to the plain tonic.
  Im7: [
    {
      name: 'Im7',
      next: ['Im', 'IVm', 'VII', 'III', 'VI', 'IIdim', 'V64', 'VIIdim', 'V'],
      dotted: ['Im7', 'IVm7', 'IIm7b5', 'VIIdim7', 'V7'],
    },
  ],
  // half-diminished supertonic (B-D-F-A in A minor, NOT Bdim7). Predominant,
  // exactly as IIdim is; it carries IIdim's `prev` for the same reason.
  IIm7b5: [
    {
      name: 'IIm7b5',
      prev: ['VI'],
      next: ['VIIdim/V', 'V/V', 'V64', 'VIIdim', 'V'],
      dotted: ['VIIdim7', 'V7'],
    },
  ],
  // minor subdominant seventh — mirrors both IVm nodes' edges, merged: the
  // plain VII continuation plus the gated dominant-complex approach.
  IVm7: [
    {
      name: 'IVm7',
      next: ['VII'],
      dotted: ['VIIdim/III', 'V7/III'],
    },
    {
      name: 'IVm7',
      prev: ['VI', 'VIIdim/VIm', 'V7/VIm'],
      next: ['VIIdim/V', 'V/V', 'V64', 'VIIdim', 'V'],
      dotted: ['VIIdim7', 'V7'],
    },
  ],
  // the dominant seventh. Inherits V's resolution to Im AND its dotted Picardy
  // third: adding the seventh strengthens the pull to the tonic, it does not
  // change which tonic the dominant may resolve to.
  V7: [
    {
      name: 'V7',
      next: ['Im'],
      dotted: ['I', 'Im7'], // Picardy third; tonic seventh as arrival colour
    },
  ],
  // fully-diminished leading-tone seventh (G#dim7 in A minor — the RAISED
  // seventh degree, handled by the leading-tone rule in romanChordNameToReal).
  // This is the characteristic minor-key seventh. Mirrors VIIdim.
  VIIdim7: [
    {
      name: 'VIIdim7',
      prev: ['IVm', 'IIdim'],
      next: ['V'],
      dotted: ['V7'],
    },
  ],
}
