# Changelog

All notable changes to this project are documented here.

## 0.7.0

_Aggregates everything since 0.3.18 — the last version published to npm — in
one release heading: the 0.5.x/0.6.0-era part-writing assistant work below,
plus the bar-template voicing/attacks/`chordContextAt` work above it._

### Added — bar templates: voicing sources, attacks, and `chordContextAt`

Bar templates (`ollave/lib/barTemplates`) can now source a gesture's pitches
from an explicit `voicing` (with provenance — the chord/roman it was realized
from) instead of only a chord name to resolve at compile time, and can time
and select those pitches with `attacks`: an ordered list of
`{ offsetTicks, selection, action }` entries, each picking a subset of the
gesture's ascending source pitches (`all` / `note-indexes` / `bass` /
`treble`) and sounding them together (`pluck`) or spread out (`strum`, with
`spreadTicks` and an optional roll `spreadShape`). A gesture with `attacks`
present ignores the legacy `mode`/`spread`/`scopeSteps`/`rollPattern`/
`pluckIndex`/`toneOrder`/`mutedToneIndices` fields; a gesture without
`attacks` compiles exactly as it always has. Entirely additive — every
existing template parses and compiles unchanged (verified by a legacy golden
compile test pinned before this change).

`attackPresets.ts` builds common `attacks` arrays without knowing the
eventual voicing size: `blockAttack` (chorale — every voice together),
`arpUpAttacks` / `arpDownAttacks` / `arpUpDownAttacks` (cycling
note-indexes), `albertiAttacks` (classical low-high-middle-high). Worked
example:

```js
import { arpUpAttacks, compileGesturesToNotes } from 'ollave/lib/barTemplates'

const gesture = {
  id: 'g1', startStep: 0,
  source: { kind: 'voicing', pitches: ['C3', 'C4', 'E4', 'G4'], chord: 'C', roman: 'I' },
  mode: 'strum', direction: 'down', spread: 'tight',
  velocity: 90, durationTicks: 128,
  attacks: arpUpAttacks({ count: 4, subdivisionTicks: 32 }),
}
compileGesturesToNotes([gesture], ctx).notes.map(n => n.note)
// ['C3', 'C4', 'E4', 'G4'] — one pluck per 32-tick step, ascending
```

Also new: `chordContextAt(notesByBar, phaseName, gapIndex)` (from
`ollave/lib`), a pure song-context helper for a harmony-assistance UI to ask
"what chord comes before/after this point in the song" — a gap-based cursor
model (gap `g` sits before bar `g`), returning every prior chord group
chronologically and the first chord group at or after the gap. Pure: no
`mem()`, safe to call from outside a loaded song.

### Added — the part-writing assistant

This is the largest release since 0.4.0 and it changes what the library is *for*.
Before it, every question was a variation on "what may follow this chord?".
Now you can say **"get me from A minor to a perfect authentic cadence in C major
in four bars, show me the hinge, write it in four voices, and tell me where the
bars fall"** — and get an answer.

Entirely additive. No breaking changes, and `nextChord` output is byte-identical
in every key, verified by probing every node in A minor and C major before and
after every change that touched a chart.

#### Harmonic function — T, PD, D

Every roman in both charts is tagged tonic, predominant or dominant
(`functionOf`, `functionMap`, `transitionCost`). Three letters, and they are
what makes graph search *goal-directed* rather than merely legal: without them
the cheapest four-bar route from I to a perfect authentic cadence is
`I - I - I - V - I`.

Tags are keyed by **roman, not scale degree**, settled by probe: `A7` in C major
sits on degree 6 (which reads as tonic) but is `V7/IIm`; `G#dim` is chromatic, so
degree has no answer for A minor's strongest dominant. Three judgement calls are
documented — `V64` is D (spells a tonic, functions as a dominant), minor `VII` is
T (no leading tone), `V/V` is PD (locally dominant, functionally predominant).
The augmented-sixth trio is PD, all three.

