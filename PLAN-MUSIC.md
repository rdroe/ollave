# Plan: from chord-name generator to part-writing assistant

Status legend: `[x]` done · `[ ]` pending · `[?]` awaiting decision

**Premise.** The current model is a *first-order Markov chain over root-position
triads and sevenths within one fixed key*. Almost everything an adept composer
does lives outside those three assumptions. This plan attacks them in priority
order: **bass/inversions (P1) → voice-leading legality (P2) → cadence-targeted
pathfinding (P4) → the rest**.

**Audience.** These features serve advanced composers, who already know the
rules; what they lack is speed of *planning*. Ranked by delight to that
audience: (1) modulation-aware cadence targeting, (2) whole-progression
four-voice realization, (3) cadence detection over their own music,
(4) schemata and sequences, (5) the rule checker itself — necessary substrate,
least differentiating. The build order below is dependency order, not value
order; Stage M-C is where the headline features compose.

Execution shape mirrors the 0.4.0 plan, which worked: **serial foundation where
shared files change, parallel fan-out where files are disjoint, serial
integration.** Every stream opens with an empirical probe (scratch vitest
printing real data) and lands green (`yarn test` + `npx tsc --noEmit`) before
merge.

Baseline at authoring: `master`, 283 tests, strict mode ON, v0.4.0 + unreleased
sevenths/scale-list work.

**STATUS 2026-08-06: Stage M-A and ALL FIVE Stage M-B streams merged and
independently verified. 752 tests green (from 283), `npx tsc --noEmit` 0
errors, both builds clean.** Each stream's outcome is recorded inline below.
Stage M-C is the remaining work.

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
- **V7 — mixture and the Neapolitan already exist** (probed 2026-08-06).
  `mixtureSuggestions` (mixture.ts) supplies borrowed chords as a non-graph
  suggestion channel, and `N6` is a chart node reachable from the predominant
  region. B4's residue (Aug6 trio, CT°7, chromatic mediants) is genuinely
  what's missing — no more, no less.
- **V8 — pivot machinery already exists.** `pivotSuggestions` (pivots.ts)
  names chords shared between keys. Modulation-targeted pathfinding is
  therefore composable from existing parts plus B2's search — it needs an
  owner, not a research phase. It gets one in B2.
- **V9 — several planned devices are not chords or edges but short
  *patterns*.** A passing ⁶₄ is only a passing ⁶₄ between I and I⁶ with
  stepwise bass; a cadential ⁶₄ is defined by metric position and its ⁶₄→⁵₃
  resolution; the lament bass, fauxbourdon, cadence formulas and sequences are
  all ordered multi-chord templates with conditions. A first-order edge cannot
  carry that context. One shared span abstraction (A4) serves all of them.

---

## Stage M-A — Bass and inversions (SERIAL, foundational) — P1

Everything else depends on this schema. One agent, no parallelism.

- [x] **A1 — extend the edge/node schema** so a chord can carry a bass. Design
      decision to make explicitly: a structured field (`{ chord, figure }`) vs a
      naming convention (`I6`, `V65`). **Steer:** structured — `/` already means
      tonicization (`V7/III`), and `Chord.get('C/E')` returns empty, so slash
      names are both ambiguous and unresolvable. Keep bare strings working
      (every existing chart entry is one).
- [x] **A2 — figured-bass vocabulary**: `⁶`, `⁶₄`, `⁷`, `⁶₅`, `⁴₃`, `⁴₂` with
      ASCII spellings (`6`, `64`, `65`, `43`, `42`). Map figure → which chord
      tone is in the bass. Verify spellings in flat AND sharp keys by probe.
- [x] **A3 — resolve bass into voicings.** `parseChordCsvArg` must place the
      figured chord with the correct bass note, and `ChordSuggestion` must
      report it. Additive: existing callers see no change.
- [x] **A4 — span/pattern schema (shared abstraction, V9).** An ordered list
      of figured chords plus bass/soprano/metric conditions and optional
      per-rule waivers — a *template over the graph*, not an edge in it.
      Passing/pedal ⁶₄s (A5), the descending-bass idioms (A6), cadence
      patterns (B2) and sequences (B5) all consume this one type instead of
      inventing it three times. Schema only at this stage; conditions may be
      inert until B1/B3 can evaluate them.
