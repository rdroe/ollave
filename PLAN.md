# Plan: Composer-grade chord assistance

Status legend: `[x]` done · `[ ]` pending · `[?]` awaiting decision

**Status as of 2026-08-06: Stages A, B and C are COMPLETE and merged to
`chord-assist-improvements` (14 commits, not on master). 199 tests passing,
`npx tsc --noEmit` 0 errors, `yarn ts-build` + `node build.js` clean,
version 0.4.0. Only Phase 5 (app surface) remains.**

Execution shape used: **Stage A serial** (one agent — all surgery on shared
files), **Stage B parallel fan-out** (5 worktree-isolated Opus subagents with
disjoint file ownership), **Stage C serial integration**. Every stream began
with an empirical probe (scratch vitest printing real data) and landed green
before merge. Actual wall time was roughly as estimated: A ≈ half day,
B ≈ 1 day in parallel, C ≈ hours.
## Verified findings (probe run 2026-08-06, A-minor graph)

Printed from the live graph, not inferred from reading code:

- **F1 — enabler semantics are split.** Non-fn edges carry the *current
  node's* `prev` (arrival context): `Dm.next = G[null], D#dim[F+Edim+C7],
  B[F+Edim+C7], G#dim[F+Edim+C7], E[F+Edim+C7]` — exactly the double-box
  partition. But fn edges (V64/Aug6/N6) carry the current node's *own name*
  (`Am.next` has `V64[Am]`; `E.next` has `V64[E] Aug6[E]`), useless for
  context matching. Normalized in A2.
- **F2 — hard filtering by enabler would break.** `G#dim.next = E[Dm+Bdim]`
  is its only edge, yet `Am.next` legally includes G#dim — arrival from Am
  is real but unannotated (`prev` exists on only 3 romans: IVm[1], IIdim,
  VIIdim). Strict filtering with prev=['Am'] would return *empty*. Context
  must annotate/rank, never drop.
- **F3 — merged nodes partition cleanly.** `Bdim.next` = IIdim edges
  (`D#dim[F], B[F], V64, G#dim[F], E[F]`) + VIIdim/III edges
  (`Edim[null], C7[null], C[null]`). Also `Dm.dotted = Bdim[null], G7[null]`
  — Bdim appears there *as VIIdim/III*, a different roman than the Bdim
  node's own (IIdim); the per-edge `roman` field disambiguates.
- **F4 — no node has duplicate next-names** today; dedupe is defensive only.
- **F5 — C major today builds the borrowed-minor chart**: nodes
  `Cm,Fm,B,E,A,Ddim,V64,Bdim,G,N6,Aug6,Edim,C7,A#dim,F#7,D#dim,B7,G#dim,E7,F#dim,D`.
  Cm as the "tonic" of C major — stream B1's target.
- **F6 — mode dispatch must use `Scale.get(...).type`**: 'C ionian' → type
  `major`, 'A aeolian' → `minor`, 'D dorian' → `dorian`. String matching is
  unreliable (`properScaleName('ionian')` throws) and aliases DO reach
  `chordGraphCreate` uncaught. Cache keys stay the raw input string
  ('C ionian' and 'C major' are separate cache entries — existing behavior).
- **F7 — `noteInversions` returns raw rotations, NOT voicings**:
  `Am → [[A3,C4,E4],[C4,E4,A3],[E4,A3,C4]]` (2nd/3rd non-ascending).
  Stream B2 needs a new ascending-inversion helper; `noteInversions` is
  public API with pinned tests — leave it, build alongside.
- **F8 — pivot lookup works**: `detectAllScales(['A','C','E'])` filtered to
  major/minor names → C/F/G major, D/E/A minor (exactly the six
  diatonic-containing keys).
- **F9 — mixture spellings via interval transpose are correct**
  (bIII/bVI/bVII of C → Eb/Ab/Bb).
