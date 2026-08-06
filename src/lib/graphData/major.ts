import type { ProgressionChart } from './types'

/**
 * Major-key harmonic flowchart.
 *
 * ORIGIN: the major-mode counterpart to `minor.ts`, and a worked example of
 * authoring a chart from scratch — nothing here was transcribed. It is built
 * from the standard common-practice functional cycle:
 *
 *   I -> (iii | vi) -> (IV | ii) -> (V | vii°) -> I
 *
 * i.e. tonic function flows to the weaker tonic-substitute region, then to the
 * predominant region, then to the dominant region, then resolves. Backward
 * motion within a region is free; motion that skips forward is common (I -> V,
 * I -> IV); motion that skips *backward* (V -> IV) is not modelled as a strong
 * edge. The structure of each node — a roman with `next` / `dotted` / `prev`,
 * and possibly MULTIPLE nodes per roman with different `prev` context — is the
 * same as minor.ts, and is consumed by the same translator.
 *
 * ROMAN SPELLING. The translator (`romanChordNameToReal`) realizes a roman by
 * substituting the scale degree's letter and keeping any suffix, so chord
 * quality must be written explicitly and is NOT implied by upper/lower case:
 * the minor triads on 2, 3 and 6 are `IIm` / `IIIm` / `VIm` (spelling them
 * `IIdim` as the minor chart does for its degree 2 would yield Ddim in C,
 * which is wrong — in major, ii is minor). Diatonic `VIIdim` is special-cased
 * in the translator to the leading tone, which in major is simply degree 7
 * (Bdim in C).
 *
 * THE DOMINANT COMPLEX (V64 / N6 / Aug6) follows the same classical direction
 * that minor.ts was flipped to, so the two charts agree:
 *
 *   N6 / Aug6 -> [V64, V]      predominants approach the dominant
 *   V64       -> [V]           the cadential 6/4 resolves TO the dominant
 *   V         -> [I]           with a dotted deceptive resolution to VIm
 *
 * The cadential 6/4 is not a tonic chord: it is tonic notes suspended over
 * scale degree 5 in the bass, functioning as dominant. `V64(tonic, 'major')`
 * in graphh.ts takes degrees 5, 1, 3 and so needs the scale name passed
 * through (G-C-E in C major); `Aug6(tonic)` uses absolute intervals (b6, 1,
 * #4 = Ab-C-F# in C) and is mode-independent.
 *
 * Predominants (I, IIm, IV, VIIdim/V, V/V) all list V64 among their
 * successors, exactly as in the minor chart: arriving at the cadential 6/4
 * from a predominant is the standard approach.
 *
 * DECEPTIVE CADENCE. `V ⇢ VIm` is a `dotted` edge, not a strong one: it is a
 * real and idiomatic move but it evades the resolution the dominant promises,
 * so it should be offered as a weaker alternative to `V -> I`.
 *
 * DECISION — N6 (the Neapolitan) IS INCLUDED, reachable only from the
 * predominant region (IV and IIm), never from the tonic. bII is diatonic to
 * neither mode; it is idiomatic in minor (where b2 sits a half step above the
 * tonic of an already-dark scale) and comparatively rare in major, where it
 * reads as a borrowing from the parallel minor. Omitting it entirely would
 * make it unreachable for major-key composers who want that colour, while
 * offering it from the tonic would misrepresent it as an ordinary diatonic
 * move. Restricting it to predominant-to-predominant chromatic substitution
 * (IV -> N6 -> V) is the honest middle. Aug6 is included on the same edges
 * for the same reason.
 *
 * These sit on `next` rather than `dotted` for a mechanical reason worth
 * recording: `makeProgNodeTranslator` handles chord-function names (V64 / N6 /
 * Aug6) via `isChordFn` on the `next` branch ONLY. Its `dotted` branch calls
 * `romanChordNameToReal` unconditionally, which returns '' for a function
 * name, so a dotted N6/Aug6 edge is silently dropped with a "Dropping
 * untranslatable dotted chord" warning (verified by probe). Until that
 * asymmetry in graphh.ts is fixed, a chord function can only be reached over
 * a strong edge. The weaker-than-diatonic character of N6/Aug6 is therefore
 * expressed by *which* chords reach them, not by edge weight.
 *
 * DIATONIC SEVENTHS (Imaj7, IIm7, IVmaj7, V7, VIIm7b5) are first-class nodes,
 * governed by the same three rules stated at length in minor.ts:
 *
 *   1. a seventh sits BESIDE its triad, never replacing it;
 *   2. its OUTGOING edges mirror the triad's, because the seventh does not
 *      change the chord's function — so V7 inherits V's strong resolution to I
 *      and its dotted deceptive cadence to VIm alike;
 *   3. it is REACHED over a dotted edge wherever its triad is reached, which
 *      keeps `nextChord` (strong edges only) byte-identical to before the
 *      sevenths existed.
 *
 * VIIm7b5 is the half-diminished leading-tone seventh (B-D-F-A in C). In MAJOR
 * the leading-tone seventh is half-diminished; the fully-diminished VIIdim7
 * belongs to minor. Both are built on the leading tone and both are matched by
 * the VII-diminished family rule in `romanChordNameToReal`.
 *
 * IIIm7 and VIm7 remain excluded, as they are from `sevenths.ts`: the mediant
 * and submediant sevenths carry no distinct function, and adding them would
 * make this "every triad also has a seventh" — the bloat the dotted-target
 * rule exists to prevent.
 *
 * INVERSIONS (Stage M-A, A5) follow the same three rules the sevenths do, and
 * the long form of the reasoning is in minor.ts's header. In brief: an edge may
 * be `{ chord, figure }` rather than a bare string; only TRUE chord-to-chord
 * inversions are edges (I6, V6, VIIdim6, V65/V43/V42); every inversion edge is
 * DOTTED, which is what keeps `nextChord` byte-identical; and the passing and
 * pedal 6/4s are NOT edges, because the chord is the same in all three cases
 * and only the context differs — they are spans (`spans.ts`).
 *
 * V42 -> I6 is the one inversion edge that is a genuinely different move
 * rather than a re-voicing of an existing one: the chordal seventh sits in the
 * bass and must resolve DOWN by step, so a V42 can only resolve to a
 * first-inversion tonic. B2 will recognize the same pair as the evaded cadence,
 * the phrase-extension device.
 *
 * I6 is more useful in major than in minor and is reached more widely here:
 * from the tonic (beginning a prolongation), from the predominants, and from
 * the dominant complex (a phrase-internal arrival that keeps the bass moving).
 */
