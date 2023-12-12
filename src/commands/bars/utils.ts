import { isString, peprnIsNum, randId } from 'src/lib/helpers'
import { lookUpGraph } from 'src/mem-db'
import { Chord, Note } from 'tonal'
import { chordNameWithNotes } from 'src/lib/graphh'
import { NoteByBar } from 'src/mem'

export const isRestArg = (arg: any) => {
    return isString(arg)
        && (
            arg === 'rest'
            || arg === '[]'
            || arg === '~'
            || arg === '_'
        )
}

export const isNoteName = (nm: any) => {
    return isString(nm) && nm.toLocaleLowerCase() === nm && peprnIsNum(nm[nm.length - 1]) && !!Note.get(nm)?.pc
}

const isNoteNameArray = (arr: any[]): arr is string[] => {
    return arr.every((arg) => isNoteName(arg) || isRestArg(arg))
}

export const isCsvArg = (str: string): str is string => {
    return str.includes(',')
}

export const parseCsvArg = (str: string): (string | number | boolean | null)[] => {
    if (!isCsvArg(str)) return [str]

    return str.split(',').map((splitOff) => {
        if (splitOff === 'null') return null
        if (peprnIsNum(splitOff)) return parseFloat(splitOff)
        if (splitOff === 'true') return true
        if (splitOff === 'false') return false
        return splitOff
    })
}

const hasOctaveFilter = (noteStrs: string[]) => {
    return noteStrs.map((str) => {
        return Note.get(str).oct ?? null
    }).filter((numOrNull) => {
        return numOrNull !== null
    })
}

export const isNoteCsvArg = (str: string): str is string => {

    if (!isCsvArg(str)) return false

    const csv = parseCsvArg(str)

    if (!isNoteNameArray(csv)) return false
    return true
}

const isChordName = (nm: any, scaleTonic?: string, scaleName?: string) => {
    const initial = isString(nm) && !isNoteName(nm) && !!Chord.get(nm)?.name
    if (initial) return initial
    if (!scaleTonic || !scaleName) {
        return initial
    }

    const graph = lookUpGraph(scaleTonic, scaleName)
    if (!graph) return initial
    return graph[nm] || initial

}



export const parseChordCsvArg = (str: string, userScaleAndTonic?: string): [notes: string[], tags: string[]] => {
    if (!isCsvArg(str)) throw new Error(`${str} is not a chord csv arg`)
    const csv = parseCsvArg(str)
    if (typeof csv[0] !== 'string' || csv[0] === "") throw new Error(`${csv} is not a non-empty string`)

    if (typeof csv[1] !== 'number') throw new Error(`${str} is not a chord csv arg; second part is not an octave (number)`)
    // const 
    //   if (!notes) throw new Error(`${str} is not a chord csv arg; could not get notes`)

    const [userTonic, userScale] = userScaleAndTonic ? userScaleAndTonic.split(' ') : []
    const graph = (userTonic && userScale) ? lookUpGraph(userTonic, userScale) : undefined
    const cnwn = chordNameWithNotes(csv[0], csv[1])
    let notes: string[] | undefined
    const tags: string[] = []

    if (graph) {
        if (graph[csv[0]]) {
            if (graph[csv[0]].translatedSource.notes) {
                const graphChordData = graph[csv[0]]
                notes = graphChordData.translatedSource.notes
                tags.push(`roman=${graphChordData.roman}`)

                if (graphChordData.translatedSource.octMap && hasOctaveFilter(notes).length === 0) {
                    return [graphChordData.translatedSource.octMap(notes, csv[1]), tags]
                }
                return [notes, tags]
            }
        }
    }

    if (!notes) {
        notes = cnwn.notes
        return [notes, tags]
    }
    return [[], []]

}

export const isChordCsvArg = (str: string, userTonic?: string, userScale?: string) => {

    if (!isCsvArg(str)) return false

    const csv = parseCsvArg(str)

    if (!isChordName(csv[0], userTonic, userScale)) return false

    if (typeof csv[1] !== 'number') return false

    return true
}

export const makeFulfilledBarNote = (barTag: string, extraTags: string[]) => {
    return (noteName: string): NoteByBar => {
        const noteProperties = Note.get(noteName)
        const { oct, letter, acc } = noteProperties

        const note1: NoteByBar =
        {
            note: `${letter}${acc}${oct}`,
            tags: [...extraTags, `lastBarTag=${barTag}`, `noteLetter=${letter}`, `noteAcc=${acc}`, `noteOct=${oct}`, `noteId=${randId('', 3)}`]
        }
        return note1
    }
}
