import { Note } from 'tonal'

import { mem } from '../../core/mem'
import { setLatestMap } from '../../core/observables'
import { caculateNoteDelay } from '../../lib/addChord'
import { mapSongToMidiTicks } from '../../lib/mapSongToTicks'
import { NoteByBar } from '../../lib/schemas'

// En-masse note arranging: apply a timing pattern to a whole group, bar, or
// phase in one command, or shift every note in a group/bar by a tick amount.
// Patterns reuse addChord's arp vocabulary: each token is one note's delay,
// either a comma-joined fraction list ('half,eighth' = half + eighth) or raw
// ticks. Examples:
//   arrange group 90fe82 0th quarter half
//   arrange bar aphrodite:0 0th quarter quarter,eighth half
//   arrange phase aphrodite 0th half half,quarter
//   arrange shift aphrodite:0 64
//   arrange shift 90fe82 -32

type PatternToken = string | number

const toDelay = (token: PatternToken, idx: number): number => {
  if (typeof token === 'number') {
    return token
  }
  // caculateNoteDelay expects the token at the note's index; wrap a
  // single-token arp so idx 0 is used for fraction parsing.
  const delay = caculateNoteDelay([token], 0)
  if (typeof delay !== 'number' || isNaN(delay)) {
    throw new Error(`could not parse pattern token '${token}' at index ${idx}`)
  }
  return delay
}

const pitchOf = (noteName: string): number => {
  // note names are stored lowercase ('a3', 'c#4'); tonal wants 'A3'
  const midi = Note.midi(noteName.charAt(0).toUpperCase() + noteName.slice(1))
  return typeof midi === 'number' ? midi : 0
}

// Sorted by current delay so the pattern lands in the notes' musical order.
// Ties (fresh chords land with every note at delay 0) break low-to-high by
// pitch, so an arp pattern reads as an upward arpeggio; noteId is the final
// stable tiebreak.
const sortNotes = (notes: NoteByBar[]): NoteByBar[] => {
  return [...notes].sort((a, b) => {
    const d =
      (Number(a.tagsObj.barDelay?.[0]) || 0) -
      (Number(b.tagsObj.barDelay?.[0]) || 0)
    if (d !== 0) {
      return d
    }
    const p = pitchOf(a.note) - pitchOf(b.note)
    if (p !== 0) {
      return p
    }
    return String(a.tagsObj.noteId?.[0]).localeCompare(
      String(b.tagsObj.noteId?.[0])
    )
  })
}

const applyPatternToNotes = (notes: NoteByBar[], pattern: PatternToken[]) => {
  if (notes.length === 0 || pattern.length === 0) {
    return 0
  }
  const sorted = sortNotes(notes)
  const base = Math.min(
    ...sorted.map((n) => Number(n.tagsObj.barDelay?.[0]) || 0)
  )
  sorted.forEach((note, idx) => {
    // Clamp to the last token when the group outgrows the pattern — same
    // spirit as addChord falling back for missing arp entries, but without
    // collapsing extra notes to delay 0.
    const token = pattern[Math.min(idx, pattern.length - 1)]
    note.tagsObj.barDelay = [base + toDelay(token, idx)]
  })
  return sorted.length
}

const groupNotesByGroupId = (notes: NoteByBar[]) => {
  const byGroup: { [groupId: string]: NoteByBar[] } = {}
  notes.forEach((note) => {
    const groupId = String(note.tagsObj.groupId?.[0] ?? '')
    if (!byGroup[groupId]) {
      byGroup[groupId] = []
    }
    byGroup[groupId].push(note)
  })
  return byGroup
}

const collectNotes = (predicate: (barId: string, note: NoteByBar) => boolean) => {
  const collected: NoteByBar[] = []
  Object.entries(mem().notesByBar).forEach(([barId, notes]) => {
    notes.forEach((note) => {
      if (predicate(barId, note)) {
        collected.push(note)
      }
    })
  })
  return collected
}

const recompile = async () => {
  await setLatestMap(mapSongToMidiTicks())
}

const parsePattern = (tokens: (string | number)[]): PatternToken[] => {
  return tokens.map((token) => {
    if (typeof token === 'number') {
      return token
    }
    const asNumber = Number(token)
    return isNaN(asNumber) ? token : asNumber
  })
}

