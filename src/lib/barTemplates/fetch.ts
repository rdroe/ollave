import { randId } from '../util/common'
import { browser } from 'user-tables'

import { propagateTemplateToSong } from './propagate'
import { BAR_TEMPLATE_TABLE, BarTemplate, barTemplateSchema } from './schemas'

/**
 * CRUD for barTemplate rows over browser.userTables (user-tables package).
 * Row layout: { table: BAR_TEMPLATE_TABLE, data: BarTemplate,
 * a: String(songId), b: phaseName }. Create stamps the generated row id
 * back into data.id (same pattern as ollave's initNewSong).
 */

export class BarTemplateNameCollisionError extends Error {
  constructor(name: string) {
    super(`A bar template named "${name}" already exists for this song`)
    this.name = 'BarTemplateNameCollisionError'
  }
}

/** URL-safe slug; uniqueness per song is compared on slugs, not raw names. */
export const slugifyTemplateName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * A row with no `purpose` is a pre-0.8.0 reusable template, so absent counts
 * as 'reusable'. Never test the name or its slug for this.
 */
export const isReusableTemplate = (t: {
  purpose?: BarTemplate['purpose']
}): boolean => (t.purpose ?? 'reusable') === 'reusable'

export async function listBarTemplates(
  songId: number
): Promise<BarTemplate[]> {
  const coll = await browser.userTables.where(BAR_TEMPLATE_TABLE, {
    a: String(songId),
  })
  const rows = await coll.toArray()

  const templates: BarTemplate[] = []
  for (const row of rows) {
    const parsed = barTemplateSchema.safeParse(row.data)
    if (!parsed.success) {
      // console.error, NOT warn. A row that no longer parses vanishes from
      // every lookup built on this list — `getBarDocument` included — and the
      // bar it belonged to silently falls back to resynthesis, which destroys
      // its gesture structure while leaving the notes intact. That is exactly
      // the failure a user cannot see. Hosts route console.error into a
      // visible alert; a warning is only ever read by a developer.
      console.error(
        `[ollave] bar template row ${row.id} (song ${songId}) could not be read and was SKIPPED — any bar it belongs to will fall back to resynthesis: ` +
          parsed.error.issues
            .map((i) => `${i.path.join('.') || '(root)'} ${i.message}`)
            .join('; ')
      )
      continue
    }
    templates.push(parsed.data)
  }

  return templates.sort((a, b) => {
    const phaseCompare = a.phaseName.localeCompare(b.phaseName)
    if (phaseCompare !== 0) return phaseCompare
    return a.name.localeCompare(b.name)
  })
}

export async function getBarTemplate(
  songId: number,
  nameOrSlug: string
): Promise<BarTemplate | null> {
  const templates = await listBarTemplates(songId)
  const slug = slugifyTemplateName(nameOrSlug)
  return (
    templates.find((t) => slugifyTemplateName(t.name) === slug) ?? null
  )
}

/** Returns the row id. Throws BarTemplateNameCollisionError on create collision. */
export async function saveBarTemplate(t: BarTemplate): Promise<number> {
  const validated = barTemplateSchema.parse(t)

  if (validated.id !== undefined) {
    // user-tables update() folds every non-`data` key into the Dexie search
    // criteria, so a/b here both locate AND rewrite the indexed columns.
    // Consequence: changing phaseName on an existing row matches nothing and
    // writes nothing. The editor never rewrites phaseName, so this holds for
    // now — but it is checked rather than assumed, because a save that
    // silently changed nothing and reported success is how edits disappear.
    const modified = await browser.userTables.update(
      BAR_TEMPLATE_TABLE,
      {
        id: validated.id,
        data: validated,
        a: String(validated.songId),
        b: validated.phaseName,
      },
      { id: validated.id }
    )
    if (modified === 0) {
      throw new Error(
        `bar template "${validated.name}" was not saved: no row ${validated.id} in song ${validated.songId} phase "${validated.phaseName}" — the row was deleted, or its phase changed (which this path cannot rewrite)`
      )
    }
    // Live sync: placed instances mirror their template. Saving IS the
    // propagation trigger — no-ops when the template was never placed.
    await propagateTemplateToSong(validated)
    return validated.id
  }

  const existing = await listBarTemplates(validated.songId)
  const slug = slugifyTemplateName(validated.name)
  if (existing.some((t2) => slugifyTemplateName(t2.name) === slug)) {
    throw new BarTemplateNameCollisionError(validated.name)
  }

  const createdId = await browser.userTables.add(BAR_TEMPLATE_TABLE, {
    data: validated,
    a: String(validated.songId),
    b: validated.phaseName,
  })

  // Stamp the generated row id back into data (mirrors ollave's
  // initNewSong pattern in node_modules/ollave/src/lib/fetch.ts).
  await browser.userTables.update(
    BAR_TEMPLATE_TABLE,
    {
      id: createdId,
      data: { id: createdId },
    },
    { id: createdId }
  )

  return createdId
}

