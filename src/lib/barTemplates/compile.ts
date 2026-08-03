import { randId } from '../util/common'
import { parseChordCsvArg } from '../util/barsUtil'
import { isNoteNameWithOctave } from '../util/noteValidationUtil'
import { chordGraphCreate } from '../util/graphUtil'

import {
  CompileCtx,
  CompiledNote,
  CompileError,
  CompileResult,
  GESTURE_ID_TAG,
  Gesture,
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
