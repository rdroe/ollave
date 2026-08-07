# Chord assistance

You have a chord. What can come next?

That's the whole idea. Ollave carries a map of how chords move in a key — which
ones follow which — and the functions below let you ask it questions. Every
example here is real output, not illustrative.

```js
import { nextChord } from 'ollave/lib'

nextChord('Am,3', 'A', 'minor')
// ['Am', 'Dm', 'G', 'C', 'F', 'Bdim', 'V64', 'G#dim', 'E']
```

Nine chords that can idiomatically follow A minor in the key of A minor.

---

## The five things you can ask

| Question | Function |
|---|---|
| What can follow this chord? | `nextChord` / `nextChordDetail` |
| Which of those flow most smoothly? | `rankByVoiceLeading` |
| What can I borrow for colour? | `mixtureSuggestions` |
| Can this chord take a seventh? | on the chart already; `seventhOf` for one chord, `seventhSuggestions` for the key |
| Which note is in the bass? | on the chart already — `figure` / `bass` on a suggestion; `bassOf`, `figuredVoicings` |
| What multi-chord idioms are there? | `spans`, `spansOfKind` |
| Where could this chord take me? | `pivotSuggestions` |
| Just sketch me something. | `randomProgression` |
| **Get me to a cadence in four bars.** | `pathToCadence` — §11 |
| **Get me to a cadence in another key.** | `pathThroughModulation` — §12 |
| **Write these chords in four voices.** | `realizeProgression` — §13 |
| **Where do the bars fall?** | `suggestHarmonicRhythm` — §14 |
| **All of the above, in one call.** | `composeProgression` / `composeModulation` — §15 |
| **Label the cadences in what I wrote.** | `detectCadences` — §16 |

All are importable from `ollave/lib`.

---

## 1. What comes next

### `nextChord(chord, tonic, scale) → string[]`

Names only. The input is a chord-with-octave string (the octave is ignored for
lookup but keeps the format consistent with the rest of ollave).

```js
nextChord('E,3', 'A', 'minor')     // ['Am']
nextChord('V64,3', 'A', 'minor')   // ['E']
```

**It throws if the chord isn't in the key's map.** That's deliberate — asking
"what follows F♯ major in A minor?" has no good answer, and a silent `[]` would
look like "nothing follows this" rather than "this chord isn't in this key."
Wrap it in a try/catch:

```js
let options = []
try {
  options = nextChord(`${chord},3`, tonic, scale)
} catch {
  options = []   // chord isn't part of this key's map
}
```

### `nextChordDetail(chord, tonic, scale, opts?) → ChordSuggestion[]`

The same question, with the reasoning attached.

```js
nextChordDetail('Am,3', 'A', 'minor')[0]
// {
//   name: 'Am',
//   roman: 'Im',
//   notes: ['A3', 'C4', 'E4'],
//   strength: 'strong',
//   enabledBy: null
// }
```

| Field | Meaning |
|---|---|
| `name` | the chord, e.g. `'G#dim'` |
| `roman` | its role in the key, e.g. `'VIIdim'`, `'V7/III'` |
| `notes` | actual pitches, ready to play |
| `strength` | `'strong'` = principal move · `'dotted'` = weaker but valid · `'mixture'` = borrowed |
| `enabledBy` | chords this move works best after; `null` = works from anywhere |
| `contextMatch` | only present when you pass `prev` (see below) |
| `figure` | only present when the move specifies an inversion — see §9 |
| `bass` | the bass pitch class, present exactly when `figure` is |

`nextChordDetail` shows **more** than `nextChord` does: `nextChord` returns only
the strong moves, while `nextChordDetail` also includes the dotted ones — the
weaker options that were previously invisible.

---

## 2. Telling it what came before

Some chords behave differently depending on what preceded them. Pass `prev`
(most recent last) and each suggestion gets a `contextMatch` flag, with matches
sorted first:

```js
nextChordDetail('Bdim,3', 'A', 'minor', { prev: ['F'] })
// D#dim:true  B:true  V64:true  G#dim:true  E:true  Edim:true  C7:true  C:true

nextChordDetail('Bdim,3', 'A', 'minor', { prev: ['Am'] })
// Edim:true  C7:true  C:true  |  D#dim:false  B:false  V64:false  G#dim:false  E:false
```

Same chord, same key — but arriving from `F` versus `Am` reorders what's most
idiomatic.

**Context never removes an option.** Both calls return all eight suggestions;
only the order and the flag change. The map records arrival context for just a
few chords, so a `false` means "not specifically recommended here," not
"forbidden." Filtering on it would hide legitimate moves.

---

