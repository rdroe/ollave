import { fakeCli } from 'peprn/browser'
import { Module, awaitAll } from 'peprn/util'
import { allScales, detectScales } from 'src/lib/graphh'
import { Chord, Note, Scale, Mode, Collection, Progression } from 'tonal'
import { z } from 'zod'

const whereTriad = (scaleNames: string[], aliases: string[]) => {
    const tonicScaleArr: [tonic: string, scaleName: string][] = z.array(z.string()).transform((strs) => {
        return strs.map((str) => {
            const split = str.split(' ')
            const tonic = split.shift()
            return [tonic, split.join(' ')] as [tonic: string, scaleName: string]

        })
    }).parse(scaleNames)

    const triadsWhereInScale = tonicScaleArr.map(([tonic, scaleName]) => {
        const triads = Mode.triads(scaleName, tonic)
        return { tonic, scaleName, triads }
    }).filter(({ triads }) => {
        const includedAlias = aliases.find((alias) => {
            return triads.includes(alias)
        })
        return includedAlias !== undefined
    })
    return triadsWhereInScale
}

export const chord: Module = {
    fn: async () => {
        return null
    },

    submodules: {
        allTriads: {
            fn: async () => {
                const formatted = allScales.map((sc) => ({
                    scaleTonic: sc.tonic,
                    scaleType: sc.type,
                    triads: Mode.triads(sc.type, sc.tonic)
                }))
                return { formatted }
            }
        },
        allProgressions: {
            fn: async () => {

                const allTriadsRaw = await fakeCli('chord allTriads', 'cli')
                const allTriads = z.array(z.object({
                    scaleTonic: z.string(),
                    triads: z.array(z.string()),
                    scaleType: z.string()
                })).parse(allTriadsRaw.formatted)

                const formatted = allTriads.map(({ scaleTonic, triads, scaleType }) => {
                    return Progression.toRomanNumerals(scaleTonic, triads).map((romanNum, idx) => ({
                        scaleTonic,
                        scaleType,
                        [romanNum]: triads[idx]
                    }))
                })

                return { formatted }
            }
        },
        graph: {
            fn: async (args, moduleCalls) => { },
            submodules: {
                test: {
                    fn: async (args) => { }
                },
                starters: {
                    fn: async ({ positionalNonCommands }) => {
                        const manyChordNames = new Set<string>()
                        const [userLetter = "", userScale = ""] = positionalNonCommands
                    }
                },
            }
        },

        '$': {
            fn: async (args) => {
                return args['$']
            },
            submodules: {

                detectScales: {
                    fn: async (args) => {
                        const [chordName] = args['$']
                        const notes = Chord.get(chordName).notes ?? []
                        return detectScales(notes)
                    }
                },
                next: {
                    fn: async (args, moduleCalls) => {
                    },
                    submodules: {
                        '$': {
                            fn: async () => { },
                            submodules: {
                                '$': {
                                    // e.g. chord C next G major
                                    fn: async ({ "$": dollar, positionalNonCommands, ...rest }, moduleCalls) => {

                                    }
                                }
                            }
                        },
                    },
                },
                aliases: {
                    fn: async (args, moduleCalls) => {
                        const [chordName] = await moduleCalls['chord $']
                        const notes = Chord.get(chordName)?.notes || []
                        const notesPermuted = Collection.permutations(notes)
                        const aliases = [notes, ...notesPermuted].map((notes1) => Chord.detect(notes1)).flat()
                        return { aliases: aliases.concat([chordName]) }
                    },

                },
                where: {
                    fn: async (args, moduleCalls) => { },
                    submodules: {
                        triad: {
                            fn: async (args, moduleCalls) => {
                            }
                        },
                        in: {
                            fn: async (args, moduleCalls) => { },
                            submodules: {
                                scale: {
                                    fn: async (args, moduleCalls) => {
                                    },
                                }
                            }
                        },
                        // often, returns slash chords

                    },
                },
                scale: {
                    fn: async () => null,
                    submodules: {
                        detect: {
                            fn: async (args, moduleCalls) => {
                                const chordName = await moduleCalls['chord $']
                                const notes = Chord.get(chordName)?.notes || []
                                const scaleNames = Scale.detect(notes)
                                return { scaleNames }

                            }
                        }
                    }
                },


                getChord: {
                    fn: async ({ $, positionalNonCommands }) => {
                        const [tonic, root] = positionalNonCommands
                        const [chordName] = $
                        if (typeof root === "string" && typeof tonic !== "string") return "a value for tonic is required if a value for root is passed"

                        if (typeof chordName !== 'string') return "a chord name is required"
                        const gottenChord = Chord.getChord(chordName, tonic || "", root || "")
                        return {
                            input: [chordName, tonic || "", root || ""],
                            getChord: gottenChord,
                            expandedNoteData: gottenChord.notes.length ? gottenChord.notes.map((nt) => {
                                return Note.get(nt)
                            }) : []
                        }
                    },

                },
                get: {
                    fn: async (args, moduleCalls) => {
                        const [chordName] = await moduleCalls['chord $']
                        if (!chordName) return null
                        const gotten = Chord.get(chordName)
                        if (chordName.includes('/')) {
                            return 'SLASH_CHORD'
                        }

                        return gotten
                    },
                    submodules: {
                        notes: {
                            fn: async (args, moduleCalls) => {
                                const [chordName] = await moduleCalls['chord $']
                                const got = await moduleCalls['chord $ get']
                                if (got === 'SLASH_CHORD') {
                                    const [main, bass] = chordName.split('/')
                                    if (!main || !bass) return null
                                    const mainNotes = Chord.get(main)?.notes || []
                                    const permutations = Collection.permutations(mainNotes)
                                    const bassNames = Chord.get(bass)?.notes || []
                                    const bassNote = bassNames[0]
                                    const bassLetter = Note.get(bassNote).letter
                                    const permutedNotes = permutations.find((notes) => {
                                        return notes[0].startsWith(bassLetter)
                                    })
                                    if (!permutedNotes) {
                                        throw new Error(`Could not ad-hoc provide the slash chord ${chordName}`)
                                    }
                                    return permutedNotes
                                }
                                return got?.notes || []
                            }
                        }
                    },
                }
            }
        }
    }
} as Module
