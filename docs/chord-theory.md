# Deep dive: how the chord map works

Companion to [chord-assistance.md](./chord-assistance.md). That page is how to
use it; this is what it's built on and why it answers the way it does.

---

## 1. The map is hand-authored data

The core is not an algorithm. It's a **hand-authored graph**: tonic on one
side, dominant on the other, arrows showing which chords legitimately move to
which.

It began as a transcription of a classic boxes-and-arrows harmony chart — the
kind that hangs in theory classrooms — and `src/lib/graphData/minor.ts` still
carries the transcriber's notes about that figure (`// double-box top`,
`// big confusing box`). Those comments are **history, not a specification**.
The map has already grown past its source: the major chart was authored from
the standard functional cycle rather than transcribed, several edges were
corrected against classical practice, and the leading-tone spellings were
fixed. Where the original figure and good musicianship disagree, the map
follows the musicianship.

So treat the provenance notes as a record of where this started, not a fence
around where it can go. **New charts, new edges and new chord types are all
fair game** — the data format is the contract, not the figure.

Each node is written in **Roman numerals**, so the chart is key-independent:

```js
V: [{ name: 'V', next: ['Im'], dotted: ['I'] }]
```

Read: *the dominant resolves to the minor tonic; it may also resolve to the
major tonic, but that's a weaker/special move.*

This matters for how you interpret results. The suggestions aren't derived from
a rule engine or trained on a corpus — they're curated common-practice harmony,
written down. Where the data is opinionated, ollave is opinionated in exactly
the same way, and the remedy is to edit the data.

### Roman → real chords

`chordGraphCreate(tonic, scale)` instantiates the chart into a key: `V` becomes
`E` in A minor, `G` in C major. It caches per key, so repeated calls are free.

Which chart it picks is decided by `Scale.get(...).type`, not by string
matching — that way `'C ionian'` and `'C major'` both resolve to major, and
`'A aeolian'` and `'A minor'` both to minor. **Modes other than major and minor
throw**, because there is no chart for them. (Before 0.4.0 they silently
received the minor chart, which is the bug behind this release's breaking
change.)

---

## 2. Strong and dotted arrows

The map records two kinds of arrow — a distinction inherited from the original
chart and worth keeping in any chart you add:

- **`strength: 'strong'`** — solid arrow, a principal motion
- **`strength: 'dotted'`** — dashed arrow, valid but weaker or special-case

The clearest example is in minor:

```
V → Im       strong    the ordinary cadence: E resolves to Am
V ⇢ I        dotted    the Picardy third: E resolves to A major
```

Both are correct. One is what usually happens; the other is a deliberate
gesture. `nextChord` returns only the strong moves; `nextChordDetail` returns
both, tagged — which is the main reason to prefer it.

---

## 3. Arrival context, and why it never filters

A few chords behave differently depending on how you got there. The chart
encodes this as a `prev` annotation, which ollave surfaces as `enabledBy`.

The clearest case is `Bdim` in A minor. Two different chart positions both
land on that chord:

- as **IIdim**, the supertonic — heading into the dominant complex
- as **VIIdim/III**, a leading-tone chord tonicizing C major

They realize to the same three notes, so ollave merges them into one node and
uses `enabledBy` (and the per-edge `roman`) to keep the two identities apart.
Hence the different orderings you get from `{ prev: ['F'] }` versus
`{ prev: ['Am'] }`.

**Context annotates; it never removes.** This is a deliberate design decision
with a concrete reason. `G#dim` in A minor has exactly one outgoing edge,
recorded as reachable from `Dm` and `Bdim`. But `Am → G#dim` is also a
perfectly legal move on the chart — it just isn't annotated, because context is
recorded only where it's musically interesting, and the annotations are sparse
by nature. If ollave
filtered on `enabledBy`, then asking "I'm on G#dim, I came from Am, what now?"
would return **nothing at all** — not because the answer is nothing, but
because of a gap in the annotations.

So `contextMatch: false` means *"not specifically recommended from here,"* never
*"forbidden."* Rank on it, style it differently in a UI, but don't filter.

