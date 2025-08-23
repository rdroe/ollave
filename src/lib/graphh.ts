import fakeCli from "peprn/fakeCli"
import { Chord, Note, Mode, Scale, Progression, Collection } from "tonal"

export const sharpNoteNames = ['C#', 'D#', 'F#', 'G#', "A#"]
export const noteNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', "A", "Bb", "B"].concat(sharpNoteNames)

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

export type ChordNameWithNotes = {
    name: string
    notes: string[]
    octMap?: (notes: string[], oct: number) => string[]
}

export type EnabledChordNameWithNotes = ChordNameWithNotes & {
    enabler: string[] | null
}

export const N6 = function N6(tonic: string, scaleName: string): ChordNameWithNotes[] {
    const secondDegree = Scale.degrees(`${tonic} ${scaleName}`)(2)
    const neoRoot = Note.simplify(`${secondDegree}b`.replace('#b', ''))
    const notes = ['1P', '3M', '5P'].map(Note.transposeFrom(neoRoot))
    if (Note.octave(notes[0]) !== undefined) {
        throw new Error(`Neapolitan chord ${notes} has octave`)
    }
    return [{
        name: "N6",
        notes: Collection.rotate(1, notes),
        octMap: (notes, oct) => notes.map(nt => `${nt}${oct}`)
    }]
}

export const V64 = function V64(tonic: string): ChordNameWithNotes[] {
    const [chordName] = Progression.fromRomanNumerals(tonic, ["V"])
    const V = Chord.get(chordName)?.notes
    if (Note.octave(V[0]) !== undefined) {
        throw new Error(`V64 chord ${V} has octave`)
    }
    return [{
        name: "V64",
        notes: Collection.rotate(1, V),
        octMap: (notes, oct) => notes.map(nt => `${nt}${oct}`)
    }]
}

export const Aug6 = function Aug6(tonic: string, scaleName: string): ChordNameWithNotes[] {
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

    return [{
        name: "Aug6",
        notes: [flatSix, one, sharpFour],
        octMap: (notes, oct) => notes.map(nt => `${nt}${oct}`)
    }]
}

export type ChordFunction = 'V64' | 'Aug6' | 'N6' | 'V63'

export const isChordFn = (arg: any): arg is ChordFunction => {
    return ['V64', 'Aug6', 'N6'].includes(arg)
}

export const fns = {
    V64,
    Aug6,
    N6,
    V63: () => {
        throw new Error('V63 is not a function')
    }
}

export const DynamicChordNames: {
    [key in Exclude<ChordFunction, 'V63'>]: string 
} = {
    V64: "V64",
    Aug6: "Aug6",
    N6: "N6",
} as const
export type ProgressionGraphNode = {
    name: string, // may be a function name 
    next: string[],
    dotted?: string[]
    prev?: string[],
}

export const scaleLetters = (scaleTonic: string, scaleName: string) => {
    const ten = oneIndexedArr(10).map(Scale.degrees(`${scaleTonic} ${scaleName}`))
    const len = Scale.get(`${scaleTonic} ${scaleName}`).notes.length
    if (len !== 7) throw new Error(`Cannot get progressions for ${len} sized scale`)
    return ten.slice(0, len)
}

export const romanToLetterEntries = (scaleTonic: string, scaleName: string) => {
    const letters = scaleLetters(scaleTonic, scaleName)
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
    const entries1 = letters.map((ltr, idx) => {
        return [romans[idx], ltr]
    })

    const entries2 = letters.map((ltr, idx) => {
        return [romans[idx], Note.enharmonic(ltr)]
    })

    const all1 = [...entries1, ...entries2]

    all1.sort(
        ([lA], [lB]) => lB.length - lA.length)
    const flatAndSharpRomans = all1.filter(([ltr]) => {
        return ltr.includes('b') || ltr.includes('#')
    }).map(([flatOrSharpLetter, roman]) => {
        const acc = Note.get(flatOrSharpLetter).acc
        return [`${acc}${roman}`, flatOrSharpLetter]
    })
    return all1.concat(flatAndSharpRomans)
}

