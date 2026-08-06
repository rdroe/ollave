import type { ProgressionChart } from './types'

/**
 * Minor-key harmonic flowchart.
 *
 * PROVENANCE: this is a transcription of a minor-key harmonic flowchart
 * (a boxes-and-arrows figure). The comments below name regions of the source
 * figure — "double-box top", "big confusing box", "non-box with sixes",
 * "upper boxesssssss ltr", "small upper fork", "downward arrow" — and are
 * kept verbatim so the data can still be diffed against the original picture.
 * Solid arrows in the figure become `next`; dashed arrows become `dotted`.
 * Where a box is reachable only from certain predecessors, that arrival
 * context is recorded as `prev` and becomes each edge's `enabler`.
 *
 * DEVIATION FROM THE TRANSCRIPTION — the dominant complex (V64 / N6 / Aug6).
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
 *     object from the cadential 6/4 this chart draws.
 *   - N6 and Aug6 are predominants. Both approach the dominant, so each now
 *     leads to `V64` (the decorated arrival) as well as directly to `V`.
 *   - V therefore no longer lists V64/Aug6 as successors. It resolves to Im,
 *     with the dotted I retained as the Picardy third.
 *
 * Edges *into* the dominant complex from predominants (Im, IVm, IIdim,
 * VIIdim/V, V/V all list V64) are unchanged and correct: arriving at the
 * cadential 6/4 from a predominant is exactly the standard approach.
 */
export const minor: ProgressionChart = {
  Im: [
    {
      name: 'Im',
      next: ['Im', 'IVm', 'VII', 'III', 'VI', 'IIdim', 'V64', 'VIIdim', 'V'],
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
    },
  ],
  // big confusing box v64 — cadential 6/4, resolves to V (see header note)
  V64: [
    {
      name: 'V64',
      next: ['V'],
    },
  ],
  // big confusing box viio (must play V before leaving ???)
  VIIdim: [
    {
      name: 'VIIdim',
      prev: ['IVm', 'IIdim'],
      next: ['V'],
    },
  ],
  // big confusing box V
  V: [
    {
      name: 'V',
      next: ['Im'],
      dotted: ['I'], // Picardy third
    },
  ],
  // non-box with sixes N6
  N6: [
    {
      name: 'N6',
      next: ['V64', 'V'],
    },
  ],
  // non-box with sixes Aug6
  Aug6: [
    {
      name: 'Aug6',
      next: ['V64', 'V'],
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
    },
  ],
  'V7/VIm': [
    {
      name: 'V7/VIm',
      next: ['IVm', 'IIdim', /*downward arrow */ 'VI'],
    },
  ],
  // 5
  'VIIdim/V': [
    {
      name: 'VIIdim/V',
      next: ['V64', 'VIIdim'],
    },
  ],
  'V/V': [
    {
      name: 'V/V',
      next: ['V64', 'VIIdim'],
    },
  ],
}
