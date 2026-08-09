import { beforeEach, describe, expect, it, vi } from 'vitest'

import { browser } from 'user-tables'

import {
  deleteBarDocument,
  exportBarTemplatesForSong,
  getBarDocument,
  importBarTemplatesForSong,
  isReusableTemplate,
  listBarTemplates,
  listReusableTemplates,
  saveBarDocument,
  saveBarTemplate,
} from './fetch'
import { BAR_TEMPLATE_TABLE, BarTemplate, barTemplateSchema } from './schemas'

// saveBarTemplate propagates to placed instances, which reaches into mem() and
// the song tables. These tests are about the barTemplate rows themselves.
vi.mock('./propagate', () => ({
  propagateTemplateToSong: vi.fn(async () => undefined),
}))

import { propagateTemplateToSong } from './propagate'

/**
 * Bar documents: the per-bar editable document that shares the barTemplate
 * table with reusable templates but must never propagate.
 */

const SONG = 1

const clearTemplates = async () => {
  const rows = await (
    await browser.userTables.where(BAR_TEMPLATE_TABLE, {})
  ).toArray()
  for (const row of rows) {
    if (row.id !== undefined) {
      await browser.userTables.delete(BAR_TEMPLATE_TABLE, { id: row.id })
    }
  }
}

const doc = (overrides: Partial<BarTemplate> = {}): BarTemplate => ({
  songId: SONG,
  name: 'bar intro:0',
  phaseName: 'intro',
  barSizeMultiplier: 1,
  gestures: [],
  compiledNotes: [],
  purpose: 'bar-document',
  barId: 'intro:0',
  ...overrides,
})

const reusable = (overrides: Partial<BarTemplate> = {}): BarTemplate => ({
  songId: SONG,
  name: 'strum pattern',
  phaseName: 'intro',
  barSizeMultiplier: 1,
  gestures: [],
  compiledNotes: [],
  ...overrides,
})

describe('isReusableTemplate', () => {
  it('treats a missing purpose as reusable, for pre-0.8.0 rows', () => {
    expect(isReusableTemplate({})).toBe(true)
    expect(isReusableTemplate({ purpose: 'reusable' })).toBe(true)
    expect(isReusableTemplate({ purpose: 'bar-document' })).toBe(false)
  })
})

describe('bar template schema', () => {
  it('parses a legacy row with neither purpose nor barId', () => {
    const parsed = barTemplateSchema.parse({
      songId: 1,
      name: 'legacy',
      phaseName: 'intro',
      barSizeMultiplier: 1,
      gestures: [],
      compiledNotes: [],
    })

    expect(parsed.purpose).toBeUndefined()
    expect(parsed.barId).toBeUndefined()
    expect(isReusableTemplate(parsed)).toBe(true)
  })

  it('rejects an unknown purpose', () => {
    expect(() => barTemplateSchema.parse(doc({ purpose: 'other' as never }))).toThrow()
  })
})

describe('bar document CRUD', () => {
  beforeEach(async () => {
    await clearTemplates()
    vi.mocked(propagateTemplateToSong).mockClear()
  })

  it('saves and reads back a document by songId + barId', async () => {
    await saveBarDocument(doc())

    const found = await getBarDocument(SONG, 'intro:0')
    expect(found).not.toBeNull()
    expect(found?.barId).toBe('intro:0')
    expect(found?.purpose).toBe('bar-document')
  })

  it('returns null when the bar has no document', async () => {
    expect(await getBarDocument(SONG, 'intro:9')).toBeNull()
  })

  it('forces purpose to bar-document even if the caller omits it', async () => {
    await saveBarDocument({ ...doc(), purpose: undefined })

    const found = await getBarDocument(SONG, 'intro:0')
    expect(found?.purpose).toBe('bar-document')
  })

  it('requires a barId', async () => {
    await expect(
      saveBarDocument({ ...doc(), barId: undefined })
    ).rejects.toThrow(/barId/i)
  })

  it('upserts by (songId, barId) rather than inserting a duplicate', async () => {
    const firstId = await saveBarDocument(doc())
    const secondId = await saveBarDocument(
      doc({ compiledNotes: [{ note: 'c3', tags: ['noteId=x', 'barDelay=0'] }] })
    )

    expect(secondId).toBe(firstId)
    const all = await listBarTemplates(SONG)
    expect(all.filter((t) => t.barId === 'intro:0')).toHaveLength(1)
    const found = await getBarDocument(SONG, 'intro:0')
    expect(found?.compiledNotes).toHaveLength(1)
  })

  it('keeps documents for different bars separate', async () => {
    await saveBarDocument(doc({ barId: 'intro:0', name: 'bar intro:0' }))
    await saveBarDocument(doc({ barId: 'intro:1', name: 'bar intro:1' }))

    expect((await getBarDocument(SONG, 'intro:0'))?.barId).toBe('intro:0')
    expect((await getBarDocument(SONG, 'intro:1'))?.barId).toBe('intro:1')
  })

  it('never triggers reusable-template propagation', async () => {
    await saveBarDocument(doc())
    await saveBarDocument(doc({ name: 'edited again' }))

    expect(propagateTemplateToSong).not.toHaveBeenCalled()
  })

  it('deletes a document', async () => {
    await saveBarDocument(doc())
    await deleteBarDocument(SONG, 'intro:0')

    expect(await getBarDocument(SONG, 'intro:0')).toBeNull()
  })

  it('deleting a bar with no document is a no-op', async () => {
    await expect(deleteBarDocument(SONG, 'nope:0')).resolves.toBeUndefined()
  })

  it('scopes documents to their song', async () => {
    await saveBarDocument(doc({ songId: 1 }))
    await saveBarDocument(doc({ songId: 2 }))

    expect(await getBarDocument(1, 'intro:0')).not.toBeNull()
    expect(await getBarDocument(2, 'intro:0')).not.toBeNull()
    expect(await listBarTemplates(1)).toHaveLength(1)
  })
})

