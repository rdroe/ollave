import { mem } from '../../core/mem'
import { setLatestMap } from '../../core/observables'
import { mapSongToMidiTicks } from '../../lib/mapSongToTicks'
import { copyBarNotesWithNoteIdsAndGroupIds } from '../../lib/util/barsUtil'

import { parseColonTag } from '../phase/phase'

// Copy parts of a song without dragging bar by bar. Notes are duplicated with
// fresh noteIds/groupIds by the underlying primitive, and missing destination
// bars are created automatically.
//   copy bar aphrodite:0 aphrodite:4
//   copy bar aphrodite:0 boethus:0 --move
//   copy bars aphrodite:0-3 aphrodite:8      (range onto 8,9,10,11)
//   copy bars aphrodite:0-3 boethus:0        (across phases)
//   copy phase aphrodite boethus             (every populated bar, same indexes)

// 'phaseName:2-5' -> { phase, start, end } ; 'phaseName:2' -> start === end
const parseRange = (arg: string) => {
  const [phase, rangeRaw] = [
    arg.slice(0, arg.lastIndexOf(':')),
    arg.slice(arg.lastIndexOf(':') + 1),
  ]
  const [startRaw, endRaw] = rangeRaw.split('-')
  const start = parseInt(startRaw)
  const end = endRaw === undefined ? start : parseInt(endRaw)
  if (!phase || isNaN(start) || isNaN(end) || end < start) {
    throw new Error(
      `could not parse '${arg}' — expected phase:index or phase:start-end`
    )
  }
  return { phase, start, end }
}

const recompile = async () => {
  await setLatestMap(mapSongToMidiTicks())
}

export default {
  help: {
    description:
      'Copy notes between bars, bar ranges, or whole phases (use --move to move instead)',
    examples: {
      'bar aphrodite:0 aphrodite:4': 'Duplicate one bar onto another',
      'bars aphrodite:0-3 aphrodite:8': 'Copy a four-bar section onto bars 8-11',
      'bars aphrodite:0-3 boethus:0 --move': 'Move the section into another phase',
      'phase aphrodite boethus': 'Copy every populated bar to the same indexes',
    },
  },
  yargs: {
    move: {
      type: 'boolean',
      default: false,
    },
  },
  fn: async () => {
    return {
      formatted: {
        usage:
          'copy bar <src> <dst> | copy bars <phase>:<start>-<end> <phase>:<destStart> | copy phase <src> <dst> (add --move to move)',
      },
    }
  },
  submodules: {
    bar: {
      fn: async ({
        positionalNonCommands,
        move,
      }: {
        positionalNonCommands: string[]
        move?: boolean
      }) => {
        const [src, dst] = positionalNonCommands.map(String)
        copyBarNotesWithNoteIdsAndGroupIds(src, dst, undefined, !!move)
        await recompile()
        return { formatted: { [move ? 'moved' : 'copied']: `${src} -> ${dst}` } }
      },
    },
    bars: {
      fn: async ({
        positionalNonCommands,
        move,
      }: {
        positionalNonCommands: string[]
        move?: boolean
      }) => {
        const [srcArg, dstArg] = positionalNonCommands.map(String)
        const src = parseRange(srcArg)
        const dst = parseRange(dstArg)
        const copies: string[] = []
        for (let i = 0; i <= src.end - src.start; i++) {
          const from = `${src.phase}:${src.start + i}`
          const to = `${dst.phase}:${dst.start + i}`
          copyBarNotesWithNoteIdsAndGroupIds(from, to, undefined, !!move)
          copies.push(`${from} -> ${to}`)
        }
        await recompile()
        return { formatted: { [move ? 'moved' : 'copied']: copies } }
      },
    },
    phase: {
      fn: async ({
        positionalNonCommands,
        move,
      }: {
        positionalNonCommands: string[]
        move?: boolean
      }) => {
        const [srcPhase, dstPhase] = positionalNonCommands.map(String)
        const copies: string[] = []
        // Copy only populated bars, keeping their indexes.
        Object.entries(mem().notesByBar).forEach(([barId, notes]) => {
          if (notes.length === 0) {
            return
          }
          const [phaseName, barIndex] = parseColonTag(barId)
          if (phaseName !== srcPhase) {
            return
          }
          const to = `${dstPhase}:${barIndex}`
          copyBarNotesWithNoteIdsAndGroupIds(barId, to, undefined, !!move)
          copies.push(`${barId} -> ${to}`)
        })
        if (copies.length === 0) {
          return {
            formatted: { error: `no populated bars found in phase ${srcPhase}` },
          }
        }
        await recompile()
        return { formatted: { [move ? 'moved' : 'copied']: copies } }
      },
    },
  },
}
