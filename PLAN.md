# Plan: Composer-grade chord assistance

Status legend: `[ ]` pending · `[x]` done · `[?]` awaiting decision

Structured for multi-agent execution: **Stage A is serial** (one agent — it
contains all surgery on shared files), **Stage B is a parallel fan-out**
(worktree-isolated streams with disjoint file ownership), **Stage C is a
small serial integration pass**. Every stream begins with an empirical
probe (scratch vitest printing the real data it depends on) and lands
green (`yarn test` + `npx tsc --noEmit`) before merge.

Est. wall time: A ≈ half day → B ≈ 1 day in parallel (vs ~3 serial) → C ≈ hours.

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

## Stage A — Foundation (SERIAL, one agent; all shared-file surgery)

Owns: `graphh.ts`, `graphUtil.ts`, `nextChord.ts`, new `src/lib/graphData/`,
and the existing test suites. After A merges, **no Stage B stream edits
these files** except B1's designated `graphUtil.ts` dispatch.

- [?] **A0 — V64 edge direction** (resolve before A5 pins tests, else pin
      current edges and revisit). As transcribed: `V -> V64` and
      `V64 -> {N6, Aug6, I, Im}` (probe confirms `V64.next = N6, Aug6, A,
      Am`; `E.next = V64, Aug6, Am`). Classically the cadential 6/4
      resolves *to* V and N6/Aug6 *precede* the dominant — i.e.
      `N6/Aug6 -> V64 -> V -> Im`. **Recommended default if the chart can't
      be checked:** flip to the classical direction, consistent with the
      approved V64/Aug6/VIIdim corrections.
- [ ] **A1 — chart data extraction** (moved from old Phase 2 so it precedes
      the fan-out): move the `minor` chart to `src/lib/graphData/minor.ts`
      with provenance comments; `graphh.ts` re-exports `minor` unchanged
      (public via lib barrel). Prepares a sibling slot for `major.ts` so B1
      is pure file-addition.
- [ ] **A2 — fn-edge enabler normalization (F1):** in
      `makeProgNodeTranslator`, fn edges get the same prev-based enabler as
      non-fn siblings (`progNodeIn.prev` realized, else null) — `Dm`'s V64
      edge becomes `[F+Edim+C7]`, `Am`'s becomes null. Internal data unused
      elsewhere; test pins the new shape.
- [ ] **A3 — per-edge roman** (additive field on
      `EnabledChordNameWithNotes`) — disambiguates Dm ⇢ Bdim-as-VIIdim/III
      vs the Bdim node's IIdim identity (F3).
- [ ] **A4 — `nextChordDetail`** in `src/lib/nextChord.ts` (existing
      `nextChord` untouched; its tests already pin output):

