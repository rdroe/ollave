
import { Chord, Note, Mode, Scale, Progression, Collection } from "tonal"

export const noteNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', "A", "Bb", "B"]
type Vector = {
    triads: string[],
    romanizedTriads: string[],
    myIndex: number,
    tonic: string,
    scaleName: string
}
export type ChordNameWithNotes = {
    name: string
    notes: string[]
    history?: (Vector & { myName: string })[]
}


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

const isGraphName = (arg: string | number): arg is keyof typeof nameTranslations => {
    if (!!nameTranslations[arg as keyof typeof nameTranslations]) return true
    return false
}

const isGraphValue = (arg: string | number) => {
    if (typeof arg === "string" && namesInverted.find(([name, translations]) => translations.includes(arg))) return true
    return false
}

const nameTranslations: {
    [graphName: string]: string[] | ((t:
        string, s: string, chordName: string) => string[])
} = {
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

const namesInverted: [graphName: string, tonalRomanNames: string[]][] = [
    ["iii", ["IIIm", "bIIIm"]],
    ["iv", ["IVm"]],
    ["iio", ["IImdim"]],
    ["i", ["Im"]],
    ["viio", ["VIImdim"]],
    ["vi", ["VIm"]],
    ["I", ["I", "bI"]],
    ["II", ["II", "bII"]],
    ["III", ["bIII", "III"]],
    ["viio/IV", ["VIImdim/IV"]],
    ["viio/VII", ["VIImdim/VII"]],
    ["viio/III", ["VIImdim/III"]],
    ["viio/vi", ["VIImdim/VIm"]],
    ["viio/V", ["VIImdim/V"]],
    ["V7/vi", ["V7/VIm"]],
    ["V/V", ["V"]],
    ["V64", ["V64"]],
    ["N6", ["N6"]],
    ["+6", ["Aug6"]],
]

const graphNameFromTonalJsRoman_ = (arg: string) => namesInverted.find((tonalRomans) => {

    return tonalRomans[1].includes(arg)
})

const graphNameFromTonalJsRoman = (arg: string): null | keyof typeof nameTranslations => {
    const initialResult = graphNameFromTonalJsRoman_(arg)
    if (!initialResult) return null
    const possGraphName = initialResult[0]
    if (isGraphName(possGraphName)) {
        return possGraphName
    }
    return null
}

export const getNameTranslations = () => nameTranslations
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
        dotted: ["VIImdim/VI", "V7/III"]
    },
    {
        name: "VII",
        next: ["III"],
        dotted: ["I"],
    },
    {
        name: "III",
        next: ["VIImdim/VI", "V7/VI", "VI",],
    },
    {
        name: "VI",
        next: ["IImdim", "IVm", /* N6 +6 */],

    },
    // double-box top                                                                                        
    {
        name: "iv",
        prev: ["VI"],
        next: [
            "VIImdim/V", "V/V", // small upper fork                                                          
            "V64", "VIImdim", "V"], // big confusing box                                                     
    },
    // double-box bottom                      
    {
        name: "iio",
        prev: ["VI"],
        next: [
            "VIImdim/V", "V/V", // small upper fork                                                         
            "V64", "VIImdim", "V"],// big confusing box                                                     
    },
    // big confusing box v64
    {
        name: "V64",
        dotted: ["I"],
        next: ["N6", "+6", "I"],
    },
    // big confusing box viio (must play V before leaving ???)                                     
    {
        name: "viio",
        prev: ["iv", "iimdim"],
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
        next: ["VIImdim/VII", "V7/VII"],
    },
    {
        name: "V7/IV",
        next: ["VIImdim/VII", "V7/VII"],
    },
    // 2
    {
        name: "viio/VII",
        next: ["VIImdim/III", "V7/III", /*downward arrow*/ "VII"],
    },
    {
        name: "V7/VII",
        next: ["VIImdim/III", "V7/III", /*downward arrow*/ "VII"],
    },
    // 3                 
    {
        name: "viio/III",
        next: ["VIImdim/vi", "V7/vi", /*downward arrow*/ "III"],
    },
    {
        name: "V7/III",
        next: ["VIImdim/VIm", "V7/vi", /*downward arrow*/ "III"],
    },
    // 4                   
    {
        name: "viio/vi",
        next: ["IVm", "IImdim", /*downward arrow */ "VI"],
    },
    {
        name: "V7/vi",
        next: ["IVm", "IImdim", /*downward arrow */ "VI"],
    },
    // 5                   
    {
        name: "viio/V",
        next: ["V64", "VIImdim"],
    },
    {
        name: "V/V",
        next: ["V64", "VIImdim"],
    },
    { name: "i", next: "Any" },
]

