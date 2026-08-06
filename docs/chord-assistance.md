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
| Where could this chord take me? | `pivotSuggestions` |
| Just sketch me something. | `randomProgression` |

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

---

## Smooth voicing when placing

Add the tag `voicing=smooth` when calling `addChord` and the chord is placed in
whichever arrangement sits closest to the previous chord in that phase, instead
of always root position.

It's opt-in. Without the tag, placement is byte-for-byte what it always was.

---

## Inversions

There is no `C/E` chord name, and that's deliberate. **Inversions live in the
voicing layer, not the naming layer.**

`ascendingInversions` already enumerates every one of them:

```js
ascendingInversions('C', { minOctave: 3, maxOctave: 3 })
// [['C3','E3','G3'], ['E3','G3','C4'], ['G3','C4','E4']]
```

and sevenths get all four:

```js
ascendingInversions('Cmaj7', { minOctave: 3, maxOctave: 3 })
// [['C3','E3','G3','B3'], ['E3','G3','B3','C4'],
//  ['G3','B3','C4','E4'], ['B3','C4','E4','G4']]
```

More to the point, you rarely have to ask. `nearestVoicing` and
`voicing=smooth` already *choose* an inversion for you — that's most of what
they do. Moving to `C` while holding `E4 G4 C5` costs distance 0, because the
first inversion is right there.

So an inversion is something ollave picks, not something you spell. Where a
first inversion is structural rather than cosmetic, the map names it by
function instead: `V64` is the cadential six-four and `N6` the Neapolitan
sixth, both of which are *defined* by being inverted.

Two concrete reasons a slash name would be the wrong fix:

- **`/` already means something else here.** The map writes secondary chords as
  `V7/III` and `VIIdim/VIm` — tonicization, not bass notes. A bare `C/E` in the
  same vocabulary is genuinely ambiguous.
- **The underlying library doesn't parse them.** `Chord.get('C/E')` returns no
  notes at all, so a slash name would need its own bass-note parser bolted on
  ahead of the existing chord-name validation.

Neither is fatal, and full slash-chord support is a reasonable future feature.
It just belongs with a bass-note field on the suggestion contract rather than
smuggled into the chord name — which is a larger change than adding sevenths
was, and one nothing currently needs.

---

## Related

- [Deep dive: the theory](./chord-theory.md) — where the map comes from, what
  the dotted arrows mean, how the unusual chords work
- `CHANGELOG.md` — what changed in 0.4.0, including one breaking change for
  major keys
