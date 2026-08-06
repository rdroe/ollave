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
 */
export const major: ProgressionChart = {
  // Tonic. Free to move anywhere in the cycle: to the tonic-substitute region
  // (IIIm, VIm), straight to a predominant (IV, IIm), or straight to the
  // dominant complex.
  I: [
    {
      name: 'I',
      next: ['I', 'IIIm', 'VIm', 'IV', 'IIm', 'V64', 'VIIdim', 'V'],
    },
  ],

  // Tonic-substitute region ------------------------------------------------
  // iii is the weakest diatonic triad; it characteristically descends to vi
  // or moves to the predominants. It also tonicizes readily.
  IIIm: [
    {
      name: 'IIIm',
      next: ['VIm', 'IV', 'IIm'],
      dotted: ['VIIdim/VIm', 'V7/VIm'],
    },
  ],
  VIm: [
    {
      name: 'VIm',
      next: ['IV', 'IIm'],
      dotted: ['VIIdim/IIm', 'V7/IIm'],
    },
  ],

  // Predominant region -----------------------------------------------------
  // IV may also move directly back to I (the plagal cadence), kept dotted
  // because it is a weaker, non-dominant resolution.
  IV: [
    {
      name: 'IV',
      next: ['IIm', 'V64', 'VIIdim', 'V', 'VIIdim/V', 'V/V', 'N6', 'Aug6'],
      dotted: ['I'],
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
    },
  ],

  // Dominant complex -------------------------------------------------------
  // cadential 6/4 — dominant function, resolves to V (see header note)
  V64: [
    {
      name: 'V64',
      next: ['V'],
    },
  ],
  // leading-tone triad: dominant function without the root, resolves to I.
  // Reached from the predominants; also passes through V.
  VIIdim: [
    {
      name: 'VIIdim',
      prev: ['I', 'IV', 'IIm'],
      next: ['I', 'V'],
    },
  ],
  V: [
    {
      name: 'V',
      next: ['I'],
      dotted: ['VIm'], // deceptive cadence
    },
  ],

  // Chromatic predominants -------------------------------------------------
  // both approach the dominant, optionally via the decorated arrival (V64)
  N6: [
    {
      name: 'N6',
      next: ['V64', 'V'],
    },
  ],
  Aug6: [
    {
      name: 'Aug6',
      next: ['V64', 'V'],
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
    },
  ],
  'VIIdim/IIm': [
    {
      name: 'VIIdim/IIm',
      next: ['IIm'],
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
    },
  ],
  'VIIdim/IV': [
    {
      name: 'VIIdim/IV',
      next: ['IV'],
    },
  ],
  // V/V and VIIdim/V are themselves predominants: they lead into the dominant
  // complex exactly as the minor chart's "small upper fork" does.
  'V/V': [
    {
      name: 'V/V',
      next: ['V64', 'VIIdim', 'V'],
    },
  ],
  'VIIdim/V': [
    {
      name: 'VIIdim/V',
      next: ['V64', 'VIIdim', 'V'],
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
}