---

## 4. The three chords that aren't chord symbols

`V64`, `N6` and `Aug6` are stored under function names because they're defined
by role and voicing, not by a stackable symbol. Each is computed per key.

### V64 — the cadential six-four

Scale degrees **5–1–3**: the tonic triad sounding *over the dominant in the
bass*. In A minor: `E–A–C`.

Despite containing tonic notes, it functions as **dominant**: the 6th and 4th
above the bass are suspensions that resolve down to the 5th and 3rd while the
bass holds. That's why the map routes it `V64 → V`, and not to a tonic chord.
It's a decorated arrival *at* the dominant, not a departure from it.

### N6 — the Neapolitan sixth

A major triad on the **lowered second degree**, conventionally in first
inversion. In A minor: `D–F–B♭`. A predominant with a distinctive dark colour;
it approaches the dominant, optionally through the cadential 6/4.

Its root comes from transposing a minor second up from the tonic. That sounds
like a pedantic detail, but it's what keeps the spelling honest in flat keys —
E♭ major's Neapolitan is `F♭–A♭–C♭`, not the enharmonically-equal-but-wrong
`E–G♯–B`.

### Aug6 — the augmented sixth family

Built as **♭6 – 1 – ♯4** measured as absolute intervals from the tonic: in A
minor, `F–A–D♯`. The augmented sixth between ♭6 and ♯4 wants to expand outward
by half step in both directions onto the dominant.

Measuring from the tonic rather than from scale degrees is deliberate: in minor,
the sixth degree is *already* lowered, so flattening "the sixth degree" a second
time gives the wrong note.

There are **three** of these, differing only in what is added inside that outer
augmented sixth, and all three are chart nodes:

| node | formula | in A minor | in C major |
|---|---|---|---|
| `It6` — Italian | ♭6 – 1 – ♯4 | `F A D♯` | `A♭ C F♯` |
| `Fr6` — French | ♭6 – 1 – 2 – ♯4 | `F A B D♯` | `A♭ C D F♯` |
| `Ger6` — German | ♭6 – 1 – ♭3 – ♯4 | `F A C D♯` | `A♭ C E♭ F♯` |

**`Aug6` is an alias for the Italian**, so it returns exactly what it always
returned. The Italian is the three-note prototype the other two each add one
note to, and aliasing the German instead would have silently turned three notes
into four in songs already saved to disk.

One grading worth knowing: **`Ger6 → V` is a dotted edge while `It6 → V` and
`Fr6 → V` are strong.** The German's ♭3 forms a perfect fifth above its bass,
so moving it directly to a root-position V produces parallel fifths — the
so-called *Mozart fifths*. Its strong path is through the cadential ⁶₄, which
is why composers approach V that way when using it.

The German's other consequence is enharmonic: `F–A–C–D♯` respelled as
`F–A–C–E♭` is `F7`, a dominant seventh. That is the **Ger⁶ ↔ V⁷ pivot**, one of
the most powerful modulation devices in the tonal repertoire, and it's why
`enharmonicPivots` exists (see §7). The Italian has no fifth to respell, so
`enharmonicPivots('Aug6', …)` correctly returns nothing.

### One alias policy for all three

Since figured bass arrived, two of these three are expressible without a
function name. The policy is decided once, for all three together:

**All three stay. They are documented aliases, not deprecated.**

The reasoning differs by chord, and the third case is the one that settles it.

**`V64` is expressible.** It is `I⁶₄` — the tonic triad with the fifth in the
bass. Probed: `figuredVoicings('C', '64')` gives `G3 C4 E4`, the same pitch
classes the `V64` node produces (`G3 C3 E3`) and better voiced, since the
function node's `octMap` stacks all three notes in one octave and so is not
ascending.

**`N6` is expressible.** It is `♭II⁶`. Probed in A minor: `figuredVoicings('Bb',
'6')` gives `D3 F3 Bb3`, byte-identical to what the `N6` node produces.

