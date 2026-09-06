import { mem } from '../core/mem'

// Specific module, NOT a barrel: barrel imports from app code cause prod
// init-cycle crashes, and this module is imported directly by the v2 UI.
import { saveSongAndTracksAwaited } from './util/schemaUtil'

/**
 * Mute or unmute a track by id, and persist it.
 *
 * Unlike `setTrackInstrumentAndSave` there is no live-playback call to make:
 * the scheduler reads `mem().tracks` afresh on every scheduled tick, so
 * writing the flag is already enough for the change to be heard on the next
 * note. Playing notes are left to ring out rather than cut, which is what a
 * mixer mute does.
 */
export const setTrackMutedAndSave = async (
  trackId: number,
  muted: boolean
): Promise<void> => {
  const idx = mem().tracks.findIndex((t) => t.id === trackId)
  if (idx === -1) {
    throw new Error(`no track with id ${trackId}`)
  }
  mem().tracks[idx].muted = muted
  await saveSongAndTracksAwaited()
}