## 3. Smoothness

Two chords can both be correct while one requires the notes to leap and the
other barely moves. Give it the voicing you're playing now:

```js
import { nextChordDetail } from 'ollave/lib'

nextChordDetail('C,3', 'C', 'major', {
  rankBy: 'voiceLeading',
  fromVoicing: ['C4', 'E4', 'G4'],
})
```

Each result gains `distance` (total semitone movement) and `suggestedVoicing`
(the arrangement that achieves it). `Em` at distance 2 means one note steps
down a semitone and two stay put.

`rankBy` **requires** `fromVoicing` and throws without it — silently returning
an unranked list would be indistinguishable from a ranked one.

---

## 4. Borrowed colour

```js
mixtureSuggestions('C', 'major')
// iv=Fm  ii°=Ddim  bIII=Eb  bVI=Ab  bVII=Bb

mixtureSuggestions('A', 'minor')
// IV=D
```

Chords borrowed from the parallel key — outside the map but idiomatic and
expressive. They carry `strength: 'mixture'`.

Either call it directly and concatenate, or let `nextChordDetail` do it:

```js
nextChordDetail('C,3', 'C', 'major', { include: ['mixture'] })
```

Unsupported modes return `[]` rather than throwing, so adding this to a call
can never cost you the suggestions you already had.

---

## 5. Sevenths

**Sevenths are on the chart, so you get them without asking.** Any seventh
reachable from where you are shows up in `nextChordDetail` as a dotted
suggestion:

```js
nextChordDetail('E,3', 'A', 'minor')
// Am  / Im  / strong
// A   / I   / dotted   the Picardy third
// E7  / V7  / dotted   the dominant's own seventh
// Am7 / Im7 / dotted   the tonic seventh, as arrival colour
```

Into major: `Imaj7`, `IIm7`, `IVmaj7`, `V7`, `VIIm7b5`.
Into minor: `Im7`, `IIm7b5`, `IVm7`, `V7`, `VIIdim7`.

Three things to know about how they behave:

**A seventh never replaces its triad.** `nextChord('Am,3', 'A', 'minor')` still
gives you `Dm`, not `Dm7`. Both are valid; the triad stays the principal move.

**Sevenths are always dotted edges** — `V7` included. They're colour on top of
the principal motion. Practically: if your UI already treats dotted edges as
optional, sevenths slot in with no change, and **`nextChord` output is exactly
what it was before they existed.**

**A seventh goes wherever its triad goes.** `Dm7` leads where `Dm` leads,
because the seventh doesn't change the chord's function. `E7` resolves to `Am`
and takes the Picardy `A`, just like `E`.

Note the two leading-tone chords differ by mode. Major takes the
**half-diminished** `VIIm7b5` (B–D–F–A in C); minor takes the **fully
diminished** `VIIdim7` (G♯–B–D–F in A minor), built on the leading tone, not
the subtonic.

### The whole key's sevenths

For a palette — every seventh the key has, regardless of where you're standing:

```js
seventhSuggestions('C', 'major')
// Imaj7=Cmaj7  IIm7=Dm7  IVmaj7=Fmaj7  V7=G7  VIIm7b5=Bm7b5

seventhSuggestions('A', 'minor')
// Im7=Am7  IIm7b5=Bm7b5  IVm7=Dm7  V7=E7  VIIdim7=G#dim7
```

Here `V7` carries `strength: 'strong'` and the rest `'dotted'` — this grades
each chord's standing in the *key*, which is a different question from how
strong a *move* to it is from your current chord. (On the chart, every seventh
edge is dotted.)

If you're sitting on a chord and just want to know whether it takes a seventh:

```js
seventhOf('E', 'A', 'minor')     // E7,    roman 'V7',      strong
seventhOf('Bdim', 'A', 'minor')  // Bm7b5, roman 'IIm7b5',  dotted
seventhOf('F', 'A', 'minor')     // null
```

It matches on the chord name you're holding, so you don't need to know the
chord's function — and it reads the same chord differently in different keys.
`Bdim` is `IIm7b5` in A minor but `VIIm7b5` in C major.

**Not every triad gets one.** The mediant and submediant sevenths (`IIIm7`,
`VIm7`) are perfectly legal but carry no distinct function, so they're left out
rather than padding every list. `romanChordNameToReal` still resolves them if
you want them by hand.

`include: ['sevenths']` still works, and now adds only what the graph didn't
already offer — the key's *other* sevenths, the ones this chord doesn't reach:

```js
nextChordDetail('C,3', 'C', 'major', { include: ['sevenths'] })
```

