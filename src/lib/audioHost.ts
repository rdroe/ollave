/**
 * Where the app serves `web/public/audio` from. Sample maps, the General MIDI
 * soundfont and the SpessaSynth worklet all resolve against this.
 */
const port = window?.location?.port ?? '8080'
const host = window?.location?.hostname ?? 'localhost'

export const AUDIO_BASE = `//${host}:${port}/audio`
export const SOUNDFONT_URL = `${AUDIO_BASE}/soundfonts/FluidR3_GM.sf2`
export const SPESSA_WORKLET_URL = `${AUDIO_BASE}/soundfonts/spessasynth_processor.min.js`
