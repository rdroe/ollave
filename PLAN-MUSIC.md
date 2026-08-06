# Plan: from chord-name generator to part-writing assistant

Status legend: `[x]` done · `[ ]` pending · `[?]` awaiting decision

**Premise.** The current model is a *first-order Markov chain over root-position
triads and sevenths within one fixed key*. Almost everything an adept composer
does lives outside those three assumptions. This plan attacks them in priority
order: **bass/inversions (P1) → voice-leading legality (P2) → cadence-targeted
pathfinding (P4) → the rest**.

Execution shape mirrors the 0.4.0 plan, which worked: **serial foundation where
shared files change, parallel fan-out where files are disjoint, serial
integration.** Every stream opens with an empirical probe (scratch vitest
printing real data) and lands green (`yarn test` + `npx tsc --noEmit`) before
merge.

Baseline at authoring: `master`, 283 tests, strict mode ON, v0.4.0 + unreleased
sevenths/scale-list work.

---

## Verified findings (probed 2026-08-06, before planning)

- **V1 — there is no bass anywhere in the data model.** `ProgressionGraphNode`
  is `{ name, next: string[], dotted?: string[], prev?: string[] }` — edges are
  bare strings. A chord is a pitch-class set plus an optional `octMap`. So
  inversions cannot be expressed without a schema change; this is the single
  biggest reason P1 is foundational and must be serial.
- **V2 — inversion *machinery* already exists but is voicing-only.**
  `ascendingInversions` / `nearestVoicing` (voiceLeading.ts) enumerate and
  select inversions; nothing names or constrains them. So P1 is about making the
  bass a *compositional* choice, not adding pitch math.
- **V3 — no part-writing code exists.** No parallel-fifth, doubling, or
  resolution checking anywhere in `src/lib`. P2 is greenfield.
- **V4 — metric data is already present.** `tickCounts`, `BAR`, and per-note
  `barDelay` tags exist, so P3 (rhythm/metric weight) needs no new timing
  infrastructure — only a way to read strong/weak position.
- **V5 — `V64` is a chord-function node precisely because the model can't say
  "I over a dominant bass."** Once P1 lands, `V64` becomes expressible as
  `I⁶₄` and the special-case node could be retired (deliberate follow-up, not
  automatic).
- **V6 — `Aug6` is one generic node**, not the Italian/French/German trio (P6).

---

## Stage M-A — Bass and inversions (SERIAL, foundational) — P1

Everything else depends on this schema. One agent, no parallelism.

- [ ] **A1 — extend the edge/node schema** so a chord can carry a bass. Design
      decision to make explicitly: a structured field (`{ chord, figure }`) vs a
      naming convention (`I6`, `V65`). **Steer:** structured — `/` already means
      tonicization (`V7/III`), and `Chord.get('C/E')` returns empty, so slash
      names are both ambiguous and unresolvable. Keep bare strings working
      (every existing chart entry is one).
- [ ] **A2 — figured-bass vocabulary**: `⁶`, `⁶₄`, `⁷`, `⁶₅`, `⁴₃`, `⁴₂` with
      ASCII spellings (`6`, `64`, `65`, `43`, `42`). Map figure → which chord
      tone is in the bass. Verify spellings in flat AND sharp keys by probe.
- [ ] **A3 — resolve bass into voicings.** `parseChordCsvArg` must place the
      figured chord with the correct bass note, and `ChordSuggestion` must
      report it. Additive: existing callers see no change.
- [ ] **A4 — chart edges using inversions.** At minimum: `I⁶`, `V⁶`, `vii°⁶`,
      passing `⁶₄`, pedal `⁶₄`, and the seventh-chord inversions `V⁶₅`/`V⁴₃`/
      `V⁴₂`. This is where the bass becomes a melodic line.
- [ ] **A5 — descending-bass idioms** as first-class content: the lament bass,
      I–V⁶–vi–iii⁶–IV–I⁶–IV–V, fauxbourdon ⁶-chains.
- [ ] **A6 — decide V64's future** (V5). Expressible as `I⁶₄` after A1; retiring
      the function node is a breaking change, so likely keep both with the
      function node documented as an alias.
- [ ] **A7 — tests + docs.** Pin that default `nextChord` output is unchanged.

**Blast-radius rule:** as with sevenths, inversions arrive on `dotted` edges
unless musically principal, so `nextChord` (strong edges only) stays stable.
Probe before/after and report the delta.

---

## Stage M-B — Parallel fan-out (worktree per stream, disjoint files)

Branch after M-A merges. File-ownership matrix; no stream edits another's files
or the Stage-M-A test suites.