```ts
export type ChordSuggestion = {
  name: string                    // 'G#dim'
  roman: string                   // edge roman, e.g. 'VIIdim' or 'V7/III'
  notes: string[]
  strength: 'strong' | 'dotted'   // Stage B adds 'mixture' via composition
  enabledBy: string[] | null      // realized names; null = unconditional
  contextMatch?: boolean          // present only when opts.prev given
}

export const nextChordDetail = (
  chordCsvArg: string, tonic: string, scale: string,
  opts?: { prev?: string[] }      // recent chords, most recent last
): ChordSuggestion[]
```

      Context rule (F2): `contextMatch = enabler === null ||
      enabler.includes(prev[prev.length - 1])`; sort matches first; **never
      drop** a suggestion (G#dim-after-Am would otherwise return empty).
      Only `prev[last]` is consulted. Includes dotted edges; dedupe by
      `(name, strength)` merging enabler lists (defensive — F4).
      **`ChordSuggestion[]` is the contract Stage B streams build against —
      they compose over it as pure functions rather than growing `opts`
      (that composition rule is what makes the fan-out conflict-free).**
- [ ] **A5 — tests:** Bdim partition with prev=['F'] vs prev=['Am']; Dm
      double-box; G#dim-after-Am non-empty regression; dotted visibility
      (`E ⇢ A`); Dm ⇢ Bdim carries roman 'VIIdim/III'; V64/E edges per A0.

## Stage B — Parallel fan-out (worktree per stream, disjoint files)

File-ownership matrix (writes; everything else is read-only). New test
files per stream — **no stream appends to the Stage-A test suites.**

| Stream | Writes | New tests |
|---|---|---|
| B1 major graph | `graphData/major.ts` (new), `graphUtil.ts` (dispatch only) | `majorGraph.test.ts` |
| B2 voice-leading + smooth voicing | `voiceLeading.ts` (new), `barsUtil.ts`, `addChord.ts` | `voiceLeading.test.ts` |
| B3 mode mixture | `mixture.ts` (new) | `mixture.test.ts` |
| B4 pivot modulation | `pivots.ts` (new) | `pivots.test.ts` |
| B5 surprise-me walk | `randomProgression.ts` (new) | `randomProgression.test.ts` |

Merge order: B1 first (it carries the one behavioral change), then B2–B5 in
any order — ownership is disjoint so conflicts should be zero. Each stream:
branch off main *after* Stage A merges; probe first; `yarn test` +
`npx tsc --noEmit` green before merge. `importHygiene.test.ts` guards
against any stream reintroducing barrel imports.

### B1 — Real major-key graph (~1 day; the accuracy fix)

- [ ] Probe: build the drafted chart for C/G/F#/Eb major, print every
      node/edge/enabler, eyeball against the source chart before pinning.
- [ ] Author `major` chart in `graphData/major.ts`: I → iii/vi → IV/ii →
      V/vii° → I, deceptive V ⇢ vi dotted, cadential V64, Aug6, secondary
      `V7/x` + `VIIdim/x` for x ∈ {ii, iii, IV, V, vi}.
- [ ] Mode dispatch in `chordGraphCreate` keyed on
      `Scale.get(...).type` (F6): `major` → major chart, `minor` → minor
      chart, else clear error (today: silent borrowed-minor, F5). Aliases
      dispatch correctly for free; raw-input cache keys unchanged.
      Parameterize the untranslatable-romans check by chart.
- [ ] Tests: C-major characterization mirroring A minor; every edge
      resolves with notes; secondary spellings (vii°/V in C = F#dim);
      dispatch error for dorian.
- [?] **N6 in the major chart** — include (as dotted?) or omit.
- [?] **Confirm consequence:** existing *major-key* songs keep playing
      (plain-chord fallback) but lose graph voicing/roman tags (their old
      chords were borrowed-minor names — F5). Minor-key songs unaffected.
      Suggest 0.4.0 at this merge.

### B2 — Voice-leading engine + smooth voicing (~1 day; single stream
because placement *needs* the engine's nearest-inversion math)

- [ ] `ascendingInversions(chordName, octaveRange)` producing *true*
      voicings (pitch-class rotation + correct octave assignment) — reuse
      `pitchHeight`/`resolveChordPitchesAscending` from
      `barTemplates/compile.ts`; do NOT build on `noteInversions` (F7).
- [ ] `voiceLeadingDistance(fromVoicing, toChordName)`: minimal total
      semitone motion across candidate voicings; nearest-note mapping for
      unequal cardinalities.
- [ ] `rankByVoiceLeading(suggestions: ChordSuggestion[], fromVoicing)` —
      **pure function over the Stage-A contract** (not an opts change to
      `nextChordDetail`), returning sorted copies carrying `distance` +
      `suggestedVoicing`.
- [ ] Smooth voicing on placement — **opt-in via `voicing=smooth` tag** (no
      `addChord` signature change; tags already flow). `parseChordCsvArg`
      gains optional `prevNotes` param (additive). Previous-chord lookup:
      greatest `(barIndex, barDelay)` chord group before the insertion
      point among `chord=`-tagged notes in the same phase.
- [ ] Tests: identity distance 0; Am→E prefers the G#-B-E-adjacent
      arrangement (hand-verified); ranking order; opt-in placement; default
      placement byte-identical to today.

### B3 — Mode mixture (~half day)

- [ ] `mixtureSuggestions(tonic, scale): ChordSuggestion[]` with
      `strength: 'mixture'`, interval-based spellings (F9): into major —
      iv, ii°, bIII, bVI, bVII; into minor — IV (dorian). Picardy I already
      exists as a dotted edge. Callers concat with `nextChordDetail` output.

### B4 — Pivot modulation (~half day)

- [ ] `pivotSuggestions(chordName, tonic, scale)` via `detectAllScales`
      filtered to major/minor key names (F8), returning
      `{ targetKey, romanThere, follow: ChordSuggestion[] }`.

### B5 — Surprise-me walk (~half day)

- [ ] `randomProgression(start, tonic, scale, length, { seed })` — weighted
      walk over `nextChordDetail` output (strong > dotted), no immediate
      repeats, seeded LCG (not `Math.random`) so tests are deterministic.

## Stage C — Integration + polish (SERIAL, one agent, ~hours)

- [ ] **C0 (from B1) — dotted chord-function edges are silently dropped.**
      `makeProgNodeTranslator`'s `dotted` branch calls
      `romanChordNameToReal` unconditionally, which returns `''` for a
      function name (V64/N6/Aug6), so every dotted edge to one is dropped
      with a "Dropping untranslatable dotted chord" warning. The `next`
      branch handles this via `isChordFn`; the dotted branch must too.
      Blocks weak N6/Aug6 edges and any future dotted V64.
- [ ] **C1 (from B4) — `detectAllScales` is spelling-sensitive**, matching
      note *names* not chromas: `detectAllScales(['C#','F','G#'])` returns
      ZERO keys (a mis-spelled C# major triad finds no home). Affects pivot
      discovery for enharmonically-spelled input. Decide: normalize to
      chroma, or document the requirement.
- [ ] **C2 (from B1) — N6/Aug6 respell enharmonically in flat keys**
      (Eb major N6 = G#-B-E rather than Fb-Ab-Cb) due to `Note.simplify`
      in graphh.ts's helpers. Pitch-correct, spelling-ugly.
- [ ] **C3 (from B3) — widen `ChordSuggestion['strength']`** to include
      `'mixture'`; B3's derived `MixtureSuggestion` type then collapses to
      structurally identical and its aliases can be retired with zero
      churn by design.
- [ ] Decide whether `nextChordDetail` gains convenience opts wrapping the
      B-stream functions (e.g. `include: ['mixture']`,
      `rankBy: 'voiceLeading'`) or the compositional API stands alone —
      either way B code is the implementation.
- [ ] Cross-feature tests (mixture + ranking together; pivot follow lists
      ranked); README/API notes.
- [ ] Housekeeping: deprecation comment on `optionalRomans` (F10).
- [ ] Version: 0.4.0 (B1's behavior change) + changelog line.

## Phase 5 (unchanged, out of the fan-out) — App surface

- [?] Suggestion chips after `addChord` (roman tag already on note groups),
      styled by strength/contextMatch, click-to-place with smooth voicing.
      Touches `myapp.ts`/commands where **another agent is currently
      working** — keep out of Stage B; schedule around their work.

## Completed groundwork (this session, 2026-08-06)

- [x] Vitest infra (`yarn test`), window/fake-indexeddb shims, tests
      excluded from tsc emit; 61 tests
- [x] Barrel-import hygiene (music.ts Piano no longer loads via mem());
      importHygiene.test.ts guards it
- [x] chordGraphCreate return-shape landmine; lookUpGraph null typing;
      dead dynamic-chord branch; enabler realization; accidental-roman
      handling; inScale membership; Bdim collision merge; assorted guards
- [x] Musical accuracy: V64 = cadential 6/4; Aug6 = b6-1-#4; secondary
      VIIdim/x on leading tone; diatonic VIIdim on leading tone
      (G#dim in A minor)
- [x] TypeScript strict mode ON (~149 errors fixed, behavior-preserving)
- [x] Precision probe of the live A-minor graph → findings F1–F10 above
