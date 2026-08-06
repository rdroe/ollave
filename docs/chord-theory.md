# Deep dive: how the chord map works

Companion to [chord-assistance.md](./chord-assistance.md). That page is how to
use it; this is what it's built on and why it answers the way it does.

---

## 1. The map is a transcribed flowchart

The core is not an algorithm. It's a **hand-authored graph** — a transcription
of the classic boxes-and-arrows harmony chart, the kind that hangs in theory
classrooms: tonic on one side, dominant on the other, arrows showing which
chords legitimately move to which.

It lives in `src/lib/graphData/minor.ts` and `major.ts`, and it still carries
the transcriber's notes about the figure it came from — comments like
`// double-box top` and `// big confusing box`.

Each node is written in **Roman numerals**, so the chart is key-independent:

```js
V: [{ name: 'V', next: ['Im'], dotted: ['I'] }]
```

Read: *the dominant resolves to the minor tonic; it may also resolve to the
major tonic, but that's a weaker/special move.*

This matters for how you interpret results. The suggestions aren't derived from
a rule engine or trained on a corpus — they're one particular pedagogical
tradition, written down. Where the chart is opinionated, ollave is opinionated
in exactly the same way.

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

The source chart draws two kinds of arrow, and ollave keeps the distinction:

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
perfectly legal move on the chart — it just isn't annotated, because the source
figure only marks context where it's pedagogically interesting. If ollave
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

### Aug6 — the augmented sixth

Built as **♭6 – 1 – ♯4** measured as absolute intervals from the tonic: in A
minor, `F–A–D♯`. The augmented sixth between ♭6 and ♯4 wants to expand outward
by half step in both directions onto the dominant.

Measuring from the tonic rather than from scale degrees is deliberate: in minor,
the sixth degree is *already* lowered, so flattening "the sixth degree" a second
time gives the wrong note.

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

## 7. Pivot modulation

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

## 8. Random walks

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

## 9. What this system is not

Worth being explicit, so you know when to override it:

- **Not a style model.** It encodes common-practice tonal harmony from one
  pedagogical chart. It doesn't know jazz reharmonization, modal writing, pop
  loops, or anything post-tonal.
- **Not exhaustive.** Absent from the map means "not on this chart," not
  "wrong." Plenty of good music lives outside it.
- **Not a ranking of quality.** `strong` versus `dotted` reflects the chart's
  arrow style — conventionality, not merit. The dotted moves are frequently the
  more interesting ones.
- **Major and minor only.** Other modes throw rather than guess.

---

## Source map

| What | Where |
|---|---|
| Chart data (minor / major) | `src/lib/graphData/` |
| Roman → real chord translation, dynamic chords | `src/lib/graphh.ts` |
| Key instantiation, caching, mode dispatch | `src/lib/util/graphUtil.ts` |
| `nextChord`, `nextChordDetail` | `src/lib/nextChord.ts` |
| Voicings and distance | `src/lib/voiceLeading.ts` |
| Borrowed chords | `src/lib/mixture.ts` |
| Modulation | `src/lib/pivots.ts` |
| Seeded walks | `src/lib/randomProgression.ts` |
