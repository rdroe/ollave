import { Chord, Note } from 'tonal'

import type { CadenceType } from './cadence'
import { chromaticPivotSources } from './chromaticPivots'
import { chordNameWithNotes, romanChordNameToReal } from './graphh'
import type { Figure, HarmonicSpan } from './graphData/types'
import { edgeChord, edgeFigure, figuredRoman } from './figuredBass'
import { functionOf, type HarmonicFunction } from './harmonicFunction'
import {
  suggestHarmonicRhythm,
  type HarmonicRhythmStep,
  type MeterName,
  type MeterSpec,
} from './harmonicRhythm'
import {
  pathThroughModulation,
  type ModulationOptions,
  type PivotCandidate,
} from './modulation'
import {
  checkProgression,
  realizeProgression,
  type PartWritingOptions,
  type RealizedProgression,
  type Violation,
} from './partWriting'
import { pathToCadence, type PathStep, type PathToCadenceOptions } from './progressionPath'
import { spanWaivedRules } from './spans'
import type { Voicing } from './voiceLeading'

/**
 * THE COMPOSED ENTRY POINT — Stage M-C, integration proper.
 *
 * Everything in Stage M-B was built by a stream that owned its own files and
 * talked to no one. Each piece works; none of them had met. This module is
 * where the two features the plan's Premise ranks FIRST and SECOND in delight
 * to the audience — modulation-aware cadence targeting, and whole-progression
 * four-voice realization — become one call:
 *
 *   "Get me from A minor to a perfect authentic cadence in C major in five
 *    bars, show me the hinge, write it in four voices without parallel fifths,
 *    and tell me where the bars fall."
 *
 * ── WHAT COMPOSING THEM ACTUALLY REQUIRED ───────────────────────────────────
 *
 * Not glue. Two real impedance mismatches had to be solved, both found by probe
 * rather than by reading the types — the types agreed, the DATA did not:
 *
 *   1. **B2 emits chart node names; B1 realizes chord symbols.** A path from
 *      `pathToCadence` can contain `V64`, `N6`, `Aug6`, `It6`, `Fr6` or `Ger6`,
 *      which are chord-FUNCTION nodes: names whose pitches exist only relative
 *      to a key. Probed: `realizeProgression(['Am','Bdim','V64','E'])` returns
 *      `incomplete: "could not realize 'V64' with figure '53'"` and stops. So a
 *      composed call has to TRANSLATE, and `resolveStep` below is that
 *      translation — the one genuinely new piece of work in this module.
 *
 *   2. **An augmented sixth cannot go through chord detection.** Probed:
 *      `Chord.detect(['F','A','D#'])` returns `['F7no5']`, respelling D♯ as E♭
 *      and converting an outward-resolving augmented sixth into a dominant
 *      seventh — the exact error PLAN-MUSIC.md's A7 note records. So the trio
 *      is voiced FROM ITS LITERAL NOTE LIST and never from a chord symbol. See
 *      `voiceExactly`.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ───────────────────────────────────────────
 *
 * No new search, no new rules, no new metric model. Every musical judgement is
 * still made by the stream that owns it: `pathToCadence` and
 * `pathThroughModulation` choose the chords, `realizeProgression` chooses the
 * voicing, `suggestHarmonicRhythm` chooses the placement. This module decides
 * only the ORDER they run in and how the vocabulary converts between them,
 * which is what "compose first, add sugar later" means.
 */

// ---------------------------------------------------------------------------
// step resolution — B2's vocabulary into B1's
// ---------------------------------------------------------------------------

/**
 * A chart step, resolved into something a four-voice realizer can use.
 *
 * `chord` is a REAL chord symbol (or null when the chord is not tertian), and
 * `figure` says which of its tones is in the bass. `notes` is the literal pitch
 * classes, which is the only correct description of an augmented sixth.
 */