const romanChordNameToReal_ = (scaleTonic: string, scaleName: string, romanName: string) => {
    const entries = romanToLetterEntries(scaleTonic, scaleName)
    const newName = entries.reduce((accum, curr) => {
        return accum.replace(curr[0], curr[1])
    }, romanName)
    if (newName === romanName) return ""
    return newName
}

export const romanChordNameToReal = (scaleTonic: string, scaleName: string, romanName: string,): string => {
    if (romanName.includes('/')) {
        return unromanizeSecondaryChords(scaleTonic, scaleName, romanName)[0]
    }
    return romanChordNameToReal_(scaleTonic, scaleName, romanName)
}

export const getTriadByRomanNumeral = async (scaleTonic: string, scaleName: string, romanNum: string) => {
    const prog = (await fakeCli(`chord progressions ${scaleTonic} ${scaleName.toLocaleLowerCase()}`)).formatted[0]
    const progEntries = Object.entries(prog as { [idx: string]: { roman: string, chordName: string } })
    const found = progEntries.find(([, progElem]) => {
        return progElem.roman === romanNum
    })
    return found[1].chordName
}

function romanEntry(progRoman: string) {
    const indicesStartsFlat = Object.entries({
        bI: 0,
        bII: 1,
        bIII: 2,
        bIV: 3,
        bV: 4,
        bVI: 5,
        bVII: 6,
    })
    const indicesStarts = Object.entries({
        I: 0,
        II: 1,
        III: 2,
        IV: 3,
        V: 4,
        VI: 5,
        VII: 6,
    })

    const longestMatch = indicesStartsFlat.concat(indicesStarts).filter(([roman1, idx]) => {
        return progRoman.startsWith(roman1)
    }).sort(([roman1], [roman2,]) => {
        return roman2.length - roman1.length
    })

    return longestMatch[0]
}

// given e.g. IImdim, return II
// given e.g. bIIImdim, return bIII
export function romanFromProgRoman(progRoman: string) {
    const longestMatch = romanEntry(progRoman)
    return longestMatch[0]
}


const unromanizeSecondaryChord = (tonic: string, scale: string, romanChord: string) => {
    const romGuess1 = romanFromProgRoman(romanChord)
    const type = romanChord.replace(romGuess1, '')
    const letters = scaleLetters(tonic, scale)
    const romanDegreeIndex = romanEntry(romGuess1)

    const letter = letters[romanDegreeIndex[1]]
    const finalDom = Chord.getChord(type, letter).symbol

    return finalDom
}

export const unromanizeSecondaryChords = (tonic: string, scale: string, slashRoman: string) => {

    const slashed = slashRoman.split('/')
    const dominantRoman = slashed[1]
    const dominantChord = unromanizeSecondaryChord(tonic, scale, dominantRoman)

    const secondaryRoman = slashed[0]
    const domData = Chord.get(dominantChord)
    const secondaryTonic = domData.tonic
    const secondaryScale = domData.quality === "Diminished" ? "minor" : domData.quality.toLocaleLowerCase()

    const secondaryChord = unromanizeSecondaryChord(secondaryTonic, secondaryScale, secondaryRoman)

    return [secondaryChord, dominantChord]

}


