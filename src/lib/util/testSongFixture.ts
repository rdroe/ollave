// Fixture helpers for the multi-track song suites.
//
// Not a .test.ts file so several suites can share it. Everything here talks to
// the same fake-indexeddb-backed `browser.userTables` the real code uses, so
// the tests exercise the actual persistence path rather than a mock of it.

import { browser } from 'user-tables'

import { mem } from '../../core/mem'
import { NoteByBar } from '../schemas'
import { SongRecord, TrackRecord } from '../types'
import { parseNoteTags } from './noteParsingUtil'
import { PhaseRecord } from './phaseTypes'

export type PhaseSpec = {
  name: string
  /** Bar count; bars are created empty unless `notes` supplies some. */
  barCount: number
  barSizeMultiplier?: number | null
  scaleTonic?: string
  scaleName?: string
  /** Names of phases this one follows; resolved to ids after all are created. */
  follows?: string[]
  /** barIndex -> note names, e.g. { 0: ['c3', 'e3'] }. */
  notes?: { [barIndex: number]: string[] }
}

export type TrackSpec = {
  name?: string
  channel?: number
  phases: PhaseSpec[]
}

export type SongFixture = {
  songId: number
  trackIds: number[]
  phaseIdsByName: { [phaseName: string]: number }
}

/**
 * Install a minimal no-op `document` for song load/save paths.
 *
 * initLoadedSong() removes leftover `.note-slider` elements, which needs a
 * document to exist. This is OPT-IN per suite rather than global setup: some
 * modules (lib/songGanttDemos/*) feature-detect `typeof document === 'undefined'`
 * to skip browser-only work, and defining it globally makes them run their DOM
 * bodies under node and break unrelated suites.
 *
 * Returns a restore function; call it in afterAll to leave the global as found.
 */
export const installStubDocument = (): (() => void) => {
  const g = globalThis as unknown as { document?: unknown }
  if (g.document !== undefined) {
    return () => undefined
  }
  const noopElement = () => ({
    id: '',
    style: {},
    remove: () => undefined,
    click: () => undefined,
    appendChild: () => undefined,
    querySelector: () => null,
    querySelectorAll: () => [] as unknown[],
  })
  g.document = {
    querySelector: () => null,
    querySelectorAll: () => [] as unknown[],
    getElementById: () => null,
    createElement: () => noopElement(),
    body: noopElement(),
  }
  return () => {
    delete g.document
  }
}

/**
 * Wipe every row so each test starts from an empty database.
 *
 * Deliberately NOT xxxClearAndRestart(): that helper does not await its own
 * delete/reopen chain, so it resolves while the database is still closed and
 * the next query throws DatabaseClosedError. Deleting the rows we seeded keeps
 * the connection open and is precise about what it removes.
 */
export const resetDb = async () => {
  for (const table of ['song', 'track', 'phase', 'barTemplate']) {
    const rows = await (await browser.userTables.where(table, {})).toArray()
    for (const row of rows) {
      if (row.id !== undefined) {
        await browser.userTables.delete(table, { id: row.id })
      }
    }
  }
  mem().song = null
  mem().tracks = []
  mem().phases = {}
  mem().notesByBar = {}
  mem().latestMap = {}
  mem().latestPhaseAndBarStartAndEndTicks = { phases: {}, bars: {} }
}

/**
 * A stored note is PLAIN data: makeNoteByBar returns a Proxy-wrapped object
 * with accessors, which structured-clone (and therefore IndexedDB) rejects.
 * The real save path stores this same {note, tags} shape.
 */
const noteFor = (barId: string, note: string, idx: number) => {
  const tags = [
    `noteId=${barId}-${idx}`,
    `barId=${barId}`,
    'barDelay=0',
    'duration=128',
    'velocity=90',
  ]
  // tagsObj is stored alongside tags (trackRecordSchema requires it), and is
  // just the parsed form of the same list.
  return {
    note,
    tags,
    tagsObj: Object.fromEntries(parseNoteTags(tags)),
  }
}