**`Aug6` is NOT expressible, and this is not a limitation of the schema.** The
augmented sixth is not a tertian chord at all. In A minor it is `F–A–D♯`, whose
intervals from the bass are `1P 3M 6A` — a major third and an augmented sixth,
with **no fifth**. There is no root to invert and therefore no chord tone for a
figure to select: the `6` in "Aug6" names an *interval above the bass*, which is
what figured bass meant before it was narrowed to inversion labels. Asking tonal
to name the sonority returns `F7no5`, which is the wrong analysis — it respells
D♯ as E♭ and turns a chord that resolves *outward to the dominant* into one that
resolves *down to a tonic*. That respelling is the whole reason `Aug6` is
computed from absolute intervals in the first place.

So a policy of "retire the ones that are now expressible" would retire two of
three and leave the third as a lone special case — trading one uniform concept
("these are the function-named chords") for two half-concepts. Keeping all three
is the cheaper and more honest model.

Three further reasons apply to all of them equally:

- **Retiring any is a breaking change.** `isChordCsvArg('V64,3')` is `true`
  today, all three pass `isDyna`, and the names appear in saved songs. They are
  live user-facing input, not internal identifiers.
- **A function name says what the chord *does*.** `V64` records that the
  sonority is dominant-function; `I⁶₄` records only that the tonic triad has its
  fifth in the bass, which is also true of a passing or pedal ⁶₄ that is not
  dominant at all. The function name carries the analysis, the figure carries
  the voicing, and they are different facts.
- **The figured forms work too.** `I⁶₄` and `♭II⁶` are valid chart edges today.
  Nothing forces a chart author to use the function name — the alias policy adds
  a way to spell these, it does not remove one.

Where the *context* is what defines the chord rather than its spelling — a
passing versus pedal versus cadential ⁶₄ — the answer is neither a function name
nor a figure but a **span** (see §12).

---

## 5. Voice leading is a separate axis

The map tells you what's **grammatical**. It says nothing about what's
**smooth** — those are different questions, and ollave keeps them apart.

`voiceLeadingDistance(fromVoicing, chordName)` measures total semitone motion
between a voicing you're playing and the nearest arrangement of a target chord.
`rankByVoiceLeading` uses it to sort suggestions.

Two details worth knowing:

**Unequal chord sizes.** Moving from a triad to a seventh chord, no
one-to-one mapping exists. Ollave charges each note of the source to its nearest
target note *and* each target note back to its nearest source note. That way a
larger target can't hide an unreachable new note for free.

**Context outranks smoothness.** When suggestions carry `contextMatch`, that
sorts first, and distance breaks ties within each group. A very smooth move to
a chord that doesn't belong after the previous one is still the wrong chord.

---

## 6. Modal mixture

`mixtureSuggestions` returns chords borrowed from the parallel key — deliberately
*outside* the chart, offered as an additive palette:

- **into major:** `iv`, `ii°`, `♭III`, `♭VI`, `♭VII`
- **into minor:** `IV` (the raised sixth, a dorian inflection)

The Picardy third is *not* in this list, because it already exists in the chart
as the dotted `V ⇢ I` edge. Duplicating it would double-count it.

Roots are derived by interval transposition from the tonic — the same technique
as `Aug6` above, for the same reason: scale-degree arithmetic double-flattens in
minor keys.

Unsupported modes return `[]` rather than throwing, because mixture is an
optional add-on and shouldn't be able to break a call that would otherwise
succeed.

---

## 7. Sevenths, and how they sit on the chart

The diatonic sevenths **are chart nodes**. They were promoted from an opt-in
palette once their edges could be answered deliberately rather than guessed,
and the three answers are worth stating, because they generalize to any chord
type someone adds next.

### The three rules

**1. A seventh sits beside its triad, never replacing it.** `nextChord('Am,3',
'A', 'minor')` still returns `Dm`, not `Dm7`. Both are musically valid, and
silently swapping one for the other would change every existing caller's
results without telling them.