export type ResolvedStep = {
  /** the chart's name for this step, e.g. 'V64' or 'Am' */
  node: string
  /** a resolvable chord symbol, or null for a non-tertian chord */
  chord: string | null
  /** which chord tone is in the bass */
  figure: Figure
  /** the literal pitch classes, always correct even when `chord` is null */
  notes: string[]
  /** the roman as the path reported it, e.g. 'IVm6' */
  roman: string
  function: HarmonicFunction | null
  /**
   * Set when this step is one of the chord-function nodes and had to be
   * rewritten. Carried so a caller can explain why the realized chord's name
   * differs from the one the path reported.
   */
  resolvedFrom?: string
}

/**
 * The chord-function nodes and how each converts to (chord, figure).
 *
 * ── WHY A TABLE AND NOT A PARSER ────────────────────────────────────────────
 *
 * PLAN-MUSIC.md's A7 record settled that these three (now six, after B4 split
 * the augmented sixth) stay as documented ALIASES rather than being retired,
 * and probed exactly what each one converts to. This table is that record made
 * executable:
 *
 *   `V64` is `I⁶₄` — tonic notes over the fifth degree in the bass. Probed:
 *   `figuredVoicings('C','64')` gives `G3 C4 E4`, the same pitch classes the
 *   node gives and better voiced, so the conversion loses nothing.
 *
 *   `N6` is `♭II⁶` — the Neapolitan is literally named as a first inversion.
 *   Probed in A minor: `D3 F3 Bb3`, byte-identical to the node.
 *
 *   The AUGMENTED SIXTHS CONVERT TO NOTHING, and that is the interesting
 *   entry. A7 established it and this module depends on it: an augmented sixth
 *   is ♭6-1-♯4 whose outer interval is an augmented sixth rather than a stacked
 *   third, so there is no root to invert and no chord tone for a figure to
 *   select. `chord: null` is not a failure path here — it is the correct
 *   description, and `voiceExactly` handles it.
 */
const FUNCTION_NODE_RESOLUTION: {
  [node: string]: { degree: string; quality: 'tonic' | 'flat2' | 'none'; figure: Figure }
} = {
  // I over the fifth degree — the cadential six-four
  V64: { degree: '1P', quality: 'tonic', figure: '64' },
  // bII in first inversion — the Neapolitan
  N6: { degree: 'm2', quality: 'flat2', figure: '6' },
  // not tertian; voiced from notes (see the table doc)
  Aug6: { degree: '', quality: 'none', figure: '53' },
  It6: { degree: '', quality: 'none', figure: '53' },
  Fr6: { degree: '', quality: 'none', figure: '53' },
  Ger6: { degree: '', quality: 'none', figure: '53' },
}

/** pitch classes of a chart node in a key, via the chart's own constructors */
const nodeNotes = (node: string, tonic: string, mode: 'major' | 'minor'): string[] => {
  const cnwn = chordNameWithNotes(node, 3, tonic, mode)
  return (cnwn?.notes ?? []).map((n) => Note.get(n).pc).filter((pc) => !!pc)
}

/**
 * Resolve one path step into a realizable chord.
 *
 * A plain step passes through untouched, which is the common case and the one
 * that must stay cheap. Only the six chord-function nodes are rewritten.
 */