- **F10 — `optionalRomans = ['IImdim']` is dead config** (not in the chart).
  Exported, so keep the export; deprecation comment in Stage C.


## Stage A — Foundation (DONE, serial) — `34258d4` `33d944f` `9dfda1d`

- [x] **A0 — V64 edge direction: flipped to classical** (user decision).
      Four nodes changed: `V64 -> [V]` (dotted I removed — a 6/4 straight to
      root-position tonic is a *passing* 6/4, a different object);
      `V -> [Im]` dotted `[I]` (Picardy); `N6 -> [V64, V]`;
      `Aug6 -> [V64, V]`. Predominant approaches to V64 (from Im, IVm,
      IIdim, VIIdim/V, V/V) deliberately kept.
- [x] **A1** — chart moved to `src/lib/graphData/minor.ts` with provenance
      comments; `ProgressionGraphNode` + `ProgressionChart` in a zero-import
      `graphData/types.ts` (that zero-import property is what prevents a
      cycle); `graphh.ts` re-exports `minor` unchanged for the public barrel.
- [x] **A2** — fn-edge enablers normalized (F1): `Dm`'s V64 edge now
      `[F, Edim, C7]`, `Am`'s now `null` (were `['Dm']` / `['Am']`).
- [x] **A3** — per-edge `roman` on `EnabledChordNameWithNotes`, populated in
      all four construction sites (fn/non-fn × next/dotted).
- [x] **A4** — `nextChordDetail` + `ChordSuggestion` shipped; `nextChord`
      behaviorally byte-identical (shares a `resolveNode` helper).
- [x] **A5** — tests; 61 → 74.

## Stage B — Parallel fan-out (DONE, 5 worktrees, zero merge conflicts)

**Provisioning note:** all five worktrees were seeded from an old `master`
commit, not `chord-assist-improvements`. Each agent detected this
independently and re-based onto Stage A before starting; no work was lost.
Worth knowing for future fan-outs — worktree isolation does not inherit the
current branch.

- [x] **B1 major graph** — `7852fda`, merged `9c5de88`. C major is really
      major: `C, Em, Am, F, Dm, V64, Bdim, G, N6, Aug6` + secondaries
      (`A7, C#dim, B7, D#dim, C7, Edim, D, F#dim, E7, G#dim`). Cm is gone.
      Mode dispatch on `Scale.get(...).type` (F6) + an `empty` guard the
      plan didn't anticipate (`Scale.get('C maj')` returns `type: ''`).
      **N6 decision: INCLUDED**, reachable only from IV and IIm (never the
      tonic) — bII is diatonic to neither mode, so predominant-to-predominant
      substitution is the honest placement. **Corrected the brief:** the
      minor chart's `IIdim` realizes to `Ddim` in C major, but ii is *minor*
      in major keys — used `IIm`/`IIIm`/`VIm`. 25 tests.
- [x] **B2 voice-leading + smooth voicing** — `a589d76` `4d977d4` `d0b8434`,
      merged `f3669f5`. `ascendingInversions` built fresh (NOT on
      `noteInversions`, per F7); symmetric nearest-note mapping for unequal
      cardinalities; `rankByVoiceLeading` as a pure function.
      **Declined the brief's instruction to import `pitchHeight`** from
      `barTemplates/compile.ts` — that would have closed a runtime cycle
      (`barsUtil → voiceLeading → compile → barsUtil`), the e302ee7 bug
      class; duplicated the 10-line helper instead, with reasoning
      commented. Smooth voicing opt-in via `voicing=smooth` tag;
      `barsUtil.test.ts` verified byte-identical to Stage A (proof the
      default path is untouched). 27 tests.
- [x] **B3 mode mixture** — `1657c71`, merged `1112c7a`. C major:
      `iv=Fm, ii°=Ddim, bIII=Eb, bVI=Ab, bVII=Bb`; A minor: `IV=D` (dorian).
      Picardy I deliberately NOT duplicated (already a dotted edge).
      Derived types (`MixtureStrength`/`MixtureSuggestion`) designed to
      collapse to zero churn once C3 widened the base union. 14 tests.
