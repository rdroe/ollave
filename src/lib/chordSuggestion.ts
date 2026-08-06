// The shared suggestion contract.
//
// This module deliberately has NO imports, for the same reason
// `graphData/types.ts` has none: it sits at the bottom of the dependency graph
// so that every module speaking this contract can import the type without
// importing each other.
//
// It was extracted from `nextChord.ts` when `nextChordDetail` gained the
// convenience options that compose `mixtureSuggestions` and
// `rankByVoiceLeading`. Those options require `nextChord.ts` to import
// `mixture.ts` and `voiceLeading.ts` AT RUNTIME, and `voiceLeading.ts` is
// already reachable from `nextChord.ts` the other way round:
//
//     nextChord -> util/barsUtil -> voiceLeading
//
// (barsUtil imports `nearestVoicing` for opt-in smooth voicing). While
// voiceLeading's reference to `ChordSuggestion` was a type-only import it
// erased at compile time and no runtime cycle existed. A runtime
// `nextChord -> voiceLeading` edge would have closed the loop for real — the
// same module-init hazard that produced a production blank page in e302ee7.
//
// Homing the type here breaks it structurally rather than by convention:
// voiceLeading and mixture now import from this leaf module and never name
// `nextChord` at all, so the only runtime edge between them points one way.
// `nextChord.ts` re-exports the type, so this move is invisible to consumers.

/**
 * One candidate continuation from a chord.
 *
 * This is the contract downstream features compose over: voice-leading
 * ranking, mode mixture, pivot modulation and random walks all consume and
 * return `ChordSuggestion[]` as pure functions.
 */
export type ChordSuggestion = {
  /**
   * Realized chord name, e.g. 'G#dim', or a chord-function name like 'V64'.
   *
   * ALWAYS THE PLAIN CHORD SYMBOL, even for an inverted suggestion: a first
   * inversion of C is `name: 'C'` with `figure: '6'`, never 'C/E'. The name is
   * the graph's key and is looked up by name throughout (graph indexing,
   * `nearestVoicing`, the sevenths dedupe, `randomProgression`'s self-loop
   * check), so encoding the bass in it would break all of them — and
   * `Chord.get('C/E')` returns no notes anyway.
   */
  name: string
  /**
   * The edge's roman, e.g. 'VIIdim' or 'V7/III' — not always the target node's
   * own roman. For an inverted suggestion this is the FIGURED roman, 'I6' or
   * 'V65', because `roman` has always meant "how this edge is spelled".
   */
  roman: string
  notes: string[]
  /**
   * Figured-bass symbol when this suggestion specifies an inversion (Stage
   * M-A). ABSENT — not '53' — on ordinary root-position suggestions, so every
   * suggestion produced before Stage M-A is byte-identical.
   * The union is spelled out rather than imported as `Figure` from
   * `graphData/types` because THIS MODULE IS DELIBERATELY ZERO-IMPORT (see the
   * header) — that property is what breaks the nextChord/voiceLeading cycle,
   * and a type-only import would erase at compile time but invites a later
   * value import onto the same line. `figuredBass.test.ts` pins the two unions
   * identical, so they cannot drift.
   * @see figuredBass.ts for what each figure means
   */
  figure?: '53' | '6' | '64' | '7' | '65' | '43' | '42'
  /**
   * Realized bass PITCH CLASS ('E'), no octave. Present exactly when `figure`
   * is. Which octave the bass lands in is a placement decision owned by
   * `parseChordCsvArg` / `nearestVoicing`, not by the graph.
   */
  bass?: string
  /**
   * Where the suggestion came from. Solid arrows in the source chart are
   * 'strong' and dashed arrows 'dotted'; 'mixture' marks a borrowed chord
   * contributed by `mixtureSuggestions`, which is not a graph edge at all but
   * a property of the key.
   */
  strength: 'strong' | 'dotted' | 'mixture'
  /** realized chords that may precede this edge's source; null = unconditional */
  enabledBy: string[] | null
  /** only present when opts.prev was given */
  contextMatch?: boolean
}