export const resolveStep = (
  step: PathStep,
  tonic: string,
  mode: 'major' | 'minor'
): ResolvedStep => {
  const base = {
    node: step.name,
    roman: step.roman,
    function: step.function,
  }
  const entry = FUNCTION_NODE_RESOLUTION[step.name]

  if (!entry) {
    // an ordinary chart node: the name IS a chord symbol
    const chord = Chord.get(step.name)
    return {
      ...base,
      chord: chord.empty ? null : step.name,
      figure: (step.figure as Figure | undefined) ?? '53',
      notes: chord.empty
        ? nodeNotes(step.name, tonic, mode)
        : chord.notes.map((n) => Note.get(n).pc),
    }
  }

  const notes = nodeNotes(step.name, tonic, mode)

  if (entry.quality === 'none') {
    // an augmented sixth. NOT tertian, so no chord symbol is correct and
    // `Chord.detect` on these notes is actively wrong — see the module header.
    return { ...base, chord: null, figure: '53', notes, resolvedFrom: step.name }
  }

  // `V64` -> the tonic triad; `N6` -> the b2 major triad. Roots are derived by
  // INTERVAL TRANSPOSITION from the tonic, never by scale-degree lookup — the
  // rule mixture.ts, chromatic.ts and the augmented sixths all follow, because
  // degree arithmetic double-flattens in minor and mis-spells in flat keys.
  const root = Note.transpose(tonic, entry.degree)
  if (!root) return { ...base, chord: null, figure: entry.figure, notes }
  // V64 is the TONIC triad, which takes the key's own mode; the Neapolitan is
  // major in both modes (that is what makes it a chromatic chord in major).
  const name = entry.quality === 'tonic' && mode === 'minor' ? `${root}m` : root
  const chord = Chord.get(name)
  return {
    ...base,
    chord: chord.empty ? null : name,
    figure: entry.figure,
    notes: chord.empty ? notes : chord.notes.map((n) => Note.get(n).pc),
    resolvedFrom: step.name,
  }
}

/**
 * Four voices for a chord that has no chord symbol — the augmented sixths.
 *
 * Places the pitch classes in ascending order from the bass, doubling the
 * lowest note an octave up when there are only three (the Italian sixth), which
 * is the conventional doubling: ♭6-1-♯4 is written with the TONIC doubled,
 * never ♭6 or ♯4, since both of those are tendency tones that must resolve
 * outward and doubling either would produce parallel motion into the dominant.
 *
 * Simple by design. This is not a search — `realizeProgression`'s beam cannot
 * enumerate voicings for a chord it cannot name, so the honest thing is one
 * correctly-spelled voicing and a note in the result saying so, rather than a
 * search that pretends to have optimized something.
 *
 * IT DOES STILL HAVE TO BE A REAL SATB VOICING. Probed: an earlier version
 * stacked the pitches from the bottom of the bass register upward and produced
 * `F2 A2 C3 D#3` — four voices inside an octave and a half, which
 * `checkVoiceLeading` correctly reported as `voice-overlap` against the chord
 * that followed. So each voice is placed in ITS OWN range: the bass takes the
 * lowest octave its range allows, and every voice above it takes the lowest
 * octave that is both in range and above the voice beneath.
 */
const SATB_LOW: readonly string[] = ['E2', 'A2', 'F3', 'C4']

const voiceExactly = (notes: string[]): Voicing => {
  if (notes.length === 0) return []
  // b6-1-#4 has three notes; the tonic (the middle one) is doubled, never b6 or
  // #4 — both are tendency tones that must resolve outward, and doubling either
  // would produce parallel motion into the dominant. Four-note forms (the
  // French and German sixths) need no doubling.
  const parts = notes.length === 3 ? [...notes, notes[1] as string] : notes.slice(0, 4)

  const out: string[] = []
  let floor = -Infinity
  parts.forEach((pc, i) => {
    const rangeLow = Note.midi(SATB_LOW[i] ?? 'C4') ?? 60
    let octave = 2
    let midi = Note.midi(`${pc}${octave}`)
    while (
      midi === null ||
      midi === undefined ||
      midi < rangeLow ||
      midi <= floor
    ) {
      octave++
      if (octave > 7) break
      midi = Note.midi(`${pc}${octave}`)
    }
    floor = midi ?? floor
    out.push(`${pc}${octave}`)
  })
  return out
}

// ---------------------------------------------------------------------------
// the composed result
// ---------------------------------------------------------------------------

