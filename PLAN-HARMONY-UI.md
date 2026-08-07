# Plan: Harmony panel — precise edition

Status legend: `[x]` done · `[ ]` pending · `[?]` awaiting decision

Written to be executable by an agent WITHOUT further judgment calls: every
type, signature, file path and acceptance gate is stated. When this plan and
the code disagree, PROBE the code (see Appendix P1) and report the
discrepancy — do not improvise.

**Order of work (user decision 2026-08-06): Workstream O (ollave) FIRST, then
publish 0.7.0, then Workstream A (the redwood app) against the published
package.** The app pins `ollave ^0.3.18` today.

**Publish blocker, known in advance:** `npm whoami` currently returns E401
(not logged in). Steps O8.1–O8.4 are automatable; O8.5 (`npm publish`)
requires the user to `npm login` first. Registry currently has 0.3.18.

---

## Decisions already made (do not revisit)

- [x] Location = a GAP between bars (cursor model, N+1 gaps per phase).
      Final gap's "next" rows render grayed ("nothing follows yet").
      Deferred: cell-click replace mode; follows-aware final-gap context.
- [x] Key policy: the location's phase key wins, with a visible badge.
- [x] Voicing textures: whole family via ATTACKS (below), not texture modes.
- [x] The original strummed-bar document is the reference model: a bar
      contains gestures; a gesture contains attacks; an attack sounds a
      selected part of a voicing. Ollave adopts attacks + voicing source in
      this pass; NOT adopted now: strings/frets, finger assignment,
      damping/rest events, first-class harmony regions.
- [x] Report-never-block remains the default for all rule checking.

---

# WORKSTREAM O — ollave (do first)

Branch: work directly on `master`. Baseline gates before starting: `yarn test`
green (808), `npx tsc --noEmit` → 0 errors, `yarn ts-build` and
`node build.js` succeed. If baseline fails, STOP and report.

Forbidden throughout: `git add -A` (untracked `public/transfer-songs.json`
belongs to another agent — never stage, delete or publish it); edits to
`src/lib/graphData/*` (no chart changes belong in this workstream); weakening
or deleting existing tests. Commit style: one line, `<type>: <desc>`, no
body, no attribution trailer.

## O1 — `chordContextAt` (pure song-context helper)

**File (new):** `src/lib/util/chordContextUtil.ts` + `chordContextUtil.test.ts`

The mem-coupled precedent is `previousChordNotes` in `src/lib/addChord.ts`
(read it first; replicate its semantics purely). Notes carry string tags like
`chord=Am`, `roman=Im`, `groupId=abc123`, `barDelay=128`.

```ts
export type ContextNote = { note: string; tags: string[] }
export type NotesByBarLike = Record<string, ContextNote[]>  // key: `${phase}:${index}`

export type ChordGroupRef = {
  chord: string            // value of the chord= tag
  roman: string | null     // value of the roman= tag if present
  barIndex: number
  barDelay: number         // min barDelay among the group's notes
  voicing: string[]        // the group's note names, sorted ascending by Note.midi (tonal); notes with unparsable midi sort first, stable
}

export type ChordContext = {
  prev: ChordGroupRef[]    // ALL chord groups in bars < gapIndex, chronological (barIndex asc, then barDelay asc). Caller slices.
  next: ChordGroupRef | null  // FIRST chord group in bars >= gapIndex, or null
}

export const chordContextAt = (
  notesByBar: NotesByBarLike,
  phaseName: string,
  gapIndex: number,        // 0..N: gap g sits BEFORE bar g; g === barCount means after the last bar
): ChordContext
```

Rules (exact):
- A chord group = the set of notes in one bar sharing a `groupId=` tag value,
  where at least one note carries a `chord=` tag. Notes without `groupId` or
  without any `chord=` in their group are ignored.
- Bars are scanned by key `${phaseName}:${i}` for i = 0,1,2,… until the first
  missing key AND no higher key exists (bars may be sparse: derive barCount as
  1 + max existing index for the phase; missing intermediate bars contribute
  no groups).
- `barDelay=` parse: integer; a note without it counts as 0.
- Pure: no `mem()`, no imports from `core/`, no barrel imports. Allowed
  imports: `tonal` only.

**Tests (minimum):** synthetic fixture with two phases, three bars, two chord
groups in one bar (order by barDelay); gap 0 → prev [] / next = first group;
final gap → next null; sparse bar indices; group lacking chord= ignored;
voicing ascending order incl. an unparsable note name.

