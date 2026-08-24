/**
 * General MIDI program names and the `gm:<program>` instrument-name encoding.
 *
 * A track's `instrument` is either a sampled name (see instrumentSamples.ts)
 * or `gm:<0-127>`, which routes to the SpessaSynth soundfont engine.
 */
export const GM_PREFIX = 'gm:'

/** GM program names, indexed by program number (0-based). */
export const GM_PROGRAM_NAMES: string[] = [
    'Acoustic Grand Piano',
    'Bright Acoustic Piano',
    'Electric Grand Piano',
    'Honky-tonk Piano',
    'Electric Piano 1',
    'Electric Piano 2',
    'Harpsichord',
    'Clavi',
    'Celesta',
    'Glockenspiel',
    'Music Box',
    'Vibraphone',
    'Marimba',
    'Xylophone',
    'Tubular Bells',
    'Dulcimer',
    'Drawbar Organ',
    'Percussive Organ',
    'Rock Organ',
    'Church Organ',
    'Reed Organ',
    'Accordion',
    'Harmonica',
    'Tango Accordion',
    'Acoustic Guitar (nylon)',
    'Acoustic Guitar (steel)',
    'Electric Guitar (jazz)',
    'Electric Guitar (clean)',
    'Electric Guitar (muted)',
    'Overdriven Guitar',
    'Distortion Guitar',
    'Guitar Harmonics',
    'Acoustic Bass',
    'Electric Bass (finger)',
    'Electric Bass (pick)',
    'Fretless Bass',
    'Slap Bass 1',
    'Slap Bass 2',
    'Synth Bass 1',
    'Synth Bass 2',
    'Violin',
    'Viola',
    'Cello',
    'Contrabass',
    'Tremolo Strings',
    'Pizzicato Strings',
    'Orchestral Harp',
    'Timpani',
    'String Ensemble 1',
    'String Ensemble 2',
    'SynthStrings 1',
    'SynthStrings 2',
    'Choir Aahs',
    'Voice Oohs',
    'Synth Voice',
    'Orchestra Hit',
    'Trumpet',
    'Trombone',
    'Tuba',
    'Muted Trumpet',
    'French Horn',
    'Brass Section',
    'SynthBrass 1',
    'SynthBrass 2',
    'Soprano Sax',
    'Alto Sax',
    'Tenor Sax',
    'Baritone Sax',
    'Oboe',
    'English Horn',
    'Bassoon',
    'Clarinet',
    'Piccolo',
    'Flute',
    'Recorder',
    'Pan Flute',
    'Blown Bottle',
    'Shakuhachi',
    'Whistle',
    'Ocarina',
    'Lead 1 (square)',
    'Lead 2 (sawtooth)',
    'Lead 3 (calliope)',
    'Lead 4 (chiff)',
    'Lead 5 (charang)',
    'Lead 6 (voice)',
    'Lead 7 (fifths)',
    'Lead 8 (bass + lead)',
    'Pad 1 (new age)',
    'Pad 2 (warm)',
    'Pad 3 (polysynth)',
    'Pad 4 (choir)',
    'Pad 5 (bowed)',
    'Pad 6 (metallic)',
    'Pad 7 (halo)',
    'Pad 8 (sweep)',
    'FX 1 (rain)',
    'FX 2 (soundtrack)',
    'FX 3 (crystal)',
    'FX 4 (atmosphere)',
    'FX 5 (brightness)',
    'FX 6 (goblins)',
    'FX 7 (echoes)',
    'FX 8 (sci-fi)',
    'Sitar',
    'Banjo',
    'Shamisen',
    'Koto',
    'Kalimba',
    'Bag pipe',
    'Fiddle',
    'Shanai',
    'Tinkle Bell',
    'Agogo',
    'Steel Drums',
    'Woodblock',
    'Taiko Drum',
    'Melodic Tom',
    'Synth Drum',
    'Reverse Cymbal',
    'Guitar Fret Noise',
    'Breath Noise',
    'Seashore',
    'Bird Tweet',
    'Telephone Ring',
    'Helicopter',
    'Applause',
    'Gunshot',
]

/**
 * The 16 standard GM families, each covering 8 consecutive programs. Used to
 * group the instrument menu so 128 entries stay navigable.
 */
export const GM_FAMILIES: string[] = [
    'Piano',
    'Chromatic Percussion',
    'Organ',
    'Guitar',
    'Bass',
    'Strings',
    'Ensemble',
    'Brass',
    'Reed',
    'Pipe',
    'Synth Lead',
    'Synth Pad',
    'Synth Effects',
    'Ethnic',
    'Percussive',
    'Sound Effects',
]

/** Family name for a program number, e.g. 24 -> 'Guitar'. */
export const gmFamilyOf = (program: number): string =>
    GM_FAMILIES[Math.floor(program / 8)] ?? 'Sound Effects'

/** `gm:<n>` for a program number. */
export const gmInstrumentName = (program: number): string =>
    `${GM_PREFIX}${program}`

/** Every GM instrument name, in program order. */
export const GM_INSTRUMENT_NAMES: string[] = GM_PROGRAM_NAMES.map((_, i) =>
    gmInstrumentName(i)
)

/**
 * Program number for a `gm:<n>` name, or null if it is not a GM name or the
 * program is out of the 0-127 range.
 */
export const gmProgramOf = (name: string): number | null => {
    if (!name.startsWith(GM_PREFIX)) return null
    const rest = name.slice(GM_PREFIX.length)
    if (!/^\d{1,3}$/.test(rest)) return null
    const program = Number(rest)
    return program >= 0 && program <= 127 ? program : null
}

/** True for a well-formed `gm:<0-127>` name. */
export const isGmInstrument = (name: string): boolean =>
    gmProgramOf(name) !== null

/** Human label for an instrument name: 'gm:24' -> 'Acoustic Guitar (nylon)'. */
export const gmLabel = (name: string): string => {
    const program = gmProgramOf(name)
    return program === null ? name : (GM_PROGRAM_NAMES[program] ?? name)
}