/** One bar of a composed phrase: the chord, its voicing, its placement. */
export type ComposedBar = {
  /** the chart's name, e.g. 'V64' */
  node: string
  /** the resolvable chord symbol, or null for a non-tertian chord */
  chord: string | null
  roman: string
  figure: Figure
  function: HarmonicFunction | null
  /** four note names, low to high: bass, tenor, alto, soprano */
  voicing: Voicing
  /** violations introduced by the move INTO this bar */
  violations: Violation[]
  /** where this chord falls in the meter */
  placement: HarmonicRhythmStep | null
  /** set when the chart node had to be rewritten to be realizable */
  resolvedFrom?: string
}

export type ComposedPhrase = {
  bars: ComposedBar[]
  /** every violation across the phrase, tagged with the bar index */
  violations: Violation[]
  /** true when the whole phrase is voice-leading legal */
  legal: boolean
  /** the cadence the phrase arrives at */
  cadence: CadenceType
  /** the key it starts in */
  fromKey: string
  /** the key it ends in — the same as `fromKey` unless it modulated */
  toKey: string
  /** the hinge, when the phrase modulated */
  pivot?: PivotCandidate
  /** index of the pivot bar within `bars` */
  pivotIndex?: number
  /** the roman summary, with the pivot shown in both keys */
  summary: string
  meter: MeterName
  /**
   * Whatever the caller should be told that the data does not say by itself:
   * a chord that had to be rewritten, a search that fell short of the requested
   * length, waivers that were applied. NEVER EMPTY when something is off, and
   * empty when nothing is.
   */
  notes: string[]
  /**
   * Set when the phrase could not be produced as asked. NEVER THROWS — the
   * honest-scoping rule the whole library follows: best effort with a reason.
   */
  incomplete?: string
}

export type ComposeOptions = PathToCadenceOptions &
  PartWritingOptions & {
    /** meter for the metric placement; default 4/4 */
    meter?: MeterName | MeterSpec
    /**
     * A span whose waivers this phrase licenses — pass a fauxbourdon or a
     * sequence and its deliberate rule-breaking stops being reported as a
     * defect. `spanWaivedRules(span)` is applied on top of any `waivedRules`
     * the caller passed directly, never instead of them.
     *
     * THIS IS THE ANTI-NAGGING CHANNEL and it is why the option exists at this
     * level rather than being left to the caller: a composed call that red-inked
     * the library's own shipped content would be exactly the failure B1's
     * waiver design was built to prevent.
     */
    span?: HarmonicSpan
    /** search over doublings and spacings; passed to `realizeProgression` */
    beamWidth?: number
    /** starting voicing, if the phrase continues from music that exists */
    startVoicing?: Voicing
    /** even harmonic rhythm rather than accelerating into the cadence */
    accelerateToCadence?: boolean
  }

/** the key rules like `unresolved-leading-tone` need, in B1's shape */
const keyOf = (tonic: string, scale: string): { tonic: string; mode: 'major' | 'minor' } => ({
  tonic,
  mode: scale === 'minor' ? 'minor' : 'major',
})

/**
 * Realize a resolved step list in four voices, routing around the chords
 * `realizeProgression` cannot name.
 *
 * SPLITS THE PROGRESSION at every non-tertian chord and realizes the tertian
 * runs, then stitches the exact voicings in between. That is more honest than
 * either alternative: dropping the augmented sixth would silently change the
 * music, and feeding `Chord.detect`'s wrong answer to the realizer would voice
 * a dominant seventh in its place.
 *
 * The stitched chords are still CHECKED — `checkProgression` runs over the
 * whole finished voicing list — so an augmented sixth that resolves into
 * parallel fifths is still reported. Only the SEARCH skips them.
 */