**Export:** from `src/lib/index.ts` (value + all four types).

## O2 — schema: `voicing` source and `attacks`

**File:** `src/lib/barTemplates/schemas.ts`. Additions are zod-ADDITIVE; every
existing template must parse unchanged (test this: a fixture gesture built
with today's fields round-trips `gestureSchema.parse` byte-identically).

Add to `gestureSourceSchema`'s union:

```ts
z.object({
  kind: z.literal('voicing'),
  /** explicit note names WITH octaves, e.g. ['C3','C4','E4','G4'] */
  pitches: z.array(z.string().min(1)).min(1),
  /** provenance: realized chord symbol this voicing came from */
  chord: z.string().min(1).optional(),
  /** provenance: roman at creation time */
  roman: z.string().min(1).optional(),
})
```

New schemas (place near `rollPatternSchema`; export all values AND inferred
types `NoteSelection`, `AttackAction`, `Attack`):

```ts
export const noteSelectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({ kind: z.literal('note-indexes'),
             indexes: z.array(z.number().int().min(0)).min(1) }),
  z.object({ kind: z.literal('bass'),
             count: z.number().int().min(1).optional() }),   // absent = 1
  z.object({ kind: z.literal('treble'),
             count: z.number().int().min(1).optional() }),   // absent = 1
])

export const attackActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('strum'),
             direction: z.enum(['down', 'up', 'custom']),
             spreadTicks: z.number().int().min(0),
             spreadShape: rollPatternSchema.optional(),      // absent = 'even'
             customOrder: z.array(z.number().int().min(0)).optional() }),
  z.object({ kind: z.literal('pluck') }),
])

export const attackSchema = z.object({
  offsetTicks: z.number().int().min(0),   // relative to the gesture's start tick
  selection: noteSelectionSchema,
  action: attackActionSchema,
  velocity: z.number().int().min(0).max(127).optional(),  // absent = gesture.velocity
  durationTicks: z.number().int().positive().optional(),  // absent = gesture.durationTicks
  letRing: z.boolean().optional(),
})
```

On `gestureSchema` add: `attacks: z.array(attackSchema).min(1).optional()`
with this doc comment: when `attacks` is present, the legacy fields `mode`,
`spread`, `scopeSteps`, `rollPattern`, `pluckIndex`, `toneOrder`,
`mutedToneIndices` are IGNORED (gesture-level `velocity`/`durationTicks`
remain the attack defaults); when absent, behavior is exactly today's.

## O3 — compile: the attacks branch

**File:** `src/lib/barTemplates/compile.ts`. BEFORE editing, run the golden
capture (Appendix P2). Reuse `rollPositionFraction` — do not duplicate it.

In `compileGesturesToNotes`, when `gesture.attacks` is present, take a new
branch with these EXACT semantics:

1. **Ascending source pitches** `P`:
   - `voicing` source → `pitches` sorted ascending by `Note.midi` (tonal);
     unparsable → CompileError for the gesture (non-fatal, matches bad-chord
     handling).
   - `chord` source → existing resolution (`resolveChordPitchesAscending`
     with the gesture octave), unchanged.
   - `note` source → single-element array.
2. **Per attack**, in array order:
   - `base = gestureStartTick + attack.offsetTicks` where `gestureStartTick =
     startStep * stepTicks(barSizeMultiplier)` (same as legacy).
   - **Selection → subset S of P (indices into P):** `all` → every index;
     `note-indexes` → apply the SAME defense as `toneOrder` (drop duplicates
     and out-of-range; if empty after defense → CompileError for this
     gesture, non-fatal); `bass` → the lowest `count ?? 1` indices;
     `treble` → the highest `count ?? 1` indices.
   - **Action `pluck`:** every note of S sounds at `base` (simultaneous; a
     multi-note S is a pinch).
   - **Action `strum`:** order S by `direction` (`down` = ascending, `up` =
     descending, `custom` = `customOrder` with the toneOrder defense, then
     any missing indices appended ascending). Note i of n sounds at
     `base + rollPositionFraction(spreadShape ?? 'even', i, n) * spreadTicks`.
     `spreadTicks: 0` → all at `base`.
   - **Velocity** = `attack.velocity ?? gesture.velocity`.
   - **Duration**: if `letRing === true` → `barTicks − (relative attack
     tick)`, clamped to ≥ 1, where `barTicks = BASE_BAR_TICKS *
     barSizeMultiplier`; else `attack.durationTicks ?? gesture.durationTicks`.
   - Tags identical to the legacy path, including `GESTURE_ID_TAG`.
3. Rounding: `Math.round` final ticks (matches legacy roll behavior — verify
   in golden capture; if legacy uses floor, match floor and note it).

**Tests (minimum):** golden legacy equality (P2); voicing+single spread-0
attack = chorale (all pitches at base, full remaining bar with letRing);
spread 180 decelerating roll ordering; pluck bass(1)+strum treble(3) hybrid
(the bass-then-brush case); note-indexes defense to empty → CompileError and
other gestures still compile; letRing duration math at barSizeMultiplier 1
and 2.

## O4 — figuration presets

**File (new):** `src/lib/barTemplates/attackPresets.ts` + test. Pure,
deterministic, no imports beyond `./schemas` types.

```ts
export const blockAttack = (o?: { velocity?: number; durationTicks?: number;
  letRing?: boolean }): Attack[]
// [{ offsetTicks: 0, selection: {kind:'all'},
//    action: {kind:'strum', direction:'down', spreadTicks: 0}, ...o }]

type ArpOpts = { count: number; subdivisionTicks: number; velocity?: number }
export const arpUpAttacks = (o: ArpOpts): Attack[]
// k-th attack (k = 0..count-1): offset k*subdivisionTicks, pluck,
// selection note-indexes [k mod voicingSizeAgnostic]: cycle 0,1,2,… — since
// presets cannot know the voicing size, cycle indexes 0..3 and rely on the
// compile-time defense to drop out-of-range (document this explicitly).
export const arpDownAttacks = (o: ArpOpts): Attack[]   // cycle 3,2,1,0
export const arpUpDownAttacks = (o: ArpOpts): Attack[] // 0,1,2,3,2,1,0,1,…
export const albertiAttacks = (o: { cycles: number; subdivisionTicks: number;
  velocity?: number }): Attack[]
// classical low–high–middle–high per cycle: indexes [0],[2],[1],[2],
// 4 attacks per cycle, offsets consecutive multiples of subdivisionTicks.
// Intended for 3+-note voicings; smaller voicings degrade via the defense.
```

**Export** everything from the barTemplates barrel (`src/lib/barTemplates/`
— locate its index/barrel file; the app imports `'ollave/lib/barTemplates'`).

## O5 — exports, docs, changelog

- `src/lib/index.ts`: `chordContextAt` + types (from O1).
- barTemplates barrel: `attackSchema`, `noteSelectionSchema`,
  `attackActionSchema`, types `Attack`/`NoteSelection`/`AttackAction`, all
  presets.
- `CHANGELOG.md` under `## Unreleased` (ADD; do not clobber existing
  entries): the voicing source, attacks, presets, `chordContextAt` — written
  for a library consumer, with one worked attack example.
- `docs/chord-assistance.md`: one short section "Voicings and attacks in bar
  templates" — every example must be executed real output (extend
  `src/lib/docExamples.test.ts` accordingly).