#### Cadences, in both directions

Seven types, authored **once** as spans and read two ways — `pathToCadence`
routes toward them, `detectCadences` matches against them, so the generator and
the analyst cannot disagree about what a deceptive cadence is: `PAC`, `IAC`,
`half`, `deceptive`, `plagal`, `phrygian-half`, and the **evaded** cadence
(`V⁴₂ → I⁶`), the phrase-*extension* device — "how do I avoid closing yet" is as
useful to a composer as "how do I close".

```js
pathToCadence('C', 'PAC', 4, 'C', 'major').paths[0].summary  // 'I - IIm - V - I'
pathToCadence('Am', 'phrygian-half', 3, 'A', 'minor').paths[0].summary
// 'Im - IVm6 - V'
```

`detectCadences` labels music **you already wrote**, with a confidence and a
reason. A wrong label being worse than a missing one, thin evidence *downgrades*
the label instead of withholding it: `V–I` with no soprano comes back as `IAC` at
`medium` because "no soprano supplied, so it cannot be confirmed as perfect".
`vii°→i` is left deliberately unlabelled rather than given invented vocabulary.

Detection **does not consult the chart's edges**, deliberately — it matches
romans, so analysis is not limited to what the generator happens to offer.

#### Modulation-targeted pathfinding

The headline feature. `pathThroughModulation` routes through a pivot to a cadence
in another key, and names the hinge **in both keys**, because that double reading
*is* the modulation:

```js
pathThroughModulation('Am', 'PAC', 4, 'A', 'minor', 'C', 'major').plans[0]
// summary: 'Im - IVm=IIm - V - I', pivot: Dm — 'IVm' here, 'IIm' there
```

Pivots are ranked by how good a *hinge* they are before total path cost, because
the composer asking for a modulation is choosing the joint — the surrounding
filler is what they will rewrite anyway. A predominant in the target key costs 0
(the new key can immediately set up its own cadence), a tonic 2, a dominant 3.

#### Chromatic pivots — modulations with no shared diatonic chord

C major and D♭ major share **no diatonic chord at all**. `chromaticPivotSources`
supplies the hinges that make such modulations possible:

```js
pathThroughModulation('C', 'PAC', 4, 'C', 'major', 'Db', 'major',
                      { extraPivots: chromaticPivotSources }).plans[0].summary
// 'I - IIm - Ger6=V7 - I'
```

Three families: **Ger⁶ ↔ V⁷** (the German sixth of C respelled as the dominant
seventh of D♭ — the most famous enharmonic modulation in the repertoire, and
available from the German alone, since only it has a perfect fifth above its
bass), **the four rotations of a diminished seventh**, and the **Neapolitan**,
which is chromatic at home and a plain diatonic triad in six other keys.

Chromatic pivots pay a **cost surcharge** (+3 enharmonic, +3 Neapolitan, +4
chromatic mediant) so they stay reachable without burying a smooth diatonic
hinge. A minor → C major still leads with `Dm`.

#### Voice-leading legality and four-voice realization

`realizeProgression` writes a **whole progression** in four voices — a beam
search over doublings, orderings and octaves, scored so that no amount of
smoothness buys a single error:

```js
realizeProgression(['C','F','G','C'], { key: { tonic: 'C', mode: 'major' } })
  .chords.map((c) => c.voicing)
// [['C3','C4','E4','G4'], ['F3','C4','F4','A4'],
//  ['G3','B3','D4','G4'], ['C3','C4','E4','G4']]
```

`checkVoiceLeading` returns **typed violations, not booleans** — fourteen rules,
each citing Aldwell & Schachter, Piston or Fux: parallel fifths and octaves,
hidden/direct motion into a perfect interval on the outer voices, unequal fifths,
unresolved chordal seventh, doubled and unresolved leading tone, augmented
second, voice crossing and overlap, spacing, and the cadential ⁶₄'s defining
⁶₄→⁵₃ resolution.

