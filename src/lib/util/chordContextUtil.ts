import { Note } from 'tonal'

/**
 * `chordContextAt` — pure song-context helper for the harmony panel.
 *
 * The mem-coupled precedent is `previousChordNotes` in `src/lib/addChord.ts`:
 * this replicates its "chord group = notes sharing a groupId, at least one
 * carrying chord=" semantics purely, over a caller-supplied notesByBar-shaped
 * map, so it has no core/mem() dependency and no barrel imports.
 *
 * Pure: no mem(), no imports from `core/`, no barrel imports. Allowed
 * imports: `tonal` only.
 */

export type ContextNote = { note: string; tags: string[] }
export type NotesByBarLike = Record<string, ContextNote[]> // key: `${phase}:${index}`

export type ChordGroupRef = {
  chord: string // value of the chord= tag
  roman: string | null // value of the roman= tag if present
  barIndex: number
  barDelay: number // min barDelay among the group's notes
  voicing: string[] // the group's note names, sorted ascending by Note.midi (tonal); notes with unparsable midi sort first, stable
}

export type ChordContext = {
  prev: ChordGroupRef[] // ALL chord groups in bars < gapIndex, chronological (barIndex asc, then barDelay asc). Caller slices.
  next: ChordGroupRef | null // FIRST chord group in bars >= gapIndex, or null
}

/** First value of a `key=value` tag, or null if absent. */
const tagValue = (tags: string[], key: string): string | null => {
  const prefix = `${key}=`
  for (const tag of tags) {
    if (tag.startsWith(prefix)) {
      return tag.slice(prefix.length)
    }
  }
  return null
}

/** `barDelay=` parse: integer; a note without it counts as 0. */
const barDelayOf = (tags: string[]): number => {
  const raw = tagValue(tags, 'barDelay')
  if (raw === null) return 0
  const n = parseInt(raw, 10)
  return Number.isNaN(n) ? 0 : n
}

/** Midi-sortable height; unparsable sorts first (as -Infinity), stable. */
const midiHeight = (noteName: string): number => {
  const midi = Note.midi(noteName)
  return midi === null || midi === undefined ? -Infinity : midi
}

/**
 * All chord groups present in one bar's notes, in barDelay order (min
 * barDelay per group, then stable by first appearance).
 */
const chordGroupsInBar = (
  barNotes: ContextNote[] | undefined,
  barIndex: number
): ChordGroupRef[] => {
  if (!barNotes || barNotes.length === 0) return []

  const order: string[] = []
  const byGroup = new Map<string, ContextNote[]>()
  for (const note of barNotes) {
    const groupId = tagValue(note.tags, 'groupId')
    if (!groupId) continue
    if (!byGroup.has(groupId)) {
      byGroup.set(groupId, [])
      order.push(groupId)
    }
    byGroup.get(groupId)!.push(note)
  }

  const groups: ChordGroupRef[] = []
  for (const groupId of order) {
    const notes = byGroup.get(groupId)!
    // at least one note in the group must carry a chord= tag
    let chord: string | null = null
    let roman: string | null = null
    for (const note of notes) {
      const c = tagValue(note.tags, 'chord')
      if (c !== null && chord === null) chord = c
      const r = tagValue(note.tags, 'roman')
      if (r !== null && roman === null) roman = r
    }
    if (chord === null) continue

    let minDelay = Infinity
    for (const note of notes) {
      const d = barDelayOf(note.tags)
      if (d < minDelay) minDelay = d
    }

    const voicing = [...notes.map((n) => n.note)].sort(
      (a, b) => midiHeight(a) - midiHeight(b)
    )

    groups.push({
      chord,
      roman,
      barIndex,
      barDelay: minDelay,
      voicing,
    })
  }

  // stable sort by barDelay (Array#sort is stable in the JS engines we
  // target, and Node's V8 guarantees it)
  return groups
    .map((g, i) => ({ g, i }))
    .sort((a, b) => a.g.barDelay - b.g.barDelay || a.i - b.i)
    .map(({ g }) => g)
}

/**
 * Derive barCount for a phase: 1 + max existing bar index found by scanning
 * keys `${phaseName}:${i}`. Bars may be sparse — a missing intermediate
 * index simply contributes no groups. Scanning stops once no higher index
 * exists in the map at all (there is no fixed upper bound otherwise).
 */
const phaseBarCount = (
  notesByBar: NotesByBarLike,
  phaseName: string
): number => {
  const prefix = `${phaseName}:`
  let maxIndex = -1
  for (const key of Object.keys(notesByBar)) {
    if (!key.startsWith(prefix)) continue
    const rest = key.slice(prefix.length)
    const idx = Number(rest)
    if (Number.isInteger(idx) && idx >= 0 && idx > maxIndex) {
      maxIndex = idx
    }
  }
  return maxIndex + 1
}

export const chordContextAt = (
  notesByBar: NotesByBarLike,
  phaseName: string,
  gapIndex: number // 0..N: gap g sits BEFORE bar g; g === barCount means after the last bar
): ChordContext => {
  const barCount = phaseBarCount(notesByBar, phaseName)

  const prev: ChordGroupRef[] = []
  for (let i = 0; i < Math.min(gapIndex, barCount); i++) {
    const barNotes = notesByBar[`${phaseName}:${i}`]
    prev.push(...chordGroupsInBar(barNotes, i))
  }

  let next: ChordGroupRef | null = null
  for (let i = Math.max(gapIndex, 0); i < barCount; i++) {
    const barNotes = notesByBar[`${phaseName}:${i}`]
    const groups = chordGroupsInBar(barNotes, i)
    if (groups.length > 0) {
      next = groups[0]
      break
    }
  }

  return { prev, next }
}
