import { z } from 'zod'

/**
 * Bar templates ("custom bars") — the contract module.
 *
 * This directory is framework-free and structured like the ollave lib
 * (schemas.ts + fetch.ts + barrel) so it can move into
 * ollave/src/lib/barTemplates/ in a single version bump. Only import from
 * 'ollave/lib/...' subpaths, zod, and 'user-tables' here.
 */

/** user-tables discriminator for bar template rows. */
export const BAR_TEMPLATE_TABLE = 'barTemplate'

/**
 * Sentinel song id for the scratch (in-memory, never persisted) song the
 * bar editor mounts. Negative so any stray saveSongAndTracks() call is a
 * guaranteed no-op against the real DB (user-tables update() with an
 * unmatched id modifies zero rows).
 */
export const SCRATCH_SONG_ID = -999999
export const SCRATCH_SONG_NAME = 'scratch-bar-editor'

/** 4/4 bar at ollave's ppq=128 — mirrors tickCounts.bar. */
export const BASE_BAR_TICKS = 512
/** Editor grid resolution: 16 steps = sixteenth notes in a 4/4 bar. */
export const GRID_STEPS = 16

export const stepTicks = (barSizeMultiplier: number): number =>
  (BASE_BAR_TICKS * barSizeMultiplier) / GRID_STEPS

/** Matches ollave's DEFAULT_VELOCITY. */
export const DEFAULT_GESTURE_VELOCITY = 90
/** Matches octaveStore's default; app convention is octaves 1-5. */
export const DEFAULT_GESTURE_OCTAVE = 3
/** Quarter note. */
export const DEFAULT_GESTURE_DURATION_TICKS = 128
/** Inter-note offset for a 'tight' (ordinary) strum. */
export const TIGHT_SPREAD_TICKS = 4

/**
 * Tags stamped onto every note at PLACEMENT time (applyTemplate), never at
 * compile time. `custom=true` drives the locked/non-editable state in the
 * song UI; `customBar=<name>` labels the group and links back to the
 * template it came from.
 */
export const CUSTOM_TAG = 'custom'
export const CUSTOM_BAR_TAG = 'customBar'
/**
 * Rename-proof template linkage: the template's user-tables row id, stamped
 * at placement so propagation can match instances even if names drift.
 */
export const CUSTOM_BAR_ID_TAG = 'customBarId'
/**
 * Placement-instance identity: one fresh id per placement, shared by all of
 * that placement's notes. Lets the same template be placed twice in one bar
 * without propagation collapsing the two, and makes instances atomic units
 * for delete/move/copy. Legacy placements (before this tag) are matched by
 * customBar name and upgraded on first propagation.
 */
export const CUSTOM_BAR_INSTANCE_TAG = 'customBarInstance'
/** Compile-time tag tracing a note back to its source gesture. */
export const GESTURE_ID_TAG = 'gestureId'

/**
 * Scope choices for the editor's dropdown, in steps. Fractions give
 * sub-step roll windows (⅛ step = 4 ticks at multiplier 1).
 */
export const SCOPE_STEP_OPTIONS = [0.125, 0.25, 0.5, 1, 2, 3, 4, 6, 8] as const

const SCOPE_FRACTION_GLYPHS: { [n: number]: string } = {
  0.125: '⅛',
  0.25: '¼',
  0.5: '½',
}

/** Human label for a scope value: ⅛ ¼ ½ 1 2 … */
export const scopeLabel = (n: number): string =>
  SCOPE_FRACTION_GLYPHS[n] ?? String(n)

export const rollPatternSchema = z.enum([
  'even',
  'accelerating',
  'decelerating',
  'swung',
])
export type RollPattern = z.infer<typeof rollPatternSchema>

export const gestureSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('chord'), chordName: z.string().min(1) }),
  z.object({ kind: z.literal('note'), note: z.string().min(1) }),
  z.object({
    kind: z.literal('voicing'),
    /** explicit note names WITH octaves, e.g. ['C3','C4','E4','G4'] */
    pitches: z.array(z.string().min(1)).min(1),
    /** provenance: realized chord symbol this voicing came from */
    chord: z.string().min(1).optional(),
    /** provenance: roman at creation time */
    roman: z.string().min(1).optional(),
  }),
])
export type GestureSource = z.infer<typeof gestureSourceSchema>

/**
 * Attacks — the strummed-bar-document model (bar > gesture > attack sounds a
 * selected part of a voicing). A `NoteSelection` picks which indices of the
 * gesture's ascending source pitches sound; an `AttackAction` says how.
 */
export const noteSelectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({
    kind: z.literal('note-indexes'),
    indexes: z.array(z.number().int().min(0)).min(1),
  }),
  z.object({ kind: z.literal('bass'), count: z.number().int().min(1).optional() }), // absent = 1
  z.object({ kind: z.literal('treble'), count: z.number().int().min(1).optional() }), // absent = 1
])
export type NoteSelection = z.infer<typeof noteSelectionSchema>

export const attackActionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('strum'),
    direction: z.enum(['down', 'up', 'custom']),
    spreadTicks: z.number().int().min(0),
    spreadShape: rollPatternSchema.optional(), // absent = 'even'
    customOrder: z.array(z.number().int().min(0)).optional(),
  }),
  z.object({ kind: z.literal('pluck') }),
])
export type AttackAction = z.infer<typeof attackActionSchema>

export const attackSchema = z.object({
  offsetTicks: z.number().int().min(0), // relative to the gesture's start tick
  selection: noteSelectionSchema,
  action: attackActionSchema,
  velocity: z.number().int().min(0).max(127).optional(), // absent = gesture.velocity
  durationTicks: z.number().int().positive().optional(), // absent = gesture.durationTicks
  letRing: z.boolean().optional(),
})
export type Attack = z.infer<typeof attackSchema>

