// Namespace exports for backward compatibility
export * as addChord from './addChord'
export * as addNote from './addNote'
export * as tags from './tags'
export * as graphh from './graphh'
export * as helpers from './helpers'
export * as music from './music'
export * as midi from './midi'
export * as subcommands from './subcommands'
export * as addSlider from './addSlider'
export { words } from './words'
export * as mapSongToTicks from './mapSongToTicks'
export * as mem from './mem'
export * as memDb from './mem-db'
export * as cli from '../cli'
export * as addTempoSlider from './addTempoSlider'
export * as nextChord from './nextChord'
export { makeCompilationSubscribe } from '../commands/phase/subjects/compilationSubject'
export { makeTickSubscribe } from '../commands/phase/subjects/masterTicksSubject'

// Individual function exports for direct access
// mem-db exports
export { 
    phaseFollowsPhase,
    phaseUnfollows,
    sortByNumberAfterColon,
    startEndData,
    lookUpGraph,
    lastTick,
    getAllPhaseBars,
    getAllPhaseBarNotes,
    getFollowingPhases,
    phaseExists,
    phaseCount,

} from './mem-db'

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
    properScaleName
} from './helpers'

// addNote exports
export { addNoteToBar } from './addNote'

// tags exports
export { 
    updateNoteTag,
    parseNoteTags,
    calcFractionalDelay
} from './tags'

// graphh exports
export { 
    ProgressionOptions,
    minor,
    allScales
} from './graphh'

// music exports
export { 
    Triad,
    RelativeNote,
    samplerState,
    getSampler,
    playTriads
} from './music'

// midi exports
export { 
    saveRaw,
    addEvents,
    addNoteEvents,
    playNotes
} from './midi'

// subcommands exports
export { 
    Subcommand,
    SubcommandPatterns,
    runSubcommandsOrNull,
    romanChordNameToRealModule
} from './subcommands'

// mapSongToTicks exports
export { 
    mapSongToMidiTicks
} from './mapSongToTicks'