**2. A seventh's outgoing edges mirror its triad's.** Adding a seventh doesn't
change what a chord *does*: `IIm7b5` is still the predominant `IIdim` is, so it
goes exactly where `IIdim` goes. `V7` accordingly inherits V's dotted Picardy
third in minor and its dotted deceptive cadence in major, alongside the strong
resolution to the tonic. Where a seventh's function genuinely differed from its
triad's, that would need its own edges — none of these do.

**3. A seventh is reached over a `dotted` edge.** Every chord that leads to a
triad also leads to that triad's seventh, weakly. This is the rule that keeps
the promotion honest: a seventh is colour available *on top of* the principal
motion, not a competitor to it.

### Why `V7` is not an exception

It's tempting to make `V7` a strong target — it's at least as principal as `V`.
Measured, that costs about 18% growth in major's default suggestion lists and
12% in minor's, and buys nothing: `V7`'s own outgoing edges are strong either
way, so once you take the `V7` edge the cadence it leads to is undiminished.
The dotted edge already offers the chord. Uniformity is worth more here than a
special case.

### What this cost existing callers

Nothing, in the default path. `nextChord` returns only strong edges, and rule 3
puts every new edge in the dotted layer — so its output is byte-for-byte
identical across all 40 pre-existing nodes in both charts. `nextChordDetail`
lists grew ~44% on average, entirely in dotted suggestions.

Seeded walks are the one visible change: `randomProgression` weighs dotted
edges at 1, so new edges shift where a given seed lands. The walks are still
legal; they're just different walks.

### What's included, and what isn't

| | major | minor |
|---|---|---|
| tonic | `Imaj7` | `Im7` |
| supertonic | `IIm7` | `IIm7b5` |
| subdominant | `IVmaj7` | `IVm7` |
| dominant | `V7` | `V7` |
| leading tone | `VIIm7b5` | `VIIdim7` |

Two things worth reading off that table.

**The supertonic mapping isn't a suffix append.** In minor the supertonic triad
is diminished (`IIdim`, B–D–F in A minor), but its idiomatic seventh is
*half*-diminished — `Bm7b5`, B–D–F–A. Stacking a diatonic seventh gives A
natural, not A♭. That's why the roman for the triad and the roman for its
seventh are stored as a pair rather than derived.

**The leading-tone seventh differs by mode.** Major takes the half-diminished
`VIIm7b5`; minor takes the fully-diminished `VIIdim7`, which is the
characteristic sound of the minor key. Both are built on the **leading tone**,
which in minor means the raised seventh degree — the same rule described in
section 4 for `V64` and friends, and the reason `VIIdim7` in A minor is
`G#dim7` and not the subtonic `Gdim7`. The subtonic `VII` (plain G major) stays
distinct; only the *diminished* VII family gets raised.

`IIIm7` and `VIm7` are excluded. They're diatonic and legal, but the mediant
and submediant sevenths carry no distinct function — they're colour on chords
that are already colour. Including them would make this "every triad also has a
seventh," which is the suggestion-list bloat rule 3 exists to contain. The
translator resolves them if you ask by hand.

### Two gradings, deliberately different

`strength` means different things on a chart edge and in the palette, and the
difference is not an inconsistency:

- **On a chart edge**, every seventh is `'dotted'`, `V7` included. That grades
  *this motion from this chord* — and rule 3 says a seventh is never the
  principal motion.
- **In `seventhSuggestions`**, `V7` is `'strong'` and the rest `'dotted'`. That
  grades *the chord's standing in the key*, where there is no edge to weigh and
  the dominant seventh's standing is plainly principal.

Both reuse the existing vocabulary rather than adding a `'seventh'` member to
the strength union — widening that union would break exhaustive switches in
existing consumers, and would say nothing the `roman` field doesn't carry.

### What `sevenths.ts` is still for

`seventhSuggestions` and `seventhOf` remain exported. They answer questions the
graph structurally cannot:

- **`seventhSuggestions(tonic, scale)`** — *what sevenths does this KEY have*,
  regardless of where you're standing. No single node's edges can report that;
  it's what a palette or key-summary UI wants.
