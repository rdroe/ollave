import {
  airSpeedArgFromTempo,
  mem,
  Mem,
  setAirSpeed,
  songObservables,
} from '../../core'
import { mapSongToMidiTicks, music } from '../index'
import { makeNoteByBar } from '../schemas'
import { chordGraphCreate } from '../util/graphUtil'

import { CompiledNote, SCRATCH_SONG_ID, SCRATCH_SONG_NAME } from './schemas'
import { ScratchCtx, ScratchHandle } from './schemas'

const { startCueObservable, stopCueObservable, deleteCueObservable } =
  songObservables

/**
 * Mount a one-phase, one-bar scratch song into mem() for looping bar
 * playback in the editor.
 *
 * CRITICAL: never call setLatestMap/addChord/addNoteToBar/phaseCount or any
 * notesUtil "AndUpdateMap" helper here — they all persist to IndexedDB.
 * Build notes with makeNoteByBar, compute the map with the pure
 * mapSongToMidiTicks(), and assign mem().latestMap /
 * mem().latestPhaseAndBarStartAndEndTicks manually. Song id is
 * SCRATCH_SONG_ID (negative sentinel) as defense-in-depth. Snapshot the
 * overwritten mem() fields on mount; restore them in teardown().
 */

/** Fields of mem() this module overwrites and restores around a mount. */
type MemSnapshot = Pick<
  Mem,
  | 'song'
  | 'tracks'
  | 'phases'
  | 'notesByBar'
  | 'latestMap'
  | 'latestPhaseAndBarStartAndEndTicks'
  | 'adjustedCursor'
  | 'isRunning'
>

const barId = (phaseName: string) => `${phaseName}:0`

/**
 * Negative sentinels, like SCRATCH_SONG_ID: a stray persist would target rows
 * that cannot exist, so it modifies nothing.
 */
const SCRATCH_TRACK_ID = -999998
const SCRATCH_PHASE_ID = -999997

// Module-level singleton: only one scratch song may be mounted at a time.
// Mounting again tears down whatever is currently mounted first.
let activeTeardown: (() => void) | null = null

export function mountScratchSong(ctx: ScratchCtx): ScratchHandle {
  if (activeTeardown) {
    activeTeardown()
  }

  const snapshot: MemSnapshot = {
    song: mem().song,
    tracks: mem().tracks,
    phases: mem().phases,
    notesByBar: mem().notesByBar,
    latestMap: mem().latestMap,
    latestPhaseAndBarStartAndEndTicks: mem().latestPhaseAndBarStartAndEndTicks,
    adjustedCursor: mem().adjustedCursor,
    isRunning: mem().isRunning,
  }

  const thisBarId = barId(ctx.phaseName)

  const buildNotesByBar = (notes: CompiledNote[]) => ({
    [thisBarId]: notes.map((n) => makeNoteByBar(n.note, n.tags)),
  })

  mem().song = {
    id: SCRATCH_SONG_ID,
    name: SCRATCH_SONG_NAME,
    tempo: ctx.tempo,
    // Declares the scratch track below. The second value is the reserved slot
    // and stays 0, as in every real song.
    'track-ids': [[SCRATCH_TRACK_ID, 0]],
  }
  // One VALID track that actually owns the scratch phase, rather than [].
  // An empty track array makes the scratch song structurally unlike every real
  // song: anything that resolves a phase through track membership (MIDI track
  // mapping, compileNotesByBarToTracks) finds no owner. The snapshot/restore
  // below still puts the real song's tracks back on teardown.
  mem().tracks = [
    {
      id: SCRATCH_TRACK_ID,
      'phase-ids': [SCRATCH_PHASE_ID],
      'phase-names': [ctx.phaseName],
      notesByBar: {},
    },
  ]
  mem().phases = {
    [ctx.phaseName]: {
      id: SCRATCH_PHASE_ID,
      name: ctx.phaseName,
      'follows-ids': [],
      speed: 1,
      barSizeMultiplier: ctx.barSizeMultiplier,
      scaleName: ctx.scaleName,
      scaleTonic: ctx.scaleTonic,
    },
  }
  mem().notesByBar = buildNotesByBar(ctx.initialNotes)
  mem().adjustedCursor = 0

  chordGraphCreate(ctx.scaleTonic, ctx.scaleName)

  setAirSpeed(airSpeedArgFromTempo(ctx.tempo))

  // mountScratchSong is sync per the ScratchHandle contract; the initial
  // (and every subsequent) map computation happens async here. play() and
  // recompile() both await readyPromise so playback/recompiles never race
  // ahead of the first map assignment.
  let readyPromise: Promise<void> = Promise.resolve()

  const applyMap = async () => {
    const { map, phaseAndBarStartAndEndTicks } = await mapSongToMidiTicks()
    mem().latestMap = map
    mem().latestPhaseAndBarStartAndEndTicks = phaseAndBarStartAndEndTicks
  }

  readyPromise = applyMap()

  let isPlayingFlag = false
  let torn = false

  const play = () => {
    if (torn) {
      return
    }
    if (!music.isReady()) {
      music.playTriads([['c3', 0.05, 0]])
    }
    readyPromise.finally(() => {
      if (torn) {
        return
      }
      startCueObservable(0)
      isPlayingFlag = true
    })
  }

  const stop = () => {
    if (torn) {
      return
    }
    stopCueObservable()
    isPlayingFlag = false
  }

  const isPlaying = () => isPlayingFlag && !!mem().isRunning

  const currentTick = () => mem().adjustedCursor ?? 0

  const recompile = async (notes: CompiledNote[]): Promise<void> => {
    if (torn) {
      return
    }
    mem().notesByBar = buildNotesByBar(notes)
    readyPromise = applyMap()
    await readyPromise
  }

  const teardown = () => {
    if (torn) {
      return
    }
    torn = true
    stopCueObservable()
    isPlayingFlag = false
    deleteCueObservable(SCRATCH_SONG_NAME)

    mem().song = snapshot.song
    mem().tracks = snapshot.tracks
    mem().phases = snapshot.phases
    mem().notesByBar = snapshot.notesByBar
    mem().latestMap = snapshot.latestMap
    mem().latestPhaseAndBarStartAndEndTicks =
      snapshot.latestPhaseAndBarStartAndEndTicks
    mem().adjustedCursor = snapshot.adjustedCursor
    mem().isRunning = snapshot.isRunning

    if (activeTeardown === teardown) {
      activeTeardown = null
    }
  }

  activeTeardown = teardown

  return { play, stop, isPlaying, currentTick, recompile, teardown }
}