export const allNexts = minor.map(({ next }) => next).flat()

type ScaleName = 'minor'

const chordToGraphName = (tonalJsChordName: string) => {

    const { tonic } = Chord.get(tonalJsChordName)

    if (!tonic) return null
    const [tonalJsRoman] = Progression.toRomanNumerals(tonic, [tonalJsChordName])

    const graphName = graphNameFromTonalJsRoman(tonalJsRoman)
    if (!graphName) return null
    return graphName
}
const oneIndexedArr = (len: number) => {
    if (len <= 0) return []
    const arr: number[] = []
    let n = 1
    while (n <= len) {
        arr.push(n)
        n += 1
    }
    return arr
}

export const rotations = <T>(arr: Array<T>): T[][] => {
    const len = arr.length
    let rotation = 1
    const rotations: T[][] = []
    while (rotation < len) {
        const rotated = Collection.rotate(rotation, arr)
        rotations.push(rotated)
        rotation++
    }
    return rotations
}

export const noteInversions = (chordName: string, userOct: number = 3): string[][] => {

    const { tonic: tonicNote, type: chordType } = Chord.get(chordName)
    const { letter } = Note.get(tonicNote)

    let oct = userOct


    if (!letter) {
        console.error('inversions', { chordName })
        throw new Error(`Cannot get note inversions without a letter + octave note`)
    }

    const validTonic = `${letter}${oct}`
    const noteCount = Chord.getChord(chordType, validTonic)?.notes?.length
    if (typeof noteCount !== "number") return []
    const mappableNums = oneIndexedArr(noteCount)
    const rotatedIndexes = rotations(mappableNums)
    const degreesFn = Chord.degrees([validTonic, chordType]);
    return rotatedIndexes.map((orderedIndexes) => {
        return orderedIndexes.map(degreesFn)
    })
}
export const nakedNoteInversions = (cn: string, oct: number = 3) => {
    return noteInversions(cn, oct).map((nArr) => nArr.map((nm) => Note.get(nm).pc))
}

export const detectScales = (notes: string[], userLetter?: string, userScale?: string) => {

    const allScales = detectAllScales(notes)

    if (!userLetter || !userScale) {
        return allScales
    }

    const scales = allScales.reduce((accum, scale) => {
        const split = scale.name.split(' ')
        const scaleTonic = Note.get(split[0])
        const nameOnly = split.slice(1).join(' ').toLocaleLowerCase()
        const nameMatch = scaleTonic.pc === split[0] && userScale.toLowerCase().includes(nameOnly)
        const notAlready = !accum.find(({ name }) => name === scale.name)
        console.log('scale match', {

            scaleTonic, nameOnly, nameMatch, notAlready, split
        })
        if (nameMatch && notAlready) {
            return [...accum, scale]
        }
        return accum

    }, [] as { name: string }[])

    return scales
}