Duplicates are dropped, so no chord is ever listed twice. C major's tonic
already reaches all five, so there the option changes nothing.

Unsupported modes return `[]` rather than throwing, so opting in can never cost
you the suggestions you already had.

---

## 6. Everything at once

```js
nextChordDetail('C,3', 'C', 'major', {
  include: ['mixture'],
  rankBy: 'voiceLeading',
  fromVoicing: ['C4', 'E4', 'G4'],
})
// C   / I    / strong  / d0
// V64 / V64  / strong  / d0
// Em  / IIIm / strong  / d2
// Am  / VIm  / strong  / d4
// Fm  / iv   / mixture / d4
// Ab  / bVI  / mixture / d4
```

Diatonic moves and borrowed colour together, ordered by how little the fingers
have to travel. `include` takes both sources at once —
`include: ['mixture', 'sevenths']` — and the order you list them doesn't change
the result.

---

## 7. Changing key

```js
pivotSuggestions('Am', 'A', 'minor')
// C major = VIm  (4 continuations)
// D minor = Vm   (0)
// E minor = IVm  (8)
// F major = IIIm (5)
// G major = IIm  (7)
```

Am belongs to five other keys. Each result gives the target key, this chord's
role there (`romanThere`), and a `follow` list of where it can go *in that key*
— the pivot into a modulation. An empty `follow` means the chord fits the key
but isn't a node on its map.

Closely-related keys come first.

---

## 8. Sketching

```js
randomProgression('C,3', 'C', 'major', 8, { seed: 42 })
// ['C', 'V64', 'G', 'Am', 'Dm', 'Bdim', 'G', 'C']

randomProgression('Am,3', 'A', 'minor', 8, { seed: 12345 })
// ['Am', 'E', 'Am', 'F', 'Dm', 'V64', 'E', 'Am']
```

A weighted walk of the map. Strong moves are favoured 3:1 over dotted ones, and
context-matching moves are doubled again.

**Same seed, same progression, always** — so a sketch you like can be
regenerated from its number alone. Omit `seed` for a different one each time.

`randomProgressionDetail` returns the same walk plus `stoppedBecause`
(`'complete'`, `'dead-end'`, `'no-legal-move'`) and, for each step, the
suggestion that led there. Walks can end early — some chords have nowhere left
to go — and that's a normal result, not an error.

---

## Chord names that aren't chord names

Three entries look unusual: **`V64`**, **`N6`**, **`Aug6`**. They're
context-dependent sonorities that can't be written as plain symbols, so the map
names them by function. They behave like any other chord:

```js
nextChord('V64,3', 'A', 'minor')  // ['E']
nextChord('N6,3', 'A', 'minor')   // ['V64', 'E']
```

`parseChordCsvArg` resolves them to real pitches when a key is supplied. What
they mean is covered in the [deep dive](./chord-theory.md).

**All three stay, now that figured bass exists.** Two of them *are* expressible
in figured terms — `V64` is `I⁶₄` and `N6` is `♭II⁶`, and you may write either
form on a chart. But `Aug6` genuinely isn't: it's `♭6–1–♯4`, with no fifth and
an augmented sixth above the bass rather than stacked thirds, so there's no root
to invert and no chord tone for a figure to pick. Retiring the two that convert
would leave the third as a lone special case, and would break saved songs
besides. They're documented aliases, not deprecated. See
[the deep dive §4](./chord-theory.md) for the full reasoning.

---

## Smooth voicing when placing

Add the tag `voicing=smooth` when calling `addChord` and the chord is placed in
whichever arrangement sits closest to the previous chord in that phase, instead
of always root position.

It's opt-in. Without the tag, placement is byte-for-byte what it always was.

---

## 9. Inversions — asking for a bass

The bass is a melody, and now you can say so. A composer thinks
`I–I⁶–IV–V⁴₃–I⁶`, where the bass steps 1–3–4–5–3; half those chords are
inverted purely to keep the line moving.

**Inverted suggestions arrive on the chart, so you get them without asking:**

```js
nextChordDetail('C,3', 'C', 'major')
// C   / I    / strong
// ...
// C   / I6   / dotted   figure '6',  bass 'E'
// Bdim/ VIIdim6/ dotted  figure '6',  bass 'D'
// G   / V6   / dotted   figure '6',  bass 'B'
// G7  / V65  / dotted   figure '65', bass 'B'
// G7  / V43  / dotted   figure '43', bass 'D'
// G7  / V42  / dotted   figure '42', bass 'F'
```

Two extra fields appear on a suggestion that specifies an inversion:

