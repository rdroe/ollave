import { Module } from 'peprn/util'
import { isString, peprnIsNum, randId } from 'src/lib/helpers'
import { SubcommandPatterns, runSubcommandsOrNull } from 'src/lib/subcommands'
import { getAllPhaseBars } from 'src/mem-db'
import { mem } from '../../mem'
import { Chord, Note } from 'tonal'
import { z } from 'zod'

const { notesByBar } = mem()
const isRestArg = (arg: any): arg is string => {
    return isString(arg)
        && (
            arg === 'rest'
            || arg === '[]'
            || arg === '~'
            || arg === '_'
        )
}
const isNoteName = (nm: any): nm is string => {
    return isString(nm) && nm.toLocaleLowerCase() === nm && peprnIsNum(nm[nm.length - 1]) && !!Note.get(nm)?.pc
}

const isNoteNameArray = (arr: any[]): arr is string[] => {
    return arr.every((arg) => isNoteName(arg) || isRestArg(arg))
}

const isNoteArray = (arr: any[]): arr is string[] => {
    return arr.every((arg) => isNoteCsvArg || isRestArg(arg))
}
const isChordArray = (arr: any[]): arr is string[] => {
    return arr.every((arg) => isChordCsvArg(arg) || isRestArg(arg))
}

const parseNoteName = (nm: string): [name: string, octave: number] => {
    if (!isNoteName(nm)) throw new Error(`"${nm}" is not a valid note name`)
    const name = nm.slice(0, nm.length - 1)
    const octave = parseInt(nm[nm.length - 1])
    return [name, octave]
}

const isCsvArg = (str: string): str is string => {
    return str.includes(',')
}

const parseCsvArg = (str: string): string[] => {
    if (!isCsvArg(str)) return [str]
    return str.split(',')
}

const parseChordCsvArg = (str: string): string[] => {
    if (!isCsvArg(str)) throw new Error(`${str} is not a chord csv arg`)
    const csv = parseCsvArg(str)
    if (!isChordName(csv[0])) throw new Error(`${str} is not a chord csv arg`)
    if (!peprnIsNum(csv[1])) throw new Error(`${str} is not a chord csv arg; second part is not an octave (number)`)
    const notes = Chord.get(csv[0])?.notes
    if (!notes) throw new Error(`${str} is not a chord csv arg; could not get notes`)
    return notes.map((note) => {
        return `${note}${csv[1]}`
    })
}

const isChordCsvArg = (str: string): str is string => {

    if (!isCsvArg(str)) return false

    const csv = parseCsvArg(str)

    if (!isChordName(csv[0])) return false

    if (!peprnIsNum(csv[1])) return false

    return true
}

const isNoteCsvArg = (str: string): str is string => {

    if (!isCsvArg(str)) return false

    const csv = parseCsvArg(str)

    if (!isNoteNameArray(csv)) return false
    return true
}

const parseNoteCsvArg = (str: string): ReturnType<typeof Note["get"]>[] => {
    if (!isNoteCsvArg(str)) throw new Error(`${str} is not a note csv arg`)
    const csv = parseCsvArg(str)
    return csv.map((note) => {
        return Note.get(note)
    })

}
const isChordName = (nm: any) => {
    return isString(nm) && !isNoteName(nm) && !!Chord.get(nm)?.name
}

const subcommands: SubcommandPatterns = {
    fill: {
        match: (args) => {
            if (args.positionalNonCommands.length < 2) return false
            if (typeof args.positionalNonCommands[1] === "string" && ['fill', 'f'].includes(args.positionalNonCommands[1])) return true

        },
        do: async ({ positionalNonCommands }) => {
            const [phaseName, _, ...rawObjects] = positionalNonCommands
            if (isString(phaseName)) {

                const bars = getAllPhaseBars(phaseName)

                if (bars.length === 0) throw new Error(`Phase ${phaseName} has no bars`)

                let noteGroups: (ReturnType<typeof Note['get']>)[][] = []
                if (isChordArray(rawObjects)) {
                    rawObjects.forEach((chordCsvArg) => {
                        if (isRestArg(chordCsvArg)) {
                            noteGroups.push([])
                            return
                        }
                        const [chordName, octave] = parseCsvArg(chordCsvArg)
                        const notes = parseChordCsvArg(chordCsvArg)
                        noteGroups.push(notes.map((note) => Note.get(note)))
                    })
                } else if (isNoteNameArray(rawObjects)) {

                    rawObjects.forEach((noteName) => {
                        if (isRestArg(noteName)) {
                            noteGroups.push([])
                            return
                        }
                        if (isRestArg(noteName)) return
                        const noteData = Note.get(noteName)

                        noteGroups.push([noteData])
                    })
                } else if (isNoteArray(rawObjects)) {
                    rawObjects.forEach((noteCsvArg) => {
                        if (isRestArg(noteCsvArg)) {
                            noteGroups.push([])
                            return
                        }
                        const noteData = parseNoteCsvArg(noteCsvArg)
                        noteGroups.push(noteData)
                    })
                }

                let noteGroupToUse = 0
                const newGroupName = randId("", 3)
                bars.forEach((barTag) => {
                    const barNotes = noteGroups[noteGroupToUse]
                    noteGroupToUse = (noteGroupToUse + 1) % noteGroups.length
                    notesByBar[barTag].push(
                        ...barNotes.map((noteProperties) => {
                            const { name, oct, letter, acc } = noteProperties
                            return {
                                barTag,
                                note: `${letter}${acc}${oct}`,
                                tags: [`layer:${newGroupName}`]
                            }
                        }))
                })
            }
        }
    },
}

export default {
    fn: async (args) => {
        const result = await runSubcommandsOrNull(subcommands, args)

        if (result !== null) return ["RAN SUBCOMMAND", result]
        return z.string().parse(args.positionalNonCommands[0])

    },
    submodules: {
        init: {
            fn: async (args, moduleCalls) => {
                const parent = await moduleCalls['bars']
                if (parent === "RAN SUBCOMMAND") return null
                return "init " + parent
            }
        },
    }
} as Module
