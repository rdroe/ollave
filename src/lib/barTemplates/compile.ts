import { Note } from 'tonal'

import { randId } from '../util/common'
import { parseChordCsvArg } from '../util/barsUtil'
import { isNoteNameWithOctave } from '../util/noteValidationUtil'
import { chordGraphCreate } from '../util/graphUtil'

import {
  Attack,
  BASE_BAR_TICKS,
  CompileCtx,
  CompiledNote,
  CompileError,
  CompileResult,
  CUSTOM_BAR_ID_TAG,
  CUSTOM_BAR_INSTANCE_TAG,
  CUSTOM_BAR_TAG,
  CUSTOM_TAG,
  GESTURE_ID_TAG,
  Gesture,
  NoteSelection,
  RollPattern,
  TIGHT_SPREAD_TICKS,
  stepTicks,
} from './schemas'

/**
 * Compile gestures to ollave-native notes ({note, tags[]} pairs).
 *
 * Pure: no mem() writes beyond chordGraphCreate's idempotent graph cache,
 * no DB access. Chord sources resolve via chordGraphCreate +
 * parseChordCsvArg (the same internals addChord uses); strum ordering is
 * low→high for 'down', reversed for 'up'; 'tight' spread uses
 * TIGHT_SPREAD_TICKS between notes, 'rolled' uses DEFAULT_GLISS spacing via
 * caculateNoteDelay. Unresolvable gestures are skipped and reported in
 * errors. Placement-time tags (custom/customBar/barId) are NOT added here.
 */

// letter -> semitone within an octave, mirrors the ChordMenu.tsx pitch-class
// table (web/src/components/ollave-subcomponents/ChordMenu.tsx).
const PITCH_CLASS: { [letter: string]: number } = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
}

/** midi-ish comparable number for ordering a voicing low-to-high; NaN (sorts
 * last, stably) when unparseable — pitches reaching this point should
 * already be validated note-names-with-octave, so this is defense only.
 * Exported for read-only note displays (e.g. the editor's note lane). */