## O6 — verification gates (all must pass; report each)

1. `yarn test` — fully green (808 baseline + new; expect ≥ 850).
2. `npx tsc --noEmit` — 0 errors.
3. `yarn ts-build` then `node build.js` — both succeed.
4. `npx madge --extensions ts --circular src/lib/barTemplates/compile.ts
   src/lib/util/chordContextUtil.ts src/lib/barTemplates/attackPresets.ts`
   — no NEW cycles (baseline has 18 legacy cycles; count must not grow).
5. Golden legacy-compile equality test passing (P2).
6. `git status` — clean except `?? public/transfer-songs.json`.

## O7 — version

- `package.json` version → **0.7.0**.
- CHANGELOG: retitle `## Unreleased` to `## 0.7.0` (it now contains the
  0.5.x/0.6.0-era entries plus O-work; one release heading is fine — note at
  its top that it aggregates everything since 0.3.18).
- Commit.

## O8 — publish (final step; O8.5 needs the user)

1. Append `public/transfer-songs.json` to `.npmignore` (it currently contains
   only `public/audio`).
2. `npm pack --dry-run 2>&1 | head -60` — verify: `public/js/**` present;
   `public/transfer-songs.json` ABSENT; no `node_modules`; tarball < 40 MB.
3. `npm view ollave version` → expect `0.3.18` (guard against a surprise
   intermediate publish).