const realizeResolved = (
  steps: ResolvedStep[],
  opts: PartWritingOptions & { beamWidth?: number; startVoicing?: Voicing }
): { voicings: Voicing[]; searched: boolean; incomplete?: string } => {
  const exact = steps.some((s) => s.chord === null)
  if (!exact) {
    const r: RealizedProgression = realizeProgression(
      steps.map((s) => s.chord as string),
      {
        ...opts,
        figures: steps.map((s) => s.figure),
      }
    )
    return {
      voicings: r.chords.map((c) => c.voicing),
      searched: true,
      ...(r.incomplete ? { incomplete: r.incomplete } : {}),
    }
  }

  // At least one chord has no symbol. Realize the tertian runs and place the
  // others exactly, then let `checkProgression` judge the whole thing.
  const voicings: Voicing[] = []
  let run: ResolvedStep[] = []
  /**
   * Realize the pending run, leading in from the chord before it.
   *
   * `lead` is the previous chord's finished voicing and `leadName` is what to
   * call it. `realizeProgression` treats `startVoicing` as CHORD ZERO — probed:
   * it seeds the beam with that voicing and the search begins at the move into
   * `chordNames[1]`, and chord zero comes BACK in the result. So the lead chord
   * must be prepended to the name list and its returned voicing dropped, or the
   * previous bar is emitted twice. Found by probe: the symptom was an augmented
   * sixth's voicing reappearing on the following bar.
   *
   * THE PLACEHOLDER NAME. The lead chord here is always the non-tertian one, so
   * it has no name to prepend — and probed, passing `'Ger6'` makes
   * `realizeProgression` return `incomplete: "could not realize 'Ger6'"` and
   * emit nothing, because it resolves chord zero before it looks at
   * `startVoicing`. The run's own first name stands in. That is safe rather than
   * merely convenient: chord zero's name is used ONLY as `fromChord` for the
   * seventh-resolution and doubling rules, and an augmented sixth has no chordal
   * seventh to resolve — the ♯4 it does have is a tendency tone the checker
   * cannot evaluate against a chord it cannot name either way. The voicing, which
   * is what every other rule reads, is the real one.
   */
  const flush = (lead?: Voicing) => {
    if (run.length === 0) return
    const leading = lead !== undefined && lead.length > 0
    const names = run.map((s) => s.chord as string)
    const figures = run.map((s) => s.figure)
    const r = realizeProgression(
      leading ? [names[0] as string, ...names] : names,
      {
        ...opts,
        figures: leading ? ['53' as Figure, ...figures] : figures,
        ...(leading ? { startVoicing: lead } : {}),
      }
    )
    for (const c of leading ? r.chords.slice(1) : r.chords) voicings.push(c.voicing)
    run = []
  }
  let lead: Voicing | undefined
  for (const s of steps) {
    if (s.chord === null) {
      flush(lead)
      const v = voiceExactly(s.notes)
      voicings.push(v)
      lead = v
    } else {
      run.push(s)
    }
  }
  flush(lead)
  return { voicings, searched: false }
}