| Field | Meaning |
|---|---|
| `figure` | `'6'`, `'64'`, `'65'`, `'43'`, `'42'` — which chord tone is in the bass |
| `bass` | the realized bass pitch class, e.g. `'E'` |

Both are **absent** on ordinary root-position suggestions, so nothing you
already parse changes shape.

### There is still no `C/E` chord name

`name` stays the plain chord symbol; the inversion rides in `figure`/`bass` and
in the `roman` (`I6`). Two reasons the slash name would be the wrong fix, both
unchanged:

- **`/` already means something else here.** The map writes secondary chords as
  `V7/III` — tonicization, not bass notes.
- **The underlying library doesn't parse them.** `Chord.get('C/E')` returns no
  notes at all.

### What the figures mean

| Figure | Bass is the | Applies to |
|---|---|---|
| `6` | third | triad |
| `64` | fifth | triad |
| `7` | root | seventh chord |
| `65` | third | seventh chord |
| `43` | fifth | seventh chord |
| `42` | seventh | seventh chord |

Unicode input is accepted and normalized, so `'⁶₅'` and `'65'` are the same
request.

```js
bassOf('G7', '42')    // 'F'
bassOf('Db7', '42')   // 'Cb'  — spelling stays correct in flat keys
bassOf('C', '42')     // null  — a triad has no seventh to put in the bass
```

An inapplicable figure returns `null` rather than guessing, and callers that
place chords fall back to the default rather than losing the chord.

### Placing a chord in a specific inversion

```js
parseChordCsvArg('C,3', 'C major', undefined, { figure: '6' })
// [['E3','G3','C4'], ['roman=I', 'chord=C', 'figure=6', 'bass=E']]
```

Opt-in and last, so existing calls are untouched. Combined with smooth voicing,
the **figure wins** on which inversion and smoothing only picks the octave — an
explicit request outranks a heuristic.

### Everything from before still works

```js
ascendingInversions('C', { minOctave: 3, maxOctave: 3 })
// [['C3','E3','G3'], ['E3','G3','C4'], ['G3','C4','E4']]

figuredVoicings('C', '6', { minOctave: 3, maxOctave: 3 })
// [['E3','G3','C4']]   — just the ones the figure permits
```

`nearestVoicing` and `voicing=smooth` still *choose* an inversion for you when
you don't care which. What's new is being able to care.

### Two things to know

**`nextChord` is unchanged.** Every inversion edge is dotted, so the names-only
call returns byte-for-byte what it always did. If your UI already treats dotted
edges as optional, inversions slot in with no change.

**A chord name is no longer unique in a suggestion list.** `Am` appears as `Im`
and again as `Im6` — same name, different bass, different chord. If you dedupe
suggestions, key on `(name, figure)`.

---

## 10. Spans — patterns, not chords

Some devices aren't a chord or a move but a short pattern with conditions:

```
I – I⁶₄ – I⁶     passing ⁶₄
I – I⁶₄ – I      pedal ⁶₄
    I⁶₄ – V      cadential ⁶₄
```

All three contain the *same sonority*. Only the surrounding bass and the metre
tell them apart, so no edge can distinguish them.

```js
import { spans, spansOfKind, spanById, spanRomans } from 'ollave/lib'

spanRomans(spanById('descending-bass-idiom'))
// ['I', 'V6', 'VIm', 'IIIm6', 'IV', 'I6', 'IV', 'V']

spansOfKind('schema', 'minor').map((s) => s.id)
// ['lament-bass']
```

What ships: `cadential-64`, `passing-64`, `pedal-64`, `lament-bass`,
`descending-bass-idiom`, `fauxbourdon`.

Steps are **roman-keyed**, so one span serves every key. Spans are a parallel,
additive channel — `nextChord` and `nextChordDetail` never consult them, so
adding this could not change a suggestion list you already had.

Each span may declare `conditions` (bass/soprano/metric) and `waivers` — the
part-writing rules it deliberately breaks, so that a future rule checker doesn't
red-ink fauxbourdon for the parallel motion that *is* fauxbourdon. **Conditions
are declared but not yet evaluated**; waivers are live data.

---

## 11. Getting somewhere — cadence targeting

The questions above are all "what may follow this chord". This one is
different: *get me there*.

```js
import { pathToCadence } from 'ollave/lib'

pathToCadence('C', 'PAC', 4, 'C', 'major').paths[0].summary
// 'I - IIm - V - I'
```

Four bars, ending in a perfect authentic cadence. The search is weighted by
harmonic function — tonic wants a predominant, a predominant wants a dominant —
so the paths come back goal-directed rather than merely legal.

Seven cadence types, all routable in both modes:

