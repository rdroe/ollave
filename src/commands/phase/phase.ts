import { Module } from 'peprn/util'
import { z } from 'zod'

import { mem } from '../../core/mem'
import { setLatestMap } from '../../core/observables'
import { allScales, DEFAULT_VELOCITY } from '../../lib'
import { isNum, isString } from '../../lib/helpers'
import { mapSongToMidiTicks } from '../../lib/mapSongToTicks'
import {
  copyBarNotesToEndOfPhase,
  copyBarNotesWithNoteIdsAndGroupIds,
} from '../../lib/util/barsUtil'
import {
  getAllPhaseBarNotes,
  phaseCount,
  phaseExists,
  phaseFollowsPhase,
  phaseUnfollows,
} from '../../lib/util/phaseUtil'
import { getPhaseChordNames } from '../../lib/util/graphUtil'
import { getRandomWord } from '../../lib/util/songUtil'

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
import { parseColonTag } from '../../lib/util/parseColonTag'

export { parseColonTag }

const notes = (phaseOrBarTag?: string) => {
  let notes: ReturnType<typeof mem>['notesByBar']['string'] = []
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
    },
  }
}

const module: Module = {
  help: {
    description: 'Create a subscribable time interval',
  },

  fn: async () => {
    // can't recall why this was here
    // if (!isString(phaseName)) {
    //     throw new Error('Phase name is required')
    // }

    // if (rest.length === 0) {
    //     throw new Error('Further arguments are required')
    // }
    return null
  },
  submodules: {
    $: {
      fn: async (args) => {
        const [phaseName] = args['$']
        const [barCnt] = args.positionalNonCommands
        // find this phase id, then the track id.
        const alreadyExists = phaseExists(phaseName)
        const trackId = alreadyExists ? mem().tracks?.[0]?.id : undefined
        if (isString(phaseName) && isNum(barCnt)) {
          phaseCount(phaseName, barCnt, true, trackId)
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
          },
        },
        unfollows: {
          fn: async (args, familialCalls) => {
            const phaseName1 = await familialCalls['phase $']
            const objects = args.positionalNonCommands
            return phaseUnfollows(phaseName1, objects)
          },
        },
        scale: {
          fn: async ({ $: $, positionalNonCommands }) => {
            const [userTonic = '', userScale = ''] = positionalNonCommands
            const [phaseName1] = $

            mem().phases[phaseName1].scaleName = userScale
            mem().phases[phaseName1].scaleTonic = userTonic
            notes(phaseName1).tag(`scaleTonic=${userTonic}`)
            notes(phaseName1).tag(`scaleName=${userScale}`)
            setLatestMap(mapSongToMidiTicks())
          },
        },
        velocityPirate: {
          fn: async ({ $: $ }) => {
            const [phaseName1] = $

            Object.keys(mem().notesByBar).forEach((barId) => {
              if (!barId.includes(phaseName1)) {
                return
              }
              mem().notesByBar[barId].forEach((note) => {
                if (note.tagsObj.velocity?.[0] !== 60) {
                  return
                }
                note.tagsObj.velocity = [DEFAULT_VELOCITY]
              })
            })
            setLatestMap(mapSongToMidiTicks())
          },
        },
        push: {},
      },
    },
    copyBarNotes: {
      fn: async ({ positionalNonCommands }) => {
        const [barId1, barId2] = z
          .array(z.string())
          .parse(positionalNonCommands)
        copyBarNotesWithNoteIdsAndGroupIds(barId1, barId2)
      },
    },
    duplicateBars: {
      yargs: {
        barIds: {
          array: true,
          type: 'string',
          alias: 'b',
        },
      },
      fn: async ({ barIds: barIdsRaw }) => {
        const { barIds } = z
          .object({
            barIds: z.array(z.string()),
          })
          .parse({
            barIds: barIdsRaw,
          })
        copyBarNotesToEndOfPhase(barIds)
      },
    },
    scaleChords: {
      fn: async ({ positionalNonCommands }) => {

        const [scaleTonic, scaleName] = positionalNonCommands
        return getPhaseChordNames(scaleTonic, scaleName, 'all')

      },
    },
    allScales: {
      fn: async () => {
        return allScales
      },
    },
    randomWord: {
      fn: async () => {
        return getRandomWord()
      },
    },
  },
  
}

export default module
