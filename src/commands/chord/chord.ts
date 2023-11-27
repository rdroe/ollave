import { fakeCli } from 'peprn/browser'
import { Module, awaitAll } from 'peprn/util'
import {
    minor, romanizedOptions, ChordNameWithNotes, progressionNodeToTonalOptions, rotations, chordNameWithNotes, getProgressionNodes, detectScales, noteNames
} from 'src/lib/graphh'
import { Chord, Note, Scale, Mode, Collection, Progression } from 'tonal'
import { z } from 'zod'

// Mode.triads("major", "C");
// => ["C", "Dm", "Em", "F", "G", "Am", "Bdim"];



const modesWeCareAbout = ['major', 'minor']
const triadLookup = modesWeCareAbout.map((mode) => {
    return noteNames.map((noteName) => {
        const triads = Mode.triads(mode, noteName)
        return { scaleName: mode, tonic: noteName, triads }
    })
}).flat()

const triadsWithRomanized = triadLookup.map(({ tonic, triads, scaleName }) => {
    return { tonic, scaleName, triads, romanizedTriads: Progression.toRomanNumerals(tonic, triads) }
})


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

const vectorize = (triadsWhereInScale: { triads: string[], tonic: string, scaleName: string }[], aliases: string[]) => {
    const withRomanizedTriads = triadsWhereInScale.map(({ triads, ...rest }) => {

        const romanizedTriads = Progression.toRomanNumerals(rest.tonic, triads)
        let myIndex: null | number = null
        for (let i = 0; i < triads.length; i++) {
            if (aliases.includes(triads[i])) {
                myIndex = i
                break
            }
        }
        return { ...rest, triads, romanizedTriads, myIndex }
    })
    return withRomanizedTriads
}




export const chord: Module = {
    fn: async () => {
        return null
    },

    submodules: {
        graph: {
            fn: async (args, moduleCalls) => { },
            submodules: {
                test: {
                    fn: async (args) => {
                        const [name1, name2] = args.positionalNonCommands
                        if (!name1 || name2 === undefined) return null

                        return progressionNodeToTonalOptions(
                            minor[0], "C", "minor", "Cm", 4
                        )

                    }
                },
                starters: {
                    fn: async ({ positionalNonCommands }) => {
                        const manyChordNames = new Set<string>()
                        const [userLetter = "", userScale = ""] = positionalNonCommands
                        triadsWithRomanized.forEach(({
                            triads
                        }) => {
                            triads.forEach(tri => {
                                manyChordNames.add(tri)
                            })
                        })
                        const chordNamesWithNotes = [...manyChordNames].map((chordName) => {
                            return chordNameWithNotes(chordName)

                        }).reduce((accum, curr) => {
                            const { notes } = curr
                            const scales = detectScales(notes, userLetter, userScale).map(scale => scale.name)
                            if (scales.length > 0) {
                                return [
                                    ...accum,
                                    ...scales.map((minorScaleName) => ({
                                        ...curr,
                                        scale: minorScaleName
                                    }))
                                ]
                            }
                            return accum
                        }, [] as (ChordNameWithNotes & { scale: string })[])

                        const opts = chordNamesWithNotes.map((cnwn) => {
                            const [scaleTonic, scaleName] = cnwn.scale.split(' ')

                            const progNodes = getProgressionNodes(cnwn, scaleTonic, scaleName)
                            console.log('around opts', {
                                cnwn, progNodes
                            })

                            return {
                                options: progNodes.map((pn) => progressionNodeToTonalOptions(pn, scaleTonic, scaleName, cnwn.name)),
                                scaleName,
                                scaleTonic
                            }
                        }).flat()
                        console.log('opts', {
                            opts,
                        })
                        return chordNamesWithNotes
                    },
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
                        const stopHere = moduleCalls['chord $ next $'] === undefined
                        const [chordName] = await moduleCalls['chord $']
                        const aliases = (await fakeCli(`chord ${chordName} aliases`, 'cli')).aliases
                        const whereTriad = (await fakeCli(`chord ${chordName} where triad`, 'cli')).triadsWhereInScale
                        const withRomanizedTriads = vectorize(whereTriad, aliases)

                        if (stopHere) {
                            return { "stopped at next": withRomanizedTriads }
                        }
                        return withRomanizedTriads
                    },
                    submodules: {
                        '$': {
                            fn: async () => { },
                            submodules: {
                                '$': {
                                    // e.g. chord C next G major
                                    fn: async ({ "$": dollar, positionalNonCommands, ...rest }, moduleCalls) => {
                                        const [chordName, tonic, scaleName] = dollar
                                        const vectorized: ReturnType<typeof vectorize> = await moduleCalls['chord $ next']
                                        if (['minor'].includes(scaleName) === false) {
                                            console.error(JSON.stringify({
                                                ...rest,
                                                $: dollar,
                                                positionalNonCommands

                                            }, null, 2))
                                            throw new Error(`Only the minor prog scale is set up yet.`)
                                        }


                                        const options =
                                            vectorized.filter((args) => {
                                                return args.scaleName === "minor"
                                            }).map((vector) => {

                                                const { romanizedTriads, triads, myIndex, scaleName, tonic: scaleTonic } = vector
                                                const me = triads[myIndex]
                                                const opts = romanizedOptions(me, scaleTonic, scaleName, "")
                                                return opts
                                            })


                                        return {
                                            formatted: options.join(','),
                                            next: options.flat()
                                        }

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
                                const [chordName] = await moduleCalls['chord $']
                                const aliasesProm = fakeCli(`chord ${chordName} aliases`, 'cli').then((({ aliases }) => aliases))
                                const whereInScaleProm = fakeCli(`chord ${chordName} where in scale`, 'cli').then(({ scaleNames }) => scaleNames)
                                const triadData = await awaitAll({ aliases: aliasesProm, whereInScale: whereInScaleProm })
                                const { aliases, whereInScale } =
                                    z.object({ aliases: z.array(z.string()), whereInScale: z.array(z.string()) }).parse(triadData)

                                const byLookup = triadLookup.filter(({ scaleName, tonic, triads }) => {
                                    return !!triads.find((triad) => {
                                        return aliases.includes(triad)
                                    })
                                })

                                const triadsWhereInScale = whereTriad(whereInScale, aliases)
                                const deduped = [...byLookup, ...triadsWhereInScale.filter(({ tonic, scaleName }) => {
                                    return !byLookup.find(({ tonic: tonic1, scaleName: scaleName1 }) => {
                                        return scaleName === scaleName1 && tonic === tonic1
                                    })
                                })]
                                return { triadsWhereInScale: deduped }

                            }
                        },
                        in: {
                            fn: async (args, moduleCalls) => { },
                            submodules: {
                                scale: {
                                    fn: async (args, moduleCalls) => {
                                        const chordName = await moduleCalls['chord $']
                                        const notes = Chord.get(chordName)?.notes || []
                                        const notesPermuted = rotations(notes)
                                        const aliases = notesPermuted.map((notes1) => Chord.detect(notes1)).flat()

                                        const scaleNames = notesPermuted.map((notes1) => Scale.detect(notes1)).flat()
                                        return { scaleNames }
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