```js
pathToCadence('Am', 'plagal', 3, 'A', 'minor').paths[0].summary
// 'Im - IVm - Im'
pathToCadence('Am', 'phrygian-half', 3, 'A', 'minor').paths[0].summary
// 'Im - IVm6 - V'   ← the bass falls a semitone, b6 to 5. That IS the cadence.
pathToCadence('Am', 'evaded', 3, 'A', 'minor').paths[0].summary
// 'Im - V42 - Im6'  ← how to NOT close yet
```

All seven in A minor, three bars each:

| Type | Path |
|---|---|
| `PAC` / `IAC` | `Im - V - Im` |
| `half` | `Im - IIdim - V` |
| `deceptive` | `Im - V - VI` |
| `plagal` | `Im - IVm - Im` |
| `phrygian-half` | `Im - IVm6 - V` |
| `evaded` | `Im - V42 - Im6` |

### It never throws, and never pretends

Ask for something impossible and you get a reason:

```js
const r = pathToCadence('C', 'phrygian-half', 4, 'C', 'major')
r.paths    // []
r.reason   // 'cadence-unavailable-in-key'
r.message
// 'The Phrygian half cadence does not exist in major: iv6 to V in minor: the
//  bass falls a semitone from 6 to 5. ... Minor only — in major the same chords
//  give a whole step and the effect is gone.'
```

That is the rule everywhere in this section: best effort with a stated reason,
never a confident wrong answer.

### `cadenceOptions` — every close available from here

```js
import { cadenceOptions } from 'ollave/lib'

cadenceOptions('C', 4, 'C', 'major')
  .filter((o) => o.best)
  .map((o) => [o.type, o.best.summary])
// [['PAC',       'I - IIm - V - I'],
//  ['IAC',       'I - IIm - V - I'],
//  ['half',      'I - I - IIm - V'],
//  ['deceptive', 'I - IIm - V - VIm'],
//  ['plagal',    'I - I - IV - I'],
//  ['evaded',    'I - I - V42 - I6']]
```

`phrygian-half` comes back with `best: null` and the message above — the menu
tells you what is *not* available too.

---

## 12. Changing key on purpose — modulation

§7 named the chords two keys share. This routes *through* one.

```js
import { pathThroughModulation } from 'ollave/lib'

const r = pathThroughModulation('Am', 'PAC', 4, 'A', 'minor', 'C', 'major')
r.plans[0].summary
// 'Im - IVm=IIm - V - I'
```

Read `IVm=IIm` as: this chord is `iv` in the key you are leaving and `ii` in the
key you are entering. **That double reading is the modulation**, so the result
names it rather than handing back a flat chord list:

```js
const plan = r.plans[0]
plan.pivot.name        // 'Dm'
plan.pivot.romanHere   // 'IVm'
plan.pivot.romanThere  // 'IIm'
plan.pivotIndex        // 1 — which bar the hinge is
```

`Dm` is the textbook hinge for this modulation precisely because it arrives as a
*predominant* in the new key: the new key can immediately set up its own
cadence. The ranking encodes that — a predominant-there pivot costs 0, a
tonic-there 2, a dominant-there 3.

### Enharmonic modulation

C major and D♭ major share **no diatonic chord at all**. The hinge has to be a
chord that is respelled:

```js
import { pathThroughModulation, chromaticPivotSources } from 'ollave/lib'

const r = pathThroughModulation('C', 'PAC', 4, 'C', 'major', 'Db', 'major', {
  extraPivots: chromaticPivotSources,
})
r.plans[0].summary        // 'I - IIm - Ger6=V7 - I'
r.plans[0].pivot.name     // 'Ger6'   ← what C major calls it
r.plans[0].pivot.nameThere // 'Ab7'   ← what Db major calls it
r.plans[0].pivot.explanation
// 'The German sixth Ab-C-Eb-F# has a perfect fifth above its bass, so
//  respelling F# as Gb makes it Ab7 — the dominant seventh of Db, the
//  Neapolitan degree of C major.'
```

That is the most famous enharmonic modulation in the common-practice
repertoire, and it is why `nameThere` exists: an enharmonic pivot is a chord
spelled *differently in the two keys*, so one name cannot describe it.

Two families ship, plus the Neapolitan:

```js
import { pivotsBetween, chromaticPivotSources } from 'ollave/lib'

pivotsBetween('C', 'major', 'Db', 'major', { extraPivots: chromaticPivotSources })
  .map((p) => [p.name, p.nameThere, p.romanHere, p.romanThere, p.kind, p.cost])
// [['N6',   'Db',  'N6',   'I',  'chromatic',  5],
//  ['Ger6', 'Ab7', 'Ger6', 'V7', 'enharmonic', 6]]
```

