// Current-song track and phase creation for v2.
//
// These are NEW entry points rather than changes to phaseCountInner(): v1's
// `phase <name> <count>` command, duplicate, and import all depend on that
// function's existing semantics (no automatic follows edge, target track
// defaulting to tracks[0]). Changing it to "follow the track's last phase"
// would silently rewrite those flows, so the v2 behavior lives here.
//
// Every operation validates BEFORE it writes, awaits each IndexedDB write,
// updates mem(), and finishes with one compile/save so callers never have to
// sequence those steps themselves.

import { browser } from 'user-tables'
import { z } from 'zod'

import { mem } from '../core/mem'
// Specific module, NOT the '../core/observables' barrel — see fetch.ts.
import { setLatestMap } from '../core/observables/compilationObservable'

import { mapSongToMidiTicks } from './mapSongToTicks'
import { phaseRecordSchema, songRecordSchema } from './schemas'
import { TrackRecord } from './types'
import { PhaseRecord } from './util/phaseTypes'
import {
  compileNotesByBarToTracks,
  compilePhasesToTracks,
  saveSongAndTracksAwaited,
} from './util/schemaUtil'

const currentSong = () => {
  const song = mem().song
  if (!song) {
    throw new Error('no song is loaded')
  }
  return song
}

/** Persist mem() and refresh the compiled map — the tail of every operation. */
const compileAndSave = async () => {
  compilePhasesToTracks()
  compileNotesByBarToTracks()
  await saveSongAndTracksAwaited()
  await setLatestMap(mapSongToMidiTicks())
}

export type CreateTrackOptions = {
  name?: string
  channel?: number
}

/**
 * Append a track to the loaded song and return its new row id.
 *
 * APPENDS to `song['track-ids']`. The second tuple value is reserved and stays
 * 0 in this release. `name`/`channel` are only stored when supplied, so a
 * track without them keeps deriving `Track N` / `min(index, 15)`.
 */
export async function createTrack(
  opts: CreateTrackOptions = {}
): Promise<number> {
  const song = currentSong()

  if (opts.channel !== undefined) {
    z.number()
      .int()
      .min(0)
      .max(15)
      .parse(opts.channel)
  }
  if (opts.name !== undefined) {
    z.string().min(1).parse(opts.name)
  }

  const trackRecord: Omit<TrackRecord, 'id'> = {
    'phase-ids': [],
    'phase-names': [],
    notesByBar: {},
    ...(opts.name === undefined ? {} : { name: opts.name }),
    ...(opts.channel === undefined ? {} : { channel: opts.channel }),
  }

  const trackId = z
    .number()
    .parse(await browser.userTables.add('track', { data: trackRecord }))
  await browser.userTables.update(
    'track',
    { id: trackId, data: { id: trackId } },
    {}
  )

  const existing = song['track-ids'] ?? []
  const nextTrackIds: [number, number][] = [...existing, [trackId, 0]]
  await browser.userTables.update(
    'song',
    { id: song.id, data: { 'track-ids': nextTrackIds } },
    {}
  )

  song['track-ids'] = nextTrackIds
  mem().tracks = [...mem().tracks, { ...trackRecord, id: trackId }]

  await compileAndSave()
  return trackId
}

export type CreatePhaseInTrackOptions = {
  trackId: number
  name: string
  barCount: number
  scaleTonic: string
  scaleName: string
  /** Omitted => the target track's last phase (or [] when the track is empty). */
  followsPhaseIds?: number[]
}

/**
 * Would adding `child -> parents` edges close a loop? Walks up from each
 * proposed parent; the new phase has no children yet, so reaching its own name
 * means the edge would create a cycle.
 */
const wouldCycle = (
  phases: { [name: string]: PhaseRecord },
  newPhaseName: string,
  parentIds: number[]
): boolean => {
  const byId = new Map<number, PhaseRecord>()
  Object.values(phases).forEach((p) => byId.set(p.id, p))

  const seen = new Set<number>()
  const stack = [...parentIds]
  while (stack.length) {
    const id = stack.pop() as number
    if (seen.has(id)) continue
    seen.add(id)
    const phase = byId.get(id)
    if (!phase) continue
    if (phase.name === newPhaseName) return true
    ;(phase['follows-ids'] || []).forEach((pid) => stack.push(pid))
  }
  return false
}

/**
 * Create a phase with `barCount` empty bars on a specific track.
 *
 * Phase names are unique song-wide because bar ids are `${phaseName}:${index}`,
 * so a duplicate name would alias another phase's bars.
 */
export async function createPhaseInTrack(
  opts: CreatePhaseInTrackOptions
): Promise<number> {
  const song = currentSong()
  const { trackId, name, barCount, scaleTonic, scaleName } = opts

  z.string().min(1).parse(name)
  if (!Number.isInteger(barCount) || barCount < 1) {
    throw new Error(`barCount must be a positive integer; got ${barCount}`)
  }
  z.string().min(1).parse(scaleTonic)
  z.string().min(1).parse(scaleName)

  const track = mem().tracks.find((t) => t.id === trackId)
  if (!track) {
    throw new Error(`track ${trackId} not found in the loaded song`)
  }

  const phases = mem().phases
  if (phases[name]) {
    throw new Error(
      `a phase named "${name}" already exists in this song; phase names must be unique song-wide`
    )
  }

  // Omitted => follow this track's last phase; [] stays an explicit root.
  const followsPhaseIds =
    opts.followsPhaseIds ??
    (track['phase-ids'].length
      ? [track['phase-ids'][track['phase-ids'].length - 1]]
      : [])

  const knownIds = new Set(Object.values(phases).map((p) => p.id))
  followsPhaseIds.forEach((parentId) => {
    if (!knownIds.has(parentId)) {
      throw new Error(`follows parent phase ${parentId} does not exist`)
    }
  })
  if (wouldCycle(phases, name, followsPhaseIds)) {
    throw new Error(
      `following ${followsPhaseIds.join(', ')} from "${name}" would create a phase cycle`
    )
  }

  const phaseData: Omit<PhaseRecord, 'id'> = {
    name,
    'follows-ids': followsPhaseIds,
    barSizeMultiplier: 1,
    speed: null,
    scaleTonic,
    scaleName,
  }
  const phaseId = z
    .number()
    .parse(await browser.userTables.add('phase', { data: phaseData }))
  await browser.userTables.update(
    'phase',
    { id: phaseId, data: { id: phaseId } },
    {}
  )

  // mem() carries the SAME follows-ids that were persisted; writing [] here
  // (as the legacy inner helper did) left memory and DB disagreeing until the
  // next reload.
  mem().phases[name] = phaseRecordSchema.parse({ ...phaseData, id: phaseId })

  track['phase-ids'].push(phaseId)
  track['phase-names'].push(name)

  for (let i = 0; i < barCount; i += 1) {
    mem().notesByBar[`${name}:${i}`] = []
  }

  songRecordSchema.parse(song)
  await compileAndSave()
  return phaseId
}