- [x] **B4 pivot modulation** — `9898e9a`, merged `e8a5155`.
      `pivotSuggestions` + `romanInKey`. Rejected `Progression.toRomanNumerals`
      (returns quality-only garbage when handed a full key name) and
      reverse-mapping (triad-only, finds nothing for G7); chose degree +
      quality construction. Ordering by `Key.alteration` distance. 14 tests.
- [x] **B5 surprise-me walk** — `ea0e6bc`, merged `d4db369`. mulberry32 PRNG
      (seeded, deterministic); strong:3 / dotted:1 with contextMatch as a
      ×2 multiplier; dead ends stop early via `stoppedBecause`. **Found what
      the brief missed:** the Picardy `A` is an edge *target* but not a graph
      node, so `nextChordDetail('A,3',…)` throws — treated as terminal
      instead of crashing. 23 tests.

## Stage C — Integration + polish (DONE) — `1bc4766` `b60d6d1` `a65cb7c` `15c47ff`

- [x] **C0 — dotted chord-function edges fixed.** Both branches now share a
      `translateEdge` helper. Probe showed it was worse than documented:
      `V64` didn't return `''`, it mangled into the garbage name `E64`.
- [x] **C1 — `detectAllScales` enharmonic fallback.** The suggested full
      chroma normalization was probed and shipped only as a *fallback*.
      **Not a cost issue** — `allScales` is a fixed 189-entry list scanned
      linearly (0.04 ms/call) either way. The issue is that `allScales` is
      built over a note-name list containing double accidentals, so it
      holds *enharmonic duplicate keys*. Chroma matching on `['A','C','E']`
      returns 15 major/minor names, but the 9 additions are duplicates of
      the same 6 real keys under unplayable spellings: `Dbb major` (= C
      major), `F## major` (= G major), `C## minor` (= D minor), and so on.
      Pivot discovery would offer them as distinct destinations and then run
      `romanInKey`/`chordGraphCreate` against `Dbb`. Shipped: name matching
      primary, chroma fallback only when name matching returns empty.
      Correctly-spelled input byte-identical.
- [x] **C1-followup — DONE, but not as specified.** The brief was "dedupe
      `allScales` by pitch-class set, preferring conventional spellings", to
      make chroma matching safe everywhere and remove the fallback. Probing
      showed all three parts of that plan were wrong:
      1. **Pitch-class set is the wrong grouping key.** C major and A minor
         share all seven pitch classes; grouping by pitch alone merges every
         relative major/minor pair and deletes half the keys. The key must be
         (mode, pitch-class set) — 84 groups, not 12.
      2. **"Fewest accidentals" is the wrong preference.** It discards
         `C# major` (7 sharps) for `Db major` (5 flats), `A# minor` for
         `Bb minor`, `Ab minor` for `G# minor` — all real notated keys. Which
         spellings are conventional is notation fact, not a derivable count,
         so the 15+15 are stated as data in `scaleList.ts`.
      3. **The fallback cannot be removed, and detection must NOT use the
         deduped list.** A deduped list holds one spelling per sounding
         scale, so `C# major` is absent from it; detecting the correctly
         spelled C#-E#-G# against it returns `B lydian` alone. Detection
         needs every spelling; a picker needs exactly one.
      Shipped as an **additive** change instead: `allScales` and
      `detectAllScales` are byte-identical, and `conventionalKeys` (30 real
      keys, incl. `Cb major` which `allScales` cannot spell) plus
      `distinctScales` (84) are added for callers. Picker goes 54 entries
      (20 unplayable) -> 30. 22 tests.
- [x] **C2 — flat-key N6 spelling fixed.** Root now
      `Note.transpose(tonic, '2m')`. Eb major: `Ab Cb Fb` (was `E G# B`);
      Db major: `Ebb Gb Bbb`. All other keys unchanged, so no pinned test
      moved.