- [x] **A5 — chart edges using inversions.** True chord-to-chord edges only:
      `I⁶`, `V⁶`, `vii°⁶`, and the seventh-chord inversions `V⁶₅`/`V⁴₃`/`V⁴₂`.
      This is where the bass becomes a melodic line. Passing and pedal `⁶₄`
      are NOT edges — their identity is contextual (V9); author them as spans.
- [x] **A6 — descending-bass idioms** as first-class spans: the lament bass,
      I–V⁶–vi–iii⁶–IV–I⁶–IV–V, fauxbourdon ⁶-chains. Fauxbourdon declares
      waivers for the parallel-motion rules it deliberately breaks (see B1) —
      the tool must not red-ink its own content.
- [x] **A7 — one alias policy for every baked-in-inversion node** (V5). `V64`
      is not alone: `N6` is literally named as a first inversion, and `Aug6`
      encodes an interval above the bass. After A1 each is expressible in
      figured terms; retiring any is a breaking change, so likely keep all as
      documented aliases — but decide once, not three times.
- [x] **A8 — tests + docs.** Pin that default `nextChord` output is unchanged.

**Blast-radius rule:** as with sevenths, inversions arrive on `dotted` edges
unless musically principal, so `nextChord` (strong edges only) stays stable.
Probe before/after and report the delta.

### Stage M-A design record (written before implementation, 2026-08-06)

Answers to the questions that had to be settled before any code was written.

**Q: How does a figured chord flow through `ChordSuggestion`?**
As two new OPTIONAL fields, `figure` and `bass`. A bare-string edge produces
neither, so every existing suggestion object is byte-identical. `figure` is the
ASCII figure (`'6'`, `'65'`, …); `bass` is the realized bass PITCH CLASS
(`'E'`), not a note with an octave — the suggestion contract has never carried
octaves for anything but `notes`, and the octave is a placement decision that
belongs to `parseChordCsvArg`/`nearestVoicing`, not to the graph.

**Q: How does `nextChordDetail` report bass?**
`name` stays the plain triad/seventh symbol (`'C'`), so name-keyed lookups —
graph indexing, `nearestVoicing`, the sevenths dedupe in `nextChordDetail`,
`randomProgression`'s `s.name !== current` check — keep working untouched.
`roman` carries the figured roman (`'I6'`), because roman is already "how this
edge is spelled" rather than "which node this is". `figure`/`bass` carry the
machine-readable form.

**Q: Can `voiceLeadingDistance` consume a figured chord?**
Yes, unchanged — it resolves `sug.name`, which is still a plain chord symbol.
A *bass-constrained* distance is deliberately NOT added here: filtering
`ascendingInversions` to those whose lowest note is the figured bass is a
one-liner over the existing enumeration, but choosing whether ranking should
respect the figure is B1's call (it owns doubling and spacing). `bassOf` and
`figuredVoicings` are exported so B1 can build it without re-deriving anything.

**Q: Does `randomProgression` walk to figured nodes?**
It walks to their `name`, which is the plain triad — so `I6` leads the walk to
node `C`, which exists. Figured edges are additional *dotted* edges, so seeded
walks shift (exactly as the sevenths work already documented), but no walk can
land on a non-existent node. Figured chords are edges, never nodes: the chart
is keyed by realized chord name and `C6` is not a chord.

**Q: How does a span reference chart nodes — by roman, by realized name, or
either?**
BY ROMAN, always. The charts are roman-keyed and key-independent and spans are
templates over the charts, so a span written in realized names would be a
different object per key — the thing the roman layer exists to avoid. A span
step is exactly the same `FiguredChord` an edge carries, which is what lets
B2/B5 emit spans and edges from one vocabulary.