4. Re-run O6 gates.
5. `npm publish` — **currently blocked by E401; the user must `npm login`
   first.** If auth fails, stop and report; do not attempt login yourself.
6. Post-publish: `npm view ollave version` → `0.7.0`.

---

# WORKSTREAM A — redwood app (after 0.7.0 is on npm)

Repo: `~/sites/rw-app/my-redwood-project`. All paths below relative to
`web/src`. The other agent has previously worked in this repo — before
starting, run `git -C ~/sites/rw-app/my-redwood-project status --short` and
report anything staged/modified that you did not create.

## A1 — dependency

- `web/package.json`: `"ollave": "^0.7.0"`; run the repo's install (yarn);
  verify `node_modules/ollave/package.json` says 0.7.0 (NOTE: install
  location is the PROJECT ROOT `node_modules/ollave`, not `web/node_modules`).
- Gate: app dev server boots; `/ollave` page loads; existing bar editor
  unchanged.

## A2 — HarmonyPanel MVP (context strip + Suggest)

**New file:** `components/ollave-subcomponents/HarmonyPanel.tsx`.
**Anchor:** in `BarTemplateEditor.tsx`, the main return is
`<Box sx={{ padding: 3 }}>` (~line 650). Wrap: outer
`<Box sx={{ display:'flex', gap:3, alignItems:'flex-start' }}>` containing
(1) the existing content Box unchanged, (2)
`<HarmonyPanel ... />` with
`sx={{ flex:'1 1 360px', minWidth:320, maxWidth:460, position:'sticky', top:16 }}`.

Props: `{ template, gestures, phaseInfo, selectedGestureId, onPickChord }`.
Add `selectedGestureId: string | null` state in the editor; set it wherever
`openEditDialog` sets `dialogGestureId`, but DO NOT clear it on dialog close.

Context strip: list the bar's chord gestures in `startStep` order → for each,
`functionOf(roman)` label (roman via the graph: `chordGraphCreate(tonic,
scale)` then `graph[chordName]?.roman ?? null`); run
`detectCadences(chordNames, tonic, scale)` and render its labels + confidence.

Suggest: subject = selected gesture's chord, else the LAST chord gesture.
Call `nextChordDetail(`${chord},3`, tonic, scale, { prev, include:
['mixture','sevenths'], rankBy:'voiceLeading', fromVoicing })` where `prev` =
the bar's earlier chord names and `fromVoicing` =
`resolveChordPitchesAscending(chord, ctx)` (already imported by the editor).
Wrap in try/catch → on throw render "«chord» is not part of the «key» map".
Render chips grouped strong / dotted / mixture, label
`${name} ${roman} d${distance}`. Click → if a gesture is selected, replace
its `source` with `{ kind:'chord', chordName }` (preserve everything else);
else append a new gesture at the FIRST empty beat step in [0,4,8,12] with the
add-dialog defaults (probe them in `openAddDialog`); if all four beat steps
are occupied, disable add with a tooltip.

Gate: panel renders; suggestions match `chord next <X> --detail` CLI output
for the same key; clicking chips mutates gestures through the SAME state path
the dialog uses (autosave fires).

## A3 — Location strip

**New file:** `components/ollave-subcomponents/SongLocationStrip.tsx`,
rendered at the top of HarmonyPanel.

- Data: `fetchSongAndTracksBySongId(songId)` once on mount (it is read-only;
  do NOT call loadAndInit* — the editor must stay unhydrated). `notesByBar`
  comes from `tracks[0].notesByBar`; phases from `phases`.