- **`seventhOf(chordName, tonic, scale)`** — *does the chord I'm holding take a
  seventh?* The chart holds `Dm` and `Dm7` as two independent nodes with no
  recorded link between them. The triad→seventh **relation** lives only in the
  tables in `sevenths.ts`, which is why that function stays table-driven by
  design rather than inertia. `sevenths.test.ts` asserts the tables and the
  charts agree in both directions, so they can't drift.

`nextChordDetail`'s `include: ['sevenths']` still works and now dedupes against
the graph edges by name, so no chord is reported twice; the graph edge wins,
because it carries the real arrival context and edge roman. For a chord that
already reaches all of the key's sevenths — the tonic of C major, for instance
— the option is a no-op.

---

## 8. Inversions, and the bass as a line

Before this, a chord was a pitch-class set and nothing in the data model could
say which note was on the bottom. Inversions lived entirely in the voicing
layer: `nearestVoicing` would *pick* one, but no one could *ask* for one, and
the chart had no way to record that a particular move wants a particular bass.

That was the single biggest gap, because a bass line is a melody. A composer
thinks `I–I⁶–IV–V⁴₃–I⁶`, where the bass steps 1–3–4–5–3 — not "I then IV then
V". Half of those chords are inverted purely to keep the line moving by step.

### The schema: a structured field, not a slash name

A chart edge is now `string | { chord, figure }`. The bare string still means
root position and is still the normal form — every edge authored before this
change is one, and takes a byte-identical path through the translator.

Slash names (`C/E`) were considered and rejected for two concrete reasons:

- **`/` already means tonicization here.** The chart writes `V7/III` and
  `VIIdim/VIm`. A bare `C/E` in the same vocabulary is genuinely ambiguous.
- **The underlying library can't parse them.** `Chord.get('C/E')` returns no
  notes at all.

A suffix convention (`I6`) was rejected too: it collides with real chord
suffixes — `C6` is a sixth chord to tonal, and `V64` is already a chord-function
name here — so the figure couldn't be recovered from the string without a parser
that knows which suffixes are figures and which are qualities. A structured
field needs no parser and cannot collide.

### The figures, and which chord tone each puts in the bass

| Figure | Bass is the | Applies to |
|---|---|---|
| `53` | root | triad (root position; usually written unfigured) |
| `6` | **third** | triad (first inversion) |
| `64` | **fifth** | triad (second inversion) |
| `7` | root | seventh chord (root position) |
| `65` | **third** | seventh chord (first inversion) |
| `43` | **fifth** | seventh chord (second inversion) |
| `42` | **seventh** | seventh chord (third inversion) |

ASCII is what's stored. The unicode forms (`⁶`, `⁶₄`, `⁶₅`, `⁴₃`, `⁴₂`) are
accepted as input sugar and normalized, so you can type what a score prints;
one stored spelling means one thing to a diff and to grep.

**The mapping is by index into the chord's own note list, never by interval
arithmetic from the root.** That's a correctness decision. `Chord.get(name).notes`
is already spelling-exact in every key, so indexing inherits that for free:

```js
bassOf('Db7', '42')   // 'Cb'  — not B
bassOf('G#7', '65')   // 'B#'  — not C
bassOf('Fbm', '64')   // 'Cb'  — not B
bassOf('F##dim', '6') // 'A#'
```

Transposing a third or a fifth would have to re-derive each of those and gets
several wrong — the enharmonic-respelling bug class that has bitten this
codebase repeatedly (see the `N6` and `Aug6` notes in §4).

Arity is checked, not just index existence. `bassOf('C', '7')` returns `null`
rather than `'C'`: `7` maps to index 0, which exists on a triad, so an
index-only check would cheerfully report that a C major triad is a `V7` — a
wrong analysis stated with full confidence.

### What a suggestion carries

```js
{ name: 'G7', roman: 'V65', notes: [...], strength: 'dotted',
  enabledBy: null, figure: '65', bass: 'B' }
```

- **`name` stays the plain chord symbol.** Never `G7/B`. The name is the graph's
  key and is looked up by name in half a dozen places, so encoding the bass in
  it would break all of them.
