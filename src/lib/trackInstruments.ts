import { mem } from '../core/mem'

import { isGmInstrument } from './gmPrograms'
import { INSTRUMENT_NAMES } from './instrumentSamples'
// Specific module, NOT a barrel: barrel imports from app code cause prod
// init-cycle crashes, and this module is imported directly by the v2 UI.
import { setTrackInstrument } from './music'
import { saveSongAndTracksAwaited } from './util/schemaUtil'

/** Set a track's instrument by track id, apply to live playback, persist. */
export const setTrackInstrumentAndSave = async (
  trackId: number,
  instrument: string
): Promise<void> => {
  // Sampled names come from the fixed list; General MIDI names are the open
  // `gm:<0-127>` set, validated by shape rather than enumeration.
  if (
    !(INSTRUMENT_NAMES as readonly string[]).includes(instrument) &&
    !isGmInstrument(instrument)
  ) {
    throw new Error(`unknown instrument: ${instrument}`)
  }
  const idx = mem().tracks.findIndex((t) => t.id === trackId)
  if (idx === -1) {
    throw new Error(`no track with id ${trackId}`)
  }
  mem().tracks[idx].instrument = instrument
  setTrackInstrument(idx, instrument)
  await saveSongAndTracksAwaited()
}
