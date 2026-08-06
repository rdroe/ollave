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
export * as sevenths from './sevenths'
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
  figuredVoicings,
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

// figured bass and inversions (Stage M-A) ---------------------------------
// `Figure` says WHICH CHORD TONE IS IN THE BASS; `bassOf` resolves it against
// a realized chord name, and `figuredVoicings` filters `ascendingInversions`
// down to the arrangements a figure permits. A suggestion carries `figure` and
// `bass` only when it specifies an inversion — the name stays the plain chord
// symbol ('C', never 'C/E'), because the name is the graph's key.
export {
  bassOf,
  edgeChord,
  edgeFigure,
  figureArity,
  figureBassIndex,
  figureFitsChord,
  figureLabel,
  figuredRoman,
  FIGURES,
  isFiguredChord,
  parseFigure,
} from './figuredBass'
export type {
  ChartEdge,
  Figure,
  FiguredChord,
  HarmonicSpan,
  LineCondition,
  MetricCondition,
  RuleWaiver,
  SpanConditions,
  SpanKind,
} from './graphData/types'

// spans — ordered harmonic templates (Stage M-A, A4/A6) --------------------
// A span is a TEMPLATE OVER THE GRAPH, not an edge in it: the devices whose
// identity is contextual (passing vs pedal vs cadential 6/4) cannot be
// distinguished by a first-order edge. `nextChord`/`nextChordDetail` never
// consult this library — it is a parallel, additive channel.
// NOTE FOR DOWNSTREAM STREAMS: `conditions` (bass/soprano/metric) is INERT at
// this stage — declared and stored, never evaluated. B1 activates the voice
// conditions, B3 the metric ones. `waivers` is live data B1 should consume.
export { spanById, spanRomans, spanWaivedRules, spans, spansOfKind } from './spans'

// harmonic rhythm and metric weight (Stage M-B, B3) ------------------------
// Reads strong/weak position from the timing data that already exists
// (`tickCounts`/`BAR` and the per-note `barDelay` tag — finding V4); it adds no
// clock of its own. `spanMetricFit` ACTIVATES the `conditions.metric` field the
// span library declared inert in Stage M-A, and `cadentialSixFourMetricFit` is
// the metric half of what distinguishes the three six-fours — the
// voice-leading half (the 6/4 -> 5/3 resolution over a held bass) is B1's.
// The weight model is a flat Lerdahl-Jackendoff dot grid; its simplifications
// (no hypermeter, no grouping structure, no preference rules) are documented
// on `metricWeight`.
export {
  barTicksOf,
  cadentialSixFourMetricFit,
  ENGINE_BAR_TICKS,
  METER_NAMES,
  METRIC_LEVEL_WEIGHT,
  meterSpec,
  metricStrength,
  metricStronger,
  metricWeight,
  spanMetricFit,
  suggestHarmonicRhythm,
} from './harmonicRhythm'
export type {
  HarmonicRhythmOptions,
  HarmonicRhythmStep,
  HarmonicRhythmSuggestion,
  MeterName,
  MeterSpec,
  MetricLevel,
  MetricPosition,
  MetricStepFit,
  SixFourMetricVerdict,
  SpanMetricFit,
} from './harmonicRhythm'

export { seventhOf, seventhSuggestions } from './sevenths'

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