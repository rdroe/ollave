import { fakeCli } from 'peprn/browser'
import { Module } from 'peprn/util'
import { fns, ProgressionGraphNode, allScales, detectScales, makeProgNodeTranslator, minor, noteInversions, optionalRomans, romanChordNameToReal, scaleLetters, combineEntriesByName, ProgressionOptions } from 'src/lib/graphh'
import { randomInt } from 'src/lib/helpers'
import { Chord, Note, Scale, Mode, Collection, Progression, RomanNumeral } from 'tonal'
import { z } from 'zod'


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
        translateLetter: {
            fn: async (args) => {
                const [userLetter = "", userScale = "", noteLetter = null] = args.positionalNonCommands
                /*
                const translateFn = letterToRomanNumeralMap(userLetter, userScale)
                if (typeof noteLetter !== 'string') throw new Error(`translatable note is required; instead ${noteLetter}`)

                return translateFn(noteLetter)
*/
            }
        },

        fromRoman: {
            fn: async (args, moduleCalls) => {
                const [userLetter = "", userScale = "", romanName = null] = args.positionalNonCommands
                return romanChordNameToReal(userLetter, userScale, romanName)
            },
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
        roman: {
            fn: async (args) => {
                const [romanName = null] = args.positionalNonCommands
                return RomanNumeral.get(romanName)
            }
        },
        graph: {
            fn: async () => {
            },
            submodules: {
                ltrs: {
                    fn: async ({ positionalNonCommands }) => {
                        const [userLetter = "", userScale = ""] = positionalNonCommands
                        return scaleLetters(userLetter, userScale)
                    }
                },
                test: {
                    fn: async ({ positionalNonCommands }) => {

                        const [userLetter = "", userScale = ""] = positionalNonCommands

                        const names = Object.keys(minor)
                        const untranslatable = names.map((romanName) => {

                            if (fns[romanName as keyof typeof fns]) { return null }
                            const translated = romanChordNameToReal(userLetter, userScale, romanName)


                            if (!translated) {
                                return romanName
                            }

                            return null
                        }).filter((elem) => elem !== null && !optionalRomans.includes(elem))

                        if (untranslatable.length) {
                            throw new Error(`Not all roman names were translatable. Make sure this is a minor key. ${JSON.stringify(untranslatable)} ; scale: ${userLetter} ${userScale}`)
                        }

                        const scaledGraph =
                            Object.entries(minor).reduce((accum, [romanName, progNodes]) => {

                                const realizedName = fns[romanName as keyof typeof fns]
                                    ? romanName
                                    : romanChordNameToReal(userLetter, userScale, romanName)



                                if (accum.find(([x, _]) => x === realizedName)) {
                                    console.error(`prog node already translated; ${romanName} in ${userLetter} ${userScale} ${JSON.stringify({ romanName, realizedName, progNodes }, null, 2)}`)
                                }

                                const realizedOptions = progNodes.map(makeProgNodeTranslator(userLetter, userScale))


                                return [...accum, [realizedName, realizedOptions]]

                            }, [] as [romanName: string, progNodes: ProgressionGraphNode][])

                        const combinedScaleGraphEntries = scaledGraph.map(([name, pOpts]: [nm: string, pOpts: ProgressionOptions[]]) => {
                            return [name, combineEntriesByName(
                                pOpts)

                            ]
                        })



                        return {
                            formatted: Object.fromEntries(combinedScaleGraphEntries
                            )
                        }
                    }
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
                        const notesPermuted = noteInversions(chordName)
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
