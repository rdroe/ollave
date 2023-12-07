import { Module, } from 'peprn/util';
import { isNum, isString } from '../../lib/helpers'
import { mem } from '../../mem';
import { z } from 'zod'
import { getAllPhaseBarNotes, phaseCount, phaseFollowsPhase, phaseUnfollows } from 'src/mem-db';
const { observables } = mem()
export const findPhase = (name: string) => {
    return observables[name] || null
}

/**
Should work like this:
a cue equals a "phase" from notes.
this command should be renamed "phase" or possibly "phases". 
start cue aphro should start a new subject that subscribes to the master ticks subject. the arguments include (at least) a length in bars.
a new command 
 
phases and tracks
we need to add the track, song, entities and the track-song (or song-track) property on one of those. 
*/

const parseColonTag = (str: string) => {
    if (str.match(/[^\:]\:[0-9]+/)) {
        return z.tuple([z.string(), z.number()]).parse(str.split(':'))
    }
    return null
}

const notes = (phaseOrBarTag?: string) => {
    let notes: ReturnType<typeof mem>["notesByBar"]["string"] = []
    if (!phaseOrBarTag) {
        notes = Object.values(mem().notesByBar).flat()
    } else if (mem().phases[phaseOrBarTag]) {
        notes = getAllPhaseBarNotes(phaseOrBarTag).flat()
    } else if (parseColonTag(phaseOrBarTag)) {
        notes = mem().notesByBar[phaseOrBarTag]
    }
    return {
        tag: (newTag: string) => {
            notes.forEach((note) => {
                note.tags.push(newTag)
            })
        }
    }
}

const module: Module = {
    help: {
        description: 'Create a subscribable time interval',
    },
    fn: async (args) => {
        return null
    },
    submodules: {
        '$': {
            fn: async (args) => {
                const [phaseName] = args['$']
                const [barCnt] = args.positionalNonCommands

                if (isString(phaseName) && isNum(barCnt)) {
                    phaseCount(phaseName, barCnt)
                    return getAllPhaseBarNotes(phaseName)
                }
                return phaseName
            },
            submodules: {
                follows: {
                    fn: async (args, familialCalls) => {
                        const off = args?.off

                        const phaseName1 = await familialCalls['phase $']
                        const objects = args.positionalNonCommands
                        if (off) {
                            return phaseUnfollows(phaseName1, objects)
                        }
                        return phaseFollowsPhase(phaseName1, objects)
                    }
                },
                scale: {
                    fn: async ({ '$': $, positionalNonCommands }) => {

                        const [userTonic = '', userScale = ''] = positionalNonCommands
                        const [phaseName1] = $

                        mem().phases[phaseName1].scaleName = userScale
                        mem().phases[phaseName1].scaleTonic = userTonic
                        notes(phaseName1).tag(`scaleTonic=${userTonic}`)
                        notes(phaseName1).tag(`scaleName=${userScale}`)

                    }
                }
            }
        }
    }
}

export default module