**The default never removes a suggestion.** `strictness` defaults to `'report'`;
`'warn'` sorts violations last and `'block'` filters. Individual rules toggle, and
`unequal-fifths` and `parallel-fourths` are **off by default** because both are
widely tolerated and a false positive is the first thing an expert would see.

**Key-dependent rules are skipped, not guessed,** without `opts.key`. For this
audience a wrong rule is worse than a missing one.

**Spacing is a search preference, not a rule.** A probe caught the realizer
opening on `C3 E4 G4 C5` — legal, smooth, and nobody writes it. Making that a
violation would have flagged legitimate open-position writing in a composer's own
music.

#### Waivers — the tool does not red-ink its own content

Fauxbourdon *is* parallel motion. Spans declare the rules they license
(`spanWaivedRules`), the checker honours them (`waivedRules`), and because a
waived rule costs **zero inside the search**, waivers *steer* the realizer rather
than merely hiding its complaints.

#### Harmonic rhythm and metric weight

`metricWeight` reads strong/weak position from the timing data that already
existed; `suggestHarmonicRhythm` proposes a placement and explains its reasoning.
Five ordered levels on a flat Lerdahl–Jackendoff grid. Honestly scoped: no
hypermeter, no grouping structure, no preference rules.

Two findings worth keeping. **`tickCounts[BAR]` (512) is the engine's fixed
container, not the meter's length** — a 3/4 bar is 384 ticks, and using the
container puts the next downbeat in the wrong place, hence `barTicksOf(meter)`.
And **metric fit must be relative, not absolute**: beat 3 → beat 4 is a textbook
cadential ⁶₄ though both are absolutely strong.

#### Chromatic vocabulary

The augmented sixth, previously one generic `Aug6` node, is now the
**Italian / French / German** trio, verified across 17 tonics in flat and sharp
keys with the outer interval pinned at 10 semitones so it can never respell into
a ♭7. `Ger6 → V` is dotted while `It6/Fr6 → V` are strong: the German's perfect
fifth makes a direct move to a root-position V parallel fifths, so its strong
path is through the cadential ⁶₄.

**`Aug6` aliases the ITALIAN**, reversing the original plan. Two facts overrode
frequency: `Aug6` appears in saved songs, so aliasing the German would silently
turn three notes into four in files on disk; and an existing test pins
`Aug6('A','minor') === ['F','A','D#']` as a guard against a double-flattening bug
fixed once before. Verified byte-identical in A minor and C/E♭/F♯/D♭ major.

Also: `chromaticMediants` and `commonToneDim7s`, both additive non-graph channels
on the `mixtureSuggestions` model. A common-tone °7 is told from a leading-tone
°7 by common-tone **count at runtime**, which surfaced a real fact: a minor key
gets only `♯v°7`, because raising a minor triad's root leaves one common tone,
not two.

#### Sequences that generate

`applySequence` realizes a pattern rather than replaying a fixed chord list:
descending fifths (diatonic and applied), ascending and descending 5-6, and
monte/fonte/ponte. Transposition is in **signed scale degrees**, not intervals —
the varying interval quality is the defining feature of a diatonic sequence, not
a defect. Monte and fonte differ only in the *sign* of the transposition over an
identical applied-dominant unit.

A sequence that runs past the end of the diatonic set **wraps within the key and
reports `wrapped: true`; it never silently modulates.**

#### The minor chart gains six cadence edges

Three cadences were detectable but not **routable**, because the moves they are
made of had no edge: `IVm → Im` (plagal), `V → VI` (deceptive), and `IVm⁶ → V`
(Phrygian half — `IVm6` appeared nowhere in the chart at all). Added, with their
seventh-chord mirrors `V7 → VI` and `IVm7 → Im` and the `Im → IVm6` edge that
makes a three-bar Phrygian half cadence reachable.