and the four rotations of a diminished seventh:

```js
import { enharmonicPivotSource } from 'ollave/lib'

enharmonicPivotSource('A', 'minor', 'C', 'minor')
  .map((p) => [p.name, p.nameThere, p.romanThere])
// [['G#dim7', 'Bdim7', 'VIIdim7']]
```

Same four pitches, different leading tone, different key.

**Chromatic pivots pay a cost surcharge** (+3 enharmonic, +3 Neapolitan, +4
chromatic mediant) so they stay reachable without burying a smooth diatonic
hinge. Ask A minor → C major with the chromatic sources on and the answer is
unchanged: `Dm` still leads, because there is a good diatonic hinge and a swerve
should not outrank it.

---

## 13. Four voices

```js
import { realizeProgression } from 'ollave/lib'

const r = realizeProgression(['C', 'F', 'G', 'C'], {
  key: { tonic: 'C', mode: 'major' },
})
r.chords.map((c) => c.voicing)
// [['C3','C4','E4','G4'],
//  ['F3','C4','F4','A4'],
//  ['G3','B3','D4','G4'],
//  ['C3','C4','E4','G4']]
r.legal  // true
```

Bass, tenor, alto, soprano — low to high. It is a beam search over doublings,
orderings and octaves, scored so that no amount of smoothness buys a single
error. The rules it checks (fourteen, each citing Aldwell & Schachter, Piston or
Fux) are in [the deep dive](./chord-theory.md).

### Checking rather than writing

A composer with their own part-writing wants it checked, not rewritten:

```js
import { checkVoiceLeading } from 'ollave/lib'

checkVoiceLeading(['C3','E3','G3','C4'], ['D3','F3','A3','D4'])
  .map((v) => [v.rule, v.severity])
// [['parallel-fifths', 'error'], ['parallel-octaves', 'error']]
```

**The default never removes anything.** `strictness` defaults to `'report'`;
pass `'warn'` to sort violations last or `'block'` to filter. Individual rules
toggle through `opts.rules`, because a composer may accept hidden fifths and not
parallel octaves.

### Waivers — the tool must not red-ink its own content

Fauxbourdon *is* parallel motion. A checker that flagged it would be flagging
this library's own shipped span. So spans declare the rules they license:

```js
import { spanById, spanWaivedRules } from 'ollave/lib'

spanWaivedRules(spanById('fauxbourdon'))
// ['parallel-fourths', 'parallel-fifths', 'doubled-leading-tone']
```

Pass that as `waivedRules` and those rules stop firing — and stop *steering the
search*, since a waived rule costs zero. `composeSpan` (§15) does it for you.

---

## 14. Where the bars fall

```js
import { suggestHarmonicRhythm } from 'ollave/lib'

suggestHarmonicRhythm(['C', 'Dm', 'G', 'C'], '3/4').steps
  .map((s) => [s.chord, s.bar, s.barDelay, s.position.level])
// [['C',  0, 0,   'downbeat'],
//  ['Dm', 0, 128, 'beat'],
//  ['G',  0, 256, 'beat'],
//  ['C',  1, 0,   'downbeat']]
```

`barDelay` is in the engine's own ticks, ready to hand to `addChord`. A 3/4 bar
is 384 ticks, so the fourth chord starts the next bar and lands on a downbeat —
which is where a cadence wants to be.

Harmonic rhythm is a *compositional parameter*, not a derived quantity: this
suggests a placement and explains its reasoning in `notes`, which is a starting
point to edit rather than an answer. It models a flat metric grid only — no
hypermeter, no grouping structure.

---

## 15. All of it, in one call

Everything above composes. `composeProgression` runs the cadence search, the
four-voice realization and the metric placement together, and translates between
their vocabularies:

```js
import { composeProgression } from 'ollave/lib'

const p = composeProgression('C', 'PAC', 4, 'C', 'major')

p.summary
// 'I - IIm - V - I'

p.bars.map((b) => [b.roman, b.chord, b.function, b.voicing.join(' '),
                   `b${b.placement.bar}+${b.placement.barDelay}`])
// [['I',   'C',  'T',  'C3 C4 E4 G4', 'b0+0'],
//  ['IIm', 'Dm', 'PD', 'D3 A3 D4 F4', 'b0+128'],
//  ['V',   'G',  'D',  'G3 B3 D4 G4', 'b0+256'],
//  ['I',   'C',  'T',  'C3 C4 E4 G4', 'b0+384']]

p.legal  // true
```

And with a modulation:

```js
import { composeModulation } from 'ollave/lib'

const m = composeModulation('C', 'PAC', 4, 'C', 'major', 'Db', 'major')

m.summary       // 'I - IIm - Ger6=V7 - I'
m.pivot.name    // 'Ger6'
m.pivotIndex    // 2
m.bars.map((b) => [b.roman, b.chord, b.voicing.join(' ')])
// [['I',   'C',   'C3 E3 E4 G4'],
//  ['IIm', 'Dm',  'D3 A3 D4 F4'],
//  ['V7',  'Ab7', 'Ab2 Ab3 C4 Eb4'],
//  ['I',   'Db',  'Db3 Ab3 Db4 F4']]
m.legal  // true
```

Chromatic pivots are **on by default** in `composeModulation`, because the
modulations you most want help with are the ones a diatonic scan cannot find.
Pass `extraPivots: []` for diatonic hinges only.

### It handles the chords that aren't chord symbols

`V64`, `N6` and the augmented sixths are chart nodes, not chord names (§"Chord
names that aren't chord names"). Handed straight to `realizeProgression` they
stop it dead. The composed call resolves them and tells you:

```js
const p = composeProgression('Am', 'half', 4, 'A', 'minor')
p.summary  // 'Im - IIdim - V64 - V'

p.bars[2]
// { node: 'V64', chord: 'Am', figure: '64', roman: 'V64',
//   voicing: ['E3','A3','E4','C5'], resolvedFrom: 'V64', ... }

p.notes[0]
// 'V64 is a chord-function node, not a chord symbol; realized as Am in 64 —
//  the same pitches, named so they can be voiced.'
```

A cadential ⁶₄ is tonic notes over the *fifth* degree, so `V64` in A minor
becomes `Am` in ⁶₄ position — bass on E, and E doubled, which is the required
doubling for this chord.

**Augmented sixths are different, and the difference matters.** ♭6-1-♯4 is not a
stack of thirds, so no chord symbol is correct for it — and `Chord.detect` gives
a *wrong* one, respelling the ♯4 as a ♭7 and turning an outward-resolving
augmented sixth into a dominant seventh. So they are voiced from their literal
notes:

```js
const g = composeProgression('Ger6', 'half', 3, 'A', 'minor')
g.bars[0].chord    // null — there is no correct chord symbol, so none is invented
g.bars[0].voicing  // ['F2','A2','C4','D#4']   ← D#, not Eb. b6 in the bass, #4 on top.
g.legal            // true
```

### `composeSpan` — the library's own devices

```js
import { composeSpan, spanById } from 'ollave/lib'

const f = composeSpan(spanById('fauxbourdon'), 'C', 'major')
f.summary  // 'I6 - VIIdim6 - VIm6 - V6'
f.bars.map((b) => b.voicing.join(' '))
// ['E3 G3 C4 E4', 'D3 F3 B3 F4', 'C3 E3 C4 A4', 'B2 D3 D4 G4']
f.legal    // true
f.notes[0]
// 'waived for this span (fauxbourdon): parallel-fourths, parallel-fifths,
//  doubled-leading-tone — the device deliberately breaks these, so they are
//  not reported as defects.'
```

The span's waivers are applied without you asking: naming the device *is* the
declaration.

### Nothing was folded into `nextChordDetail`

`nextChordDetail` answers "what may follow this chord", and its `include` /
`rankBy` options are sugar over functions that also stand alone. A four-voice
phrase plan is a **different question**, not a richer answer to the same one —
so `composeProgression` is its own entry point and the pieces it composes stay
importable on their own. Use whichever grain you need.

---

## 16. Reading music you already wrote

The inverse query, and quietly one of the most useful things here — analysis of
your own music rather than suggestions for music you have not written.

```js
import { detectCadences } from 'ollave/lib'

detectCadences(['C','F','Dm','G','Am','F','G','C'], 'C', 'major')
  .map((c) => [c.index, c.type, c.romans.join('-'), c.confidence])
// [[2, 'half',      'IIm-V',  'low'],
//  [3, 'deceptive', 'V-VIm',  'high'],
//  [5, 'half',      'IV-V',   'low'],
//  [6, 'IAC',       'V-I',    'medium']]
```

**Confidence is the feature.** A wrong label is worse than a missing one, so
thin evidence downgrades the label rather than withholding it, and `reason` says
why:

```js
// the closing V-I:
// 'V to I: an authentic cadence. No soprano supplied, so it cannot be
//  confirmed as perfect'

// the mid-phrase IIm-V:
// 'IIm to V mid-phrase: a half cadence only if the phrase stops here'
```

Supply a soprano and the perfect authentic cadence can be confirmed:

```js
detectCadences([{ name: 'G', soprano: 'D' }, { name: 'C', soprano: 'C' }],
               'C', 'major')[0].type   // 'PAC'
```

Detection **does not consult the chart's edges**, deliberately: it matches
romans. `IVm→Im` and `V→VI` were absent from the minor chart for a long time and
are perfectly ordinary music, and analysis must not be limited by what the
generator happens to offer.

---

## Voicings and attacks in bar templates

Bar templates (`ollave/lib/barTemplates`) gained a second way to source a
gesture's pitches, and a second way to time and select which of those pitches
sound. A `voicing` source gives a gesture EXPLICIT pitches (with provenance —
the chord/roman it was realized from) instead of naming a chord to resolve at
compile time; `attacks` replaces the legacy mode/spread/scope fields with an
ordered list of `{ offsetTicks, selection, action }` entries, each picking a
subset of the gesture's ascending source pitches and sounding them together
(`pluck`) or spread out (`strum`).

`selection` names WHICH pitches: `all`, `note-indexes` (explicit ascending
indices), `bass`/`treble` (lowest/highest N). The figuration presets in
`attackPresets.ts` build common `attacks` arrays without knowing the eventual
voicing size — `blockAttack` (chorale), `arpUpAttacks`/`arpDownAttacks`/
`arpUpDownAttacks`, `albertiAttacks`.

```js
import { arpUpAttacks } from 'ollave/lib/barTemplates'
import { compileGesturesToNotes } from 'ollave/lib/barTemplates'

const gesture = {
  id: 'doc1',
  startStep: 0,
  source: { kind: 'voicing', pitches: ['C3', 'C4', 'E4', 'G4'], chord: 'C', roman: 'I' },
  mode: 'strum', direction: 'down', spread: 'tight',
  velocity: 90, durationTicks: 128,
  attacks: arpUpAttacks({ count: 4, subdivisionTicks: 32 }),
}

compileGesturesToNotes([gesture], ctx).notes.map(n => n.note)
// ['C3', 'C4', 'E4', 'G4'] — one pluck per 32-tick step, ascending
```

A gesture with `attacks` present ignores the legacy `mode`/`spread`/
`scopeSteps`/`rollPattern`/`pluckIndex`/`toneOrder`/`mutedToneIndices` fields
entirely; a gesture without `attacks` compiles exactly as it always has —
this is purely additive.

---

## At the command line

Every capability above has a subcommand. Real output:

```
$ chord cadence C --to PAC --bars 4 --tonic C --scale major
key       C major
cadence   perfect authentic cadence
summary   I - IIm - V - I
meter     4/4
bars      I         C      53  T  C3 C4 E4 G4          b0+0 downbeat
          IIm       Dm     53  PD D3 A3 D4 F4          b0+128 beat
          V         G      53  D  G3 B3 D4 G4          b0+256 secondary
          I         C      53  T  C3 C4 E4 G4          b0+384 beat
legal     no voice-leading violations
```

```
$ chord modulate C --key "Db major" --tonic C --scale major
key       C major -> Db major
summary   I - IIm - Ger6=V7 - I
pivot     Ger6 = Ab7  Ger6 / V7  (enharmonic, bar 3)
bars      I         C      53  T  C3 E3 E4 G4          b0+0 downbeat
          IIm       Dm     53  PD D3 A3 D4 F4          b0+128 beat
          V7        Ab7    53  D  Ab2 Ab3 C4 Eb4       b0+256 secondary
          I         Db     53  T  Db3 Ab3 Db4 F4       b0+384 beat
```

```
$ chord analyze C,F,Dm,G,Am,F,G,C --tonic C --scale major
cadences  bar 3-4  half cadence  IIm -> V  (Dm G)  low — IIm to V mid-phrase: a half cadence only if the phrase stops here
          bar 4-5  deceptive cadence  V -> VIm  (G Am)  high
          bar 6-7  half cadence  IV -> V  (F G)  low — IV to V mid-phrase: a half cadence only if the phrase stops here
          bar 7-8  imperfect authentic cadence  V -> I  (G C)  medium — V to I: an authentic cadence. No soprano supplied, so it cannot be confirmed as perfect
```

Also: `chord realize C,F,G,C` for four voices over chords you already have, and
`chord realize --span fauxbourdon` for one of the library's own devices. The key
comes from the current phase unless you pass `--tonic` and `--scale`.

---

## Related

- [Deep dive: the theory](./chord-theory.md) — where the map comes from, what
  the dotted arrows mean, how the unusual chords work
- `CHANGELOG.md` — what changed in 0.6.0, and in 0.4.0 before it
