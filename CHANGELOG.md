# Changelog

All notable changes to this project are documented here.

## Unreleased

### Added — curated scale lists (`conventionalKeys`, `distinctScales`)

**If you build a scale or key picker from `allScales`, switch it to
`conventionalKeys`.**

`allScales` is built by crossing an internal note-name list against all seven
modes, and that note-name list contains double accidentals. The result is 189
entries of which 84 are enharmonic duplicates. Filtered to major and minor —
what a key dropdown does — it yields 54 entries, and **20 of those are
unplayable spellings**: `Dbb major`, `Ebb major`, `Gbb major`, `Abb major`,
`Bbb major`, `C## major`, `D## major`, `F## major`, `G## major`, `A## major`,
and the same ten in minor. `Dbb major` is C major written so no one would ever
notate it. Users have been seeing all twenty in scale pickers.

Two new exports fix this:

- **`conventionalKeys`** — the 30 real keys (15 major, 15 minor) as resolved
  `Scale` objects, ordered around the circle of fifths from seven flats to
  seven sharps. This is the list to put in front of a user.
- **`distinctScales`** — `allScales` with enharmonic duplicates collapsed, 84
  entries, one spelling per (mode, sounding pitch set). Use this when you need
  all seven modes rather than just major and minor.

Also exported: `isConventionalKeyName`, `dedupeEnharmonicScales`,
`conventionalMajorTonics`, `conventionalMinorTonics`.

*What "conventional spelling" means here.* The 15 conventional major keys are
C, G, D, A, E, B, F♯, C♯, F, B♭, E♭, A♭, D♭, G♭, C♭, and the 15 minor are A,
E, B, F♯, C♯, G♯, D♯, A♯, D, G, C, F, B♭, E♭, A♭. That is stated as data, not
computed, because the tempting rule — "keep whichever spelling has fewer
accidentals" — is wrong: it discards C♯ major (7 sharps) for D♭ major (5
flats), A♯ minor for B♭ minor, and A♭ minor for G♯ minor, all of which are
real notated keys. When `dedupeEnharmonicScales` collapses a group it prefers a
conventional spelling first, then fewest accidentals, then the flat spelling.
That last tie-break only decides genuine equal-weight pairs (G♭/F♯ major, E♭/D♯
minor and their modal equivalents), where both spellings are conventional and
the choice is convention rather than correctness; flats match the spelling the
rest of the library produces.

Note that `conventionalKeys` includes **C♭ major**, which `allScales` cannot
represent at all — its note-name list has no `Cb`.

### Unchanged

**`allScales` is untouched** — still 189 entries, still including every
double-accidental spelling. Nothing is removed, so stored scale names keep
resolving and `isScaleName` / `properScaleName` behave exactly as before. There
is no migration beyond pointing user-facing lists at `conventionalKeys`.

`detectAllScales` is also unchanged, and still scans the full `allScales` with
its narrow chroma fallback. The fallback **cannot** be retired now that a
deduped list exists: deduplication keeps one spelling per sounding scale, so
`C♯ major` is not in `distinctScales`, and detecting the correctly spelled
triad C♯–E♯–G♯ against it would return `B lydian` alone — the chord's actual
key having been collapsed away. Detection needs every spelling present; a
picker needs exactly one. They need different lists, which is why this release
adds a list instead of changing the existing one.

## 0.4.0

Composer-grade chord assistance. This release adds a real major-key
progression graph, a voice-leading engine, modal mixture, pivot modulation and
seeded random walks, and makes all of them reachable from `ollave/lib`.

### Breaking

**Major keys now build a real major chart.** `chordGraphCreate` previously
dispatched every key to the *minor* chart, so asking for C major produced the
borrowed-minor graph — its nodes were `Cm`, `Fm`, `B`, `Ddim`, `Edim` and so
on, with `Cm` standing in as the tonic of C major. Major keys now build a
chart with the chords a major key actually contains (`C`, `Dm`, `Em`, `F`,
`G`, `Am`, `Bdim`, plus the cadential 6/4, secondary dominants and
leading-tone chords).

*Who is affected:* songs in a **major** key that were written against the old
graph. Their stored chord names came from the borrowed-minor chart and are no
longer nodes in the major graph.

*What happens:* those chords **keep playing** — placement falls back to the
plain-chord path, which resolves any valid chord symbol. What they lose is the
graph-derived extras: roman-numeral tags on the placed note groups, and graph
voicing. Calling `nextChord` / `nextChordDetail` with one of those names in a
major key now throws `could not obtain <chord> in graph for <key>`, where it
previously returned the borrowed-minor continuations.

*Minor-key songs are unaffected* — the minor chart is unchanged apart from the
fixes listed below.

*Migration:* re-enter affected chords using their major-key spellings (`Cm` ->
`C`, `Fm` -> `F`, `B` -> `Bdim`), or leave them as-is if you only need
playback. Mode is dispatched on `Scale.get(...).type`, so aliases such as
`'C ionian'` and `'A aeolian'` resolve correctly; modes other than major and
minor now raise a clear error instead of silently building a minor chart.

**`ChordSuggestion['strength']` widened** from `'strong' | 'dotted'` to
`'strong' | 'dotted' | 'mixture'`. Additive for producers, but an exhaustive
`switch` or a narrowing conditional over the old two-member union will no
longer type-check as exhaustive.