- Render one row per phase (order as returned): phase name, then for bar i =
  0..N−1 a cell, with selectable GAP carets before bar 0, between bars, and
  after bar N−1. Cell content: distinct chord groups' `chord=` names joined
  with `·` (group detection identical to `chordContextAt`'s rules), else note
  dots absolutely positioned at `left = barDelay/512 * 100%`.
- Selection state `{ phaseName, gapIndex } | null` (single global selection).
  On select: `chordContextAt(notesByBar, phaseName, gapIndex)` → show
  "context: …X → Y | next: Z | key: <tonic scale>". Final gap: next-dependent
  rows render grayed with "nothing follows yet".
- Key policy: when a location is selected, THE LOCATION PHASE'S key drives
  every panel computation; show badge
  `key: C major — from verse2 (template home: A minor)` whenever it differs
  from `phaseInfo`. No selection → `phaseInfo` as today.
- Feed `prev` (chord names, ending with the location's `prev` tail) and
  `fromVoicing` (= `prev[last].voicing`) into A2's Suggest call.

Gate: selecting a gap visibly changes Suggest output; badge appears iff keys
differ; deselecting restores home-key behavior.

## A4 — Plan-a-phrase section

- Controls: cadence (`'PAC'|'IAC'|'half'|'deceptive'|'plagal'|
  'phrygian-half'|'evaded'`), bars (2–8, default 4), target key (default
  "stay"; options from `conventionalKeys`).
- Stay: `composeProgression(start, cadence, bars, tonic, scale,
  { startVoicing })`; modulate: `composeModulation(...)` — `start` = location
  `prev` chord if a location is selected else the bar's last chord;
  `startVoicing` = location prev voicing when available.
- Render ranked plans (roman summary + cost; pivot chip with `explanation`
  when modulating). Expand = per-bar table: chord, roman, function, SATB
  voicing, violations (amber annotate ONLY — never filtered).
- **Apply / fill this bar** (enabled when plan length ≤ 4): REPLACE the
  template's chord gestures with one gesture per plan chord at steps
  0/4/8/12: `source: { kind:'voicing', pitches: <that bar's SATB>, chord,
  roman }`, `attacks: blockAttack({ letRing: true })`, velocity
  DEFAULT_GESTURE_VELOCITY, durationTicks 128 (attacks letRing overrides).
  Behind a confirm dialog listing what is replaced.
- **Apply / create N templates**: for each plan chord i, `saveBarTemplate`
  with name `${template.name}-${cadence}-${i+1}of${N}` (slug-unique — probe
  `slugifyTemplateName` collision behavior first), phaseName = location's
  phase (else template's), `barSizeMultiplier` copied, gestures = the single
  voicing gesture above, compiledNotes = compile result. Show links/toasts to
  the created templates.

Gate: a 4-bar PAC plan applied to the bar plays back as block chorale SATB in
the editor's existing preview; created templates appear in CustomBarPanel for
that phase and are placeable.

## A5 — Figurations, hand-nudge, Patterns

- Figuration picker on any voicing-source gesture: `block / arp up / arp
  down / up-down / Alberti` → replaces `attacks` via the preset with
  `subdivisionTicks = stepTicks(barSizeMultiplier)`, count = 4 (arp) /
  cycles = 4 (Alberti).
- Hand-nudge: selected voicing gesture renders stacked note chips (low→high);
  per-chip ▲/▼ semitone and ±octave; after each change run
  `checkVoiceLeading(prevVoicing, thisVoicing)` and, when a next voicing
  exists, `(thisVoicing, nextVoicing)`; render violations amber inline
  (report-never-block).
- Patterns section: `spans` + `sequencePatterns` lists; `applySequence` for
  sequences; both feed the SAME two apply targets as A4. Waived rules of the
  applied span accompany any subsequent `checkVoiceLeading` calls
  (`spanWaivedRules`).

---

# Appendix — procedures

**P1 Probe procedure.** Before pinning ANY expectation: write a scratch
vitest under `src/lib/__probe__.test.ts` (ollave) or a scratch node script
(app) that PRINTS the real value; run it; copy the printed value into the
test/plan; DELETE the scratch. Never assume a chord spelling, tick value, or
suggestion list.

**P2 Golden legacy-compile capture.** BEFORE touching compile.ts: write a
probe compiling 4 fixture gestures through the CURRENT code — (a) tight
strum chord, (b) rolled strum with rollPattern 'decelerating' + scopeSteps 2,
(c) pluck with pluckIndex 1, (d) note source — and print the exact
`CompiledNote[]`. Pin those arrays in a permanent test
(`compileLegacyGolden.test.ts`). They must still pass after O3 with `attacks`
absent. This is the no-regression proof.

**P3 Cycle check.** After creating any new module:
`npx madge --extensions ts --circular src/lib/<new>.ts`. Baseline is 18
legacy cycles; the count must not grow. If a new cycle appears, break it by
moving the shared type to a zero-import module (precedent:
`chordSuggestion.ts`, `graphData/types.ts`).

**P4 Blast radius.** This workstream must not change ANY chart or suggestion
output: `nextChord`/`nextChordDetail` for every node in A minor and C major,
before vs after, must be byte-identical (probe both, diff, report).

**P5 Commit style.** One line, `<type>: <short description>`, nothing else.