/** shared tail: resolve, realize, place, and describe */
const assemble = (
  steps: PathStep[],
  tonic: string,
  scale: string,
  cadence: CadenceType,
  summary: string,
  opts: ComposeOptions | undefined,
  extra: { fromKey: string; toKey: string; pivot?: PivotCandidate; pivotIndex?: number }
): ComposedPhrase => {
  const notes: string[] = []
  const mode = scale === 'minor' ? 'minor' : 'major'
  const resolved = steps.map((s) => resolveStep(s, tonic, mode))

  for (const r of resolved) {
    if (r.resolvedFrom && r.chord) {
      notes.push(
        `${r.resolvedFrom} is a chord-function node, not a chord symbol; realized as ` +
          `${r.chord}${r.figure === '53' ? '' : ` in ${r.figure}`} — the same pitches, named so they can be voiced.`
      )
    } else if (r.resolvedFrom) {
      notes.push(
        `${r.resolvedFrom} is not a tertian chord (${r.notes.join('-')} — an augmented ` +
          `sixth, not a stacked third), so it is voiced from its notes rather than ` +
          `searched. Chord.detect would respell it as a dominant seventh.`
      )
    }
  }

  // THE WAIVER CHANNEL. A span's own waivers are added to whatever the caller
  // passed, never substituted for them — a caller who waived a rule and also
  // supplied a fauxbourdon span means both.
  const spanWaivers = opts?.span ? spanWaivedRules(opts.span) : []
  const waivedRules = [...(opts?.waivedRules ?? []), ...spanWaivers]
  if (spanWaivers.length > 0) {
    notes.push(
      `waived for this span (${opts?.span?.id}): ${spanWaivers.join(', ')} — ` +
        `the device deliberately breaks these, so they are not reported as defects.`
    )
  }

  const partOpts: PartWritingOptions & { beamWidth?: number; startVoicing?: Voicing } = {
    ...(opts?.strictness ? { strictness: opts.strictness } : {}),
    ...(opts?.rules ? { rules: opts.rules } : {}),
    ...(waivedRules.length > 0 ? { waivedRules } : {}),
    key: opts?.key ?? keyOf(tonic, scale),
    ...(opts?.beamWidth !== undefined ? { beamWidth: opts.beamWidth } : {}),
    ...(opts?.startVoicing ? { startVoicing: opts.startVoicing } : {}),
  }

  const { voicings, searched, incomplete } = realizeResolved(resolved, partOpts)
  if (!searched) {
    notes.push(
      'this phrase contains a chord with no chord symbol, so the four-voice ' +
        'search ran over the tertian stretches only; the whole phrase is still checked.'
    )
  }

  // CHECK THE WHOLE THING, however it was voiced. The search skips chords it
  // cannot name; the checker does not, so an augmented sixth that resolves into
  // parallel fifths is still reported.
  const violations = checkProgression(voicings, {
    ...partOpts,
    figures: resolved.map((s) => s.figure),
  })

  // Metric placement, over the chords as they will be READ (a resolved name
  // where there is one, the node name otherwise — a bar labelled `Ger6` in a
  // rhythm plan is more useful than one labelled `null`).
  const rhythm = suggestHarmonicRhythm(
    resolved.map((s) => s.chord ?? s.node),
    opts?.meter ?? '4/4',
    {
      ...(opts?.accelerateToCadence !== undefined
        ? { accelerateToCadence: opts.accelerateToCadence }
        : {}),
    }
  )

  const bars: ComposedBar[] = resolved.map((r, i) => ({
    node: r.node,
    chord: r.chord,
    roman: r.roman,
    figure: r.figure,
    function: r.function,
    voicing: voicings[i] ?? [],
    violations: violations.filter((v) => v.at === i),
    placement: rhythm.steps[i] ?? null,
    ...(r.resolvedFrom ? { resolvedFrom: r.resolvedFrom } : {}),
  }))

  return {
    bars,
    violations,
    legal: violations.length === 0,
    cadence,
    fromKey: extra.fromKey,
    toKey: extra.toKey,
    ...(extra.pivot ? { pivot: extra.pivot } : {}),
    ...(extra.pivotIndex !== undefined ? { pivotIndex: extra.pivotIndex } : {}),
    summary,
    meter: rhythm.meter,
    notes,
    ...(incomplete ? { incomplete } : {}),
  }
}

/** an empty phrase carrying a reason — the never-throws failure shape */
const failed = (
  reason: string,
  cadence: CadenceType,
  fromKey: string,
  toKey: string
): ComposedPhrase => ({
  bars: [],
  violations: [],
  legal: false,
  cadence,
  fromKey,
  toKey,
  summary: '',
  meter: '4/4',
  notes: [],
  incomplete: reason,
})

