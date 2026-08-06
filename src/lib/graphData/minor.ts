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
 * CADENCE EDGES (Stage M-C, C2). Three cadences the cadence library has always
 * been able to DETECT were not ROUTABLE, because the moves they are made of had
 * no edge here: `IVm -> Im` (plagal), `V -> VI` (deceptive) and `IVm6 -> V`
 * (Phrygian half — `IVm6` appeared nowhere in this file at all). B2's
 * `detectCadences` deliberately matches romans rather than chart edges for
 * exactly this reason, and recorded the gap; `pathToCadence` cannot do that,
 * because it walks the graph, so it returned `unreachable-cadence`.
 *
 * All five new edges (the three above plus their seventh-chord mirrors
 * `V7 -> VI` and `IVm7 -> Im`) are DOTTED. That is the blast-radius rule, and
 * here it is also the musically honest grading: a predominant's principal
 * motion is to the dominant and a dominant's is to the tonic. The plagal close
 * is a codetta after that, and the deceptive close is a deliberate refusal of
 * it — both are dashed arrows in any flowchart that draws the principal motion
 * solid. `nextChord` output is byte-identical, verified by probe across every
 * node in A minor and C major.
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
        // iv6 — the predominant with b6 in the bass. `Im -> IVm` is already a
        // strong edge; this is its inverted refinement, exactly as V6 below is
        // the inverted refinement of `Im -> V`. It is also what makes a
        // three-bar Phrygian half cadence (i - iv6 - V) reachable at all: with
        // only IVm -> IVm6 the shortest route was four bars, which is a longer
        // phrase than the cadence needs.
        { chord: 'IVm', figure: '6' },
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
        // THE MINOR PLAGAL CADENCE (Stage M-C, C2). iv -> i is ordinary music
        // and `detectCadences` has always labelled it, but the chart had no
        // edge for it, so `pathToCadence(_, 'plagal', _, _, 'minor')` returned
        // `unreachable-cadence` — detectable but not routable. Dotted, per the
        // blast-radius rule and because it is musically honest: the plagal
        // cadence is a codetta after an authentic close, not the principal
        // motion out of a predominant, which is still to the dominant.
        'Im',
        // THE PHRYGIAN HALF CADENCE (C2). iv6 -> V, the bass falling a
        // semitone b6 -> 5. That semitone IS the cadence's identity, which is
        // why the figure is load-bearing here and why `IVm6` had to exist as
        // an edge at all — it appeared nowhere in this chart before. Dotted:
        // IVm -> V already exists as a strong edge, and this is the inverted
        // refinement of it, exactly as every other figured edge here is.
        { chord: 'IVm', figure: '6' },
        // the augmented-sixth trio (B4). Predominant-to-predominant chromatic
        // substitution: iv is the diatonic chord whose bass note b6 the
        // augmented sixth chromaticizes, so iv -> Aug6 is the smoothest
        // approach in the idiom (the bass simply holds). DOTTED, per the
        // blast-radius rule — the generic Aug6 was unreachable from any node
        // before this, so every one of these edges is new and none may
        // strengthen an existing suggestion list.
        'It6',
        'Fr6',
        'Ger6',
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
        // the augmented-sixth trio (B4) — the other predominant reaches them
        // too, on the same reasoning as IVm's edges. Dotted, always.
        'It6',
        'Fr6',
        'Ger6',
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
        // THE MINOR DECEPTIVE CADENCE (Stage M-C, C2). V -> VI: the dominant
        // resolves to the major submediant instead of the tonic, which shares
        // two of its three notes and so stands in for it just long enough to
        // disappoint. Absent from this chart until now, so the cadence was
        // detectable but not routable. Dotted — the dominant's principal
        // resolution is and remains to the tonic; the deception is the
        // deliberate departure from it, which is a dashed arrow by definition.
        'VI',
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
  // non-box with sixes Aug6 — the generic augmented sixth, kept as a working
  // documented alias for the German (see graphh.ts). The Italian/French/German
  // trio below are its three real members and carry identical edges: they are
  // one predominant function with three colours, not three functions.
  Aug6: [
    {
      name: 'Aug6',
      next: ['V64', 'V'],
      dotted: ['V7'],
    },
  ],
  // The augmented-sixth trio (Stage M-B, B4) --------------------------------
  // All three are predominants approaching the dominant, so all three carry the
  // same edges the generic Aug6 always had. They differ in PITCH CONTENT, not
  // in function, which is why splitting them adds nodes but no new topology.
  //
  // One edge is graded differently between them, and it is the one place the
  // distinction is audible in the chart rather than only in the notes: the
  // GERMAN has a perfect fifth above its bass, so German -> root-position V
  // moves in parallel fifths. The idiomatic resolution passes through the
  // cadential 6/4, so Ger6 -> V64 is strong and Ger6 -> V is DOTTED. The
  // Italian and French have no fifth and go directly to V without trouble, so
  // both of their edges stay strong, exactly as the generic Aug6's are.
  //
  // Aug6 itself is left untouched (both edges strong) — it is a live alias that
  // appears in saved songs, and re-grading its edges would change `nextChord`
  // output for an existing node.
  It6: [
    {
      name: 'It6',
      next: ['V64', 'V'],
      dotted: ['V7'],
    },
  ],
  Fr6: [
    {
      name: 'Fr6',
      next: ['V64', 'V'],
      dotted: ['V7'],
    },
  ],
  Ger6: [
    {
      name: 'Ger6',
      // the cadential 6/4 first: resolving a German sixth straight onto a
      // root-position V gives parallel fifths (see the header note)
      next: ['V64'],
      dotted: ['V', 'V7'],
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
      // the plagal resolution, mirroring IVm's (rule 2). `IVm7` is one of the
      // romans the plagal cadence definition accepts as an approach.
      dotted: ['VIIdim7', 'V7', 'Im'],
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
        // the deceptive resolution, mirroring V's (rule 2: a seventh does not
        // change a chord's function, so V7 goes where V goes). V7 -> VI is in
        // fact the commoner form of the minor deceptive cadence, because the
        // seventh makes the promise of resolution explicit before breaking it.
        'VI',
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