All six arrive **dotted**, which is the blast-radius rule and is also the honest
grading: a predominant's principal motion is to the dominant and a dominant's is
to the tonic; the plagal close is a codetta after that and the deceptive close is
a deliberate refusal of it. `nextChord` is byte-identical across every node in
both keys. All seven cadence types are now routable in minor.

#### `composeProgression` — all of it in one call

```js
composeProgression('C', 'PAC', 4, 'C', 'major')
composeModulation('C', 'PAC', 4, 'C', 'major', 'Db', 'major')
composeSpan(spanById('fauxbourdon'), 'C', 'major')
```

Each returns bars carrying the roman, the realized chord, the figure, the
function tag, a four-voice voicing, its metric placement and any violations.
Chromatic pivots are on by default in `composeModulation`, since the modulations
you most want help with are the ones a diatonic scan cannot find.

Two translations live here and nowhere else, both found by probe:

- **Chord-function node names become realizable chords.** `V64`, `N6` and the
  augmented sixths are chart nodes, not chord symbols; handed straight to
  `realizeProgression` they stop it dead. `V64` becomes the tonic triad in ⁶₄,
  `N6` the ♭2 major triad in ⁶ — and the caller is *told*, in `notes`.
- **Augmented sixths are voiced from their literal notes.**
  `Chord.detect(['F','A','D#'])` returns `['F7no5']`, respelling D♯ as E♭ and
  turning an outward-resolving augmented sixth into a dominant seventh. So no
  chord symbol is invented for them: `chord` is `null` and the voicing is exact.

**Nothing was folded into `nextChordDetail`.** Its options are sugar over
functions answering *the same* question ("what may follow this chord"); a
four-voice phrase plan is a different question, taking a goal and a length and
returning bars. The composed calls are their own entry points and every piece
they compose stays importable alone.

#### CLI

Four new `chord` subcommands: `cadence`, `modulate`, `realize` and `analyze`.

```
$ chord modulate C --key "Db major" --tonic C --scale major
key       C major -> Db major
summary   I - IIm - Ger6=V7 - I
pivot     Ger6 = Ab7  Ger6 / V7  (enharmonic, bar 3)
bars      I         C      53  T  C3 E3 E4 G4          b0+0 downbeat
          IIm       Dm     53  PD D3 A3 D4 F4          b0+128 beat
          V7        Ab7    53  D  Ab2 Ab3 C4 Eb4       b0+256 secondary
          I         Db     53  T  Db3 Ab3 Db4 F4       b0+384 beat
legal     no voice-leading violations
```

#### Everything is honestly scoped

No function added in this release throws on a request it cannot satisfy. An
unreachable cadence, a cadence that does not exist in the mode, a chord that
cannot be voiced, a key with no chart — each returns a result with a machine-
readable reason and a sentence explaining it. `pathToCadence('C',
'phrygian-half', 4, 'C', 'major')` says the device is minor-only *and why*.

### Added — inversions, figured bass, and the span schema

**A chord can now say which note is in its bass.** Before this the data model
had no notion of a bass at all: a chord was a pitch-class set, so inversions
lived only in the voicing layer, where `nearestVoicing` would *pick* one but
nobody could *ask* for one. That was the biggest gap in the model, because a
bass line is a melody — a composer thinks `I–I⁶–IV–V⁴₃–I⁶`, not "I then IV then
V".

**The schema is a structured field, not a naming convention.** A chart edge is
now `string | { chord, figure }`. A bare string still means root position and is
still the normal form, so every edge authored before this change takes a
byte-identical path. Slash names (`C/E`) were rejected because `/` already means
tonicization here (`V7/III`) and `Chord.get('C/E')` returns no notes; a suffix
convention (`I6`) was rejected because it collides with real chord suffixes
(`C6` is a sixth chord, `V64` is already a function-name node).

**The figured-bass vocabulary** is `6`, `64`, `7`, `65`, `43`, `42` (plus `53`
for explicit root position), each naming which chord tone is in the bass:

