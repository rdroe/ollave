
import { Chord, Note, Mode, Scale, Progression, Collection } from "tonal"
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

export const noteNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', "A", "Bb", "B"]
export type ChordNameWithNotes = {
    name: string
    notes: string[]

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

