import { Module, } from 'peprn/util';
import { isNum, isString } from '../../lib/helpers'
import { mem } from '../../mem';

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
                }
            }
        }
    }
}

export default module
