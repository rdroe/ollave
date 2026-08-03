import { fetchSongAndTracksBySongId } from '../fetch'
import { NoteByBar } from '../schemas'
import { randId } from '../util/common'
import { browser } from 'user-tables'

import { cloneTemplateNotesForInstance } from './applyTemplate'
import {
  BarTemplate,
  CUSTOM_BAR_ID_TAG,
  CUSTOM_BAR_INSTANCE_TAG,
  CUSTOM_BAR_TAG,
} from './schemas'

/**
 * Template → song live sync: placed instances mirror their template.
 *
 * Runs purely against IndexedDB (fetch track rows, rewrite notesByBar,
 * update rows) and never touches mem() — critical, because during template
 * editing mem() holds the scratch one-bar song, not the real one. The song
 * UI picks the changes up on its next load, exactly like any other edit.
 *
 * Instance matching: primary key is customBarId=<template row id>; legacy
 * placements (before that tag existed) match by customBar=<name>. Within a
 * bar, notes group into instances by customBarInstance; legacy notes lack
 * the tag and are treated as one instance per bar, upgraded (all new tags
 * stamped) by the replacement itself.
 */

const tagVal = (tags: string[], name: string): string | undefined => {
  const t = tags.find((tag) => tag.startsWith(`${name}=`))
  return t?.slice(name.length + 1)
}

const noteMatchesTemplate = (
  tags: string[],
  template: BarTemplate
): boolean => {
  const id = tagVal(tags, CUSTOM_BAR_ID_TAG)
  if (id !== undefined) {
    return template.id !== undefined && Number(id) === template.id
  }
  return tagVal(tags, CUSTOM_BAR_TAG) === template.name
}

/**
 * Stored track rows hold plain {note, tags, tagsObj} objects (what
 * structured-clone made of NoteByBar instances). Serialize new notes to the
 * same durable shape — ollave reads back note+tags via makeNoteByBar, and
 * trackRecordSchema wants tagsObj present.
 */
const serializeNote = (n: NoteByBar) => ({
  note: n.note,
  tags: [...n.tags],
  tagsObj: JSON.parse(JSON.stringify(n.tagsObj)),
})

/**
 * Replace every placed instance of `template` in its song with a fresh
 * realization of the template's current compiledNotes. Returns the number
 * of instances replaced (0 when the template has never been placed).
 */
export async function propagateTemplateToSong(
  template: BarTemplate
): Promise<number> {
  const songAndTracks = await fetchSongAndTracksBySongId(template.songId)
  if (!songAndTracks) return 0

  let replaced = 0
  for (const track of songAndTracks.tracks) {
    let trackChanged = false
    const newNotesByBar: Record<string, unknown[]> = {}

    for (const [barId, notes] of Object.entries(track.notesByBar)) {
      const kept: unknown[] = []
      const instanceIds = new Set<string>()
      for (const note of notes as { tags?: string[] }[]) {
        const tags = note.tags ?? []
        if (noteMatchesTemplate(tags, template)) {
          // '' = legacy placement without an instance tag: one per bar.
          instanceIds.add(tagVal(tags, CUSTOM_BAR_INSTANCE_TAG) ?? '')
        } else {
          kept.push(note)
        }
      }

      if (instanceIds.size === 0) {
        newNotesByBar[barId] = notes as unknown[]
        continue
      }

      trackChanged = true
      const rebuilt = [...kept]
      for (const inst of instanceIds) {
        // Preserve instance identity; legacy '' gets upgraded to a real id.
        const instanceId = inst || randId('', 6)
        const clones = cloneTemplateNotesForInstance(
          template,
          barId,
          instanceId
        )
        rebuilt.push(...clones.map(serializeNote))
        replaced++
      }
      newNotesByBar[barId] = rebuilt
    }

    if (trackChanged) {
      // user-tables update() merges data keys top-level, so this replaces
      // notesByBar wholesale and preserves the row's other fields.
      await browser.userTables.update(
        'track',
        { id: track.id, data: { notesByBar: newNotesByBar } },
        { id: track.id }
      )
    }
  }
  return replaced
}
