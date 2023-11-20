
type GraphName = "iii" | "iv" | "iio" | "i" | "viio" | "vi" | "I" | "II" | "III" | "viio/IV" | "viio/VII" | "viio/III" | "viio/vi" | "viio/V" | "V7/vi" | "V/V" | "V64" | "V" | "N6" | "+6" | "VII" | "VI" | "V7/IV" | "V7/VII" | "V7/III" | "V7/vi"

const translated = {
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
    "V/V": ["V"]

    // https://www.hearandplay.com/main/who-else-wants-to-learn-what-6-4-chords-are
    // "V64": function romanFiveWithFifthNoteJammed(tonic: string) {}
    // any first inversion: https://www.hearandplay.com/main/who-else-wants-to-learn-what-6-4-chords-are
    // "N6": function neopolitan6(tonic: string) {}
    // https://music.stackexchange.com/questions/29255/what-is-the-symbol-mean-in-a-chord
    // "+6": function augmented6(tonic: string) {}
    // Any: function anyTriad(tonic: string) {}
}

type ProgressionNode = {
    name: GraphName,
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