- [x] **C3 — `strength` widened** to `'strong' | 'dotted' | 'mixture'`.
      B3's derived aliases collapsed exactly as designed; kept as
      `@deprecated` documentation rather than retired (safer for external
      importers).
- [x] **Convenience opts** (user decision — `b60d6d1`):
      `nextChordDetail(chord, tonic, scale, { prev?, include?: 'mixture'[],
      rankBy?: 'voiceLeading', fromVoicing? })`. Order: graph edges →
      dedupe → include → prev annotation → rank. `rankBy` without
      `fromVoicing` **throws** (silently skipping would return a
      plausible-looking unranked list the caller can't detect). Stage B
      functions remain exported and ARE the implementation.
- [x] **Public API surface** (user decision — `a65cb7c`). The four new
      modules were compiled but unreachable from the `ollave/lib` entry;
      now exported (named + namespace + all public types). Two aliases avoid
      colliding with namespace exports: `nextChordNames`,
      `randomProgressionNames`.
      **Cycle avoidance — the highest-risk item:** `nextChord.ts` importing
      voiceLeading/mixture at runtime would have closed a real loop, since
      `barsUtil` already imports `nearestVoicing` and `nextChord` imports
      `barsUtil`. Fixed by extracting `ChordSuggestion` into a zero-import
      leaf module `src/lib/chordSuggestion.ts`. Verified: madge circular
      deps went 19 → 18 *despite* adding two runtime imports (the
      `voiceLeading → nextChord` cycle is gone), and the emitted
      `public/js/lib/*.js` has zero runtime references back to `nextChord`.
      Two guards added to `importHygiene.test.ts`.
- [x] **Verified external contract** (independently, not from agent report):
      esbuild-bundled a consumer importing 10 symbols from the built
      `public/js/lib/index.js` — clean (esbuild errors on unmatched named
      exports); real `tsc --strict` on a consumer file using the public
      types — 0 errors, confirming `MixtureSuggestion` ↔ `ChordSuggestion`
      mutual assignability.
- [x] **Housekeeping:** `CustomEvent` shim hoisted to `test/setup.ts`;
      `optionalRomans` deprecation comment (F10).
- [x] **0.4.0 + CHANGELOG.md** (user decision — `15c47ff`), documenting the
      breaking change: existing *major-key* songs keep playing via the
      plain-chord fallback but lose graph voicing/roman tags, since their
      stored chords were borrowed-minor names. Minor-key songs unaffected.

## Phase 5 — App surface (NOT STARTED; the only remaining work)

- [?] Suggestion chips after `addChord` (the roman tag is already recorded on
      note groups), styled by strength/contextMatch, click-to-place with
      smooth voicing. **Coordination needed:** touches `myapp.ts`/commands
      where another agent has been working.
- Note: `public/main.js` currently contains none of the new symbols — correct,
  since it tree-shakes to what the UI calls. **These APIs are library-facing
  only until Phase 5 surfaces them.**

## Completed groundwork (pre-plan, this session)

- [x] Vitest infra (`yarn test`), window/fake-indexeddb shims, tests excluded
      from tsc emit
- [x] Barrel-import hygiene (music.ts Piano no longer loads via mem());
      `importHygiene.test.ts` guards it
- [x] chordGraphCreate return-shape landmine; lookUpGraph null typing; dead
      dynamic-chord branch; enabler realization; accidental-roman handling;
      inScale membership; Bdim collision merge; assorted guards
- [x] Musical accuracy: V64 = cadential 6/4; Aug6 = b6-1-#4; secondary
      VIIdim/x on leading tone; diatonic VIIdim on leading tone (G#dim in
      A minor)
- [x] TypeScript strict mode ON (~149 errors fixed, behavior-preserving)
- [x] Precision probe of the live A-minor graph → findings F1–F10 above