export const optionalRomans = ["IImdim"]
export function makeProgNodeTranslator(
    userLetter: string,
    userScale: string
): (progNode: ProgressionGraphNode) => ProgressionOptions | null {

    return (progNodeIn) => {
        let translatedSource: ChordNameWithNotes | undefined

        if (isChordFn(progNodeIn.name)) {
            const fnRes = fns[progNodeIn.name](userLetter, userScale)
            const asEnabledArr = fnRes.map((cnwnFn) => {
                return {
                    name: cnwnFn.name,
                    notes: cnwnFn.notes,
                    octMap: cnwnFn.octMap
                }
            })
            if (asEnabledArr.length) {
                translatedSource = asEnabledArr[0]
            } else {
                translatedSource = {
                    name: progNodeIn.name,
                    notes: [],

                }
            }
        } else {
            const newName = romanChordNameToReal(userLetter, userScale, progNodeIn.name)
            translatedSource =
                chordNameWithNotes(newName)
        }

        if (!translatedSource) {
            console.error(`Could not translate ${progNodeIn.name} in ${userLetter} ${userScale}`)
            return null
        }

        const next = progNodeIn.next.reduce((accum, romanName) => {
            if (isChordFn(romanName)) {

                const fnRes = fns[romanName](userLetter, userScale)
                const asEnabledArr = fnRes.map((cnwnFn) => {
                    return {
                        ...cnwnFn,
                        enabler: [progNodeIn.name],
                        octMap: cnwnFn.octMap
                    }
                })
                // todo: error here; enabler is always roman.
                // when we start enforcing, we will need to enable roman lookup at runtime when we hit these on 'next' usage
                return [...accum, ...asEnabledArr]
            }
            const realizedName = romanChordNameToReal(userLetter, userScale, romanName)
            const cnwn = chordNameWithNotes(realizedName)

            if (cnwn === null || cnwn.notes.length === 0) return accum

            const newNode = {
                ...cnwn,
                enabler: progNodeIn.prev ? progNodeIn.prev.map((romanName: string) => {
                    return romanChordNameToReal(userLetter, userScale, romanName)
                }) : null
            }
            return [...accum, newNode]

        }, [] as EnabledChordNameWithNotes[])

        const dotted = progNodeIn?.dotted?.map((romanName) => {
            const realizedName = romanChordNameToReal(userLetter, userScale, romanName)
            const cnwn = chordNameWithNotes(realizedName)
            if (cnwn === null || cnwn.notes.length === 0) return null
            return {
                ...cnwn,
                enabler: progNodeIn.prev ? progNodeIn.prev.map((romanName: string) => {
                    return romanChordNameToReal(userLetter, userScale, romanName)
                }) : null
            }
        }).filter(n => n !== null)

        return {
            roman: progNodeIn.name,
            scaleName: userScale,
            scaleTonic: userLetter,
            translatedSource,
            next,
            dotted: dotted ?? []
        }
    }
}
export type ProgressionOptionsEntry = [name: string, po: ProgressionOptions]
export type ProgressionOptions = {
    roman: string
    scaleTonic: string
    scaleName: string
    translatedSource: ChordNameWithNotes
    next: EnabledChordNameWithNotes[]
    dotted: EnabledChordNameWithNotes[]
    octMap?: (notes: string[], rootOct: number) => string[]
}

export const randomElement = <Elem = any>(array: Array<Elem>): Elem => array[Math.floor(Math.random() * array.length)];

export const combineEntriesByName = (progOptions: ProgressionOptions[]): ProgressionOptions | null => {

    if (progOptions.length === 0) return null
    if (progOptions.length === 1) return progOptions[0]
    return progOptions.reduce((accum, curr, idx) => {
        if (idx === 0) return accum
        return {
            ...accum,
            next: [...accum.next, ...curr.next],
            dotted: [...accum.dotted, ...curr.dotted]
        }
    }, progOptions[0] as ProgressionOptions)
}

