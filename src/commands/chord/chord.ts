import { fakeCli } from 'peprn/browser'
import { Module } from 'peprn/util'
import { Chord, Note, Scale, Mode, Collection } from 'tonal'
import { z } from 'zod'

// Mode.triads("major", "C");
// => ["C", "Dm", "Em", "F", "G", "Am", "Bdim"];


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
                aliases: {
                    fn: async (args, moduleCalls) => {
                        const chordName = await moduleCalls['chord $']
                        const notes = Chord.get(chordName)?.notes || []
                        const notesPermuted = Collection.permutations(notes)
                        const aliases = notesPermuted.map((notes1) => Chord.detect(notes1)).flat()
                        return { aliases }
                    },

                },
                where: {
                    fn: async (args, moduleCalls) => { },
                    submodules: {
                        triad: {
                            fn: async (args, moduleCalls) => {
                                const [chordName] = await moduleCalls['chord $']
                                let retVar: any
                                const whereInScale = await fakeCli(`chord ${chordName} where in scale`, 'cli').then((data: any) => {
                                    return data['chord $ where in scale']
                                })
                                console.log('whereInScale', whereInScale)
                                if (whereInScale.scaleNames) {
                                    const tonicScaleArr = z.array(z.string()).transform((strs) => {
                                        return strs.map((str) => {
                                            const split = str.split(' ')
                                            const tonic = split.shift()
                                            return [tonic, split.join(' ')]

                                        })
                                    }).parse(whereInScale.scaleNames)
                                    const triadsWhereInScale = tonicScaleArr.map(([tonic, scaleName]) => {
                                        const triads = Mode.triads(scaleName, tonic)

                                        return { tonic, scaleName, triads }
                                    }).filter(({ triads }) => {
                                        console.log('triads', triads, 'includes', chordName, triads.includes(chordName))
                                        return triads.includes(chordName)
                                    })

                                    return { triadsWhereInScale }
                                }

                                return { "where triad": `Could not get scale names for chord ${chordName}` }
                            }
                        },
                        in: {
                            fn: async (args, moduleCalls) => { },
                            submodules: {
                                scale: {
                                    fn: async (args, moduleCalls) => {
                                        const chordName = await moduleCalls['chord $']
                                        const notes = Chord.get(chordName)?.notes || []
                                        const notesPermuted = Collection.permutations(notes)
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

                                /*
  "scaleNames": [
    "C minor",
    "C major blues",
    "C minor blues",              */
                            }
                        }
                    }
                },

                next: {
                    fn: async (args, moduleCalls) => {
                        const chordName = await moduleCalls['chord $']

                        return Chord.get(chordName)
                    }
                }
            }
        }
    }
} as Module