/**
 * A cadence-targeted phrase, voice-leading legal, metrically placed and
 * realized in four voices — THE FIRST HEADLINE FEATURE, composed.
 *
 * One call replaces four, and more importantly replaces the translation between
 * them that a caller would otherwise have to write and get wrong: chart node
 * names into chord symbols, path figures into realization figures, span waivers
 * into checker options, chord list into metric placement.
 *
 * NEVER THROWS. A cadence with no route, a chord that cannot be voiced, a key
 * that has no chart — each returns a phrase with `incomplete` set and whatever
 * was produced, exactly as `pathToCadence` and `realizeProgression` do
 * individually.
 *
 * @example a four-bar phrase to a perfect authentic cadence in C major
 * ```ts
 * const p = composeProgression('C', 'PAC', 4, 'C', 'major')
 * p.summary                    // 'I - IIm - V - I'
 * p.bars[0].voicing            // ['C3', 'G3', 'E4', 'C5']
 * p.legal                      // true
 * p.bars[3].placement!.bar     // which bar the cadence lands in
 * ```
 */
export const composeProgression = (
  from: string,
  cadence: CadenceType,
  bars: number,
  tonic: string,
  scale: string,
  opts?: ComposeOptions
): ComposedPhrase => {
  const key = `${tonic} ${scale}`
  const result = pathToCadence(from, cadence, bars, tonic, scale, opts)
  const path = result.paths[0]
  if (!path) {
    return failed(result.message, cadence, key, key)
  }

  const phrase = assemble(path.steps, tonic, scale, cadence, path.summary, opts, {
    fromKey: key,
    toKey: key,
  })
  if (!result.exact) {
    phrase.notes.push(result.message)
  }
  return phrase
}

/**
 * Realize a SPAN — a fauxbourdon, a lament bass, a cadence formula — in four
 * voices, with the span's own waivers applied.
 *
 * ── WHY THIS IS PART OF INTEGRATION AND NOT SUGAR ───────────────────────────
 *
 * The plan's acceptance rule for the waiver channel is that "the library never
 * red-inks its own shipped content". `spanWaivedRules` has existed since Stage
 * M-A and `waivedRules` since B1, but nothing in the library actually ran the
 * one into the other over the library's OWN spans — B1 verified it against a
 * hand-built fauxbourdon texture, which proves the mechanism and not the wiring.
 * This function is the wiring, and it is why fauxbourdon comes back clean here
 * rather than flagged three times.
 *
 * The waivers steer the SEARCH, not just the report: `realizeProgression` costs
 * a waived rule at zero, so the beam is free to find the parallel motion the
 * device is made of instead of routing around it.
 *
 * A span is roman-keyed and key-independent (that is what makes it a template),
 * so it needs a key to become chords. Modes the span declares itself unsuited
 * to are reported rather than silently realized.
 *
 * @example the library's own fauxbourdon, realized clean
 * ```ts
 * const p = composeSpan(spanById('fauxbourdon')!, 'C', 'major')
 * p.legal    // true — the parallel fourths are the point, and are waived
 * p.summary  // 'I6 - VIIdim6 - VIm6 - V6'
 * ```
 */
export const composeSpan = (
  span: HarmonicSpan,
  tonic: string,
  scale: string,
  opts?: ComposeOptions
): ComposedPhrase => {
  const key = `${tonic} ${scale}`
  const mode: 'major' | 'minor' = scale === 'minor' ? 'minor' : 'major'

  const steps: PathStep[] = []
  for (const step of span.steps) {
    const roman = edgeChord(step)
    const figure = edgeFigure(step)
    let name: string | null = null
    try {
      name = romanChordNameToReal(tonic, scale, roman)
    } catch {
      name = null
    }
    if (!name) {
      return failed(
        `'${roman}' could not be resolved in ${key}, so the span '${span.id}' cannot be realized here.`,
        'PAC',
        key,
        key
      )
    }
    steps.push({
      name,
      roman: figuredRoman(roman, figure),
      function: functionOf(roman),
      ...(figure && figure !== '53' ? { figure } : {}),
    })
  }

  // THE SPAN'S OWN WAIVERS, always. A caller realizing `spanById('fauxbourdon')`
  // has said which device this is; making them ALSO pass `span:` in the options
  // to get its waivers would be the nagging trap with an extra step.
  const phrase = assemble(
    steps,
    tonic,
    scale,
    'PAC',
    steps.map((s) => s.roman).join(' - '),
    { ...opts, span },
    { fromKey: key, toKey: key }
  )
  if (span.modes && !span.modes.includes(mode)) {
    phrase.notes.push(
      `'${span.id}' declares itself ${span.modes.join('/')}-only; realizing it in ` +
        `${key} is outside what it was authored for.`
    )
  }
  if (span.notes) phrase.notes.push(span.notes)
  return phrase
}