export const minor: { [name: string]: ProgressionGraphNode[] } = {
    'Im': [{
        name: 'Im',
        next: ['Im', 'IVm', 'VII', 'III', 'VI', 'IIdim', 'V64', 'VIIdim', 'V']
    }],

    'IVm': [{
        name: 'IVm',
        next: ["VII"],
        dotted: ["VIIdim/III", "V7/III"]
    },
    // double-box top
    {
        name: "IVm",
        prev: ["VI", "VIIdim/VIm", "V7/VIm"],
        next: [
            "VIIdim/V", "V/V", // small upper fork
            "V64", "VIIdim", "V"
        ], // big confusing box
    }],
    'VII': [{
        name: 'VII',
        next: ["III"],
        dotted: ["I"],
    }],
    'III': [{
        name: "III",
        next: ["VIIdim/VIm", "V7/VIm", "VI",],
    }],
    'VI': [{
        name: "VI",
        next: ["IIdim", "IVm", /* N6 Aug6 */],
    }],
    // double-box bottom                      
    'IIdim': [{
        name: "IIdim",
        prev: ["VI"],
        next: [
            "VIIdim/V", "V/V", // small upper fork                                                         
            "V64", "VIIdim", "V"],// big confusing box                                                     
    }],
    // big confusing box v64
    'V64': [{
        name: "V64",
        dotted: ["I"],
        next: ["N6", "Aug6", "I", "Im"],
    }],
    // big confusing box viio (must play V before leaving ???)                                     
    'VIIdim': [{
        name: "VIIdim",
        prev: ["IVm", "IIdim"],
        next: ["V"],
    }],
    // big confusing box V                                     
    'V': [{
        name: "V",
        next: ["V64", "Aug6", "Im"],
        dotted: ["I"],
    }],
    // non-box with sixes N6   
    'N6': [{
        name: "N6",
        next: ["V"],
    }],
    // non-box with sixes Aug6
    'Aug6': [{
        name: "Aug6",
        next: ["V"],
    }],
    // upper boxesssssss ltr                      
    // 1    
    'VIIdim/IV': [{
        name: "VIIdim/IV",
        next: ["VIIdim/VII", "V7/VII"],
    }],
    'V7/IV': [{
        name: "V7/IV",
        next: ["VIIdim/VII", "V7/VII"],
    }],
    // 2
    'VIIdim/VII': [{
        name: "VIIdim/VII",
        next: ["VIIdim/III", "V7/III", /*downward arrow*/ "VII"],
    }],
    'V7/VII': [{
        name: "V7/VII",
        next: ["VIIdim/III", "V7/III", /*downward arrow*/ "VII"],
    }],
    // 3                 
    'VIIdim/III': [{
        name: "VIIdim/III",
        next: ["VIIdim/VIm", "V7/VIm", /*downward arrow*/ "III"],
    }],
    'V7/III': [{
        name: "V7/III",
        next: ["VIIdim/VIm", "V7/VIm", /*downward arrow*/ "III"],
    }],
    // 4                   
    'VIIdim/VIm': [{
        name: "VIIdim/VIm",
        next: ["IVm", "IIdim", /*downward arrow */ "VI"],
    }],
    'V7/VIm': [{
        name: "V7/VIm",
        next: ["IVm", "IIdim", /*downward arrow */ "VI"],
    }],
    // 5                   
    'VIIdim/V': [{
        name: "VIIdim/V",
        next: ["V64", "VIIdim"],
    }],
    'V/V': [{
        name: "V/V",
        next: ["V64", "VIIdim"],
    }]
}

export const oneIndexedArr = (len: number) => {
    if (len <= 0) return []
    const arr: number[] = []
    let n = 1
    while (n <= len) {
        arr.push(n)
        n += 1
    }
    return arr
}

export const zeroIndexedArr = (len: number) => {
    if (len <= 0) return []
    const oneIndexed = oneIndexedArr(len)
    return oneIndexed.map(elem => elem - 1)
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
    const notesArr = Chord.getChord(chordType, validTonic)?.notes
    const noteCount = notesArr.length
    if (typeof noteCount !== "number") return []
    const mappableNums = oneIndexedArr(noteCount)
    const rotatedIndexes = rotations(mappableNums)
    const degreesFn = Chord.degrees([validTonic, chordType]);
    const rots = rotatedIndexes.map((orderedIndexes) => {
        return orderedIndexes.map(degreesFn)
    })

    return [notesArr, ...rots]
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

export const fnChordNameWithNotes = (fnName: ChordFunction, tonic: string, scaleName: string) => {
    return fns[fnName](tonic, scaleName)[0]

}

export const chordNameWithNotes = (chordName: string, oct: number = 3): ChordNameWithNotes | null => {

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