export async function duplicateBarTemplate(
  songId: number,
  sourceNameOrSlug: string,
  newName?: string
): Promise<BarTemplate> {
  const source = await getBarTemplate(songId, sourceNameOrSlug)
  if (!source) {
    throw new Error(
      `Bar template "${sourceNameOrSlug}" not found for song ${songId}`
    )
  }

  const existing = await listBarTemplates(songId)
  const existingSlugs = new Set(
    existing.map((t) => slugifyTemplateName(t.name))
  )

  let resolvedName = newName ?? `${source.name} copy`
  if (existingSlugs.has(slugifyTemplateName(resolvedName))) {
    const base = resolvedName
    let n = 2
    while (existingSlugs.has(slugifyTemplateName(`${base} ${n}`))) {
      n += 1
    }
    resolvedName = `${base} ${n}`
  }

  // Fresh gesture ids; keep an old->new mapping so compiledNotes'
  // gestureId= tags can be rewritten to match.
  const gestureIdMap = new Map<string, string>()
  const gestures = source.gestures.map((g) => {
    const newId = randId('', 6)
    gestureIdMap.set(g.id, newId)
    return { ...g, id: newId, source: { ...g.source } }
  })

  const compiledNotes = source.compiledNotes.map((note) => ({
    note: note.note,
    tags: note.tags.map((tag) => {
      const eq = tag.indexOf('=')
      if (eq === -1) return tag
      const key = tag.slice(0, eq)
      const value = tag.slice(eq + 1)
      if (key !== 'gestureId') return tag
      const mapped = gestureIdMap.get(value)
      return mapped ? `${key}=${mapped}` : tag
    }),
  }))

  const toSave: BarTemplate = {
    songId,
    name: resolvedName,
    phaseName: source.phaseName,
    barSizeMultiplier: source.barSizeMultiplier,
    gestures,
    compiledNotes,
  }

  const id = await saveBarTemplate(toSave)
  return { ...toSave, id }
}

export async function deleteBarTemplate(
  songId: number,
  nameOrSlug: string
): Promise<void> {
  const existing = await getBarTemplate(songId, nameOrSlug)
  if (!existing || existing.id === undefined) {
    return
  }
  await browser.userTables.delete(BAR_TEMPLATE_TABLE, { id: existing.id })
}

/**
 * Reusable templates only — what a template manager should list. Bar
 * documents live in the same table but are per-bar editing state, not
 * something a user places.
 */
export async function listReusableTemplates(
  songId: number
): Promise<BarTemplate[]> {
  const all = await listBarTemplates(songId)
  return all.filter(isReusableTemplate)
}

/** The one bar document for a bar, or null. Identity is (songId, barId). */
export async function getBarDocument(
  songId: number,
  barId: string
): Promise<BarTemplate | null> {
  const all = await listBarTemplates(songId)
  const matches = all.filter(
    (t) => !isReusableTemplate(t) && t.barId === barId
  )
  if (matches.length > 1) {
    // Two rows claiming one bar means every write lands on one of them and
    // the reader may pick the other. Loud, because the symptom — an edit that
    // "does not stick" — is otherwise indistinguishable from a UI bug.
    console.error(
      `[ollave] ${matches.length} bar documents claim song ${songId} bar "${barId}" (rows ${matches
        .map((m) => m.id)
        .join(', ')}); using row ${matches[0].id}. The others are unreachable.`
    )
  }
  return matches[0] ?? null
}

/**
 * Create the row for a bar document and stamp the generated id into its data.
 *
 * Any `id` on the incoming document is DROPPED: this is a create, and a
 * carried-over id would leave `data.id` disagreeing with the row it now lives
 * in. (The stamp below would fix it anyway; dropping it says so.)
 */
const createBarDocumentRow = async (doc: BarTemplate): Promise<number> => {
  const { id: _discarded, ...withoutId } = doc
  const createdId = await browser.userTables.add(BAR_TEMPLATE_TABLE, {
    data: withoutId,
    a: String(doc.songId),
    b: doc.phaseName,
  })
  const stamped = await browser.userTables.update(
    BAR_TEMPLATE_TABLE,
    { id: createdId, data: { id: createdId } },
    { id: createdId }
  )
  if (stamped === 0) {
    console.error(
      `[ollave] bar document row ${createdId} for bar "${doc.barId}" could not be stamped with its own id`
    )
  }
  return createdId as number
}