export const chordNameWithNotes = (chordName: string, oct: number = 3): ChordNameWithNotes => {

    if (chordName.includes('/')) {
        const [main, bass] = chordName.split('/')

        if (!main || !bass) return null

        const mainInversions = noteInversions(main, oct)
        const bassNames = Chord.get(bass)?.notes || []
        const bassNote = bassNames[0]

        const bassLetter = Note.get(bassNote).letter
        console.log('notes in cnwn fn', { mainInversions, bassLetter })
        const permutedNotes = mainInversions.find((notes) => {
            return notes[0].startsWith(bassLetter) || Note.enharmonic(notes[0]).startsWith(bassLetter)
        })

        if (!permutedNotes) {
            throw new Error(`Could not ad-hoc provide the slash chord ${chordName}`)
        }
        return {
            name: chordName,
            notes: permutedNotes
        }
    }

    const simpleChord = Chord.get(chordName)
    const tonicParsed = Note.get(simpleChord.notes[0])
    const noteWithOct = `${tonicParsed.name}${oct}`

    if (typeof tonicParsed.oct === "number") return {
        name: chordName,
        notes: simpleChord.notes
    }

    return {
        name: simpleChord.symbol,
        notes: Chord.getChord(simpleChord.type, noteWithOct)?.notes || [],

    }
}

export const progressionNodeToTonalOptions = ({ next }: ProgressionNode, scaleTonic: string, scaleName: string, originalTonalChordName: string, origOctave: number = 3): ChordNameWithNotes[] => {

    if (next === "Any") return [{
        name: "Any",
        notes: []
    }]

    return next.map((graphNameOrRomanNumeral) => {
        // every next returns
        if (isGraphName(graphNameOrRomanNumeral)) {
            // If it's a function name, treat the special case.
            const arrOrFn = nameTranslations[graphNameOrRomanNumeral]

            // function output
            if (typeof arrOrFn === 'function') {
                const notes = arrOrFn(scaleTonic, scaleName, originalTonalChordName)
                return [{
                    name: graphNameOrRomanNumeral,
                    notes
                }]
            }

            // or a treatment of its own multiple names.
            const graphNameResults = arrOrFn.map((nm) => {
                console.log('name in graphh', nm)
                const needsTranslation = isGraphName(nm)
                if (!needsTranslation) {
                    const [romName] = Progression.fromRomanNumerals(scaleTonic, [nm])
                    return chordNameWithNotes(romName, origOctave)
                }

                const romanOrFn = nameTranslations[nm]
                // For fns, we don't need to go any further here (with current structure of code at time of writing)
                if (typeof romanOrFn === "function") return []

                // at this point we are assuming it's translatable.
                if (!Array.isArray(romanOrFn)) {
                    console.error({
                        'should have been an array (or function': `${nm} on nameTranslations`
                    })
                }

                // romanOrFn is an array of string values from the graph; could be roman, but could need translation.
                return romanOrFn.filter((flatOrDoable) => {
                    if (flatOrDoable.startsWith("b") || flatOrDoable.includes("\/b")) {
                        console.error('Found a flatted roman numeral');
                        return false
                    }
                    return true
                }).map((roman) => {
                    if (roman.includes("/")) {
                        const [r1, r2] = roman.split("/")
                        const [name1, name2] = Progression.fromRomanNumerals(scaleTonic, [r1, r2])
                        return chordNameWithNotes(`${name1}/${name2}`, origOctave)
                    }
                    const [name] = Progression.fromRomanNumerals(scaleTonic, [roman])
                    return chordNameWithNotes(name, origOctave)
                })
            }).flat()
            console.log('graphNameResults', { graphNameResults })
            return graphNameResults
        } else {

            if (typeof graphNameOrRomanNumeral === "string") {
                if ((graphNameOrRomanNumeral as string).includes("/")) {
                    const [r1, r2] = (graphNameOrRomanNumeral as string).split("/")
                    const [name1, name2] = Progression.fromRomanNumerals(scaleTonic, [r1, r2])
                    //                    return chordNameWithNotes(`${name1}/${name2}`, origOctave)
                    let cnwn2: null | ChordNameWithNotes = null
                    try {
                        const cnwn2 = chordNameWithNotes(`${name1}/${name2}`, origOctave)
                    } catch (e) {
                        console.error(`Caught chordNameWithNotes err: ${e.message}`)
                        return []
                    }
                    console.log("cnwn2", {
                        cnwn2, from: {
                            name: `${name1}/${name2}`,
                            origOctave,
                            scaleTonic,
                            graphNameOrRomanNumeral
                        }
                    })
                    return cnwn2 ? [cnwn2] : []
                }
                return []
            }
        }

    }).flat()
}