- **`roman` carries the figured roman** — `roman` has always meant "how this
  edge is spelled" rather than "which node this is". Note `V65`, not `V765`: a
  seventh-chord figure absorbs the `7`, because the figure already says seventh
  chord. That's how it reads on a page.
- **`figure` and `bass` are absent — not `undefined` — on an unfigured
  suggestion.** So every suggestion produced before this change serializes
  byte-identically.

`bass` is a pitch class with no octave. Which octave the bass lands in is a
placement decision owned by `parseChordCsvArg` and `nearestVoicing`, not by the
graph.

### Which inversions are edges, and which aren't

Only **true chord-to-chord inversions** are edges — the ones whose identity is a
property of the move itself: `I⁶`, `V⁶`, `vii°⁶`, and `V⁶₅`/`V⁴₃`/`V⁴₂`.

`V⁴₂ → I⁶` is the one that's a genuinely different move rather than a re-voicing
of an existing one. The chordal seventh is in the bass and must resolve *down*
by step, so a `V⁴₂` can only resolve to a first-inversion tonic. That obligation
earns it its own edge.

**Passing and pedal ⁶₄s are deliberately not edges.** See §9.

### What this cost existing callers

Nothing, in the default path — the same guarantee the sevenths shipped under.
Every inversion edge is `dotted`, so `nextChord` (strong edges only) is
byte-for-byte identical across all 50 nodes in both charts. Verified by probe
before and after.

An inversion is a *refinement* of a motion the chart already offers, not a new
motion, which makes this the musically honest grading too: the strong edge says
"go to the dominant", the dotted figured edge adds "and you may put its third in
the bass".

Two visible changes, both expected:

- **`nextChordDetail` lists grew**, entirely in dotted suggestions.
- **Seeded walks shifted.** New dotted edges are extra weighted choices, so a
  given seed lands differently. The walks are still legal; they're just
  different walks.

One consequence worth stating plainly: **a chord name is no longer unique in a
suggestion list.** `Am` appears as `Im` and again as `Im⁶` — same name, different
bass, different musical object. Anything deduping suggestions should key on
`(name, figure)`, which is what the graph itself now does.

### Placing a figured chord

```js
parseChordCsvArg('C,3', 'C major', undefined, { figure: '6' })
// [['E3','G3','C4'], ['roman=I', 'chord=C', 'figure=6', 'bass=E']]
```

Additive and last, so every existing call site takes the untouched default path.
When both a figure and `prevNotes` are given, the **figure wins** on which
inversion and smoothing only chooses among its octaves — a figure is an explicit
compositional decision, smoothing is a convenience. An inapplicable figure
(`42` on a triad) falls back to the default rather than losing the chord.

---

## 9. Spans: when the device isn't a chord or an edge

Some of what a composer reaches for is neither a chord nor a chord-to-chord
move, but a short *ordered pattern with conditions*. The clearest case:

```
I – I⁶₄ – I⁶     passing ⁶₄     (bass walks stepwise through it)
I – I⁶₄ – I      pedal ⁶₄       (bass holds under it)
    I⁶₄ – V      cadential ⁶₄   (strong beat, resolves ⁶₄→⁵₃)
```

**All three contain the identical sonority.** Only the surrounding bass and the
metric position tell them apart — and a first-order edge carries neither. No
amount of edge-adding can distinguish them, because the distinction isn't in the
chord pair at all.

So there's one shared abstraction, `HarmonicSpan`: an ordered list of figured
chords plus optional conditions and waivers. A **template over the graph, not an
edge in it**.

```js
{
  id: 'cadential-64',
  title: 'Cadential six-four',
  kind: 'idiom',
  steps: [{ chord: 'I', figure: '64' }, 'V'],
  conditions: {
    metric: ['strong', 'weak'],
    bass: { degrees: [5, 5], motion: 'static' },
  },
}
```

