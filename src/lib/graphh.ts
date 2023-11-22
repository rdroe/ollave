
import { Chord, Note, Scale, Progression, Collection } from "tonal"

// for an array entry in translated values, find the key (the property at which it is stored)

export const N6 = function N6(tonic: string, scaleName: string) {
    const secondDegree = Scale.degrees(`${tonic} ${scaleName}`)(2)
    const neoRoot = Note.simplify(`${secondDegree}b`.replace('#b', ''))
    const notes = ['1P', '3M', '5P'].map(Note.transposeFrom(neoRoot))
    if (Note.octave(notes[0]) !== undefined) {
        throw new Error(`Neapolitan chord ${notes} has octave`)
    }
    return Collection.rotate(1, notes)
}

export const V64 = function V64(tonic: string) {
    const [chordName] = Progression.fromRomanNumerals(tonic, ["V"])
    const V = Chord.get(chordName)?.notes
    if (Note.octave(V[0]) !== undefined) {
        throw new Error(`V64 chord ${V} has octave`)
    }
    return Collection.rotate(1, V)
}

export const Aug6 = function Aug6(tonic: string, scaleName: string) {
    /*
Think of your key as C. The formula for the chord is (using scale degrees) b6, 1, #4, or in C, this would be Ab, C, F#. https://www.reddit.com/r/musictheory/comments/2vhagj/eli5_augmented_sixth_chords/
*/
    const six = Scale.degrees(`${tonic} ${scaleName}`)(6)
    const flatSix = Note.simplify(`${six}b`.replace('#b', ''))
    const one = Scale.degrees(`${tonic} ${scaleName}`)(1)
    const four = Scale.degrees(`${tonic} ${scaleName}`)(4)
    const sharpFour = Note.simplify(`${four}#`.replace('b#', ''))
    if (Note.octave(one) !== undefined || Note.octave(four) !== undefined || Note.octave(sharpFour) !== undefined) {
        throw new Error(`Aug6th chord ${[flatSix, one, sharpFour]} has octave`)
    }
    return [flatSix, one, sharpFour]
}

export const translated: { [graphName: string]: string[] | ((t: string, s?: string) => string[]) } = {
    "iii": ["IIIm", "bIIIm"],
    "iv": ["IVm"],
    "iio": ["IImdim"],
    "i": ["Im"],
    "viio": ["VIImdim"],
    "vi": ["VIm"],
    "I": ["I", "bI"],
    "II": ["II", "bII"],
    "III": ["bIII", "III"],
    "viio/IV": ["VIImdim/IV"],
    "viio/VII": ["VIImdim/VII"],
    "viio/III": ["VIImdim/III"],
    "viio/vi": ["VIImdim/VIm"],
    "viio/V": ["VIImdim/V"],
    "V7/vi": ["V7/VIm"],
    "V/V": ["V"],
    "V64": V64,
    "N6": N6,
    "+6": Aug6,
}

type ProgressionNode = {
    name: string,
    prev?: string[],
    next: string[] | "Any",
    dotted?: string[]
}

export const minor: ProgressionNode[] = [
    {
        name: "iv",
        next: ["VII"],
        dotted: ["viio/vi", "V7/III"]
    },
    {
        name: "VII",
        next: ["III"],
        dotted: ["i"],
    },
    {
        name: "III",
        next: ["viio/vi", "V7/vi", "VI",],
    },
    {
        name: "VI",
        next: ["iio", "iv", /* N6 +6 */],

    },
    // double-box top
    {
        name: "iv",
        prev: ["VI"],
        next: [
            "viio/V", "V/V", // small upper fork
            "V64", "viio", "V"], // big confusing box
    },
    // double-box bottom
    {
        name: "iio",
        prev: ["VI"],
        next: [
            "viio/V", "V/V", // small upper fork
            "V64", "viio", "V"],// big confusing box
    },
    // big confusing box v64
    {
        name: "V64",
        dotted: ["I"],
        next: ["N6", "+6", "i"],
    },
    // big confusing box viio (must play V before leaving ???)
    {
        prev: ["iv", "iio"],
        name: "viio",
        next: ["V"],
    },
    // big confusing box V    
    {
        name: "V",
        next: ["V64", "+6"],
        dotted: ["I"],
    },
    // non-box with sixes N6
    {
        name: "N6",
        next: ["V"],
    },
    // non-box with sixes +6
    {
        name: "+6",
        next: ["V"],
    },
    // upper boxesssssss ltr
    // 1
    {
        name: "viio/IV",
        next: ["viio/VII", "V7/VII"],
    },
    {
        name: "V7/IV",
        next: ["viio/VII", "V7/VII"],
    },
    // 2
    {
        name: "viio/VII",
        next: ["viio/III", "V7/III", /*downward arrow*/ "VII"],
    },
    {
        name: "V7/VII",
        next: ["viio/III", "V7/III", /*downward arrow*/ "VII"],
    },
    // 3
    {
        name: "viio/III",
        next: ["viio/vi", "V7/vi", /*downward arrow*/ "III"],
    },
    {
        name: "V7/III",
        next: ["viio/vi", "V7/vi", /*downward arrow*/ "III"],
    },
    // 4
    {
        name: "viio/vi",
        next: ["iv", "iio", /*downward arrow */ "VI"],
    },
    {
        name: "V7/vi",
        next: ["iv", "iio", /*downward arrow */ "VI"],
    },
    // 5
    {
        name: "viio/V",
        next: ["V64", "viio"],
    },
    {
        name: "V/V",
        next: ["V64", "viio"],
    },
    { name: "i", next: "Any" },
]

export const allNexts = minor.map(({ next }) => next).flat()
