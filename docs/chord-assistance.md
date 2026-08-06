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

## 5. Everything at once

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
have to travel.

---

## 6. Changing key

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

## 7. Sketching

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

## Related

- [Deep dive: the theory](./chord-theory.md) — where the map comes from, what
  the dotted arrows mean, how the unusual chords work
- `CHANGELOG.md` — what changed in 0.4.0, including one breaking change for
  major keys