| Stream | Writes | New tests |
|---|---|---|
| B1 voice-leading rules (**P2**) | `partWriting.ts` | `partWriting.test.ts` |
| B2 cadences + pathfinding (**P4**) | `cadence.ts`, `progressionPath.ts` | own files |
| B3 metric weight (**P3**) | `harmonicRhythm.ts` | own file |
| B4 chromatic vocabulary (**P6**) | `graphData/*`, `chromatic.ts` | own file |
| B5 sequences (**P7**) | `sequences.ts` | own file |

### B1 — Voice-leading legality (P2) — highest value in this stage

- [ ] `checkVoiceLeading(from: Voicing, to: Voicing, opts?)` → typed violations,
      not booleans: parallel fifths/octaves (and hidden/direct into a perfect
      interval on the outer voices), unresolved chordal seventh, doubled leading
      tone, unresolved leading tone at a cadence, augmented second (minor),
      voice crossing/overlap, spacing > octave between upper voices.
- [ ] `realizeSATB(chordName, opts)` → four-voice realization with correct
      doubling (double the root; never the leading tone) and tendency-tone
      resolution.
- [ ] Compose over the existing contract: `rankByVoiceLeading` sorts, this
      *filters/annotates*. Do NOT fold into `nextChordDetail`'s opts (that
      pattern exists to keep streams independent).
- [ ] Each rule cites its textbook statement in a comment and is pinned by a
      hand-verified example AND a counter-example.

### B2 — Cadences and pathfinding (P4)

- [ ] Cadence types as data: PAC, IAC, half, deceptive, plagal, Phrygian half —
      each a *pattern* (chords + bass/soprano conditions), not just a chord pair.
- [ ] `pathToCadence(from, cadenceType, bars, key)` — weighted graph search
      returning ranked progressions of the requested length. This is the
      interaction-model change: from "what's next" to "get me there."
- [ ] `detectCadences(progression, key)` — the inverse query; label what a
      composer already wrote.
- [ ] Honest scoping: exact-length paths may not exist; return best-effort with
      a reason, never throw.

### B3 — Harmonic rhythm and metric weight (P3)

- [ ] `metricWeight(barDelay, meter)` using existing `tickCounts`/`BAR` (V4).
- [ ] Constrain the cadential ⁶₄ correctly: strong beat for the ⁶₄, weaker for
      its V — the device's whole point, currently unmodellable.
- [ ] `suggestHarmonicRhythm(progression, meter)` — where changes should fall.

### B4 — Chromatic vocabulary (P6)

- [ ] Split `Aug6` into **Italian / French / German** (V6), keeping `Aug6` as a
      documented alias so nothing breaks.
- [ ] Common-tone diminished sevenths; chromatic mediants (major-third relations
      with a common tone); enharmonic reinterpretation pairs (Ger⁶ ↔ V⁷,
      dim⁷ rotations) — the last also feeds B2-style modulation work.

### B5 — Sequences as objects (P7)

- [ ] Sequences as *templates* that generate progressions: descending fifths,
      ascending 5-6, descending 5-6, monte/fonte/ponte.
- [ ] `applySequence(pattern, startChord, length, key)`. Fits the existing
      bar-template machinery conceptually — check whether it can reuse it.

---

## Stage M-C — Integration (SERIAL)

- [ ] Compose the streams: a cadence-targeted path (B2) that is voice-leading
      legal (B1), metrically placed (B3).
- [ ] Decide the `nextChordDetail` surface: which of these become `opts`, which
      stay standalone. (The 0.4.0 lesson: compose first, add sugar later.)
- [ ] `chord` CLI subcommands for the new capabilities.
- [ ] Docs: extend `docs/chord-theory.md` (it now has §11 on authoring charts)
      and `docs/chord-assistance.md`.
- [ ] Version + CHANGELOG. Likely 0.6.0.

---

## Deferred — prolongation (P5)

- [?] **Hierarchical/Schenkerian structure is research-grade, not a sprint.**
      A first-order Markov chain fundamentally cannot represent nesting, where
      a whole passage prolongs a single tonic. A lightweight down payment is
      feasible and worth doing first: tag chords by function (T / PD / D),
      distinguish structural from embellishing, allow nested spans. Full
      prolongational analysis should be its own project with its own plan.

---

## Open questions for the user

- [?] **Target idiom.** These priorities assume common-practice tonal harmony
      (the tradition the charts already encode). Jazz (extensions, tritone subs,
      modal interchange) or Romantic chromaticism (neo-Riemannian P/L/R, which
      is a *different graph topology*, not more nodes) would reorder this list.
- [?] **How strict should P2 be?** Textbook part-writing forbids things skilled
      composers do deliberately. Suggest: report violations, never block — same
      principle as `contextMatch` annotating rather than filtering.