**A1 — the schema, and why not a naming convention.**
An edge is `ChartEdge = string | FiguredChord` where
`FiguredChord = { chord: string; figure: Figure }`. Additive by construction:
every existing chart entry is a `string` and takes a byte-identical path.
Rejected alternatives: (a) slash names (`C/E`) — `/` already means
tonicization here and `Chord.get('C/E')` is empty; (b) suffix convention
(`I6`) — collides with real chord suffixes (`C6` is a sixth chord, `V64`
is an existing node name), and would make the figure unrecoverable from the
string without a parser that must know which suffixes are figures. The
structured field needs no parser and cannot collide. `types.ts` stays
zero-import.

**A4 — the span schema, and why it is this small.**
`HarmonicSpan` is an ordered `steps: FiguredChord[]` plus `conditions?` and
`waivers?`. Four downstream streams consume it, so the design rule was: put in
the fields no stream can add later without breaking the others, and leave out
everything a stream can add for itself.

- `steps` — the ordered template. Required. Roman-keyed.
- `conditions` — `{ bass?, soprano?, metric? }`, all per-step, all INERT at
  this stage: declared and type-checked, never evaluated, because nothing can
  evaluate them until B1 (voice leading) and B3 (metric weight) exist. They are
  in the schema now precisely so B1/B3 do not each invent their own shape and
  force a migration of A6's and B2's authored content.
- `waivers` — rule ids this span deliberately licenses. B1 consumes this. It is
  in the schema NOW rather than added by B1 because A6 ships fauxbourdon in this
  stage, and a span library that cannot say "these parallels are the point"
  would make B1's first act be to red-ink this stage's own content.
- `kind` — a coarse tag (`'idiom' | 'cadence' | 'sequence' | 'schema'`) so B2
  and B5 can filter one registry rather than each keeping a private list.

Deliberately NOT included: generation parameters (B5's `applySequence` needs a
transposition interval and a repeat count, which only sequences have — B5 can
extend `HarmonicSpan` structurally); scoring/weights (no stream has a use yet);
nesting (P5 is deferred and would be a different type).

**A7 — a correction to V5, found by probe.** The plan assumed "after A1 each
[of `V64`, `N6`, `Aug6`] is expressible in figured terms". Two of the three are:
`V64` is `I⁶₄` (probed: `figuredVoicings('C','64')` → `G3 C4 E4`, the same
pitch classes the node gives and better voiced) and `N6` is `♭II⁶` (probed in
A minor: → `D3 F3 Bb3`, byte-identical to the node).

**`Aug6` is not, and cannot be.** It is `♭6–1–♯4` — in A minor `F–A–D♯`, whose
intervals from the bass are `1P 3M 6A`. There is **no fifth**, and the top
interval is an augmented sixth rather than a stacked third, so there is no root
to invert and no chord tone for a figure to select. The `6` in its name is an
interval above the bass, which is what figured bass meant before the notation
was narrowed to inversion labels. `Chord.detect(['F','A','D#'])` returns
`['F7no5']` — the wrong analysis, respelling D♯ as E♭ and converting an
outward-resolving chord into a dominant seventh.

This settles the policy rather than complicating it: retiring the two that
convert would leave the third as a lone special case, trading one uniform
concept for two half-concepts. **All three stay as documented aliases** — which
is where the steer pointed anyway, but now for a demonstrated reason rather
than a precautionary one. The figured forms are valid chart edges too, so this
adds a spelling without removing one.

---

## Stage M-B — Parallel fan-out (worktree per stream, disjoint files)

Branch after M-A merges. File-ownership matrix; no stream edits another's files
or the Stage-M-A test suites.

| Stream | Writes | New tests |
|---|---|---|
| B1 voice-leading rules (**P2**) | `partWriting.ts` | `partWriting.test.ts` |
| B2 cadences, function + pathfinding (**P4**) | `cadence.ts`, `progressionPath.ts`, `harmonicFunction.ts`, `modulation.ts` | own files |
| B3 metric weight (**P3**) | `harmonicRhythm.ts` | own file |
| B4 chromatic vocabulary (**P6**) | `graphData/*`, `chromatic.ts` | own file |
| B5 sequences (**P7**) | `sequences.ts` | own file |