| Figure | Bass | | Figure | Bass |
|---|---|---|---|---|
| `6` | third | | `65` | third |
| `64` | fifth | | `43` | fifth |
| `7` | root | | `42` | seventh |

Unicode spellings (`⁶`, `⁶₄`, `⁶₅`, `⁴₃`, `⁴₂`) are accepted as input and
normalized; ASCII is what's stored. The figure→bass mapping indexes into the
chord's own note list rather than transposing an interval, which keeps spelling
exact in every key — `bassOf('Db7', '42')` is `Cb`, not `B`; `bassOf('G#7',
'65')` is `B#`, not `C`.

**New suggestion fields.** `ChordSuggestion` gains optional `figure` and `bass`.
They are **absent — not `undefined`** — on root-position suggestions, so every
suggestion produced before this change serializes identically. `name` stays the
plain chord symbol (`'G7'`, never `'G7/B'`) because the name is the graph's key;
`roman` carries the figured roman (`V65`, not `V765` — a seventh-chord figure
absorbs the `7`, as it does on the page).

**New chart edges**, all `dotted`: `I⁶`, `V⁶`, `vii°⁶`, and `V⁶₅`/`V⁴₃`/`V⁴₂`,
in both charts. `V⁴₂ → I⁶` gets its own edge because the chordal seventh in the
bass *must* resolve down by step, so it can only resolve to a first-inversion
tonic.

**`nextChord` is byte-identical**, verified by probing every node in A minor and
C major before and after. Every inversion edge is dotted, the same rule that
made the sevenths promotion non-breaking. `nextChordDetail` lists grow, entirely
in the dotted layer, and seeded walks shift for a given seed.

One consequence worth flagging: **a chord name is no longer unique in a
suggestion list.** `Am` appears as `Im` and again as `Im⁶` — same name,
different bass, different chord. Code that dedupes suggestions should key on
`(name, figure)`, which is what the graph now does internally.

**`parseChordCsvArg` accepts a figure** as a fourth, optional argument:
`parseChordCsvArg('C,3', 'C major', undefined, { figure: '6' })` places
`E3 G3 C4` and tags `figure=6` / `bass=E`. Existing two- and three-argument
calls are untouched. When a figure and smooth voicing are combined the figure
decides the inversion and smoothing only picks the octave.

**Spans — a shared schema for multi-chord idioms.** Some devices aren't a chord
or an edge but an ordered pattern with conditions: a passing ⁶₄, a pedal ⁶₄ and
a cadential ⁶₄ all contain the *same sonority*, distinguished only by the
surrounding bass and the metric position, which no first-order edge can carry.
`HarmonicSpan` is one type for all of them — roman-keyed steps plus optional
bass/soprano/metric conditions and per-rule waivers. Ships with `cadential-64`,
`passing-64`, `pedal-64`, `lament-bass`, `descending-bass-idiom` and
`fauxbourdon`.

Spans are a **parallel, additive channel** — `nextChord` and `nextChordDetail`
never consult them — so adding the library cannot change any existing result.
Span **conditions are declared but not yet evaluated**; they are authored now so
the streams that will evaluate them inherit real content. Span **waivers are
live data**: `fauxbourdon` licenses the parallel motion it is made of, so a
future part-writing checker won't flag the library's own content.

**`V64`, `N6` and `Aug6` all stay, as documented aliases** — one policy for all
three. `V64` is expressible as `I⁶₄` and `N6` as `♭II⁶`, but `Aug6` genuinely
isn't: it's `♭6–1–♯4`, with no fifth and an augmented sixth above the bass
instead of stacked thirds, so there's no root to invert and no chord tone for a
figure to select. Retiring the two that convert would leave the third as a lone
special case, and would break saved songs (`isChordCsvArg('V64,3')` is `true`
today). The figured forms are valid chart edges as well — this adds a way to
spell these, it doesn't remove one.

