import { fakeCli } from 'peprn/browser'
import { Module, awaitAll } from 'peprn/util'
import { Chord, Note, Scale, Mode, Collection, Progression } from 'tonal'
import { z } from 'zod'

// Mode.triads("major", "C");
// => ["C", "Dm", "Em", "F", "G", "Am", "Bdim"];

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
const vectorize = (whereInScale: string[], aliases: string[]) => {
    const triadsWhereInScale = whereTriad(whereInScale, aliases)
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

export default {
    fn: async () => {
        return null
    },
    submodules: {
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
                        const whereInScale = (await fakeCli(`chord ${chordName} where in scale`, 'cli')).scaleNames
                        const withRomanizedTriads = vectorize(whereInScale, aliases)
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
                                const [, tonicRaw] = dollar
                                const [modeRaw] = positionalNonCommands
                                const tonic = z.string({ invalid_type_error: "tonic is required" }).parse(tonicRaw)
                                const mode = z.string({ invalid_type_error: "mode is required" }).parse(modeRaw)
                                const romanizedTriads = await fakeCli(`chord ${chordName} vectorized`, 'cli')

                                console.log('parent call from tonic and mode', tonic, mode, romanizedTriads)

                            }
                        }
                    }
                },
                vectorized: {
                    fn: async (args, moduleCalls) => {
                        const [chordName] = await moduleCalls['chord $']
                        const aliases = (await fakeCli(`chord ${chordName} aliases`, 'cli')).aliases
                        const whereInScale = (await fakeCli(`chord ${chordName} where in scale`, 'cli')).scaleNames
                        const withRomanizedTriads = vectorize(whereInScale, aliases)
                        return { vectorizing: withRomanizedTriads }
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

                                return { triadsWhereInScale: whereTriad(whereInScale, aliases) }

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