### B1 — Voice-leading legality (P2) — MERGED `37241ca`

- [x] `checkVoiceLeading(from: Voicing, to: Voicing, opts?)` → typed violations,
      not booleans: parallel fifths/octaves (and hidden/direct into a perfect
      interval on the outer voices), unequal fifths (°5→P5 — widely tolerated,
      a natural per-rule toggle), unresolved chordal seventh, doubled leading
      tone, unresolved leading tone at a cadence, augmented second (minor),
      voice crossing/overlap, spacing > octave between upper voices, and the
      cadential ⁶₄'s defining ⁶₄→⁵₃ resolution over a held bass (B3 covers
      only its metric half; this is its voice-leading half).
- [x] **Context waivers, not context-free nagging.** The checker accepts a
      waiver set, and spans (A4) carry theirs: fauxbourdon licenses its
      parallel motion, strict sequences tolerate a doubled leading tone on
      weak steps. Without this, B1 flags A6's and B5's own content — exactly
      the nagging that alienates composers who break rules on purpose.
- [x] `realizeProgression(chordNames, opts)` → four-voice realization of a
      *whole progression*: search over doublings and spacings minimizing
      violations across the span. This is the composer-facing deliverable;
      per-chord `realizeSATB` is its building block, not the feature.
- [x] **Doubling rules are per-figure, not global**: root position doubles the
      root, the cadential ⁶₄ doubles the bass, diminished triads double the
      third, first-inversion triads are flexible; never the leading tone.
      (Another reason B1 depends on M-A: doubling is a function of the figure.)
- [x] Compose over the existing contract: `rankByVoiceLeading` sorts, this
      *filters/annotates*. Do NOT fold into `nextChordDetail`'s opts (that
      pattern exists to keep streams independent).
- [x] **Strictness is a settable option** (see Decisions): default `'report'`,
      plus `'warn'` and `'block'`, and per-rule toggles. The default must never
      remove a suggestion.
- [x] Each rule cites its textbook statement in a comment and is pinned by a
      hand-verified example AND a counter-example.


