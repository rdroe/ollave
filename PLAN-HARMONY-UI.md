# Plan: Harmony panel for the bar-template editor

Status legend: `[x]` done · `[ ]` pending · `[?]` awaiting decision

**What this is.** A right-side docked panel in the redwood app's bar-template
editor (`web/src/components/ollave-subcomponents/BarTemplateEditor.tsx`)
surfacing the 0.6.0 composer features — suggestions, phrase planning,
modulation, part-writing, sequences — plus two ambitious additions the user
asked for: **explicit-voicing gestures (the whole texture family)** and a
**location strip** that lets the surrounding song serve as harmonic context.

Spans two repos: ollave (schema + helpers) and
`~/sites/rw-app/my-redwood-project` (the UI). The app pins `ollave ^0.3.18`;
nothing here works until 0.6.0 is published or linked and the dependency
bumped.

---

## Verified facts (probed 2026-08-06, before proposing)

- The editor is entirely left-anchored (`width: 'fit-content'`, grid ≈ 812px)
  — the right side is genuinely empty. One template = ONE BAR: 16 steps,
  beats at 0/4/8/12.
- Chord choice today is a flat `<Select>` over `getPhaseChordNames` — an
  unordered diatonic list with zero harmonic intelligence. This is the single
  highest-leverage replacement point.
- Key already flows in (`phaseInfo.scaleTonic/scaleName` from the live
  phase), and `resolveChordPitchesAscending` is already imported — a real
  `fromVoicing` is one call away.
- Gestures are a zod discriminated union (`source.kind: 'note' | 'chord'`,
  modes `strum`/`pluck`) — new variants are additive and old templates parse
  unchanged. `compile.ts` resolves pitches per source kind: a new kind is one
  branch (~10 lines).
- `orderPitchesForGesture` operates on a PITCH ARRAY, not a chord name — so
  existing textures work over an explicit voicing for free.
- The editor sub-app deliberately never boots the song (`SCRATCH_SONG_ID`
  sentinel, scratch playback). But `fetchSongAndTracksBySongId(songId)`
  returns `{ song, tracks, phases }` with `track.notesByBar`, whose notes
  carry `chord=`, `roman=`, `barDelay`, `groupId` tags — everything a
  read-only song mini-map needs, no mem hydration, no CLI boot.
- `previousChordNotes` (the prev-chord-group lookup) exists in
  `ollave/src/lib/addChord.ts` but is mem-coupled; a pure
  `chordContextAt(notesByBar, phaseName, barIndex)` should be extracted in
  ollave so the app stays thin.
- Placement into song bars already has a mechanism (CustomBarPanel
  arm-and-tap, instance tags, propagation). The editor writing directly into
  song bars would cross the sub-app boundary SCRATCH_SONG_ID protects —
  location selection is CONTEXT ONLY, no write-back (revisit later, marked).

---

## Decisions (user, 2026-08-06)

- [x] **Location = a GAP between bars** (cursor model, N+1 gaps per phase),
      not a bar. Unambiguous prev/next context; the final gap's "next" rows
      render grayed ("nothing follows yet"). Deferred, explicitly:
      cell-click = replace-a-bar mode, and follows-aware final-gap context
      (`phaseFollowsPhase` / loop-back supplying the next chord).
- [x] **Key policy: the location's phase key wins, with a visible badge**
      ("key: C major — from verse2; template home is A minor"). Rationale:
      an interpretation in the wrong key is the 0.4.0 borrowed-minor bug
      class — e.g. the same `E` gesture is V (the dominant) in A minor and
      NOT A NODE AT ALL in C major. This subsumes the editor's existing
      "original phase no longer exists" warning.
- [x] **Voicing textures: the whole family, not just chorale** (user
      correction). Source × texture stays orthogonal.
- [x] **Original strummed-bar data-model document — received 2026-08-06.**
      Its core: Bar / Harmony / Gesture / Attack / NoteSource as five separate
      concepts; "a bar contains gestures; a gesture contains attacks; an
      attack sounds a selected part of a voicing." The current ollave model is
      this with gesture+attack collapsed and harmony fused into the gesture.
      Part 1 is REVISED accordingly (below).

---

## Part 1 — Voicing sources and ATTACKS (revised against the original model)

The earlier "source × texture" framing conflated WHEN with HOW. Following the
original document's separation (available notes / timing / sounding):

1. **New note source** (zod-additive):
   `{ kind: 'voicing', pitches: string[], chord?: string, roman?: string }`
   — the original's explicit-pitches source, with pitch NAMES (this codebase
   speaks spelled pitches, not midi numbers) plus provenance so the panel can
   analyze what it wrote.
2. **`attacks?: Attack[]` on the gesture** — the original's attack shape:
   `{ offsetTicks, selection, action{ spreadTicks, direction, … }, velocity?,
   letRing?, durationTicks? }`. When ABSENT, the legacy mode fields behave
   exactly as today (back-compat by construction); when present, compile.ts
   emits per-attack.
