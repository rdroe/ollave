// Namespace exports for backward compatibility
export * as addChord from './addChord'
export * as addNote from './addNote'
export * as tags from './util/tagsUtil'
export * as graphh from './graphh'
export * as helpers from './helpers'
export * as music from './music'
export * as midi from './midi'
export * as subcommands from './subcommands'
export * as addSlider from './addSlider'
export { words } from './words'
export * as mapSongToTicks from './mapSongToTicks'
export * as mem from './schemas'
export * as phaseUtil from './util/phaseUtil'

// Removed cli export to break circular dependency
export * as addTempoSlider from './addTempoSlider'
export * as nextChord from './nextChord'
export * as romanize from './romanize'
export * as deleteNoteById from './deleteNoteById'


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

} from './util/phaseUtil'

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
} from './util/tagsUtil'

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

export  * as util from './util'