**Outcome.** 14 rules, each citing Aldwell & Schachter, Piston or Fux in
`RULE_CITATIONS` (pinned so catalogue and citations can't drift). Key-dependent
rules are **skipped, not guessed**, without `opts.key` — for this audience a
wrong rule is worse than a missing one. `unequal-fifths` and `parallel-fourths`
are off by default (both widely tolerated; a false positive would be the first
thing an expert saw).

- **Waivers verified end-to-end**: a real fauxbourdon texture flags
  `parallel-fourths` 1× with the rule on and **0×** with the span's own
  waivers applied. The checker does not red-ink the library's own content.
- `realizeProgression` is a **beam search** (width 24) over doubling × ordering
  × octave, scored `1000×errors + 250×warnings + motion + spacing`. A beam
  rather than greedy because part-writing isn't locally optimal — the smoothest
  V often forces parallel octaves into I. Waived rules cost **zero**, so
  waivers steer the search, not just the report. Verified I–IV–V–I in C: root
  doubled throughout, B3→C4 resolving at the cadence, zero violations.
- **Spacing is a search PREFERENCE, not a rule.** A probe caught the realizer
  opening on `C3 E4 G4 C5` — legal, smooth, and nobody writes it. Making it a
  violation would flag legitimate open-position writing in a composer's own
  music.
- The agent **mutation-tested its own counter-examples** (four deliberate
  breakages, each caught by exactly the test written for it), on the grounds
  that 79 tests passing first try is weak evidence.
- Reported three rule ids for `spans.test.ts`'s `KNOWN_RULES` rather than
  editing a file it didn't own; added in `148dc38`.

### B2 — Cadences, function and pathfinding (P4) — MERGED `d0b02cb`

- [x] **T/PD/D function tags — pulled forward from P5.** Tag every chart node
      tonic / predominant / dominant (`harmonicFunction.ts`). Cheap, and
      without it weighted search returns wandering, functionally aimless
      paths — technically legal chains that don't feel goal-directed. This is
      the P5 down payment; only the hard nesting part stays deferred.
- [x] Cadence types as data: PAC, IAC, half, deceptive, plagal, Phrygian
      half, and the **evaded cadence** (V⁴₂→I⁶) — the phrase-*extension*
      device; "how do I avoid closing yet" is as valuable to a composer as
      "how do I close." Each is a span (A4): chords + bass/soprano/metric
      conditions, not just a chord pair (PAC requires soprano on 1̂ and both
      chords in root position; the span schema can say so).
- [x] `pathToCadence(from, cadenceType, bars, key)` — graph search weighted by
      harmonic function (prefer T→PD→D→T motion), returning ranked
      progressions of the requested length. From "what's next" to "get me
      there."
- [x] **Modulation-targeted pathfinding — the headline feature for the
      target audience, owned here.** `pathToCadence` accepts a `targetKey`:
      route through `pivotSuggestions` (pivots.ts, already exists — V8) to a
      cadence in the new key. Diatonic pivots first; B4's enharmonic pairs
      (Ger⁶↔V⁷, dim⁷ rotations) extend the pivot set later without changing
      this surface.
- [x] `detectCadences(progression, key)` — the inverse query; label what a
      composer already wrote. Quietly one of the most delightful features:
      analysis of the composer's *own* music.
- [x] Honest scoping: exact-length paths may not exist; return best-effort with
      a reason, never throw.


**Outcome.** The headline features work end-to-end. Verified independently:
`pathThroughModulation('Am','PAC',4,'A','minor','C','major')` returns
`Am - Dm - G - C` pivoting on **Dm** (`IVm` here, `IIm` there) — the ideal
hinge because it arrives as a predominant in the new key. `detectCadences` on
`C F Dm G Am F G C` labels the deceptive `V→VIm` at **high** confidence and
`G→C` as **IAC at medium**, with the reason "no soprano supplied, so it cannot
be confirmed as perfect" — refusing to overclaim. Determinism confirmed by
running an identical call twice.

- **Function tags are keyed by ROMAN, not scale degree** — probed, and degree
  tagging is simply wrong on many nodes: `A7` in C major is degree 6 (reads
  tonic) but is `V7/IIm`; `G#dim` is chromatic, so degree has no answer for A
  minor's strongest dominant. Three judgement calls: `V64` = D (spells a tonic,
  functions as dominant), minor `VII` = T (no leading tone; the chart routes it
  to III), `V/V` = PD (locally dominant, functionally predominant).
- **Detection deliberately does NOT use chart edges.** `IVm→Im`, `V→VI` and
  `IVm6→V` are absent from the minor chart yet are ordinary music. It matches
  romans instead. `vii°→i` is deliberately left unlabelled rather than given
  invented vocabulary.
- Two ranking defects its own probes caught: paths that **closed early**
  (`I-IIm-V-I-V-I` is two three-bar phrases, not one six-bar one) and
  **chromatic sort accidents** (`Aug6` led every 5-bar result because 'A' sorts
  first). Both fixed as tiebreaks.
- Bounded DFS rather than Dijkstra, deliberately: a composer wants several
  exact-length options, not one cheapest path.

### B3 — Harmonic rhythm and metric weight (P3) — MERGED `1450279`

- [x] `metricWeight(barDelay, meter)` using existing `tickCounts`/`BAR` (V4).
- [x] Constrain the cadential ⁶₄ correctly: strong beat for the ⁶₄, weaker for
      its V. `spanMetricFit` ACTIVATES M-A's inert `conditions.metric`.
- [x] `suggestHarmonicRhythm(progression, meter)`.

**Outcome.** Lerdahl–Jackendoff dot grid (GTTM ch. 2), five ordered levels
(`downbeat > secondary > beat > division > subdivision`) with `'strong'|'weak'`
derived for `MetricCondition` compatibility. Honestly scoped in the docs:
well-formedness only — no hypermeter, grouping, or preference rules.

Two findings worth keeping:
- **`tickCounts[BAR]` (512) is the engine's fixed CONTAINER, not the meter's
  length.** A 3/4 bar is 384 ticks; using the container puts the next downbeat
  in the wrong place. Hence `barTicksOf(meter)`. Verified independently.
