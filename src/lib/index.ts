// Namespace exports for backward compatibility
export * as addChord from './addChord'
export * as addNote from './addNote'
export * as tags from './util/tagsUtil'
export * as graphh from './graphh'
export * as helpers from './helpers'
export * as music from './music'
export * as midi from './midi'
export * as mapSongToTicks from './mapSongToTicks'
export * as mem from './schemas'
export * as phaseUtil from './util/phaseUtil'

// Removed cli export to break circular dependency
export * as addTempoSlider from './addTempoSlider'
export * as nextChord from './nextChord'
export * as voiceLeading from './voiceLeading'
export * as mixture from './mixture'
export * as pivots from './pivots'
export * as randomProgression from './randomProgression'

// chord assistance -------------------------------------------------------
// `ChordSuggestion` is the contract every one of these speaks: voice-leading
// ranking, mode mixture, pivot modulation and random walks are pure functions
// over `ChordSuggestion[]`, so they compose freely with each other and with
// `nextChordDetail`. `nextChordDetail`'s `include` / `rankBy` options are
// sugar over exactly these functions.
export type { ChordSuggestion } from './nextChord'
export { nextChord as nextChordNames, nextChordDetail } from './nextChord'
export type { NextChordDetailOptions } from './nextChord'

export {
  ascendingInversions,
  nearestVoicing,
  rankByVoiceLeading,
  voiceLeadingDistance,
  voicingDistance,
} from './voiceLeading'
export type {
  AscendingInversionsOptions,
  NearestVoicing,
  RankedSuggestion,
  Voicing,
} from './voiceLeading'

export { mixtureSuggestions } from './mixture'
export type { MixtureStrength, MixtureSuggestion } from './mixture'

export { pivotSuggestions, romanInKey } from './pivots'
export type { PivotSuggestion } from './pivots'

export {
  createRng,
  randomProgression as randomProgressionNames,
  randomProgressionDetail,
} from './randomProgression'
export type {
  ProgressionResult,
  ProgressionStep,
  ProgressionStopReason,
  RandomProgressionOptions,
} from './randomProgression'

// Individual function exports for direct access
// mem-db exports
export {
  phaseFollowsPhase,
  phaseUnfollows,
  sortByNumberAfterColon,
  lookUpGraph,
  getAllPhaseBars,
  getAllPhaseBarNotes,
  getFollowingPhases,
  phaseExists,
  phaseCount,
} from './util/phaseUtil'

export { lastTick, startEndData } from './util/startEndUtil'

// helpers exports
export {
  strjson,
  isString,
  isStringNumNum,
  peprnIsNum,
  passivelyNumberize,
  isNum,
  randId,
  randomNumber,
  randomInt,
  phaseScale,
  isScaleName,
  isScaleNameWithTonic,
  properScaleName,
} from './helpers'

// addNote exports
export { addNoteToBar } from './addNote'

// tags exports
export {
  updateNoteTag,
  parseNoteTags,
  calcFractionalDelay,
} from './util/tagsUtil'

// graphh exports
// `conventionalKeys` is the list to build user-facing scale pickers from;
// `allScales` is the raw 189-entry list and contains enharmonic duplicates
export {
  minor,
  allScales,
  distinctScales,
  conventionalKeys,
  conventionalMajorTonics,
  conventionalMinorTonics,
  dedupeEnharmonicScales,
  isConventionalKeyName,
} from './graphh'

// music exports
export type { Triad, RelativeNote, isReady } from './music'
export type { ProgressionOptions, ProgressionOptionsEntry } from './graphh'
export { playTriads } from './music'

// midi exports
export { saveRaw, addEvents, playNotes } from './midi'

// mapSongToTicks exports
export { mapSongToMidiTicks } from './mapSongToTicks'
export { abbrev, tickCounts, ppq, isAbbreviation } from './util/constantsUtil'
export type { Abbreviation } from './util/constantsUtil'
export * as util from './util'
export { addSongLoadCallback, onLoadSongCallbacks } from './util/songUtil'
export { DEFAULT_VELOCITY } from './shared/midiMappingCore'

// greek women exports
export * from './greek-women'