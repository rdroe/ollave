import fakeCli from 'peprn/fakeCli'
import { Module } from 'peprn/util'
import {
    fns, ProgressionGraphNode, allScales, detectScales, makeProgNodeTranslator, minor, noteInversions, optionalRomans, romanChordNameToReal, scaleLetters, combineEntriesByName, ProgressionOptions, romanFromProgRoman, isChordFn, unromanizeSecondaryChords, randomElement, chordNameWithNotes, fnChordNameWithNotes, ChordNameWithNotes,
} from '../../lib/graphh'

import { randomInt } from '../../lib/helpers'
import { Chord, Note, Scale, Mode, Collection, Progression, RomanNumeral } from 'tonal'
import { z } from 'zod'
import { getDollarEntity, getNotesByEntity, parseDelayMatrix } from '../notes/notes'
import { filterDelayTags, parseNoteTags } from 'src/lib/tags'

const inModule: Module = {
    fn: async () => { },
    submodules: {
        '$': {
            fn: async ({ $ }) => { },
            submodules: {
                '$': {
                    fn: async () => { },
                    submodules: {
                        arrange: {
                            fn: async ({ $: dollar, positionalNonCommands: patterns }, moduleCalls) => {
                                const chordName = dollar.shift()
                                const entity = dollar.shift()
                                const phaseOrBarOrTag = getDollarEntity([entity])
                                const entityName = dollar.shift()
                                const notes1 = getNotesByEntity(phaseOrBarOrTag, [entityName])

                                let maxChordSize = -1
                                console.log('notes1', { notes1 })
                                const notes = notes1.filter((n) => {
                                    const parsedTags = parseNoteTags(n.tags)
                                    const isMatch = parsedTags.find(([nm, dat]) => {
                                        return nm === 'chord' && dat.includes(chordName)


                                    })

                                    if (isMatch) {
                                        const chordSize = parsedTags.find(([nm, dat]) => nm === 'chordSize')
                                        if (chordSize
                                            && typeof chordSize[1][0] === 'number'
                                            && chordSize[1][0] > maxChordSize
                                        ) {
                                            maxChordSize = chordSize[1][0]
                                        }
                                        return true
                                    }
                                    return false
                                })



                                const delayTagsPerNoteSlot = parseDelayMatrix(patterns)
                                notes.forEach((nt) => {
                                    filterDelayTags(nt)
                                    nt
                                })



                            }
                        }
                    }
                }
            }
        }
    }
}

export const chord: Module = {
    fn: async () => {
        return null
    },
    submodules: {

        triads: {
            fn: async (args) => {
                const [userLetter = "", userScale = "", noteLetter = null] = args.positionalNonCommands

                const formatted = allScales.map((sc) => ({
                    scaleTonic: sc.tonic,
                    scaleType: sc.type,
                    triads: Mode.triads(sc.type, sc.tonic)
                }))

                if (!userLetter && !userScale) {
                    return { formatted }
                }

                return {
                    formatted: formatted.filter(
                        ({ scaleTonic, scaleType }) => scaleTonic === userLetter && scaleType === userScale)
                }
            }
        },
        fromRoman: {
            fn: async (args) => {
                const [userLetter = "", userScale = "", romanName = null] = args.positionalNonCommands
                return unromanizeSecondaryChords(userLetter, userScale, romanName)
            },
        },
        progressions: {
            fn: async (args) => {
                const [userLetter = "", userScale = ""] = args.positionalNonCommands
                const allTriadsRaw = await fakeCli(`chord triads ${userLetter} ${userScale}`, 'cli')

                const allTriads = z.array(z.object({
                    scaleTonic: z.string(),
                    triads: z.array(z.string()),
                    scaleType: z.string()
                })).parse(allTriadsRaw.formatted)

                const formatted = allTriads.map(({ scaleTonic, triads, scaleType }) => {
                    return Progression.toRomanNumerals(scaleTonic, triads).map((romanNum, idx) => {
                        const roman = romanFromProgRoman(romanNum)
                        return {
                            scaleTonic,
                            scaleType,
                            [romanNum]: triads[idx],
                            roman,
                            progressionName: romanNum,
                            chordName: triads[idx]

                        }
                    })
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

                test2: {
                    fn: async ({ positionalNonCommands }) => {
                        const [userLetter = "", userScale = ""] = positionalNonCommands
                        const graph: {
                            [chordName: string]: ProgressionOptions
                        } = (await fakeCli(`chord graph test ${userLetter} ${userScale}`)).formatted

                        const pruned = graph
                        const chords: string[] = [Object.keys(pruned)[0]]
                        let error: undefined | string

                        while (chords.length < 100 && !error) {
                            const prev = chords[chords.length - 1]
                            if (!pruned[prev]) {

                                error = chords.toString()
                                break
                            }
                            const nexts = pruned[prev].next
                            const nextIdx = randomInt(0, nexts.length - 1)
                            const nextChordName = nexts[nextIdx].name
                            chords.push(nextChordName)
                        }

                        const chordsWithNotes = chords.map((someChord: string) => {
                            const oct = randomElement([3])
                            let chord: ChordNameWithNotes | undefined
                            if (isChordFn(someChord)) {
                                const tmp = fnChordNameWithNotes(someChord, userLetter, userScale)
                                chord = {
                                    ...tmp,
                                    notes: tmp.notes.map((n) => { return `${n}${oct}`.toLowerCase() })

                                }
                            } else {
                                chord = chordNameWithNotes(someChord, oct)
                            }

                            return chord
                        })
                        const noteStr = chordsWithNotes.map(
                            (
                                ({ notes }) => notes.map(Note.simplify).join(',').toLowerCase()
                            )
                        ).join(' ')
                        return {

                            formatted: {
                                notes: noteStr,
                                chords: chordsWithNotes.map(({ name }) => `${name},3`).join(' '),
                                aaNoteProgram: `
phase aphrodite 100
bars aphrodite fill ${noteStr}
song start
`,
                                aaChordProgram: `
phase aphrodite ${chordsWithNotes.length}
phase aphrodite scale ${userLetter} ${userScale}
bars aphrodite fill ${chordsWithNotes.map(({ name }) => name + ',3').join(' ')}
song start
`
                                , pruned
                            }
                        }

                    }
                },
                test: {
                    fn: async ({ positionalNonCommands }) => {

                        const [userLetter = "", userScale = ""] = positionalNonCommands

                        const names = Object.keys(minor)
                        const untranslatable = names.map((romanName) => {

                            if (isChordFn(romanName)) { return null }
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
                        }) as [name: string, pOpt: ProgressionOptions][]

                        const realizedGraph = Object.fromEntries(combinedScaleGraphEntries)
                        return {
                            formatted: realizedGraph

                        }
                    }
                },
            }
        },

        '$': {
            fn: async (args) => {
                return args['$']
            },
            submodules: {
                in: inModule,
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

                unromanize: {
                    fn: async ({ $, positionalNonCommands }) => {
                        const [chordName] = $
                        const [tonic, scale] = positionalNonCommands
                        return romanChordNameToReal(tonic, scale, chordName)
                        //                      if (typeof root === "string" && typeof tonic !== "string") return "a value for tonic is required if a value for root is passed"

                        //                        return unromanizeSecondaryChord(tonic, chordName)

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