- **Metric fit must be RELATIVE, not absolute.** Beat 3 → beat 4 is a textbook
  cadential ⁶₄ though both are absolutely strong; an absolute-only check
  red-inks correct music. A `some`/`every` bug found mid-work would have
  accepted a mere descent as a passing-⁶₄ trough — fixed and pinned.

### B4 — Chromatic vocabulary (P6) — MERGED `b8fc7ff`

- [x] Split `Aug6` into **Italian / French / German** (V6), `Aug6` kept as alias.
- [x] Common-tone diminished sevenths; chromatic mediants; enharmonic
      reinterpretation pairs handed to B2.

**Outcome.** Trio verified across 17 tonics in flat and sharp keys; the outer
interval is pinned at 10 semitones so it can never respell into a ♭7.

- **`Aug6` aliases the ITALIAN, reversing this plan's steer** ("German is most
  common"). Two facts overrode frequency: `Aug6` appears in saved songs, so
  aliasing the German silently turns three notes into four in files on disk;
  and `graphh.test.ts` pins `Aug6('A','minor') === ['F','A','D#']` as a guard
  against a double-flattening bug fixed once before. The Italian is also the
  genuine prototype the other two each add one note to. **Independently
  verified byte-identical in A minor, C/Eb/F#/Db major.**
- **Chromatic mediants are a function, not chart edges** — decided by the
  codebase's own test: does it depend on where you're standing (→ node, like
  sevenths) or only on the key (→ channel, like `mixture.ts`)? Mediants are
  available from the tonic at any moment, and they side-step the T/PD/D cycle
  the charts encode. The Aug6 trio went the other way — an augmented sixth
  *does* have a functional obligation.
- **`Ger6 → V` is dotted while `It6/Fr6 → V` are strong**: the German's
  perfect fifth makes a direct move to root-position V parallel fifths, so its
  strong path is through the cadential ⁶₄.
- CT°7 vs leading-tone °7 is enforced by common-tone COUNT at runtime, which
  surfaced a real fact: a minor key gets only `♯v°7` (raising a minor triad's
  root leaves one common tone, not two).
- `nextChord` diff: pure additions, 25 → 28 nodes per chart, zero pre-existing
  nodes changed.

### B5 — Sequences as objects (P7) — MERGED `f21afe5`

- [x] Sequences as spans (A4) that *generate* progressions: descending fifths
      (diatonic AND applied), ascending/descending 5-6, monte/fonte/ponte.
- [x] `applySequence(pattern, startChord, length, key)`.
- [x] Sequence spans declare their rule waivers (B1).

**Outcome.** `SequencePattern = HarmonicSpan & { unit, transposition,
defaultRepeats }` — an intersection, so every pattern IS a valid span and
passes to `spanRomans`/`spanWaivedRules` unchanged. Transposition is in
**signed scale degrees**, not intervals: the varying interval quality is the
defining feature of a diatonic sequence, not a defect. Monte and fonte differ
only in the SIGN of the transposition over an identical applied-dominant unit
— exactly what a generator expresses and a fixed chord list cannot.

- **Bar-template reuse: CHECKED, and the fit is poor.** `BarTemplate` is a
  zod-validated persistence record bound to a song, keyed by *realized* chord
  names with tick timings. A sequence is key-independent, roman-keyed,
  note-free and unpersisted. Reusing it would mean discarding what makes a
  sequence reusable. `barTemplates` is the right *downstream consumer*, not a
  dependency. (The plan asked; the answer is no.)
- Exiting the diatonic set **wraps within the key and reports `wrapped: true`;
  it never silently modulates** — a sequence that modulated by accident hands
  back names the caller's key signature can't spell.

---

## Stage M-C — Integration (SERIAL)

**Carried over from M-B — contracts both sides designed for but neither could
complete alone** (each stream correctly declined to edit files it didn't own;
file ownership is now lifted):