### Added

- **`nextChordDetail(chordCsvArg, tonic, scale, opts?)`** — continuations from
  a chord as `ChordSuggestion[]`, each carrying its `roman`, `notes`,
  `strength` and `enabledBy` arrival condition. `opts.prev` (recent chords,
  most recent last) annotates each suggestion with `contextMatch` and sorts
  matches first; it never removes a suggestion, because arrival context is
  recorded on only a few chart nodes and strict filtering would return nothing
  for legitimate queries.

  Convenience options compose the functions below without hand-wiring:

  ```ts
  nextChordDetail('Am,3', 'A', 'minor', {
    prev: ['E'],
    include: ['mixture'],          // append mixtureSuggestions output
    rankBy: 'voiceLeading',        // sort via rankByVoiceLeading
    fromVoicing: ['A3', 'C4', 'E4'],
  })
  ```

  `rankBy: 'voiceLeading'` throws without a non-empty `fromVoicing`. The
  return type stays `ChordSuggestion[]` in every configuration — call
  `rankByVoiceLeading` directly if you want `distance` and `suggestedVoicing`
  typed on the result.

- **Voice leading** (`ollave/lib`, or `ollave/lib/voiceLeading`):
  `ascendingInversions`, `voicingDistance`, `voiceLeadingDistance`,
  `nearestVoicing`, `rankByVoiceLeading`. Unlike `noteInversions`, which
  returns raw pitch-class rotations, `ascendingInversions` returns true
  voicings that ascend in pitch.

- **Smooth voicing on placement** — opt in per chord with a `voicing=smooth`
  tag. Default placement is byte-identical to 0.3.x.

- **Modal mixture** — `mixtureSuggestions(tonic, scale)` returns borrowed
  chords (into major: `iv`, `ii°`, `bIII`, `bVI`, `bVII`; into minor: the
  dorian `IV`), spelled by interval transposition so flat keys stay flat.

- **Pivot modulation** — `pivotSuggestions(chordName, tonic, scale)` returns
  every major/minor key containing the chord, with its roman there and its
  continuations, ordered by key-signature distance from the current key.
  `romanInKey` is exported alongside.

- **Random progressions** — `randomProgression` / `randomProgressionDetail`
  walk the graph with weighted edge selection (strong over dotted, context
  matches boosted). Seeded via a local PRNG, so a seed reproduces a walk
  exactly; `createRng` is exported.

- **Public API surface.** All of the above are now exported from the `ollave/lib`
  entry point as both named and namespace exports, with their types
  (`ChordSuggestion`, `NextChordDetailOptions`, `Voicing`, `NearestVoicing`,
  `RankedSuggestion`, `AscendingInversionsOptions`, `PivotSuggestion`,
  `ProgressionStep`, `ProgressionResult`, `ProgressionStopReason`,
  `RandomProgressionOptions`, …). Deep imports (`ollave/lib/voiceLeading`)
  continue to work.

  Two named exports are aliased to avoid colliding with the namespace export
  of the same name: `nextChordNames` (the original `nextChord` function) and
  `randomProgressionNames` (the original `randomProgression`). The namespaces
  `nextChord` and `randomProgression` expose the unaliased members.

### Fixed

- **Dotted edges to chord functions were silently dropped.** The graph
  translator recognized `V64` / `N6` / `Aug6` on solid edges only; on dashed
  edges it tried to realize them as roman numerals, which yields `''` for
  `N6`/`Aug6` and the garbage name `'E64'` for `V64`, so the edge vanished
  with a "Dropping untranslatable dotted chord" warning. Both branches now
  share one translator.

- **Neapolitan chords respelled into the wrong key signature in flat keys.**
  The root came from flattening the scale's second degree and simplifying, so
  E-flat major's N6 came out `E-G#-B` instead of `Fb-Ab-Cb`. It is now derived
  by transposing a minor second from the tonic, which is spelling-exact and
  produces double flats where they belong (D-flat major: `Ebb-Gb-Bbb`). Keys
  whose lowered second was already a single accidental are unchanged.

- **`detectAllScales` found no key at all for enharmonically mis-spelled
  input.** `detectAllScales(['C#','F','G#'])` — an audible C-sharp major triad
  with its third written `F` instead of `E#` — returned an empty array. Name
  matching is still the primary rule, so correctly spelled input returns
  byte-identical results and a C-E-G triad still reports exactly six keys; an
  enharmonic fallback now runs only when name matching finds nothing.

- Cadential 6/4, augmented sixth and leading-tone chords were corrected in
  0.3.x groundwork and are carried forward: `V64` is the tonic triad over the
  dominant bass, `Aug6` is b6-1-#4 from the tonic, and `VIIdim` sits on the
  leading tone (`G#dim` in A minor) rather than the subtonic.

### Deprecated

- `optionalRomans` — dead configuration; its one entry, `'IImdim'`, is not a
  node in any chart. Still exported; expect removal in a future major version.
- `MixtureStrength` and `MixtureSuggestion` — now exact aliases of
  `ChordSuggestion['strength']` and `ChordSuggestion` respectively, since the
  base union carries `'mixture'`. Kept as documentation and for external
  importers.