New exports from `ollave/lib`: `bassOf`, `parseFigure`, `figuredRoman`,
`figuredVoicings`, `figureBassIndex`, `figureArity`, `figureFitsChord`,
`figureLabel`, `FIGURES`, `isFiguredChord`, `edgeChord`, `edgeFigure`, `spans`,
`spansOfKind`, `spanById`, `spanRomans`, `spanWaivedRules`, and the types
`Figure`, `FiguredChord`, `ChartEdge`, `HarmonicSpan`, `SpanKind`,
`SpanConditions`, `LineCondition`, `MetricCondition`, `RuleWaiver`.

### Added — diatonic seventh chords, as first-class chart nodes

**Diatonic sevenths are now nodes in the chord charts.** `nextChordDetail`
offers them wherever they're reachable, without opting in; they appear in the
graph itself, with their own outgoing edges.

Into major: `Imaj7`, `IIm7`, `IVmaj7`, `V7`, `VIIm7b5`.
Into minor: `Im7`, `IIm7b5`, `IVm7`, `V7`, `VIIdim7`.

Three rules govern them, stated in full in the chart headers:

1. **A seventh sits beside its triad, never replacing it.** `nextChord('Am,3',
   'A', 'minor')` still returns `Dm`, not `Dm7`. Both chords are valid and the
   triad stays the principal motion.
2. **A seventh's outgoing edges mirror its triad's**, because adding a seventh
   doesn't change a chord's function. `V7` therefore inherits V's dotted
   Picardy third (minor) and deceptive cadence (major) alongside its strong
   resolution to the tonic.
3. **A seventh is reached over a `dotted` edge**, wherever its triad is
   reached — including `V7`. Sevenths are colour on top of the principal
   motion, not a competing one.

**Rule 3 is what makes this non-breaking.** `nextChord` returns only strong
edges, so its output is byte-for-byte identical to before across every node in
both charts — verified by probing all 40 pre-existing nodes. `nextChordDetail`
lists grow, by 44% on average for A minor and C major combined, entirely in
the dotted layer. Callers that render dotted edges differently (or drop them)
need no change; callers that render everything will see more chords.

**`seventhSuggestions` and `seventhOf` remain exported and unchanged in
signature.** `seventhSuggestions` now answers a question the graph can't —
*what sevenths does this key have*, independent of the current chord — which is
what a palette or key-summary UI wants. `seventhOf` stays table-driven because
the triad→seventh relation is precisely what the chart does not record: it
holds `Dm` and `Dm7` as unrelated nodes.

`nextChordDetail`'s `include: ['sevenths']` still works and now **dedupes
against the graph edges**, so a chord is never reported twice; the graph edge
wins, since it carries the real arrival context and edge roman. For a chord
that already reaches all of the key's sevenths, the option is a no-op.

Seeded walks (`randomProgression`) shift for a given seed: the new dotted edges
are extra weighted choices. The strength union is unchanged — no `'seventh'`
member was added, so exhaustive switches keep compiling.

The non-functional diatonic sevenths (`IIIm7`, `VIm7`) are excluded by design;
`romanChordNameToReal` still resolves them on request.

### Fixed

**The leading-tone rule now covers the whole VII-diminished family.** 0.4.0
built `VIIdim` on the leading tone rather than the subtonic, but matched the
literal string `'VIIdim'` only — so `VIIdim7` and `VIIm7b5` fell through to the
subtonic. `romanChordNameToReal('A', 'minor', 'VIIdim7')` returned `Gdim7`
(G–B♭–D♭–F♭) where it should return `G#dim7`. The subtonic chords `VII` and
`VII7` are unaffected and remain diatonic, as does secondary-chord resolution.

### Notes

Slash-chord names (`C/E`) remain unsupported, and inversions remain a concern
of the voicing layer — `ascendingInversions` enumerates them and
`nearestVoicing` / `voicing=smooth` already select them. See the Inversions
section of `docs/chord-assistance.md` for the rationale.

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