export default {
  help: {
    description:
      'Apply a timing pattern to a whole group, bar, or phase, or shift notes en masse',
    examples: {
      'group 90fe82 0th quarter half':
        'Re-time the three notes of group 90fe82 to 0, a quarter, and a half after its start',
      'bar aphrodite:0 0th quarter quarter,eighth':
        'Apply the pattern to every group in the bar, each from its own start',
      'phase aphrodite 0th half': 'Apply the pattern to every bar of the phase',
      'shift aphrodite:0 64': 'Move every note in the bar 64 ticks later',
      'shift 90fe82 -32': 'Move every note in the group 32 ticks earlier',
    },
  },
  fn: async () => {
    return {
      formatted: {
        usage:
          'arrange group <groupId> <pattern...> | arrange bar <barName> <pattern...> | arrange phase <phaseName> <pattern...> | arrange shift <barName|groupId> <ticks>',
      },
    }
  },
  submodules: {
    group: {
      fn: async ({
        positionalNonCommands,
      }: {
        positionalNonCommands: (string | number)[]
      }) => {
        const [groupIdRaw, ...patternRaw] = positionalNonCommands
        const groupId = String(groupIdRaw)
        const notes = collectNotes(
          (_, note) => String(note.tagsObj.groupId?.[0]) === groupId
        )
        if (notes.length === 0) {
          return { formatted: { error: `no notes found for group ${groupId}` } }
        }
        const changed = applyPatternToNotes(notes, parsePattern(patternRaw))
        await recompile()
        return { formatted: { group: groupId, notesArranged: changed } }
      },
    },
    bar: {
      fn: async ({
        positionalNonCommands,
      }: {
        positionalNonCommands: (string | number)[]
      }) => {
        const [barNameRaw, ...patternRaw] = positionalNonCommands
        const barName = String(barNameRaw)
        const notes = mem().notesByBar[barName]
        if (!notes || notes.length === 0) {
          return { formatted: { error: `no notes found in bar ${barName}` } }
        }
        const pattern = parsePattern(patternRaw)
        let changed = 0
        Object.values(groupNotesByGroupId(notes)).forEach((groupNotes) => {
          changed += applyPatternToNotes(groupNotes, pattern)
        })
        await recompile()
        return { formatted: { bar: barName, notesArranged: changed } }
      },
    },
    phase: {
      fn: async ({
        positionalNonCommands,
      }: {
        positionalNonCommands: (string | number)[]
      }) => {
        const [phaseNameRaw, ...patternRaw] = positionalNonCommands
        const phaseName = String(phaseNameRaw)
        const pattern = parsePattern(patternRaw)
        let changed = 0
        let bars = 0
        Object.entries(mem().notesByBar).forEach(([barId, notes]) => {
          if (barId.split(':')[0] !== phaseName || notes.length === 0) {
            return
          }
          bars++
          Object.values(groupNotesByGroupId(notes)).forEach((groupNotes) => {
            changed += applyPatternToNotes(groupNotes, pattern)
          })
        })
        if (bars === 0) {
          return {
            formatted: { error: `no bars with notes in phase ${phaseName}` },
          }
        }
        await recompile()
        return {
          formatted: { phase: phaseName, bars, notesArranged: changed },
        }
      },
    },
    shift: {
      fn: async ({
        positionalNonCommands,
      }: {
        positionalNonCommands: (string | number)[]
      }) => {
        const [targetRaw, ticksRaw] = positionalNonCommands
        const target = String(targetRaw)
        const ticks = Number(ticksRaw)
        if (isNaN(ticks)) {
          return { formatted: { error: `'${ticksRaw}' is not a tick amount` } }
        }
        // A bar name contains ':', otherwise treat the target as a groupId.
        const notes = target.includes(':')
          ? mem().notesByBar[target] || []
          : collectNotes(
              (_, note) => String(note.tagsObj.groupId?.[0]) === target
            )
        if (notes.length === 0) {
          return { formatted: { error: `no notes found for ${target}` } }
        }
        notes.forEach((note) => {
          const current = Number(note.tagsObj.barDelay?.[0]) || 0
          note.tagsObj.barDelay = [Math.max(0, current + ticks)]
        })
        await recompile()
        return {
          formatted: { shifted: target, notes: notes.length, ticks },
        }
      },
    },
  },
}
