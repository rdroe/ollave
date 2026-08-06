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
 *
 * INVERSIONS (Stage M-A, A5). An edge may be `{ chord, figure }` instead of a
 * bare string; the bare string still means root position and is still the
 * normal form. Only TRUE CHORD-TO-CHORD inversions are edges here — the ones
 * whose identity is a property of the move itself:
 *
 *   Im6      the tonic over its third; the bass as a melodic line rather than
 *            a pillar. Its function is unchanged, so it goes where Im goes.
 *   V6       the dominant over the LEADING TONE, which rises a semitone to the
 *            tonic. A weaker, more linear dominant than root-position V.
 *   VIIdim6  first inversion is the NORMAL form of the leading-tone triad —
 *            root position leaves the diminished fifth exposed above the bass.
 *   V65/V43/V42  the dominant-seventh inversions.
 *
 * V42 -> Im6 is the one edge here that is not just "the same move, inverted".
 * The chordal seventh is in the bass and MUST resolve down by step, so a V42
 * resolves to a FIRST-INVERSION tonic and cannot resolve to a root-position
 * one. That obligation is why it gets its own edge rather than riding along
 * with V7's; B2 will recognize the same pair as the evaded cadence.
 *
 * PASSING AND PEDAL 6/4s ARE DELIBERATELY NOT EDGES. A 6/4 between I and I6
 * with stepwise bass is a passing 6/4; the same two chords with a static bass
 * is a pedal 6/4; the same sonority on a strong beat resolving to V is the
 * cadential 6/4 (which this chart carries as the `V64` function node). The
 * chord is identical in all three — only the CONTEXT differs — so a
 * first-order edge cannot tell them apart. They are authored as spans instead;
 * see `spans.ts`.
 *
 * EVERY INVERSION EDGE IS DOTTED. This is the same blast-radius rule the
 * sevenths shipped under: `nextChord` returns strong edges only, so putting
 * inversions on the dotted layer keeps its output byte-for-byte identical to
 * before they existed — verified by probe across every node in A minor and
 * C major. An inversion is a refinement of a motion the chart already offers,
 * not a new motion, so this is also the musically honest grading: the strong
 * edge says "go to the dominant", the dotted figured edge says "and you may
 * put its third in the bass".
 */
export const minor: ProgressionChart = {
  Im: [
    {
      name: 'Im',
      next: ['Im', 'IVm', 'VII', 'III', 'VI', 'IIdim', 'V64', 'VIIdim', 'V'],
      // seventh colour on the chords this node already reaches (rule 3),
      // then the inversions of those same chords (Stage M-A rule: dotted)
      dotted: [
        'Im7',
        'IVm7',
        'IIm7b5',
        'VIIdim7',
        'V7',
        // the tonic over its third — the bass leaves the root without the
        // harmony changing, which is how a tonic prolongation begins
        { chord: 'Im', figure: '6' },
        // first inversion is the normal form of the leading-tone triad
        { chord: 'VIIdim', figure: '6' },
        // the linear dominant: bass on the leading tone
        { chord: 'V', figure: '6' },
        { chord: 'V7', figure: '65' },
        { chord: 'V7', figure: '43' },
        { chord: 'V7', figure: '42' },
      ],
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
      dotted: [
        'VIIdim7',
        'V7',
        // the predominant's inverted continuations into the dominant complex,
        // plus IVm -> Im6, the plagal move with a rising stepwise bass
        { chord: 'V', figure: '6' },
        { chord: 'VIIdim', figure: '6' },
        { chord: 'V7', figure: '65' },
        { chord: 'Im', figure: '6' },
      ],
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
      dotted: [
        'VIIdim7',
        'V7',
        // ii°6 is the normal form of the minor-key supertonic (root position
        // exposes the diminished fifth above the bass), so the inverted
        // continuations into the dominant complex matter here
        { chord: 'V', figure: '6' },
        { chord: 'VIIdim', figure: '6' },
        { chord: 'V7', figure: '65' },
        { chord: 'V7', figure: '43' },
      ],
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
      dotted: [
        'V7',
        // vii°6 -> I6 is the classic linear pair: both chords inverted, the
        // bass moving by step in parallel tenths with the soprano
        { chord: 'Im', figure: '6' },
        { chord: 'V', figure: '6' },
      ],
    },
  ],
  // big confusing box V
  V: [
    {
      name: 'V',
      next: ['Im'],
      // the Picardy third, plus the dominant's own seventh: V -> V7 is the
      // ordinary move of adding the seventh before resolving
      dotted: [
        'I',
        'V7',
        'Im7',
        // resolving onto an inverted tonic keeps the bass moving rather than
        // landing; a phrase-internal cadence rather than a full close
        { chord: 'Im', figure: '6' },
        // the dominant may also take its own inversions before resolving
        { chord: 'V7', figure: '65' },
        { chord: 'V7', figure: '43' },
        { chord: 'V7', figure: '42' },
      ],
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
      dotted: [
        'I',
        'Im7', // Picardy third; tonic seventh as arrival colour
        // V7's own inversions: the dominant may be re-voiced before resolving
        { chord: 'V7', figure: '65' },
        { chord: 'V7', figure: '43' },
        { chord: 'V7', figure: '42' },
        // the inverted resolution — see the V42 note in the header
        { chord: 'Im', figure: '6' },
      ],
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