**Steps are roman-keyed, always.** The charts are roman-keyed and
key-independent; a span written in realized chord names would be a different
object per key, which is the duplication the roman layer exists to prevent. A
step is exactly the same `{ chord, figure }` an edge carries, so edges and spans
speak one vocabulary.

**A span is never consulted by `nextChord` or `nextChordDetail`.** The library is
a parallel, additive channel — like `mixtureSuggestions` — so nothing in it can
change a suggestion list that already existed.

### What ships

| id | kind | what it is |
|---|---|---|
| `cadential-64` | idiom | tonic notes over ⁵, strong beat, resolving to V |
| `passing-64` | idiom | bass walks stepwise through the ⁶₄ |
| `pedal-64` | idiom | bass holds while upper voices step away and back |
| `lament-bass` | schema | descending tetrachord 1–♭7–♭6–5 (minor) |
| `descending-bass-idiom` | schema | I–V⁶–vi–iii⁶–IV–I⁶–IV–V (major) |
| `fauxbourdon` | idiom | parallel ⁶₃ chains |

`descending-bass-idiom` is the clearest demonstration of the point: the bass
falls 1–7–6–5–4–3 and turns back to 5, and three of its eight chords are
inverted purely to keep that line stepwise. The harmony is ordinary; the *line*
is the idea.

### Conditions are declared but inert

`conditions.bass`, `conditions.soprano` and `conditions.metric` are typed,
stored and authored — and **nothing evaluates them yet**. They're in the schema
now so that the streams which *will* evaluate them (voice-leading rules for the
line conditions, metric weight for the metric ones) inherit real content to
switch on, rather than each inventing a shape that the other and the
already-authored spans would then have to migrate to.

### Waivers, so the tool doesn't red-ink its own content

`fauxbourdon` is *made of* parallel motion — that's the device, not a mistake.
A part-writing checker with no notion of context would flag every step of it.
So a span declares the rules it deliberately breaks, with a human-readable
reason:

```js
waivers: [
  { rule: 'parallel-fourths',
    reason: 'Fauxbourdon is BUILT from parallel fourths above the bass...' },
]
```

Unlike conditions, **waivers are live data**, because the content that needs
them ships now. A rule checker is expected to take `spanWaivedRules(span)` and
suppress those rules while verifying a realization.

Rule ids aren't pinned as a union in the chart-data types — a rule catalogue
belongs with the checker, and pinning it in a zero-import module would mean
every new rule forces an edit there. `spans.test.ts` asserts instead that every
id used is from a documented set, so a typo still fails a test.

---

## 10. Pivot modulation

A pivot chord belongs to two keys at once — it's the hinge a modulation turns
on. `pivotSuggestions` finds every major or minor key containing all of a
chord's pitches, excluding the current one, and reports the chord's role in
each (`romanThere`) plus where it can go there (`follow`).

Two limits worth knowing:

**`romanThere` is diatonic-degree only.** It won't produce `♭III` or `V7/V`.
That's safe by construction — a chord only reaches this code if all its notes
are already in the target scale — but it means the label is simpler than a
theorist's full analysis. Minor keys are labelled from natural minor, matching
the chart's own vocabulary.

**Spelling matters.** Key detection matches note *names*, not pitch numbers.
A correctly spelled chord finds its keys; a chord written with unconventional
enharmonics falls back to pitch matching. The scale list underneath contains
enharmonic duplicate keys (a "D♭♭ major" that is really C major), which is why
the fallback is narrow rather than the default.

Those duplicates are a problem for *display*, not for detection, and the two
needs are now served by different lists. `conventionalKeys` is the 30 real keys
and is what a scale picker should show; `allScales` keeps every spelling and is
what detection scans. The distinction is load-bearing: a deduplicated list has
only one spelling per sounding scale, so C♯ major is absent from it, and
detecting C♯–E♯–G♯ against it would report `B lydian` instead of the key the
chord is really in. Detection needs all the spellings; a dropdown needs one.

---

## 11. Random walks

