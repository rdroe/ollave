import { parseColonTag } from './util/parseColonTag'
import { tagsObjSchema } from './schemas'

const findBarId = (compositionTags: string[]) => {
  // convert tag list to tagsObj
  const tagsObj = tagsObjSchema.parse(compositionTags)
  return tagsObj.barId?.[0]
}

export const getPhaseId = (compositionTags: string[]): string | null => {
  const barId = findBarId(compositionTags)
  if (!barId || typeof barId !== 'string') {
    return null
  }
  const parsed = parseColonTag(barId)
  if (!parsed) {
    return null
  }
  return parsed[0]
}

/**
 * phaseName -> song track index, from the song's own track order.
 *
 * Replaces first-note-encounter numbering, which made a note's MIDI track
 * depend on playback order rather than on which track actually owns its phase.
 */
export const buildPhaseTrackIndex = (
  tracks: { 'phase-names': string[] }[]
): { [phaseName: string]: number } => {
  const map: { [phaseName: string]: number } = {}
  tracks.forEach((track, trackIdx) => {
    track['phase-names'].forEach((phaseName) => {
      map[phaseName] = trackIdx
    })
  })
  return map
}
