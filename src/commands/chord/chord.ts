import fakeCli from 'peprn/fakeCli'
import { Module } from 'peprn/util'
import { fns, ProgressionGraphNode, allScales, detectScales, makeProgNodeTranslator, minor, noteInversions, optionalRomans, romanChordNameToReal, scaleLetters, combineEntriesByName, ProgressionOptions, ProgressionOptionsEntry, EnabledChordNameWithNotes, unromanizeSecondaryChord, getTriadByRomanNumeral, guessRoman, romanFromProgRoman } from '../../lib/graphh'
import { randomInt } from '../../lib/helpers'


import { Chord, Note, Scale, Mode, Collection, Progression, RomanNumeral } from 'tonal'
import { z } from 'zod'


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
            fn: async (args, moduleCalls) => {

                const [userLetter = "", userScale = "", romanName = null] = args.positionalNonCommands
                //                return getTriadByRomanNumeral(userLetter, userScale, romanName)
                return unromanizeSecondaryChord(userLetter, userScale, romanName)
            },

        },
        progressions: {
            fn: async (args) => {
                const [userLetter = "", userScale = "", noteLetter = null] = args.positionalNonCommands
                const allTriadsRaw = await fakeCli(`chord triads ${userLetter} ${userScale}`, 'cli')
                const allTriads = z.array(z.object({
                    scaleTonic: z.string(),
                    triads: z.array(z.string()),
                    scaleType: z.string()
                })).parse(allTriadsRaw.formatted)

                const formatted = allTriads.map(({ scaleTonic, triads, scaleType }) => {
                    return Progression.toRomanNumerals(scaleTonic, triads).map((romanNum, idx) => {

                        let roman: string | undefined = RomanNumeral.get(romanNum).roman
                        if (!roman) {
                            roman = guessRoman(romanNum, triads[idx])
                        }

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
        progression: {
            fn: async (a, b) => {

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

                        const allNexts = Object.entries(graph).reduce((accum, [nm, po]: ProgressionOptionsEntry) => {
                            if (po === null) {
                                console.log('null po found', { nm, po })
                                return accum
                            }
                            return [...accum, ...po.next]
                        }, [] as EnabledChordNameWithNotes[])

                        const prunedNexts1 = allNexts.filter((enabledChordWithNotes) => {
                            const fromGraph = graph[enabledChordWithNotes.name] ?? null
                            if (fromGraph) {
                                return fromGraph.next.filter(({ name }) => {
                                    return !!graph[name]
                                }).length > 0

                            }
                            return false
                        })
                        // next, get any with a next in the prunedNexts
                        const prunedEntries = Object.entries(graph).reduce((accum, [nm, po]: ProgressionOptionsEntry) => {
                            if (prunedNexts1.find(
                                ({ name }) => name === nm
                            )) {
                                return [...accum, [nm, po]]
                            }
                            return accum
                        }, [] as ProgressionOptionsEntry[])
                        /*
 
                        // next, get any with a next in the prunedNexts
                        const prunedEntries = Object.entries(graph).reduce((accum, [nm, po]: ProgressionOptionsEntry) => {
                            const foundNext = prunedNexts1.find(
                                ({ name }) => name === nm
                            )
 
                            if (foundNext && graph[foundNext.name]) {
                                const subNexts = graph[foundNext.name]?.next
                                if (subNexts) {
                                    const badSubnexts = subNexts.filter((ecn) => {
                                        return !graph[ecn.name] || !graph[ecn.name].next || graph[ecn.name].next.length === 0
                                    })
                                    if (badSubnexts.length > 0) {
                                        console.error('badSubnexts', { badSubnexts })
                                    } else {
                                        return [...accum, [nm, po]]
                                    }
                                }
                            }
 
                            return accum
                        }, [] as ProgressionOptionsEntry[])
*/

                        console.log('prunedEntries', { prunedEntries })

                        const allNexts2 = (prunedEntries as ProgressionOptionsEntry[]).reduce((accum, [nm, po]: ProgressionOptionsEntry) => {
                            if (po === null || !po.next) {
                                console.log('null po found (allNexts2', { nm, po })
                                return accum
                            }


                            return [...accum, ...po.next]
                        }, [] as EnabledChordNameWithNotes[])

                        const aErrors = allNexts2.filter((ec) => {

                            const po = prunedEntries.find(([nm, obj]: ProgressionOptionsEntry) => {
                                return nm === ec.name
                            }) as undefined | ProgressionOptionsEntry

                            if (!po) return true

                            if (!po[1].next) return true
                            if (po[1].next.find((someNext) => {
                                const subPruned = prunedEntries.find(([nm, obj]: ProgressionOptionsEntry) => {
                                    return nm === someNext.name
                                }) as undefined | ProgressionOptionsEntry
                                return !subPruned || subPruned[1].next.length < 1
                            })) {
                                return true
                            }
                            return false
                        }).map((ecn) => {
                            return ecn.name
                        })
                        //                            ..aErrors.push("Aug6")
                        if (aErrors.length) {
                            const aErrorsStr = JSON.stringify(aErrors, null, 2)
                            console.error(`Found  unusuable "next" array element(s): ${aErrorsStr}`)
                        }

                        const pruned = Object.fromEntries((
                            prunedEntries as ProgressionOptionsEntry[]
                        ).reduce((accum, e: ProgressionOptionsEntry) => {
                            if (aErrors.includes(e[0])) { return accum }
                            const filtered = e[1].next.filter(({ name }) => {
                                return !aErrors.includes(name)
                            })
                            if (filtered.length > 0) {
                                const newE = [e[0], {
                                    ...e[1],
                                    next: filtered
                                }]
                                return [...accum, newE]
                            }
                            return accum
                        }, [] as ProgressionOptionsEntry[])) as { [nm: string]: ProgressionOptions }

                        const chords: string[] = [Object.keys(pruned)[0]]
                        let error: undefined | string

                        while (chords.length < 100 && !error) {
                            const prev = chords[chords.length - 1]
                            if (!pruned[prev]) {
                                console.log('error;', chords, { prev })
                                error = chords.toString()
                                break
                            }
                            const nexts = pruned[prev].next
                            const nextIdx = randomInt(0, nexts.length - 1)
                            const nextChordName = nexts[nextIdx].name
                            chords.push(nextChordName)
                        }

                        return {

                            formatted: {
                                chords: chords.join(' '),
                                aaProgram: `\n\
phase aphrodite 100\n\
bars aphrodite fill ${chords.join(' ')}\n\
song start\n\
`
                                , aErrors, pruned
                            }
                        }

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

                unromanize: {
                    fn: async ({ $, positionalNonCommands }) => {
                        const [chordName] = $
                        const [tonic, root] = positionalNonCommands

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