describe('listReusableTemplates', () => {
  beforeEach(async () => {
    await clearTemplates()
    vi.mocked(propagateTemplateToSong).mockClear()
  })

  it('excludes bar documents', async () => {
    await saveBarTemplate(reusable())
    await saveBarDocument(doc())

    const reusables = await listReusableTemplates(SONG)
    expect(reusables.map((t) => t.name)).toEqual(['strum pattern'])
  })

  it('includes legacy rows that have no purpose', async () => {
    await saveBarTemplate(reusable({ name: 'legacy one' }))

    const reusables = await listReusableTemplates(SONG)
    expect(reusables).toHaveLength(1)
  })

  it('is empty when the song has only bar documents', async () => {
    await saveBarDocument(doc())
    expect(await listReusableTemplates(SONG)).toEqual([])
  })
})

describe('export/import round trip', () => {
  beforeEach(async () => {
    await clearTemplates()
    vi.mocked(propagateTemplateToSong).mockClear()
  })

  it('exports bar documents alongside reusable templates', async () => {
    await saveBarTemplate(reusable())
    await saveBarDocument(doc())

    const exported = await exportBarTemplatesForSong(SONG)

    expect(exported).toHaveLength(2)
    expect(exported.some((t) => t.purpose === 'bar-document')).toBe(true)
    expect(exported.every((t) => !('id' in t && t.id !== undefined))).toBe(true)
  })

  it('rewrites songId and preserves purpose/barId on import', async () => {
    await saveBarTemplate(reusable())
    await saveBarDocument(doc())
    const exported = await exportBarTemplatesForSong(SONG)

    const NEW_SONG = 42
    await importBarTemplatesForSong(NEW_SONG, exported)

    const imported = await listBarTemplates(NEW_SONG)
    expect(imported).toHaveLength(2)
    expect(imported.every((t) => t.songId === NEW_SONG)).toBe(true)

    const importedDoc = await getBarDocument(NEW_SONG, 'intro:0')
    expect(importedDoc).not.toBeNull()
    expect(importedDoc?.purpose).toBe('bar-document')
    expect(importedDoc?.barId).toBe('intro:0')
  })

  it('does not propagate when importing a bar document', async () => {
    await saveBarDocument(doc())
    const exported = await exportBarTemplatesForSong(SONG)
    vi.mocked(propagateTemplateToSong).mockClear()

    await importBarTemplatesForSong(99, exported)

    expect(propagateTemplateToSong).not.toHaveBeenCalled()
  })

  it('imports a legacy export whose rows have no purpose', async () => {
    // exactly the payload shape produced before 0.8.0
    const legacyExport = [
      {
        songId: SONG,
        name: 'legacy',
        phaseName: 'intro',
        barSizeMultiplier: 1,
        gestures: [],
        compiledNotes: [],
      },
    ]

    await importBarTemplatesForSong(7, legacyExport)

    const imported = await listBarTemplates(7)
    expect(imported).toHaveLength(1)
    expect(isReusableTemplate(imported[0])).toBe(true)
  })
})
