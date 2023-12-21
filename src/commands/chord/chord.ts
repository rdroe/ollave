import fakeCli from 'peprn/fakeCli'
import { Module, ParsedCli, awaitAll } from 'peprn/util'
import {

    fns, ProgressionGraphNode, allScales, detectScales, makeProgNodeTranslator, minor, noteInversions, optionalRomans, romanChordNameToReal, scaleLetters, combineEntriesByName, ProgressionOptions, romanFromProgRoman, isChordFn, unromanizeSecondaryChords, randomElement, chordNameWithNotes, fnChordNameWithNotes, ChordNameWithNotes,

} from '../../lib/graphh'

import { randomInt, strjson } from '../../lib/helpers'
import { Chord, Note, Scale, Mode, Progression, RomanNumeral } from 'tonal'
import { z } from 'zod'
import { getNotesByEntity, isNotesByBar, parseDelayMatrix, prepDelayMatrix, shiftDollarEntity } from '../notes/notes'
import { calcFractionalDelay, filterDelayTags, latestNote, parseNoteTags, scale } from 'src/lib/tags'
import { mapSongToMidiTicks } from 'src/mapSongToTicks'
import { mem } from '../../mem'
import { lookUpGraph } from 'src/mem-db'

const nextModule: Module = {
    fn: async () => { },
    submodules: {

        '$': {
            fn: async ({ $ }) => {

            },
            submodules: {
                '$': {

                    fn: async ({ $: dollar, positionalNonCommands }) => {

                        const notes1 = getNotesByEntity(dollar, positionalNonCommands)
                        const latestChordNote = latestNote(notes1)
                        if (!latestChordNote) return null
                        const [chordName] = parseNoteTags(latestChordNote.tags).find(([nm]) => nm === 'chord')[1]
                        const [userLetter = "", userScale = "", noteLetter = null] = positionalNonCommands
                        if (typeof chordName !== 'string') {
                            throw new Error(`could not get chord name; instead ${chordName}`)
                        }

                        let scaleName: [tonic: string, name: string] | undefined
                        if (userLetter && userScale) {
                            scaleName = [userLetter, userScale]
                        }
                        if (!scaleName) {
                            scaleName = scale(latestChordNote)
                        }
                        if (!scale) {
                            throw new Error(`could not obtain scale`)
                        }

                        let graph = lookUpGraph(...scaleName)

                        if (!graph) {
                            await fakeCli(`chord graph test ${scaleName[0]} ${scaleName[1]}`)
                            graph = lookUpGraph(...scaleName)
                        }
                        if (!graph) {
                            throw new Error(`could not obtain graph for ${scale}`)
                        }
                        if (!graph[chordName]) {
                            throw new Error(`could not obtain ${chordName} in graph for ${scale}`)
                        }
                        const next = graph[chordName]?.next
                        const roman = graph[chordName].roman

                        if (!next) {
                            throw new Error(`Got graph and chord; no next for ${chordName}; roman ${roman}`)
                        }

                        return next.map(({ name }) => name)
                    }
                }
            }

        }
    }
}


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

                                const sorted = Object.entries(moduleCalls).sort(([kA], [kB]) => {
                                    return kB.length - kA.length

                                })

                                const chordName = dollar.shift()
                                const entity = dollar.shift()
                                const entityName = dollar.shift()

                                console.log('entity data', { entity, entityName })

                                const notes1 = await fakeCli(`notes in ${entity} ${entityName}`)
                                let maxChordSize = -1

                                if (!isNotesByBar(notes1)) {
                                    throw new Error(`Incorrectly formatted or empty notes:${strjson(notes1)
                                        }`)
                                }
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

                                const prepped = prepDelayMatrix(patterns as ParsedCli['positionalNonCommands'])
                                const delaysPerChordSize = parseDelayMatrix(prepped)

                                const subdataKey = `${maxChordSize}x`

                                const noteLookup = delaysPerChordSize[subdataKey]

                                notes.forEach((nt) => {
                                    filterDelayTags(nt, true)

                                    const parsed = Object.fromEntries(parseNoteTags(nt.tags))
                                    const [chordIdx] = parsed['groupIndex']
                                    if (typeof chordIdx !== 'number') {
                                        const msg = strjson(nt)
                                        throw new Error(`Note lacked a chord index: ${msg}`)
                                    }
                                    const newTags = noteLookup[chordIdx]
                                    nt.tags.push(...newTags)
                                })

                                mem().latestMap = mapSongToMidiTicks()

                                return notes
                            }
                        }
                    }
                }
            }
        }
    }
}

export const chord: Module = {
    help: {
        description: "THis is the chord module! Utilities and arrangement attentive to chords."
    },
    fn: async () => {
        return null
    },
    submodules: {

        triads: {
            help: {
                description: "Dev facilities for playing with triads",
            },

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
                                chords: chordsWithNotes.map(({ name }) => `${name}, 3`).join(' '),
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
                'make': {
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
                            throw new Error(`Not all roman names were translatable.Make sure this is a minor key.${JSON.stringify(untranslatable)} ; scale: ${userLetter} ${userScale} `)
                        }

                        const scaledGraph =
                            Object.entries(minor).reduce((accum, [romanName, progNodes]) => {

                                const realizedName = fns[romanName as keyof typeof fns]
                                    ? romanName
                                    : romanChordNameToReal(userLetter, userScale, romanName)

                                if (accum.find(([x, _]) => x === realizedName)) {
                                    console.error(`prog node already translated; ${romanName} in ${userLetter} ${userScale} ${JSON.stringify({ romanName, realizedName, progNodes }, null, 2)} `)
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

                next: nextModule,
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
                            throw new Error(`Not all roman names were translatable.Make sure this is a minor key.${JSON.stringify(untranslatable)} ; scale: ${userLetter} ${userScale} `)
                        }

                        const scaledGraph =
                            Object.entries(minor).reduce((accum, [romanName, progNodes]) => {

                                const realizedName = fns[romanName as keyof typeof fns]
                                    ? romanName
                                    : romanChordNameToReal(userLetter, userScale, romanName)

                                if (accum.find(([x, _]) => x === realizedName)) {
                                    console.error(`prog node already translated; ${romanName} in ${userLetter} ${userScale} ${JSON.stringify({ romanName, realizedName, progNodes }, null, 2)} `)
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
                }
            }
        }
    }
} as Module
