import { fakeCli } from 'peprn/browser'
import { Module, awaitAll } from 'peprn/util'
import { allNexts, minor, translated } from 'src/lib/graphh'

import { Chord, Note, Scale, Mode, Collection, Progression } from 'tonal'
import { z } from 'zod'

const romanizedOptions = (name: string, prev: string, scaleName: string): string[] => {

    const keysss = Object.keys(translated)
    const graphName = keysss.find((key2) => {
        const vals = translated[key2]
        return Array.isArray(vals) && vals.includes(name)
    })
    if (!graphName) return []


    const resultsForThisScale = minor.filter((node) => {
        console.log('looking for', graphName, 'in', node)
        if (node.name !== graphName) return false
        return true
    })
    const filteredForPrev = resultsForThisScale.filter((node) => {
        if (node.prev && !node.prev.includes(prev)) return false

        return true
    })

    const nexts = filteredForPrev
        .map((node) => {
            if (node.next === "Any") {
                return allNexts


            }
            const translatedNextOptions =
                node.next.map((nextOption) => {

                    const arrOrFn = translated[nextOption]
                    if (typeof arrOrFn === 'function') {
                        const fnName = arrOrFn.name
                        const notes = arrOrFn(name, scaleName)
                        return [`${fnName}|${notes.join(',')}`]
                    }
                    return arrOrFn ? arrOrFn : null
                }).filter((x) => x !== null).flat()
            return translatedNextOptions
        })

    console.log('romanized options return 1', nexts)
    return nexts
        .flat()
}

// Mode.triads("major", "C");
// => ["C", "Dm", "Em", "F", "G", "Am", "Bdim"];

type Vector = {
    triads: string[],
    romanizedTriads: string[],
    myIndex: number,
    tonic: string,
    scaleName: string
}
const noteNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', "A", "Bb", "B"]
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
const rotations = <T>(arr: Array<T>): T[][] => {
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
const allModes = Mode.all()
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
        console.log('to roman', rest.tonic, triads)
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

const vecotrizedSchema = z.object({
    mode: z.string(), // e.g. major,
    romanNumberal: z.string(), // e.g. I
})

type ChordNameWithNotes = {
    name: string
    notes: string[]
    history?: (Vector & { myName: string })[]
}

const chordNameWithNotes = (chordName: string): ChordNameWithNotes => {
    if (chordName.includes('/')) {
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
        return {
            name: chordName,
            notes: permutedNotes,
        }
    }
    return {
        name: chordName,
        notes: Chord.get(chordName)?.notes || [],

    }
}

export const chord: Module = {
    fn: async () => {
        return null
    },
    submodules: {
        graph: {
            fn: async (args, moduleCalls) => { },
            submodules: {
                starters: {
                    fn: async () /*: Promise<ChordNameWithNotes[]> */ => {

                        return triadsWithRomanized.filter(({ scaleName }) => scaleName === "minor").map(({ tonic, scaleName, romanizedTriads, triads }) => {

                            // for each romanized triad
                            return romanizedTriads.map((rt, i) => {
                                // get it as a graph node name
                                //                                const graphTranslated = global.reverseTrans(rt)
                                //const graphTranslated = Object.keys(translated)
                                const keysss = Object.keys(translated)
                                const graphTranslated = keysss.find((key2) => {
                                    const vals = translated[key2]
                                    return Array.isArray(vals) && vals.includes(rt)
                                })
                                // where it's a name in the graph
                                if (minor.find((node) => {
                                    return node.name === graphTranslated
                                })) {
                                    console.log("find for", graphTranslated)
                                    return { tonic, scaleName, romanizedTriads, triads, myIndex: i, myName: graphTranslated }
                                } else {
                                    console.log("could not find for", graphTranslated)
                                }
                            }).filter(x => !!x).map(({ tonic, myName }) => {
                                if (myName.includes('/')) {
                                    const [main, bass] = myName.split('/')
                                    if (!main || !bass) return null
                                    const [mainName] = Progression.fromRomanNumerals(tonic, [main])
                                    const [bassName] = Progression.fromRomanNumerals(tonic, [bass])
                                    const chordWithNotes = chordNameWithNotes(`${mainName}/${bassName}}`)
                                    return {
                                        ...chordWithNotes,
                                        history: [{ myName, triads, romanizedTriads, myIndex: 0, tonic, scaleName }]
                                    }
                                }
                                const keysss = Object.keys(translated)
                                const nonRomanName = keysss.find((key2) => {
                                    const vals = translated[key2]
                                    return Array.isArray(vals) && vals.includes(myName)
                                })

                                //                                const [nonRomanName] = global.reverseTrans(myName)
                                const [nameFromRoman] = Progression.fromRomanNumerals(tonic, [nonRomanName])
                                const chordWithNotes = chordNameWithNotes(nameFromRoman)

                                return {
                                    ...chordWithNotes,
                                    history: [{ myName, triads, romanizedTriads, myIndex: 0, tonic, scaleName }]
                                }
                            })




                        }).flat()
                    },
                },
            }
        },

        '$': {
            fn: async (args) => {
                return args['$']
            },
            submodules: {

                next: {
                    fn: async (args, moduleCalls) => {
                        console.log('moduleCalls at chord $ next', moduleCalls)
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
                            // e.g. chord C next G major
                            fn: async ({ "$": dollar, positionalNonCommands }, moduleCalls) => {
                                const [chordName] = await moduleCalls['chord $']
                                const vectorized: ReturnType<typeof vectorize> = await moduleCalls['chord $ next']
                                const options =
                                    vectorized.filter((args) => {
                                        return args.scaleName === "minor"
                                    }).map((vector) => {
                                        const { romanizedTriads, myIndex, scaleName, tonic } = vector
                                        const me = romanizedTriads[myIndex]
                                        const opts = romanizedOptions(me, tonic, scaleName)
                                        return opts
                                    })


                                return { next: options.flat() }

                            }
                        }
                    }
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
                                        console.log('aliases', aliases)
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

                get: {
                    fn: async (args, moduleCalls) => {
                        const [chordName] = await moduleCalls['chord $']
                        if (!chordName) return null
                        const gotten = Chord.get(chordName)
                        if (chordName.includes('/')) {
                            return 'SLASH_CHORD'
                        }
                        console.log('chordName', chordName)
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