/**
 * Write a complete multi-track song straight to IndexedDB, bypassing the
 * library's own creation APIs so fixtures stay independent of the code under
 * test. Returns the ids needed to load and assert against it.
 */
export const seedSong = async (
  spec: { name?: string; tempo?: number; tracks: TrackSpec[] }
): Promise<SongFixture> => {
  const songId = (await browser.userTables.add('song', {
    data: { name: spec.name ?? 'fixture song', tempo: spec.tempo ?? 120, 'track-ids': [] },
  })) as number
  await browser.userTables.update(
    'song',
    { id: songId, data: { id: songId } },
    {}
  )

  const phaseIdsByName: { [phaseName: string]: number } = {}
  const trackIds: number[] = []

  // Pass 1: create every phase row so follows-ids can be resolved by name.
  for (const track of spec.tracks) {
    for (const phase of track.phases) {
      const data: Omit<PhaseRecord, 'id'> = {
        name: phase.name,
        'follows-ids': [],
        barSizeMultiplier: phase.barSizeMultiplier ?? 1,
        speed: 1,
        scaleName: phase.scaleName ?? 'major',
        scaleTonic: phase.scaleTonic ?? 'C',
      }
      const phaseId = (await browser.userTables.add('phase', { data })) as number
      await browser.userTables.update(
        'phase',
        { id: phaseId, data: { id: phaseId } },
        {}
      )
      phaseIdsByName[phase.name] = phaseId
    }
  }

  // Pass 2: apply follows edges now that every id exists.
  for (const track of spec.tracks) {
    for (const phase of track.phases) {
      if (!phase.follows?.length) continue
      await browser.userTables.update(
        'phase',
        {
          id: phaseIdsByName[phase.name],
          data: {
            'follows-ids': phase.follows.map((n) => phaseIdsByName[n]),
          },
        },
        {}
      )
    }
  }

  // Pass 3: tracks, each owning its phases and their bars.
  for (const track of spec.tracks) {
    const notesByBar: { [barId: string]: NoteByBar[] } = {}
    track.phases.forEach((phase) => {
      for (let i = 0; i < phase.barCount; i += 1) {
        const barId = `${phase.name}:${i}`
        const names = phase.notes?.[i] ?? []
        notesByBar[barId] = names.map((n, idx) => noteFor(barId, n, idx))
      }
    })

    const data: Omit<TrackRecord, 'id'> = {
      'phase-ids': track.phases.map((p) => phaseIdsByName[p.name]),
      'phase-names': track.phases.map((p) => p.name),
      notesByBar,
      ...(track.name === undefined ? {} : { name: track.name }),
      ...(track.channel === undefined ? {} : { channel: track.channel }),
    }
    const trackId = (await browser.userTables.add('track', { data })) as number
    await browser.userTables.update(
      'track',
      { id: trackId, data: { id: trackId } },
      {}
    )
    trackIds.push(trackId)
  }

  await browser.userTables.update(
    'song',
    {
      id: songId,
      data: { 'track-ids': trackIds.map((id) => [id, 0]) },
    },
    {}
  )

  return { songId, trackIds, phaseIdsByName }
}

/** The song row as currently stored, parsed loosely for assertions. */
export const readSongRow = async (songId: number): Promise<SongRecord> => {
  const row = await (
    await browser.userTables.where('song', { id: songId })
  ).first()
  if (!row) throw new Error(`song ${songId} not found`)
  return row.data as SongRecord
}

export const readTrackRow = async (trackId: number): Promise<TrackRecord> => {
  const row = await (
    await browser.userTables.where('track', { id: trackId })
  ).first()
  if (!row) throw new Error(`track ${trackId} not found`)
  return row.data as TrackRecord
}

export const readPhaseRow = async (phaseId: number): Promise<PhaseRecord> => {
  const row = await (
    await browser.userTables.where('phase', { id: phaseId })
  ).first()
  if (!row) throw new Error(`phase ${phaseId} not found`)
  return row.data as PhaseRecord
}

export const countRows = async (table: string): Promise<number> => {
  const rows = await (await browser.userTables.where(table, {})).toArray()
  return rows.length
}
