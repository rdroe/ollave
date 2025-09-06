
/*
The formula is 60000 / (BPM * PPQ) (milliseconds).
Where BPM is the tempo of the track (Beats Per Minute).
(i.e. a 120 BPM track would have a MIDI time of (60000 / (120 * 192)) or 2.604 ms for 1 tick.i
*/


// at the moment, PPQ stays constant.
// although user can already change speed to increase playback speed, this PPQ var may be variable based on tempo in the future. this would alter the number of ticks laid down per musical entity. (e.g. a 64th note would end up on a different tick). at the time of writing this note, a 64th note is always going to fall on the same number of tick (but a different ms when the speed is tweaked).
export const ppq = 128 // 128 matches GarageBand's default

export const BAR = 'bar' as const
export const HALF = 'half' as const
export const QUARTER = 'quarter' as const
export const EIGHTH = 'eighth' as const
export const SIXTEENTH = 'sixteenth' as const
export const THIRTY_SECOND = 'thirtySecond' as const
export const SIXTY_FOURTH = 'sixtyFourth' as const
export const ONE_TWENTY_EIGHTH = 'oneTwentyEighth' as const
export const ZERO = 'zero' as const
export const roundToTenths = (num: number) => {
    return Math.round(num * 10) / 10
}

// used throughout the codebase.
// needs to probably be functionalized for any kind of dynamicity of speed.
const tickCounts_ = {
    [ZERO]: 0,
    [BAR]: ppq * 4, // 128 ppq * 4
    [HALF]: ppq * 4 / 2, // 128 * 2
    [QUARTER]: ppq * 4 / 4, // 128
    [EIGHTH]: ppq * 4 / 8, // 64
    [SIXTEENTH]: ppq * 4 / 16, // 32
    [THIRTY_SECOND]: ppq * 4 / 32, // 16
    [SIXTY_FOURTH]: ppq * 4 / 64, // 8
    [ONE_TWENTY_EIGHTH]: ppq * 4 / 128, // 4
};

(window as any).tickCounts = tickCounts_
export const tickCounts = tickCounts_


export const oneTwentyEighthCounts = {
    [BAR]: 128,
    [HALF]: 64,
    [QUARTER]: 24,
    [EIGHTH]: 16,
    [SIXTEENTH]: 8,
    [THIRTY_SECOND]: 4,
    [SIXTY_FOURTH]: 2,
    [ONE_TWENTY_EIGHTH]: 1,
    [ZERO]: 0
}

export type Abbreviation = 'bar' | 'half' | '4th' | '8th' | '16th' | '32nd' | '64th' | '128th' | '0th'

export const abbrev = {
    'bar': BAR,
    'half': HALF,
    '4th': QUARTER,
    '8th': EIGHTH,
    '16th': SIXTEENTH,
    '32nd': THIRTY_SECOND,
    '64th': SIXTY_FOURTH,
    '128th': ONE_TWENTY_EIGHTH,
    '0th': ZERO,
    '2nd': HALF,
    'quarter': QUARTER,
    'eighth': EIGHTH,
    'sixteenth': SIXTEENTH,
    'thirtySecond': THIRTY_SECOND,
    'sixtyFourth': SIXTY_FOURTH,
    'oneTwentyEighth': ONE_TWENTY_EIGHTH,
    'zero': ZERO,
} as { [Property in Abbreviation]: keyof typeof tickCounts }