- [x] **C0 — tag B4's Aug6 trio in B2's function map.** B2's exhaustive
      coverage test caught this on merge: `It6`/`Fr6`/`Ger6` didn't exist when
      B2 branched, so they were untagged. All three are **predominants** — the
      whole point of an augmented sixth is ♭6 and ♯4 expanding onto the
      dominant, and every chart edge routes them to V or the cadential ⁶₄.
      Fixed in `9f7e1cf`. *This is exactly the failure the cross-stream tests
      exist to catch.*
- [ ] **C1 — wire B4's `enharmonicPivots` into B2's `extraPivots`.** Both
      sides built to the same contract without talking:
      B2 exposes `PivotSource = (fromTonic, fromScale, toTonic, toScale) =>
      PivotCandidate[]` and reserves `PivotKind` `'enharmonic'`; B4 returns
      pivots whose `targetKey`/`targetTonic`/`targetScale` field names and
      types already match `PivotSuggestion`. **No signature changes needed on
      either side** — B2 pinned this with a contract test using a stand-in
      Ger⁶↔V⁷ source. Enharmonic pivots carry a cost surcharge so they stay
      reachable without burying smooth diatonic hinges.
- [ ] **C2 — make the minor plagal, minor deceptive and Phrygian half cadences
      ROUTABLE.** B2 reports they are detectable but not routable: the minor
      chart lacks the edges (`IVm6` appears nowhere), so `pathToCadence`
      returns `unreachable-cadence`. Needs `graphData/minor.ts` edits, which B2
      didn't own. Blast-radius rule still applies — dotted unless principal.
- [ ] **C3 — route `N6`/`Aug6` through `extraPivots`.** B2 skips them in the
      diatonic scan because `pivotSuggestions` throws on them; they should
      arrive as properly-spelled chromatic pivots instead.

**Integration proper:**

- [ ] Compose the streams: a modulation-aware, cadence-targeted path (B2) that
      is voice-leading legal (B1), metrically placed (B3), and realizable in
      four voices (`realizeProgression`, B1). Acceptance follows the audience
      ranking in the Premise: the two headline features — modulation-aware
      targeting and whole-progression realization — must work end-to-end
      before any API sugar is added.
- [ ] Decide the `nextChordDetail` surface: which of these become `opts`, which
      stay standalone. (The 0.4.0 lesson: compose first, add sugar later.)
- [ ] `chord` CLI subcommands for the new capabilities.
- [ ] Docs: extend `docs/chord-theory.md` (it now has §11 on authoring charts)
      and `docs/chord-assistance.md`.
- [ ] Version + CHANGELOG. Likely 0.6.0.

---

## Deferred — prolongation (P5)

- [?] **Hierarchical/Schenkerian structure is research-grade, not a sprint —
      but its tractable parts are no longer deferred.** The T/PD/D function
      tags land in B2 (they are what makes pathfinding goal-directed), and
      spans (A4) give a first, flat notion of "this stretch is one thing."
      What remains deferred is true recursion — a whole passage prolonging a
      single tonic, spans within spans — which a first-order Markov chain
      fundamentally cannot represent. That is its own project with its own
      plan, and it will start from tags and spans that already exist.

---

## Decisions (user, 2026-08-06)

- [x] **Target idiom: common-practice tonal harmony** — the tradition the
      charts already encode. Jazz and neo-Riemannian chromaticism are out of
      scope for this plan (the latter is a *different graph topology*, not more
      nodes, and would want its own plan).
- [x] **P2 strictness is a settable option, defaulting to report-never-block.**
      Violations are always *reported*; whether they filter or block is the
      caller's choice. Concretely:

      ```ts
      type StrictnessMode =
        | 'report'   // DEFAULT — annotate, never remove (matches contextMatch)
        | 'warn'     // annotate + sort violations last
        | 'block'    // filter out illegal moves (exercises, student work)
      ```

      Rationale: skilled composers break textbook rules deliberately, so the
      default must never hide a legal-but-unconventional move. But a pedagogy
      or engraving tool wants enforcement, and hardcoding permissiveness would
      make that impossible. Individual rules should also be toggleable (a user
      may accept hidden fifths but not parallel octaves).
