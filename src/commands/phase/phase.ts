import { Module, ParsedCli } from 'peprn/util';
import { isNum, isString } from '../../lib/helpers'
import { mem } from '../../mem';
import { z } from 'zod';
import { getAllPhaseBarNotes, phaseCount, phaseFollowsPhase, phaseUnfollows } from 'src/mem-db';
import { SubcommandPatterns, runSubcommandsOrNull } from 'src/lib/subcommands';
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


const subcommandPatterns: SubcommandPatterns = {
    follows: {
        match: (args) => {

            if (args.positionalNonCommands.length < 3) return false
            if (typeof args.positionalNonCommands[1] === "string" && ['follows', 'foll'].includes(args.positionalNonCommands[1])) return true
        },
        // phase <new-phase> follows <existing-phase>
        // phase <new-phase> follows <existing-phase> <existing-phase> <existing-phase>
        // phase <new-phase> foll <existing-phase>
        // phase <new-phase> foll <existing-phase> <existing-phase> <existing-phase>
        // phase <existing-phase> foll <existing-phase> [--off=<boolean>]
        // phase <existing-phase> foll <existing-phase> <existing-phase> <existing-phase> [--off=<boolean>]
        // phase <existing-phase> foll --off=<boolean>
        // if the new-phase track-phase does not already exist, create it.
        // if the new-phase track-phase does not already follow the existing-phase, add a follows-id (for each, if a list)
        // if "-off", and  the new-phase track-phase already follows the existing-phase, remove the follows-id (for each, if a list)
        // if "-off", and only one phase argument, remove all follows-ids from the new-phase track-phase
        do: async ({ positionalNonCommands, off, size }: ParsedCli & { off: boolean, barCnt?: number }) => {
            const [rawSubject, _, ...rawObjects] = positionalNonCommands
            const {
                subject,
                objects,
            } = z.object({
                ["parsing follows args"]: z.object({
                    subject: z.string(),
                    objects: z.array(z.string())
                })
            }
            ).parse({
                ["parsing follows args"]: {
                    subject: rawSubject,
                    objects: rawObjects ?? []
                }
            })['parsing follows args']

            const { off: offParsed = false } = z.object({
                off: z.boolean().optional()
            }).parse({
                off
            })

            if (off) {
                await phaseUnfollows(subject, objects)
            } else {

                await phaseFollowsPhase(subject, objects)
            }

        }


    }
}

const module: Module = {
    help: {
        description: 'Create a subscribable time interval',
    },
    fn: async (args) => {

        const ranSubcommand = await runSubcommandsOrNull(subcommandPatterns, args)

        if (Array.isArray(ranSubcommand)) return ranSubcommand[0]

        const [phaseName, barCnt] = args.positionalNonCommands

        if (isString(phaseName) && isNum(barCnt)) {
            phaseCount(phaseName, barCnt)

            console.log('in command; mem.phases', getAllPhaseBarNotes(phaseName))
            return getAllPhaseBarNotes(phaseName)
        }
        return null

    },
}

export default module