export const pitchHeight = (noteName: string): number => {
  const m = /^([a-g])([#b]*)(-?\d+)$/i.exec(noteName.trim())
  if (!m) {
    return NaN
  }
  let pc = PITCH_CLASS[m[1].toLowerCase()]
  for (const acc of m[2]) {
    pc += acc === '#' ? 1 : -1
  }
  return (parseInt(m[3], 10) + 1) * 12 + pc
}

/** Resolve a chord name to its voicing's pitches, sorted low→high. For UI
 * (e.g. the editor's chord-tone picker); throws on unresolvable chords. */
export const resolveChordPitchesAscending = (
  chordName: string,
  ctx: CompileCtx
): string[] => {
  chordGraphCreate(ctx.scaleTonic, ctx.scaleName)
  const [pitches] = parseChordCsvArg(
    `${chordName},${ctx.octave}`,
    `${ctx.scaleTonic} ${ctx.scaleName}`
  )
  return [...(pitches ?? [])].sort((a, b) => pitchHeight(a) - pitchHeight(b))
}

const resolvePitches = (
  gesture: Gesture,
  ctx: CompileCtx
): { pitches: string[]; sourceTags: string[] } => {
  if (gesture.source.kind === 'note') {
    const { note } = gesture.source
    if (!isNoteNameWithOctave(note)) {
      throw new Error(`"${note}" is not a valid note name with octave`)
    }
    return { pitches: [note], sourceTags: [] }
  }

  if (gesture.source.kind === 'voicing') {
    // A voicing source is only meaningful through the attacks branch (O3);
    // the legacy mode/spread/scope fields have no defined semantics against
    // an explicit pitch list. Reaching here means a voicing-source gesture
    // was compiled with no `attacks` — a non-fatal CompileError, like a bad
    // chord name.
    throw new Error(
      'a "voicing" source gesture requires `attacks` to compile'
    )
  }

  // chord source — mirror addChord's usage of chordGraphCreate +
  // parseChordCsvArg (node_modules/ollave/src/lib/addChord.ts).
  // Per-gesture octave wins over the ctx default.
  const { chordName } = gesture.source
  const octave =
    gesture.octave !== undefined ? String(gesture.octave) : ctx.octave
  chordGraphCreate(ctx.scaleTonic, ctx.scaleName)
  const [pitches, chordTags] = parseChordCsvArg(
    `${chordName},${octave}`,
    `${ctx.scaleTonic} ${ctx.scaleName}`
  )
  if (!pitches || pitches.length === 0) {
    throw new Error(`Chord "${chordName}" resolved to no notes`)
  }
  return { pitches, sourceTags: chordTags }
}

/**
 * Ascending source pitches P for the attacks branch (O3). Mirrors
 * `resolvePitches` per source kind but always returns ascending order (by
 * `Note.midi`, tonal) plus provenance tags:
 *  - `voicing` source: `pitches` sorted ascending by Note.midi; an
 *    unparsable pitch throws (caught by the caller as a non-fatal
 *    CompileError for the gesture, matching bad-chord handling). Provenance
 *    tags come from the source's own `chord`/`roman` fields, not the graph.
 *  - `chord` source: existing resolution via `resolveChordPitchesAscending`
 *    with the gesture octave (already ascending); sourceTags come from
 *    `parseChordCsvArg`.
 *  - `note` source: single-element array, no sourceTags.
 */
const resolveAscendingSourcePitches = (
  gesture: Gesture,
  ctx: CompileCtx
): { pitches: string[]; sourceTags: string[] } => {
  if (gesture.source.kind === 'note') {
    const { note } = gesture.source
    if (!isNoteNameWithOctave(note)) {
      throw new Error(`"${note}" is not a valid note name with octave`)
    }
    return { pitches: [note], sourceTags: [] }
  }

  if (gesture.source.kind === 'voicing') {
    const { pitches, chord, roman } = gesture.source
    for (const p of pitches) {
      if (Note.midi(p) === undefined || Note.midi(p) === null) {
        throw new Error(`"${p}" is not a valid note name with octave`)
      }
    }
    const ascending = [...pitches].sort(
      (a, b) => (Note.midi(a) ?? 0) - (Note.midi(b) ?? 0)
    )
    const sourceTags: string[] = []
    if (roman) sourceTags.push(`roman=${roman}`)
    if (chord) sourceTags.push(`chord=${chord}`)
    return { pitches: ascending, sourceTags }
  }

  // chord source
  const { chordName } = gesture.source
  const octave =
    gesture.octave !== undefined ? String(gesture.octave) : ctx.octave
  chordGraphCreate(ctx.scaleTonic, ctx.scaleName)
  const [pitches, chordTags] = parseChordCsvArg(
    `${chordName},${octave}`,
    `${ctx.scaleTonic} ${ctx.scaleName}`
  )
  if (!pitches || pitches.length === 0) {
    throw new Error(`Chord "${chordName}" resolved to no notes`)
  }
  const ascending = [...pitches].sort(
    (a, b) => pitchHeight(a) - pitchHeight(b)
  )
  return { pitches: ascending, sourceTags: chordTags }
}

/**
 * Selection -> subset of indices into ascending source pitches P, per O3's
 * exact rules. `note-indexes` reuses the SAME defense as legacy `toneOrder`:
 * drop duplicates and out-of-range; an empty result after defense throws
 * (non-fatal CompileError for this gesture, caught by the caller).
 */
const selectionIndices = (
  selection: NoteSelection,
  pCount: number
): number[] => {
  switch (selection.kind) {
    case 'all':
      return Array.from({ length: pCount }, (_, i) => i)
    case 'note-indexes': {
      const seen = new Set<number>()
      const indexes = selection.indexes.filter(
        (i) => i >= 0 && i < pCount && !seen.has(i) && !!seen.add(i)
      )
      if (indexes.length === 0) {
        throw new Error('note-indexes selection is empty after defense')
      }
      return indexes
    }
    case 'bass': {
      const count = Math.min(selection.count ?? 1, pCount)
      return Array.from({ length: count }, (_, i) => i)
    }
    case 'treble': {
      const count = Math.min(selection.count ?? 1, pCount)
      return Array.from({ length: count }, (_, i) => pCount - count + i)
    }
  }
}

/**
 * Order a selection's indices for a strum action: `down` = ascending, `up` =
 * descending, `custom` = `customOrder` with the toneOrder defense (drop
 * duplicate/out-of-range against the SELECTION, i.e. only indices present in
 * `indices`), then any missing selection indices appended ascending.
 */
const orderSelectionForStrum = (
  indices: number[],
  direction: 'down' | 'up' | 'custom',
  customOrder: number[] | undefined
): number[] => {
  if (direction === 'up') {
    return [...indices].reverse()
  }
  if (direction === 'down' || !customOrder) {
    return [...indices]
  }
  // custom
  const allowed = new Set(indices)
  const seen = new Set<number>()
  const ordered = customOrder.filter(
    (i) => allowed.has(i) && !seen.has(i) && !!seen.add(i)
  )
  for (const i of indices) {
    if (!seen.has(i)) {
      ordered.push(i)
      seen.add(i)
    }
  }
  return ordered
}

/**
 * Tag keys a passthrough tag may NEVER set.
 *
 * Identity (noteId/groupId/layer) and placement (barId/gestureId/customBar*)
 * are regenerated by compile or stamped at placement. Letting a stored
 * passthrough tag carry an old value would alias two notes to one id, or link
 * a bar document to a reusable template's propagation.
 */
const IDENTITY_TAG_KEYS = new Set([
  'noteId',
  'groupId',
  'layer',
  'barId',
  GESTURE_ID_TAG,
  CUSTOM_TAG,
  CUSTOM_BAR_TAG,
  CUSTOM_BAR_ID_TAG,
  CUSTOM_BAR_INSTANCE_TAG,
])

/** Tag name before '=', e.g. 'velocity=90' -> 'velocity'. */
const tagKey = (tag: string): string => {
  const eq = tag.indexOf('=')
  return eq === -1 ? tag : tag.slice(0, eq)
}

/**
 * Passthrough tags, with identity/placement keys removed and any key already
 * emitted by compilation dropped so the compiled value wins.
 */
export const sanitizePassthroughTags = (
  passthroughTags: string[] | undefined,
  emittedTags: string[]
): string[] => {
  if (!passthroughTags?.length) {
    return []
  }
  const alreadyEmitted = new Set(emittedTags.map(tagKey))
  const seen = new Set<string>()
  return passthroughTags.filter((tag) => {
    const key = tagKey(tag)
    if (IDENTITY_TAG_KEYS.has(key)) return false
    if (alreadyEmitted.has(key)) return false
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Compile one gesture through the attacks branch (O3). Attacks are applied
 * in array order; each attack sounds a selected subset S of the gesture's
 * ascending source pitches P.
 */
const compileGestureAttacks = (
  gesture: Gesture,
  attacks: Attack[],
  ctx: CompileCtx
): CompiledNote[] => {
  const { pitches: P, sourceTags } = resolveAscendingSourcePitches(
    gesture,
    ctx
  )
  const gestureStartTick = gesture.startStep * stepTicks(ctx.barSizeMultiplier)
  const barTicks = BASE_BAR_TICKS * ctx.barSizeMultiplier

  const out: CompiledNote[] = []

  attacks.forEach((attack, attackIdx) => {
    const base = gestureStartTick + attack.offsetTicks
    const indices = selectionIndices(attack.selection, P.length)

    const velocity = attack.velocity ?? gesture.velocity

    const groupId = randId('', 6)
    const layerId = randId('', 3)

    if (attack.action.kind === 'pluck') {
      // every note of S sounds at base (simultaneous; a multi-note S is a pinch)
      indices.forEach((pIdx) => {
        const relativeTick = base
        const durationTicks = attack.letRing
          ? Math.max(1, barTicks - relativeTick)
          : attack.durationTicks ?? gesture.durationTicks
        const tags = [
          `noteId=${randId('', 6)}`,
          `groupId=${groupId}`,
          `layer=${layerId}`,
          `barDelay=${Math.round(relativeTick)}`,
          `duration=${durationTicks}`,
          `velocity=${velocity}`,
          'quantize=0th',
          `${GESTURE_ID_TAG}=${gesture.id}`,
          ...sourceTags,
        ]
        out.push({
          note: P[pIdx],
          // appended AFTER identity/placement keys are stripped
          tags: [...tags, ...sanitizePassthroughTags(attack.passthroughTags, tags)],
        })
      })
      return
    }

    // strum
    const ordered = orderSelectionForStrum(
      indices,
      attack.action.direction,
      attack.action.customOrder
    )
    const n = ordered.length
    ordered.forEach((pIdx, i) => {
      const spreadTicks = attack.action.kind === 'strum' ? attack.action.spreadTicks : 0
      const spreadShape =
        attack.action.kind === 'strum'
          ? attack.action.spreadShape ?? 'even'
          : 'even'
      const relativeTick =
        base + rollPositionFraction(spreadShape, i, n) * spreadTicks
      const durationTicks = attack.letRing
        ? Math.max(1, Math.round(barTicks - relativeTick))
        : attack.durationTicks ?? gesture.durationTicks
      const tags = [
        `noteId=${randId('', 6)}`,
        `groupId=${groupId}`,
        `layer=${layerId}`,
        `barDelay=${Math.round(relativeTick)}`,
        `duration=${durationTicks}`,
        `velocity=${velocity}`,
        'quantize=0th',
        `${GESTURE_ID_TAG}=${gesture.id}`,
        ...sourceTags,
      ]
      out.push({
        note: P[pIdx],
        tags: [...tags, ...sanitizePassthroughTags(attack.passthroughTags, tags)],
      })
    })
    // attackIdx currently unused beyond iteration order (kept for clarity /
    // potential future per-attack diagnostics)
    void attackIdx
  })

  return out
}

const orderPitchesForGesture = (
  pitches: string[],
  gesture: Gesture
): string[] => {
  if (gesture.mode === 'pluck') {
    // single note only — the pluckIndex-th note of the ascending voicing
    // (default lowest), clamped so a smaller chord still sounds.
    const ascending = [...pitches].sort(
      (a, b) => pitchHeight(a) - pitchHeight(b)
    )
    const idx = Math.min(gesture.pluckIndex ?? 0, ascending.length - 1)
    return [ascending[idx]]
  }

  // strum: a custom toneOrder (ascending-voicing indices in play order) wins;
  // otherwise low->high for 'down', high->low for 'up'. Muted tone indices
  // (ascending convention, like pluckIndex) drop out after ordering, so roll
  // timing distributes over the tones that actually sound.
  const ascending = [...pitches].sort(
    (a, b) => pitchHeight(a) - pitchHeight(b)
  )
  let orderedIndices: number[]
  if (gesture.toneOrder?.length) {
    // Defense against voicing-size drift (chord swapped since the order was
    // set): drop duplicate/out-of-range entries, append missing ascending.
    const seen = new Set<number>()
    orderedIndices = gesture.toneOrder.filter(
      (i) => i >= 0 && i < ascending.length && !seen.has(i) && !!seen.add(i)
    )
    for (let i = 0; i < ascending.length; i++) {
      if (!seen.has(i)) {
        orderedIndices.push(i)
      }
    }
  } else {
    orderedIndices = ascending.map((_, i) => i)
    if (gesture.direction === 'up') {
      orderedIndices.reverse()
    }
  }
  const muted = new Set(gesture.mutedToneIndices ?? [])
  const audible = orderedIndices
    .filter((i) => !muted.has(i))
    .map((i) => ascending[i])
  if (audible.length === 0) {
    throw new Error('every chord tone is muted')
  }
  return audible
}

/**
 * Position fraction (0 ≤ t < 1) of attack idx among noteCount attacks inside
 * a rolled gesture's scope. All fractions stay strictly below 1, so every
 * attack starts within the scope window.
 */
const rollPositionFraction = (
  pattern: RollPattern,
  idx: number,
  noteCount: number
): number => {
  const f = idx / noteCount
  switch (pattern) {
    case 'accelerating':
      // attacks speed up: sparse early, dense late
      return Math.sqrt(f)
    case 'decelerating':
      // fast opening that rings out: dense early, sparse late
      return f * f
    case 'swung': {
      // long-short 2:1 gap pairs (triplet feel): attack positions are the
      // cumulative alternating gaps normalized over all noteCount gaps.
      let total = 0
      let before = 0
      for (let i = 0; i < noteCount; i++) {
        const gap = i % 2 === 0 ? 2 : 1
        if (i < idx) before += gap
        total += gap
      }
      return before / total
    }
    case 'even':
    default:
      return f
  }
}

const delayForNoteIndex = (
  gesture: Gesture,
  gestureBaseDelay: number,
  idx: number,
  noteCount: number,
  ctx: CompileCtx
): number => {
  if (gesture.spread === 'tight') {
    return Math.round(gestureBaseDelay + idx * TIGHT_SPREAD_TICKS)
  }
  // 'rolled': attacks distribute across the gesture's scope window.
  // Deliberately unclamped — a scope reaching past the bar end may place
  // attacks beyond it, mirroring the song UI's laissez-faire timing.
  const scopeTicks =
    (gesture.scopeSteps ?? 1) * stepTicks(ctx.barSizeMultiplier)
  const t = rollPositionFraction(
    gesture.rollPattern ?? 'even',
    idx,
    noteCount
  )
  return Math.round(gestureBaseDelay + t * scopeTicks)
}

export function compileGesturesToNotes(
  gestures: Gesture[],
  ctx: CompileCtx
): CompileResult {
  const notes: CompiledNote[] = []
  const errors: CompileError[] = []

  for (const gesture of gestures) {
    try {
      if (gesture.attacks && gesture.attacks.length > 0) {
        notes.push(...compileGestureAttacks(gesture, gesture.attacks, ctx))
        continue
      }

      const { pitches, sourceTags } = resolvePitches(gesture, ctx)
      const orderedPitches = orderPitchesForGesture(pitches, gesture)

      const gestureBaseDelay =
        gesture.startStep * stepTicks(ctx.barSizeMultiplier)

      const groupId = randId('', 6)
      const layerId = randId('', 3)

      orderedPitches.forEach((pitch, idx) => {
        const barDelay = delayForNoteIndex(
          gesture,
          gestureBaseDelay,
          idx,
          orderedPitches.length,
          ctx
        )
        const tags = [
          `noteId=${randId('', 6)}`,
          `groupId=${groupId}`,
          `layer=${layerId}`,
          `barDelay=${barDelay}`,
          `duration=${gesture.durationTicks}`,
          `velocity=${gesture.velocity}`,
          // Template offsets are surgical (strum spreads are sub-16th); 0th
          // opts out of the song UI's default 16th quantization, which would
          // otherwise snap barDelay and destroy the spread.
          'quantize=0th',
          `${GESTURE_ID_TAG}=${gesture.id}`,
          ...sourceTags,
        ]
        notes.push({ note: pitch, tags })
      })
    } catch (e) {
      errors.push({
        gestureId: gesture.id,
        message: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return { notes, errors }
}