3. **Spread unifies the family**: chorale = one attack, spread 0, full-bar
   duration, letRing; roll = same attack, spread ~180; strum = spread ~18.
   No "block mode" exists.
4. **Figurations are attack PRESETS, not schema**: `albertiAttacks(…)`,
   `arpUp/arpDown/arpUpDown(…)` return `Attack[]` the composer can then edit
   per-attack. Hybrids (bass-then-brush) fall out for free.

Deliberately NOT adopted in this pass: strings/frets + finger assignment
(ollave has no instrument-string model), damping/rest events, and first-class
harmony regions — noting that placed chord groups (`chord=`/`roman=` tags at
a `barDelay`) already ARE proto-regions stored as notes, and the original's
`ChordSpec.bass` / `VoicingInstruction.inversion` correspond to M-A's figured
bass. Declarative regions are the natural follow-on plan.

Voicing origins in the panel:
1. **Plan apply** — `realizeProgression` runs ONCE across the whole plan,
   sliced per bar; created templates carry the exact SATB the preview showed,
   with voice-leading continuity inherent.
2. **"Voice this"** — one click converts a chord gesture via `nearestVoicing`
   from location context, preserving texture.
3. **Hand-nudge** — stacked note chips, ±semitone/±octave per voice, live
   `checkVoiceLeading` annotations (report-never-block; amber, never removed).

Library work: zod variant · `resolvePitches` branch · block/figuration modes
· export/import round-trip free via the schema.

## Part 2 — Location strip (context, not placement)

```
├─ LOCATION (optional) ────────────────────────────────┤
│ aphrodite  ▸[Am]▸[F·Dm]▸[E]▸[∙••·]▸                  │
│ verse2     ▸[C]▸[G]▸[∙·∙]▸ …                         │
│              ▲ gap after bar 2 (of 4)                │
│ context: …F → Dm | next: E | key: A minor            │
└──────────────────────────────────────────────────────┘
```

One slim row per phase; cells show chord names when tags exist, else note
dots positioned by `barDelay/512`; carets are the selectable gaps. Selection
feeds:
- `prev` chords → `nextChordDetail` contextMatch on real music
- the previous chord group's ACTUAL voicing → `fromVoicing` (ranking) AND
  `startVoicing` (`realizeProgression`) — planned phrases physically
  voice-lead out of the existing song
- following chord → soft "leads into" check + `detectCadences` across the seam
- the location phase's key (badge policy above) + "bar k of N" hypermeter hint

## Panel sections (from the original proposal, unchanged)

1. **Context strip** — bar's chords with T/PD/D labels + `detectCadences`
2. **Suggest** — `nextChordDetail(chord, tonic, scale, { prev,
   include: ['mixture','sevenths'], rankBy: 'voiceLeading', fromVoicing })`;
   chips grouped strong/dotted/mixture; click = set selected gesture's chord
   or add at next empty beat step
3. **Plan a phrase** — cadence picker (all seven), bars, optional target key
   (`pathToCadence` / `composeModulation`); preview = SATB + metric placement
   + violations; apply = **fill this bar** (≤4 chords on beat steps) or
   **create N templates** (named `{name}-PAC-1of4`…, same phase, pattern
   inherited, chord swapped — placeable via CustomBarPanel)
4. **Patterns** — `spans` + `sequencePatterns`, `applySequence`, waivers ride
   along so the checker never red-inks shipped content

Layout: wrap existing column in a flex row; panel
`flex: 1 1 360px; min-width: 320px; max-width: 460px; position: sticky;
align-self: flex-start`.

## Honest constraints

- The app must move to ollave 0.6.0 (currently `^0.3.18`).
- Panel needs a selected-gesture concept slightly broader than
  `dialogGestureId` (which exists only while the edit panel is open).
- SATB writes are enabled by Part 1's voicing source — the earlier
  "advisory-only" limitation is REMOVED by design here.

## Phasing

1. [ ] **MVP** — panel layout + context strip + Suggest chips (~half day)
2. [ ] **Location strip** — fetch, render, gap selection, context plumbing +
       the ollave `chordContextAt` helper (~half day)
3. [ ] **Voicing source + attacks array** in ollave (schema, compile branch,
       spread unification); plan-apply writes real SATB as spread-0 attacks
       (~1–1.5 days; unblocked — document received and folded in)
4. [ ] **Phrase planner UI** wired to location context (`startVoicing` from
       the song) (~1 day)
5. [ ] **Figuration presets (attack generators) + hand-nudge editing +
       Patterns section** (~1 day)

Rejected alternative, for the record: the song page (next to ChordPanel) has
direct bar access, but the bar-template screen is where deliberate
composition happens, it has the space, and create-N-templates bridges back to
the song page through existing placement machinery.