/**
 * A MODULATING cadence-targeted phrase, realized in four voices — THE SECOND
 * HEADLINE FEATURE, and the one the plan's Premise ranks first in delight.
 *
 * Same composition as `composeProgression`, over
 * `pathThroughModulation` instead of `pathToCadence`, so the phrase names its
 * hinge: `pivot` carries the chord in both readings and `pivotIndex` says which
 * bar it is.
 *
 * CHROMATIC PIVOTS ARE ON BY DEFAULT here, which is the one place this module
 * makes a choice rather than passing one through. The reason is that the
 * modulations a composer most wants help with are exactly the ones a diatonic
 * scan cannot find — C major to D♭ major shares NO diatonic chord, so without
 * the enharmonic and Neapolitan sources it is reported unreachable. Pass
 * `extraPivots: []` for diatonic hinges only.
 *
 * @example the textbook modulation, realized
 * ```ts
 * const p = composeModulation('Am', 'PAC', 5, 'A', 'minor', 'C', 'major')
 * p.summary        // 'Im - IVm=IIm - V - I' — the pivot in both keys
 * p.pivot!.name    // 'Dm'
 * p.bars[p.pivotIndex!].voicing
 * ```
 *
 * @example the most famous enharmonic modulation in the repertoire
 * ```ts
 * composeModulation('C', 'PAC', 4, 'C', 'major', 'Db', 'major').summary
 * // 'I - IIm - Ger6=V7 - I' — the German sixth of C heard as V7 of Db
 * ```
 */
export const composeModulation = (
  from: string,
  cadence: CadenceType,
  bars: number,
  fromTonic: string,
  fromScale: string,
  toTonic: string,
  toScale: string,
  opts?: ComposeOptions & ModulationOptions
): ComposedPhrase => {
  const fromKey = `${fromTonic} ${fromScale}`
  const toKey = `${toTonic} ${toScale}`
  const result = pathThroughModulation(
    from,
    cadence,
    bars,
    fromTonic,
    fromScale,
    toTonic,
    toScale,
    { extraPivots: chromaticPivotSources, ...opts }
  )
  const plan = result.plans[0]
  if (!plan) {
    return failed(result.message, cadence, fromKey, toKey)
  }

  // Realize in the TARGET key. The phrase ends there, so the key-dependent
  // rules — the leading tone, the augmented second, cadential resolution — are
  // the target key's. Probed alternative: realizing in the home key flags the
  // new key's leading tone as an unresolved one, which is a wrong rule fired
  // with confidence, and this audience is the one that notices.
  const phrase = assemble(
    plan.steps,
    toTonic,
    toScale,
    cadence,
    plan.summary,
    opts,
    { fromKey, toKey, pivot: plan.pivot, pivotIndex: plan.pivotIndex }
  )
  phrase.notes.unshift(
    `pivot: ${plan.pivot.name} is ${plan.pivot.romanHere} in ${fromKey} and ` +
      `${plan.pivot.romanThere} in ${toKey}` +
      (plan.pivot.nameThere ? `, respelled ${plan.pivot.nameThere}` : '') +
      '.'
  )
  if (plan.pivot.explanation) phrase.notes.push(plan.pivot.explanation)
  if (!result.exact) phrase.notes.push(result.message)
  return phrase
}
