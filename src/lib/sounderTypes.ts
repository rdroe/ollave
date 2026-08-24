/**
 * The minimal instrument surface playback needs. The piano, the sampled
 * instruments and the General MIDI synth all present this shape, so
 * `playMusic` never learns which kind of instrument it is driving.
 *
 * `time` is a Tone time string (`'+<seconds>'`), NOT absolute seconds — see
 * the note on gmSounder for how the GM path converts it.
 */
export type Sounder = {
    keyDown: (args: { note: string; time: string; velocity: number }) => void
    keyUp: (args: { note: string; time: string }) => void
    connect: () => void
    isLoaded: () => boolean
}
