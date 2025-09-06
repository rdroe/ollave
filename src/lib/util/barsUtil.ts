import { isString, peprnIsNum, isCsvArg, parseCsvArg } from './common'
import { randId } from './common'
import { lookUpGraph } from './graphUtil'
import { isNoteNameWithoutOctave, isNoteNameWithOctave } from './noteValidationUtil'
import { Chord, ChordType, Note } from 'tonal'
import { chordNameWithNotes, DynamicChordNames, noteNames } from '../graphh'
import { makeNoteByBar, NoteByBar } from '../schemas'
import { parseNoteTags } from './noteParsingUtil'
const allChordTypes = ChordType.all()
export const isRestArg = (arg: any) => {
    return isString(arg)
        && (
            arg === 'rest'
            || arg === '[]'
            || arg === '~'
            || arg === '_'
        )
}

// Re-export functions from their new locations
export { isNoteNameWithoutOctave, isNoteNameWithOctave } from "./noteValidationUtil"
export const isStringArray = (arr: any[]): arr is string[] => {
    return arr.every((arg) => isString(arg))
}
const isNoteNameArray = (arr: any[]): arr is string[] => {
    return arr.every((arg) => isNoteNameWithOctave(arg) || isRestArg(arg))
}

// Re-export functions from their new locations
export { isCsvArg, parseCsvArg } from "./common"

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

const isChordName = (nm: string, scaleTonic?: string, scaleName?: string): boolean => {
    const tokenized = Chord.tokenize(nm)

    if (tokenized.length === 2) {
        if (!isNoteNameWithoutOctave(tokenized[0])) {
            console.error('not a note name', tokenized[0])
            return false
        }
        if (tokenized[1].toLowerCase() === '') {
            return true
        }

        const isNormalChord = !!allChordTypes.find((type) => {
            return type.name.toLowerCase() === tokenized[1].toLowerCase() || type.aliases.some((alias) => {
                return alias.toLowerCase() === tokenized[1].toLowerCase()
            })
        })
        if (isNormalChord) return true
        const isDyna = Object.keys(DynamicChordNames).map((name) => name.toLowerCase()).includes(nm.toLowerCase())

        return isDyna
    }

    return false
}

const isChordNameOld = (nm: any, scaleTonic?: string, scaleName?: string) => {
    const initial = isString(nm) && !isNoteNameWithOctave(nm) && !!Chord.get(nm)?.name
    if (initial) return initial
    if (!scaleTonic || !scaleName) {
        return initial
    }

    const graph = lookUpGraph(scaleTonic, scaleName)
    if (!graph) return initial
    return graph[nm] || initial

}

const raiseOctaveOfChordNotes = (notes: string[], rootOctave: number, chordLetter?: string) => {
    const root = chordLetter ? notes.find((n) => {
        let casedNote = n
        if (n[0].toLowerCase() == n[0]) {

            casedNote = `${n[0].toUpperCase()}${n.slice(1)}`

        }

        return casedNote.startsWith(chordLetter)
    }) : notes[0]
    const currOctave = Note.get(root).oct

    const diff = currOctave - rootOctave
    if (diff === 0) return notes
    return notes.map((noteName: string) => {
        const [name, oct] = [Note.get(noteName).pc, Note.get(noteName).oct]
        return `${name}${oct - diff}`
    })
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
                tags.push(`chord=${graphChordData.translatedSource.name}`)
                if (graphChordData.translatedSource.octMap && hasOctaveFilter(notes).length === 0) {
                    return [graphChordData.translatedSource.octMap(notes, csv[1]), tags]
                }
                const raised = raiseOctaveOfChordNotes(notes, csv[1], Chord.get(graphChordData.translatedSource.name).tonic)
                return [raised, tags]
            }
        }
    }


    tags.push(`chord=${cnwn.name}`)
    if (!notes) {
        notes = cnwn.notes
    }

    const raised = raiseOctaveOfChordNotes(notes, csv[1], Chord.get(cnwn.name).tonic)

    return [raised, tags]

}

export const isChordCsvArg = (str: string, userTonic?: string, userScale?: string) => {

    if (!isCsvArg(str)) return false
    const csv = parseCsvArg(str)

    if (typeof csv[0] !== 'string') return false
    if (!isChordName(csv[0], userTonic, userScale)) return false
    if (typeof csv[1] !== 'number') return false

    return true
}
const lastLayerAdded: string[] = []
export const makeFulfilledBarNote = (barTag: string, extraTags: string[]) => {
    return (noteName: string): NoteByBar => {

        const noteProperties = Note.get(noteName)
        const { oct, letter, acc } = noteProperties 
        const parsed = parseNoteTags(extraTags)
        const layer  = parsed.find(([tag]) => {
            return tag === 'layer'
        })?.[1]
        
        const layerId = layer ? layer[0] : null
        
        if (typeof layerId === 'string' && layerId !== lastLayerAdded[0]) {
            lastLayerAdded.unshift(layerId)
        }

        const allTags = [...extraTags, `lastBarTag=${barTag}`, `noteLetter=${letter}`, `noteAcc=${acc}`, `noteOct=${oct}`, `noteId=${randId('', 3)}`]
        const note1: NoteByBar = makeNoteByBar(
            `${letter}${acc}${oct}`,
            allTags
        )
         note1.tagsObj.creatdInUtils = [true]
        return note1
    }
}

export const getLastChordLayerName = () => {
    return lastLayerAdded[0]
}