`randomProgression` walks the map with weighted choices: strong edges 3, dotted
edges 1, and a ×2 multiplier for context matches. Immediate repeats are
suppressed by default (the minor tonic lists itself as a successor, so without
this you'd get runs of one chord).

Randomness comes from a small seeded generator (mulberry32), never
`Math.random()` — so a seed reproduces a walk exactly. That makes tests
meaningful and lets you recover a progression you liked from its number.

Walks can stop early. Some nodes have a single exit, and some suggestion targets
aren't themselves nodes — the Picardy `A` is reachable *as a destination* but
has no outgoing edges of its own, so a walk that lands there ends. That's
reported as `stoppedBecause: 'dead-end'`, which is a legitimate musical ending
(a final Picardy third), not a failure.

---

## 12. What this system is not (yet)

Worth being explicit, so you know when to override it — and each of these is a
gap to fill rather than a boundary to respect:

- **Not a style model.** It currently encodes common-practice tonal harmony.
  It doesn't yet know jazz reharmonization, modal writing, pop loops, or
  anything post-tonal — but the chart format can express all of them.
- **Not exhaustive.** Absent from the map means "not modelled yet," not
  "wrong." Plenty of good music lives outside it.
- **Not a ranking of quality.** `strong` versus `dotted` marks conventionality,
  not merit. The dotted moves are frequently the more interesting ones.
- **Major and minor only.** Other modes throw rather than guess, because no
  chart exists for them yet.

---

## 13. Adding your own chart

The data format is the contract. A chart is a plain object mapping a Roman
numeral to one or more nodes:

```js
export const myChart = {
  I: [{ name: 'I', next: ['IV', 'V'], dotted: ['VIm'] }],
  IV: [{ name: 'IV', next: ['V'], prev: ['I'] }],
}
```

- `next` — principal motions · `dotted` — weaker or special-case motions
- `prev` — arrival context, surfaced to callers as `enabledBy`; optional, and
  sparse by design
- Multiple nodes under one numeral express context-dependent behaviour (the
  same chord behaving differently depending on what preceded it)
- Suffixes are passed to the chord parser, so `IIm7`, `V7`, `VIIm7b5` and
  friends already resolve — a chart may use them freely
- `V64`, `N6` and `Aug6` are function-name nodes computed per key; a chart can
  reference them like any other node

Drop the file in `src/lib/graphData/`, register it in `chartForScale`
(`src/lib/util/graphUtil.ts`), and it is instantiated into every key for free.
A jazz chart, a pop-loop chart, or a modal chart are all additions of this
shape — no engine changes required.

Two things worth doing when you author one: state your reasoning in a header
comment (so a later reader can tell a deliberate edge from a typo), and pin the
node list in a test, as `majorGraph.test.ts` does.

---

## Source map

| What | Where |
|---|---|
| Chart data (minor / major) | `src/lib/graphData/` |
| Roman → real chord translation, dynamic chords | `src/lib/graphh.ts` |
| Key instantiation, caching, mode dispatch | `src/lib/util/graphUtil.ts` |
| `nextChord`, `nextChordDetail` | `src/lib/nextChord.ts` |
| Voicings, distance, `figuredVoicings` | `src/lib/voiceLeading.ts` |
| Figured-bass vocabulary, figure → bass tone | `src/lib/figuredBass.ts` |
| Shared chart/span types (zero-import) | `src/lib/graphData/types.ts` |
| Span library (idioms, schemata, waivers) | `src/lib/spans.ts` |
| Borrowed chords | `src/lib/mixture.ts` |
| Aug6 trio, CT°7, chromatic mediants, enharmonic pivots | `src/lib/chromatic.ts` |
| Part-writing rules, four-voice realization | `src/lib/partWriting.ts` |
| Metric weight, harmonic rhythm | `src/lib/harmonicRhythm.ts` |
| Sequences and Galant schemata | `src/lib/sequences.ts` |
| Diatonic sevenths — nodes | `src/lib/graphData/` (with the triads) |
| Diatonic sevenths — key palette, triad→seventh relation | `src/lib/sevenths.ts` |
| Modulation | `src/lib/pivots.ts` |
| Seeded walks | `src/lib/randomProgression.ts` |