/**
 * Upsert a bar document by (songId, barId).
 *
 * NEVER calls propagateTemplateToSong: editing one song bar must not rewrite
 * any other bar. That is the whole distinction between a bar document and a
 * reusable template, so it is enforced here rather than left to callers.
 */
export async function saveBarDocument(doc: BarTemplate): Promise<number> {
  if (!doc.barId) {
    throw new Error('a bar document requires a barId')
  }
  const validated = barTemplateSchema.parse({
    ...doc,
    purpose: 'bar-document' as const,
  })

  // The (songId, barId) LOOKUP is the authority on which row to write, never
  // `doc.id`. A caller legitimately holds a document it loaded earlier, and
  // that row may since have been deleted (bar-document invalidation after an
  // external change to the bar) or replaced (a renumber deletes and recreates
  // every document in the phase). Targeting the id it remembers writes into a
  // row that is not there — and user-tables' update() is a Dexie `.modify()`
  // over the search collection, so zero matches means zero writes and NO
  // error. That is how a bar's whole gesture structure used to vanish while
  // the UI said "saved": the notes were rewritten, the document never was, and
  // the next open resynthesized one gesture per note.
  const existing = await getBarDocument(validated.songId, validated.barId!)
  const targetId = existing?.id

  if (targetId !== undefined) {
    const next = { ...validated, id: targetId }
    // Searched by row id ALONE. user-tables folds every non-`data` key into
    // the search criteria, so passing a/b here would make the write
    // conditional on the indexed columns still matching — another silent
    // no-op waiting to happen. Neither column can go stale on a bar document:
    // `a` is the songId we just looked the row up by, and `b` is the phase,
    // which `barId` encodes and therefore cannot change under a fixed barId.
    const modified = await browser.userTables.update(
      BAR_TEMPLATE_TABLE,
      { id: targetId, data: next },
      { id: targetId }
    )
    if (modified > 0) return targetId
    // Deleted between the lookup and the write. Recreating is the only
    // outcome that does not throw the user's edit away.
    console.error(
      `[ollave] bar document row ${targetId} for bar "${validated.barId}" disappeared mid-save; recreating it`
    )
  }

  return createBarDocumentRow(validated)
}

/** Remove a bar's document, e.g. when the bar itself is deleted. */
export async function deleteBarDocument(
  songId: number,
  barId: string
): Promise<void> {
  const existing = await getBarDocument(songId, barId)
  if (!existing || existing.id === undefined) {
    return
  }
  await browser.userTables.delete(BAR_TEMPLATE_TABLE, { id: existing.id })
}

/**
 * Templates for a song, stripped of row ids, ready to embed in a song export.
 * Ids are dropped deliberately: the importing database assigns its own.
 *
 * Includes BOTH reusable templates and bar documents: a song that exported
 * only its reusable rows would lose every per-bar edit on import.
 */
export async function exportBarTemplatesForSong(
  songId: number
): Promise<Omit<BarTemplate, 'id'>[]> {
  const templates = await listBarTemplates(songId)
  return templates.map(({ id: _id, ...rest }) => rest)
}

/**
 * Recreate exported templates under a newly imported song and return a map of
 * old row id -> new row id, so placed notes' `customBarId=` tags can be
 * repointed (they are the rename-proof link between a placement and its
 * template; a stale id would break live propagation after import).
 *
 * Templates are matched to their old ids by name — the exported payload keeps
 * no ids, so callers pass the ids observed on the placed notes.
 */
export async function importBarTemplatesForSong(
  songId: number,
  templates: Omit<BarTemplate, 'id'>[],
  oldIdsByName: { [name: string]: number } = {}
): Promise<{ [oldId: number]: number }> {
  const idMap: { [oldId: number]: number } = {}
  for (const t of templates) {
    const parsed = barTemplateSchema.safeParse({ ...t, songId })
    if (!parsed.success) {
      console.warn(`Skipping invalid imported barTemplate "${t.name}"`, parsed.error)
      continue
    }
    // Bar documents go through saveBarDocument: they are keyed by barId (not
    // by unique name), and must not trigger propagation on import.
    const newId = isReusableTemplate(parsed.data)
      ? await saveBarTemplate({ ...parsed.data, songId })
      : await saveBarDocument({ ...parsed.data, songId })
    const oldId = oldIdsByName[t.name]
    if (oldId !== undefined) {
      idMap[oldId] = newId
    }
  }
  return idMap
}
