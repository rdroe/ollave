import { mem, setLatestMap } from '../../core'
import { mapSongToMidiTicks } from '../index'
import { makeNoteByBar, NoteByBar } from '../schemas'
import { randId } from '../util/common'

import {
  BarTemplate,
  CompiledNote,
  CUSTOM_BAR_ID_TAG,
  CUSTOM_BAR_INSTANCE_TAG,
  CUSTOM_BAR_TAG,
  CUSTOM_TAG,
  GESTURE_ID_TAG,
} from './schemas'

/** Tag-name prefix, e.g. 'noteId=x' -> 'noteId'. */
const tagName = (tag: string): string => tag.slice(0, tag.indexOf('='))

/** Strip identity/placement tags from a note's raw tag strings, so fresh
 * ones can be appended without duplicates. */
const stripIdentityTags = (tags: string[]): string[] => {
  const stripped = new Set([
    'noteId',
    'groupId',
    'layer',
    'barId',
    CUSTOM_TAG,
    CUSTOM_BAR_TAG,
    CUSTOM_BAR_ID_TAG,
    CUSTOM_BAR_INSTANCE_TAG,
  ])
  return tags.filter((tag) => {
    const eq = tag.indexOf('=')
    if (eq === -1) return true
    return !stripped.has(tagName(tag))
  })
}

const gestureKeyOf = (note: CompiledNote): string => {
  const match = note.tags.find((tag) => tag.startsWith(`${GESTURE_ID_TAG}=`))
  // Notes lacking a gestureId tag fall back to one shared group.
  return match ? match.slice(GESTURE_ID_TAG.length + 1) : ''
}

/**
 * Realize a template's compiled notes as one placement instance for a bar:
 * fresh noteId per note, fresh groupId/layer per gesture, plus barId,
 * custom=true, customBar=<name>, customBarId=<row id>, and
 * customBarInstance=<instanceId> on every note. Pure — callers decide where
 * the notes go (mem for placement, track rows for propagation).
 */
export function cloneTemplateNotesForInstance(
  template: BarTemplate,
  barId: string,
  instanceId: string
): NoteByBar[] {
  const notesByGesture = new Map<string, CompiledNote[]>()
  for (const note of template.compiledNotes) {
    const key = gestureKeyOf(note)
    const group = notesByGesture.get(key)
    if (group) {
      group.push(note)
    } else {
      notesByGesture.set(key, [note])
    }
  }

  const out: NoteByBar[] = []
  for (const notes of notesByGesture.values()) {
    // One fresh groupId per gesture, one fresh layer id, matching addChord's
    // per-chord groupId/layer convention.
    const groupId = randId('', 6)
    const layerId = randId('', 3)

    for (const note of notes) {
      const tags = [
        ...stripIdentityTags(note.tags),
        `noteId=${randId('', 6)}`,
        `groupId=${groupId}`,
        `layer=${layerId}`,
        `barId=${barId}`,
        `${CUSTOM_TAG}=true`,
        `${CUSTOM_BAR_TAG}=${template.name}`,
        `${CUSTOM_BAR_INSTANCE_TAG}=${instanceId}`,
      ]
      if (template.id !== undefined) {
        tags.push(`${CUSTOM_BAR_ID_TAG}=${template.id}`)
      }
      // Templates compiled before quantize stamping existed lack the tag;
      // without it the song UI's default 16th quantize would snap barDelay
      // and destroy sub-16th strum spreads.
      if (!tags.some((t) => t.startsWith('quantize='))) {
        tags.push('quantize=0th')
      }
      out.push(makeNoteByBar(note.note, tags))
    }
  }
  return out
}

/**
 * Place a template into a real song bar (append, like chords). The real
 * save path (setLatestMap) is desired here — mirrors addChord's last line.
 */
export function addCustomBarToBar(template: BarTemplate, barId: string): void {
  if (!mem().notesByBar[barId]) {
    mem().notesByBar[barId] = []
  }
  const instanceId = randId('', 6)
  mem().notesByBar[barId].push(
    ...cloneTemplateNotesForInstance(template, barId, instanceId)
  )
  setLatestMap(mapSongToMidiTicks())
}

/**
 * Copy a placed instance (all of its notes) into another bar as a NEW
 * instance: fresh noteId per note, fresh groupId/layer per source group,
 * fresh customBarInstance — so the copy is independent for propagation.
 * Used by the song UI's group copy-drag on custom groups.
 */
export function copyCustomInstanceToBar(
  sourceBarId: string,
  noteIds: string[],
  targetBarId: string
): void {
  const source = (mem().notesByBar[sourceBarId] || []).filter((n) =>
    noteIds.includes(String(n.tagsObj?.noteId?.[0]))
  )
  if (source.length === 0) return
  if (!mem().notesByBar[targetBarId]) {
    mem().notesByBar[targetBarId] = []
  }
  const instanceId = randId('', 6)
  const groupIdMap = new Map<string, { groupId: string; layer: string }>()
  for (const note of source) {
    const oldGroup = String(note.tagsObj?.groupId?.[0] ?? '')
    let ids = groupIdMap.get(oldGroup)
    if (!ids) {
      ids = { groupId: randId('', 6), layer: randId('', 3) }
      groupIdMap.set(oldGroup, ids)
    }
    const keptTags = stripIdentityTags(note.tags).filter(
      (t) => tagName(t) !== 'noteId'
    )
    const custom = note.tagsObj?.customBar?.[0]
    const customId = note.tagsObj?.customBarId?.[0]
    const tags = [
      ...keptTags,
      `noteId=${randId('', 6)}`,
      `groupId=${ids.groupId}`,
      `layer=${ids.layer}`,
      `barId=${targetBarId}`,
      `${CUSTOM_TAG}=true`,
      `${CUSTOM_BAR_TAG}=${custom ?? ''}`,
      `${CUSTOM_BAR_INSTANCE_TAG}=${instanceId}`,
    ]
    if (customId !== undefined && customId !== null) {
      tags.push(`${CUSTOM_BAR_ID_TAG}=${customId}`)
    }
    mem().notesByBar[targetBarId].push(makeNoteByBar(note.note, tags))
  }
  setLatestMap(mapSongToMidiTicks())
}