export const major: ProgressionChart = {
  // Tonic. Free to move anywhere in the cycle: to the tonic-substitute region
  // (IIIm, VIm), straight to a predominant (IV, IIm), or straight to the
  // dominant complex.
  I: [
    {
      name: 'I',
      next: ['I', 'IIIm', 'VIm', 'IV', 'IIm', 'V64', 'VIIdim', 'V'],
      // seventh colour on the chords this node already reaches (rule 3),
      // then the inversions of those same chords (Stage M-A: always dotted)
      dotted: [
        'Imaj7',
        'IVmaj7',
        'IIm7',
        'VIIm7b5',
        'V7',
        // I -> I6: the harmony holds while the bass steps up to 3, which is
        // how a tonic prolongation opens
        { chord: 'I', figure: '6' },
        // vii°6 — first inversion is the normal form of the leading-tone triad
        { chord: 'VIIdim', figure: '6' },
        // the linear dominant, bass on the leading tone
        { chord: 'V', figure: '6' },
        { chord: 'V7', figure: '65' },
        { chord: 'V7', figure: '43' },
        { chord: 'V7', figure: '42' },
      ],
    },
  ],

  // Tonic-substitute region ------------------------------------------------
  // iii is the weakest diatonic triad; it characteristically descends to vi
  // or moves to the predominants. It also tonicizes readily.
  IIIm: [
    {
      name: 'IIIm',
      next: ['VIm', 'IV', 'IIm'],
      dotted: ['VIIdim/VIm', 'V7/VIm', 'IVmaj7', 'IIm7'],
    },
  ],
  VIm: [
    {
      name: 'VIm',
      next: ['IV', 'IIm'],
      dotted: ['VIIdim/IIm', 'V7/IIm', 'IVmaj7', 'IIm7'],
    },
  ],

  // Predominant region -----------------------------------------------------
  // IV may also move directly back to I (the plagal cadence), kept dotted
  // because it is a weaker, non-dominant resolution.
  IV: [
    {
      name: 'IV',
      next: ['IIm', 'V64', 'VIIdim', 'V', 'VIIdim/V', 'V/V', 'N6', 'Aug6'],
      dotted: [
        'I',
        'IIm7',
        'VIIm7b5',
        'V7',
        'Imaj7',
        // IV -> I6 is the plagal move with the bass rising by step rather than
        // falling a fourth; it is also the hinge of the descending-bass idiom
        // authored as a span in spans.ts
        { chord: 'I', figure: '6' },
        { chord: 'V', figure: '6' },
        { chord: 'VIIdim', figure: '6' },
        { chord: 'V7', figure: '65' },
      ],
    },
  ],
  // ii is the other predominant; the ii -> V motion is the strongest
  // predominant-to-dominant move in the idiom. Its `prev` records that the
  // chart reaches it from the tonic-substitute region and from IV.
  IIm: [
    {
      name: 'IIm',
      prev: ['I', 'IIIm', 'VIm', 'IV'],
      next: ['V64', 'VIIdim', 'V', 'VIIdim/V', 'V/V', 'N6', 'Aug6'],
      dotted: [
        'VIIm7b5',
        'V7',
        // the inverted dominants this predominant may move to
        { chord: 'V', figure: '6' },
        { chord: 'VIIdim', figure: '6' },
        { chord: 'V7', figure: '65' },
        { chord: 'V7', figure: '43' },
      ],
    },
  ],

  // Dominant complex -------------------------------------------------------
  // cadential 6/4 — dominant function, resolves to V (see header note)
  V64: [
    {
      name: 'V64',
      next: ['V'],
      dotted: ['V7'],
    },
  ],
  // leading-tone triad: dominant function without the root, resolves to I.
  // Reached from the predominants; also passes through V.
  VIIdim: [
    {
      name: 'VIIdim',
      prev: ['I', 'IV', 'IIm'],
      next: ['I', 'V'],
      dotted: [
        'Imaj7',
        'V7',
        // vii°6 -> I6, the classic linear pair: both inverted, the bass moving
        // by step against the soprano in parallel tenths
        { chord: 'I', figure: '6' },
        { chord: 'V', figure: '6' },
      ],
    },
  ],
  V: [
    {
      name: 'V',
      next: ['I'],
      // deceptive cadence, plus the dominant's own seventh: V -> V7 is the
      // ordinary move of adding the seventh before resolving
      dotted: [
        'VIm',
        'V7',
        'Imaj7',
        // resolving onto an inverted tonic keeps the bass moving rather than
        // landing: a phrase-internal arrival, not a full close
        { chord: 'I', figure: '6' },
        // the dominant's own inversions, before resolving
        { chord: 'V7', figure: '65' },
        { chord: 'V7', figure: '43' },
        { chord: 'V7', figure: '42' },
      ],
    },
  ],

  // Chromatic predominants -------------------------------------------------
  // both approach the dominant, optionally via the decorated arrival (V64)
  N6: [
    {
      name: 'N6',
      next: ['V64', 'V'],
      dotted: ['V7'],
    },
  ],
  Aug6: [
    {
      name: 'Aug6',
      next: ['V64', 'V'],
      dotted: ['V7'],
    },
  ],

  // Secondary dominants and leading-tone chords ----------------------------
  // For each tonicizable diatonic target x, both V7/x and VIIdim/x resolve to
  // x, and each pair leads onward to the chords x itself leads to. Targets:
  // ii, iii, IV, V, vi (I is the tonic; vii° is diminished and not tonicized).
  'V7/IIm': [
    {
      name: 'V7/IIm',
      next: ['IIm'],
      dotted: ['IIm7'],
    },
  ],
  'VIIdim/IIm': [
    {
      name: 'VIIdim/IIm',
      next: ['IIm'],
      dotted: ['IIm7'],
    },
  ],
  'V7/IIIm': [
    {
      name: 'V7/IIIm',
      next: ['IIIm'],
    },
  ],
  'VIIdim/IIIm': [
    {
      name: 'VIIdim/IIIm',
      next: ['IIIm'],
    },
  ],
  'V7/IV': [
    {
      name: 'V7/IV',
      next: ['IV'],
      dotted: ['IVmaj7'],
    },
  ],
  'VIIdim/IV': [
    {
      name: 'VIIdim/IV',
      next: ['IV'],
      dotted: ['IVmaj7'],
    },
  ],
  // V/V and VIIdim/V are themselves predominants: they lead into the dominant
  // complex exactly as the minor chart's "small upper fork" does.
  'V/V': [
    {
      name: 'V/V',
      next: ['V64', 'VIIdim', 'V'],
      dotted: ['VIIm7b5', 'V7'],
    },
  ],
  'VIIdim/V': [
    {
      name: 'VIIdim/V',
      next: ['V64', 'VIIdim', 'V'],
      dotted: ['VIIm7b5', 'V7'],
    },
  ],
  'V7/VIm': [
    {
      name: 'V7/VIm',
      next: ['VIm'],
    },
  ],
  'VIIdim/VIm': [
    {
      name: 'VIIdim/VIm',
      next: ['VIm'],
    },
  ],

  // Diatonic sevenths ------------------------------------------------------
  // Each mirrors its triad's outgoing edges (rule 2 in the header note), and
  // is reached only over dotted edges from the triads above (rule 3).

  // tonic seventh — colour on the tonic, not a point of arrival in its own
  // right. Goes everywhere I goes, including back to the plain tonic.
  Imaj7: [
    {
      name: 'Imaj7',
      next: ['I', 'IIIm', 'VIm', 'IV', 'IIm', 'V64', 'VIIdim', 'V'],
      dotted: ['Imaj7', 'IVmaj7', 'IIm7', 'VIIm7b5', 'V7'],
    },
  ],
  // supertonic seventh — the standard predominant, the ii7 of ii7-V7-I. Same
  // function and same `prev` context as IIm.
  IIm7: [
    {
      name: 'IIm7',
      prev: ['I', 'IIIm', 'VIm', 'IV'],
      next: ['V64', 'VIIdim', 'V', 'VIIdim/V', 'V/V', 'N6', 'Aug6'],
      dotted: ['VIIm7b5', 'V7'],
    },
  ],
  // subdominant seventh — mirrors IV, plagal cadence included.
  IVmaj7: [
    {
      name: 'IVmaj7',
      next: ['IIm', 'V64', 'VIIdim', 'V', 'VIIdim/V', 'V/V', 'N6', 'Aug6'],
      dotted: ['I', 'IIm7', 'VIIm7b5', 'V7', 'Imaj7'],
    },
  ],
  // the dominant seventh. Inherits V's strong resolution to I AND its dotted
  // deceptive cadence to VIm: the seventh sharpens the pull to the tonic, it
  // does not change which chords the dominant may resolve to.
  V7: [
    {
      name: 'V7',
      next: ['I'],
      dotted: [
        'VIm',
        'Imaj7', // deceptive cadence; tonic seventh as colour
        // V7's own inversions: re-voicing the dominant before it resolves
        { chord: 'V7', figure: '65' },
        { chord: 'V7', figure: '43' },
        { chord: 'V7', figure: '42' },
        // the inverted resolution — obligatory after V42 (see header)
        { chord: 'I', figure: '6' },
      ],
    },
  ],
  // half-diminished leading-tone seventh (B-D-F-A in C). Dominant function,
  // mirrors VIIdim: resolves to the tonic or passes through V.
  VIIm7b5: [
    {
      name: 'VIIm7b5',
      prev: ['I', 'IV', 'IIm'],
      next: ['I', 'V'],
      dotted: ['Imaj7', 'V7'],
    },
  ],
}