export const getProgressionNodes = (chordWithNotes: ChordNameWithNotes, scaleTonic: string, scaleName: string) => {

    const [romanized] = Progression.toRomanNumerals(scaleTonic, [chordWithNotes.name])

    const progNodes: ProgressionNode[] = []


    if (isGraphValue(romanized)) {
        progNodes.push(...minor.filter(({ name }) => {
            if (name.startsWith('b')) {
                console.error(`Came across a roman numeral starting with "b"; not sure what happened with it.`)
            }
            return name === romanized
        }))
    }

    const graphName = namesInverted.find(([, translations]) => {

        return translations.includes(romanized)
    })

    if (graphName && graphName[0] && isGraphName(graphName[0])) {
        const found = minor.find(({ name }) => name === graphName[0])
        if (found) {
            progNodes.push(found)
        }
    }

    return progNodes
}

export const romanizedOptions = (chordName: string, scaleTonic: string, scaleName: string, prev: string = ""): string[] => {

    const graphName = chordToGraphName(chordName)

    if (!graphName) return []

    const resultsForThisScale = minor.filter((node) => {
        if (node.name !== graphName) return false
        return true
    })

    const filteredForPrev = resultsForThisScale.filter((node) => {
        return !prev || node.prev?.includes(prev)
    })

    const nexts = filteredForPrev
        .map((node) => {
            if (node.next === "Any") {
                return allNexts
            }
            const translatedNextOptions =
                node.next.map((nextOption) => {

                    const arrOrFn = nameTranslations[nextOption]
                    if (typeof arrOrFn === 'function') {
                        const fnName = arrOrFn.name
                        const notes = arrOrFn(scaleTonic, scaleName, chordName)
                        return [`${fnName}|${notes.join(',')}`]
                    }
                    return arrOrFn ? arrOrFn : null
                }).filter((x) => x !== null).flat()
            return translatedNextOptions
        })
    return nexts
        .flat()
}
const allModes = Mode.all()
export const allScales = allModes.map((m) => {
    const scales = noteNames.map(nn => `${nn} ${m.name}`)
    const scaleObjs = scales.map(scName => Scale.get(scName))
    return scaleObjs
}).flat()
const inScale = (notes: string[], scale: { notes: string[] }) => {
    const indexMap = notes.reduce((accum, curr) => {
        const idx = scale.notes.indexOf(curr)
        if (idx > -1 && accum.length === 0 || accum[accum.length - 1] < idx) {
            return [...accum, idx]
        }
        return accum
    }, [] as number[])

    if ((indexMap.length === notes.length) && notes.length > 0) {
        return true
    }
    return false
}


export const detectAllScales = (notes: string[]) => {
    if (notes.length === 0) return []
    let sorted: string[] | null = null
    if (Note.get(notes[0]).oct !== undefined) {

        const sortMe = notes.concat()
        sortMe.sort((ntA, ntB) => {
            const ntDataA = Note.get(ntA)
            const ntDataB = Note.get(ntB)
            return ntDataA.freq - ntDataB.freq
        })

        sorted = sortMe.map((nt) => {
            return Note.get(nt).pc
        })

    } else {
        sorted = notes
    }



    return allScales.filter((sc) => {
        return inScale(sorted, sc)
    })
}