export const gestureSchema = z.object({
  id: z.string().min(1),
  startStep: z
    .number()
    .int()
    .min(0)
    .max(GRID_STEPS - 1),
  source: gestureSourceSchema,
  /** pluck plays a single note even for a chord source (see pluckIndex). */
  mode: z.enum(['strum', 'pluck']),
  /**
   * Which chord tone a plucked chord source plays: 0-based index into the
   * ascending voicing (0 = lowest/bass). Absent = 0. Ignored for strums and
   * note sources. Out-of-range clamps to the highest note at compile time.
   */
  pluckIndex: z.number().int().min(0).optional(),
  /** Ignored for pluck / single-note sources. */
  direction: z.enum(['down', 'up']),
  /** tight = near-simultaneous strum; rolled = spread across the scope. */
  spread: z.enum(['tight', 'rolled']),
  /**
   * Group timing scope: the window (in steps, fractions allowed) anchored at
   * startStep within which a rolled strum's attacks all begin. Absent = 1.
   * A general gesture concept — rolled strums are its first consumer. May
   * extend past the bar end (deliberately unclamped).
   */
  scopeSteps: z.number().positive().optional(),
  /** How attacks distribute inside the scope when rolled. Absent = 'even'. */
  rollPattern: rollPatternSchema.optional(),
  velocity: z.number().int().min(0).max(127),
  durationTicks: z.number().int().positive(),
  /**
   * Octave for chord-source voicings (1-5, app convention). Absent =
   * DEFAULT_GESTURE_OCTAVE. Ignored for note sources — the pitch string
   * carries its own octave.
   */
  octave: z.number().int().min(1).max(5).optional(),
  /**
   * Ascending-voicing indices (0 = lowest, same convention as pluckIndex) a
   * strummed chord source must NOT play — e.g. [1] plays only root+fifth of
   * a triad. Absent/empty = every tone plays. Ignored for pluck and note
   * sources. Out-of-range indices are ignored at compile (the chord can
   * shrink if the scale context changes); a gesture with every tone
   * suppressed compiles to a non-fatal error, like a bad chord name.
   */
  mutedToneIndices: z.array(z.number().int().min(0)).optional(),
  /**
   * Custom attack order for a strummed chord source: ascending-voicing
   * indices (0 = lowest) in play order, e.g. [1, 2, 0] = "2-3-1" rotation.
   * Absent = derived from `direction` (down = ascending, up = descending);
   * present = wins over `direction` (choosing a plain up/down in the UI
   * clears it, behind a confirm). Compile defends against voicing-size
   * drift: duplicate/out-of-range entries drop, missing indices append in
   * ascending order. Ignored for pluck and note sources.
   */
  toneOrder: z.array(z.number().int().min(0)).optional(),
  /**
   * When present, this gesture compiles via the attacks model instead of the
   * legacy mode/spread/scope path: bar > gesture > attacks, where each
   * attack sounds a selected part of the gesture's source voicing. When
   * `attacks` is present, the legacy fields `mode`, `spread`, `scopeSteps`,
   * `rollPattern`, `pluckIndex`, `toneOrder`, `mutedToneIndices` are IGNORED
   * (gesture-level `velocity`/`durationTicks` remain the attack defaults);
   * when absent, behavior is exactly today's.
   */
  attacks: z.array(attackSchema).min(1).optional(),
})
export type Gesture = z.infer<typeof gestureSchema>

/** Exactly what ollave's makeNoteByBar(note, tags) accepts. */
export const compiledNoteSchema = z.object({
  note: z.string().min(1),
  tags: z.array(z.string()),
})
export type CompiledNote = z.infer<typeof compiledNoteSchema>

export const barTemplateSchema = z.object({
  /** user-tables row id; absent until first save. */
  id: z.number().optional(),
  songId: z.number(),
  /** Display name; unique per song by slug (see slugifyTemplateName). */
  name: z.string().min(1),
  /** Phase this template was built against (scale/chord context). */
  phaseName: z.string(),
  /** Captured from the phase at creation time; bar length may not be 512. */
  barSizeMultiplier: z.number().positive(),
  gestures: z.array(gestureSchema),
  /** Realized ollave-native form; regenerated from gestures on every save. */
  compiledNotes: z.array(compiledNoteSchema),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
})
export type BarTemplate = z.infer<typeof barTemplateSchema>

/** Scale/phase context needed to resolve chords and place ticks. */
export type CompileCtx = {
  phaseName: string
  scaleTonic: string
  scaleName: string
  barSizeMultiplier: number
  /** Octave for chord voicings, e.g. '3' — same convention as addChord's csv arg. */
  octave: string
}

export type CompileError = { gestureId: string; message: string }

export type CompileResult = {
  notes: CompiledNote[]
  /** Gestures that failed to resolve (e.g. bad chord name) are skipped, not fatal. */
  errors: CompileError[]
}

export type ScratchCtx = {
  phaseName: string
  scaleTonic: string
  scaleName: string
  barSizeMultiplier: number
  tempo: number
  initialNotes: CompiledNote[]
}

export type ScratchHandle = {
  /** Must be called from a user-gesture click handler (Tone.js unlock). */
  play: () => void
  stop: () => void
  isPlaying: () => boolean
  /** Current playback tick within the scratch bar (for playhead displays). */
  currentTick: () => number
  /** Call after every gesture edit; safe while playing. */
  recompile: (notes: CompiledNote[]) => Promise<void>
  /** Must be called on editor unmount. Stops playback, restores mem(). */
  teardown: () => void
}
