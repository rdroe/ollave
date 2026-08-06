import { Chord, ChordType, Note } from 'tonal'
import { z } from 'zod'

// direct imports (not via the lib barrel or commands) to avoid module-init
// cycles and browser-only side effects (cf. e302ee7)
import { mem } from '../../core/mem'
import { setLatestMap } from '../../core/observables/compilationObservable'
import { mapSongToMidiTicks } from '../mapSongToTicks'
import { chordNameWithNotes, DynamicChordNames } from '../graphh'
import { cloneNoteByBar, makeNoteByBar, NoteByBar } from '../schemas'
import { bassOf, parseFigure } from '../figuredBass'
import { figuredVoicings, nearestVoicing, voicingDistance } from '../voiceLeading'

import { isString, isCsvArg, parseCsvArg } from './common'
import { randId } from './common'
import { lookUpGraph } from './graphUtil'
import { parseColonTag } from './parseColonTag'
import { phaseCount, phaseExists } from './phaseUtil'
import { parseNoteTags, TagEntries } from './noteParsingUtil'
import {
  isNoteNameWithoutOctave,
  isNoteNameWithOctave,
} from './noteValidationUtil'
import { getAllPhaseBars } from './phaseNotesUtil'
import { tagEntriesCompare } from './tagsUtil'

const allChordTypes = ChordType.all()
export const isRestArg = (arg: unknown) => {
  return (
    isString(arg) &&
    (arg === 'rest' || arg === '[]' || arg === '~' || arg === '_')
  )
}

export {
  isNoteNameWithoutOctave,
  isNoteNameWithOctave,
} from './noteValidationUtil'
export const isStringArray = (arr: unknown[]): arr is string[] => {
  return arr.every((arg) => isString(arg))
}
const isNoteNameArray = (arr: unknown[]): arr is string[] => {
  return arr.every((arg) => isNoteNameWithOctave(arg) || isRestArg(arg))
}

export { isCsvArg, parseCsvArg } from './common'

const hasOctaveFilter = (noteStrs: string[]) => {
  return noteStrs
    .map((str) => {
      return Note.get(str).oct ?? null
    })
    .filter((numOrNull) => {
      return numOrNull !== null
    })
}
export const isDyna = (nm: string) => {
  return Object.keys(DynamicChordNames)
    .map((name) => name.toLowerCase())
    .includes(nm.toLowerCase())
}
export const isNoteCsvArg = (str: string): str is string => {
  if (!isCsvArg(str)) return false

  const csv = parseCsvArg(str)

  if (!isNoteNameArray(csv)) return false
  return true
}

const isChordName = (nm: string): boolean => {
  const tokenized = Chord.tokenize(nm)
  if (isDyna(nm)) {
    return true
  }

  if (tokenized.length === 2) {
    if (!isNoteNameWithoutOctave(tokenized[0])) {
      console.error('not a note name', tokenized[0])
      return false
    }
    if (tokenized[1].toLowerCase() === '') {
      return true
    }

    const isNormalChord = !!allChordTypes.find((type) => {
      return (
        type.name.toLowerCase() === tokenized[1].toLowerCase() ||
        type.aliases.some((alias) => {
          return alias.toLowerCase() === tokenized[1].toLowerCase()
        })
      )
    })
    if (isNormalChord) return true
    return isDyna(nm)
  }

  return false
}

const raiseOctaveOfChordNotes = (
  notes: string[],
  rootOctave: number,
  chordLetter?: string
) => {
  const root = chordLetter
    ? notes.find((n) => {
        let casedNote = n
        if (n[0].toLowerCase() == n[0]) {
          casedNote = `${n[0].toUpperCase()}${n.slice(1)}`
        }

        return casedNote.startsWith(chordLetter)
      })
    : notes[0]
  // no identifiable root, or a root without an octave (pitch class): there is
  // nothing to raise; previously this produced NaN octaves like 'CNaN'
  if (!root) return notes
  const currOctave = Note.get(root).oct
  if (typeof currOctave !== 'number') return notes

  const diff = currOctave - rootOctave
  if (diff === 0) return notes
  return notes.map((noteName: string) => {
    const [name, oct] = [Note.get(noteName).pc, Note.get(noteName).oct]
    if (typeof oct !== 'number') return noteName
    return `${name}${oct - diff}`
  })
}

const parseChordCsvArgDefault = (
  str: string,
  userScaleAndTonic?: string
): [notes: string[], tags: string[]] => {
  if (!isCsvArg(str)) throw new Error(`${str} is not a chord csv arg`)
  const csv = parseCsvArg(str)
  if (typeof csv[0] !== 'string' || csv[0] === '')
    throw new Error(`${csv} is not a non-empty string`)

  if (typeof csv[1] !== 'number') {
    throw new Error(
      `${str} is not a chord csv arg; second part is not an octave (number)`
    )
  }

  const [userTonic, userScale] = userScaleAndTonic
    ? userScaleAndTonic.split(' ')
    : []
  const graph =
    userTonic && userScale ? lookUpGraph(userTonic, userScale) : undefined
  const cnwn = chordNameWithNotes(csv[0], csv[1], userTonic, userScale)
  let notes: string[] | undefined
  const tags: string[] = []

  if (graph) {
    if (graph[csv[0]]) {
      if (graph[csv[0]].translatedSource.notes) {
        const graphChordData = graph[csv[0]]
        notes = graphChordData.translatedSource.notes
        tags.push(`roman=${graphChordData.roman}`)
        tags.push(`chord=${graphChordData.translatedSource.name}`)

        if (
          graphChordData.translatedSource.octMap &&
          hasOctaveFilter(notes).length === 0
        ) {
          return [graphChordData.translatedSource.octMap(notes, csv[1]), tags]
        }
        const raised = raiseOctaveOfChordNotes(
          notes,
          csv[1],
          Chord.get(graphChordData.translatedSource.name).tonic ?? undefined
        )
        return [raised, tags]
      }
    }
  }

  if (!cnwn) {
    throw new Error(`${csv[0]} could not be resolved to a chord`)
  }
  tags.push(`chord=${cnwn.name}`)
  if (!notes) {
    notes = cnwn.notes
  }

  const raised = raiseOctaveOfChordNotes(
    notes,
    csv[1],
    Chord.get(cnwn.name).tonic ?? undefined
  )

  return [raised, tags]
}

/** Options for {@link parseChordCsvArg}. */
export type ParseChordCsvArgOptions = {
  /**
   * Place the chord in the inversion this figure names, rather than in root
   * position (Stage M-A, A3).
   *
   * Accepts any spelling `parseFigure` accepts, so '6' and '⁶' are the same
   * request. When the figure does not apply to the chord — a '42' on a triad,
   * or a chord name that will not resolve — placement falls back to the
   * default, in keeping with this codebase's "never lose the result you would
   * otherwise have had" policy. Two tags are added when the figure IS applied:
   * `figure=` and `bass=`.
   */
  figure?: string
}

/**
 * Resolve a chord csv arg ('Am,3') to notes + tags.
 *
 * `prevNotes` is OPT-IN smooth voicing: when supplied and non-empty, the
 * chord is placed in whichever of its ascending inversions is reachable with
 * the least total semitone motion from those notes, rather than the default
 * root-position-at-the-given-octave voicing. Tags are unaffected either way.
 *
 * `opts.figure` is OPT-IN figured placement (Stage M-A): the chord is placed
 * with the chord tone the figure names in the bass. When both are supplied the
 * figure WINS on which inversion, and `prevNotes` then chooses among the
 * octaves of that inversion — a figure is a compositional decision about the
 * bass line, whereas smoothing is a convenience, so the explicit request
 * outranks the heuristic.
 *
 * Both extra params are additive and last, so every existing call site (which
 * passes at most two arguments) takes the untouched default path verbatim —
 * `barsUtil.test.ts` pins that behavior and passes unchanged.
 *
 * Placement degrades to the default whenever it cannot improve on it: an
 * unresolvable chord name, empty prevNotes, or an inapplicable figure.
 */
export const parseChordCsvArg = (
  str: string,
  userScaleAndTonic?: string,
  prevNotes?: string[],
  opts?: ParseChordCsvArgOptions
): [notes: string[], tags: string[]] => {
  const [notes, tags] = parseChordCsvArgDefault(str, userScaleAndTonic)

  const figure = opts?.figure ? parseFigure(opts.figure) : null

  if (!figure && (!prevNotes || prevNotes.length === 0)) return [notes, tags]

  const [userTonic, userScale] = userScaleAndTonic
    ? userScaleAndTonic.split(' ')
    : []
  const scale =
    userTonic && userScale ? { tonic: userTonic, name: userScale } : undefined
  const [chordName, oct] = parseCsvArg(str) as [string, number]

  if (figure) {
    // The chord name in the csv arg may be a roman/function name; the REALIZED
    // name is what carries the notes a figure indexes into, and the default
    // parse has already put it in a `chord=` tag.
    const realized =
      tags
        .find((t) => t.startsWith('chord='))
        ?.slice('chord='.length) ?? chordName

    const candidates = figuredVoicings(realized, figure, {
      scale,
      minOctave: oct,
      maxOctave: oct + 1,
    })

    if (candidates.length > 0) {
      // with prevNotes, pick the figured voicing closest to them; without,
      // take the lowest, which is the figured analogue of the default
      // root-position-at-the-given-octave placement.
      const chosen =
        prevNotes && prevNotes.length > 0
          ? candidates.reduce((best, cand) =>
              voicingDistance(prevNotes, cand) < voicingDistance(prevNotes, best)
                ? cand
                : best
            )
          : candidates[0]

      const bass = bassOf(realized, figure)
      return [
        chosen,
        [...tags, `figure=${figure}`, ...(bass ? [`bass=${bass}`] : [])],
      ]
    }
    // figure did not apply; fall through to the pre-existing behaviour
  }

  if (!prevNotes || prevNotes.length === 0) return [notes, tags]

  const { voicing } = nearestVoicing(prevNotes, chordName, { scale })

  return voicing.length > 0 ? [voicing, tags] : [notes, tags]
}

export const isChordCsvArg = (str: string) => {
  if (!isCsvArg(str)) return false
  const csv = parseCsvArg(str)

  if (typeof csv[0] !== 'string') return false
  if (!isChordName(csv[0])) return false
  if (typeof csv[1] !== 'number') return false

  return true
}
const lastLayerAdded: string[] = []
export const makeFulfilledBarNote = (barTag: string, extraTags: string[]) => {
  return (noteName: string): NoteByBar => {
    const noteProperties = Note.get(noteName)
    const { oct, letter, acc } = noteProperties
    const parsed = parseNoteTags(extraTags)
    const layer = parsed.find(([tag]) => {
      return tag === 'layer'
    })?.[1]

    const layerId = layer ? layer[0] : null

    if (typeof layerId === 'string' && layerId !== lastLayerAdded[0]) {
      lastLayerAdded.unshift(layerId)
    }

    const allTags = [
      ...extraTags,
      `lastBarTag=${barTag}`,
      `noteLetter=${letter}`,
      `noteAcc=${acc}`,
      `noteOct=${oct}`,
      `noteId=${randId('', 3)}`,
    ]
    const note1: NoteByBar = makeNoteByBar(`${letter}${acc}${oct}`, allTags)
    note1.tagsObj.creatdInUtils = [true]
    return note1
  }
}

export const getLastChordLayerName = () => {
  return lastLayerAdded[0]
}

export const copyBarNotesWithNoteIdsAndGroupIds = (
  sourceBarTag: string,
  targetBarTag: string,
  tags?: TagEntries,
  move?: boolean
) => {
  const sourceParsed = parseColonTag(sourceBarTag)
  const targetParsed = parseColonTag(targetBarTag)
  if (!sourceParsed) {
    throw new Error(`${sourceBarTag} is not a bar tag`)
  }
  if (!targetParsed) {
    throw new Error(`${targetBarTag} is not a bar tag`)
  }
  const [sourcePhase, sourceBarIndex] = sourceParsed
  const [targetPhase, targetBarIndex] = targetParsed
  if (!phaseExists(sourcePhase)) {
    throw new Error(`Source phase ${sourcePhase} does not exist`)
  }
  if (!phaseExists(targetPhase)) {
    throw new Error(`Target phase ${targetPhase} does not exist`)
  }

  if (!mem().notesByBar[sourceBarTag]) {
    phaseCount(sourcePhase, sourceBarIndex + 1, true)
  }
  if (!mem().notesByBar[targetBarTag]) {
    phaseCount(targetPhase, targetBarIndex + 1, true)
  }

  const allSourceNotes = mem().notesByBar[sourceBarTag]
  const sourceBarNotes = tags
    ? allSourceNotes.filter((note) => {
        const parsedTags = parseNoteTags(note.tags)
        const compare = tagEntriesCompare(tags, parsedTags)

        return compare
      })
    : allSourceNotes

  const uniqueNoteGroupIds = [
    ...new Set(sourceBarNotes.map((note) => note.tagsObj.groupId[0])),
  ]
  const replacmentNoteGroupIds = z.record(z.string(), z.string()).parse(
    Object.fromEntries(
      uniqueNoteGroupIds.map((groupId) => {
        return [groupId, randId('', 6)]
      })
    )
  )
  const uniqueLayerIds = [
    ...new Set(sourceBarNotes.map((note) => note.tagsObj?.layer?.[0])),
  ].filter((layerId) => !!layerId)
  const replacmentLayerIds = z.record(z.string(), z.string()).parse(
    Object.fromEntries(
      uniqueLayerIds.map((layerId) => {
        return [layerId, randId('', 6)]
      })
    )
  )

  const clonedNotes = sourceBarNotes.map((note) => {
    const clonedNote = cloneNoteByBar(note)
    if (!clonedNote) {
      throw new Error(`could not clone note in ${sourceBarTag}`)
    }
    const noteGroupId = z.string().parse(note.tagsObj.groupId[0])
    const noteLayerId = z
      .string()
      .or(z.undefined())
      .parse(note.tagsObj?.layer?.[0])

    clonedNote.tagsObj.groupId = [replacmentNoteGroupIds[noteGroupId]]
    if (noteLayerId) {
      clonedNote.tagsObj.layer = [replacmentLayerIds[noteLayerId]]
    }
    clonedNote.tagsObj.noteId = [randId('', 6)]
    clonedNote.tagsObj.barId = [targetBarTag]
    return clonedNote
  })

  mem().notesByBar[targetBarTag] = mem().notesByBar[targetBarTag] || []
  mem().notesByBar[targetBarTag].push(...clonedNotes)
  if (move) {
    mem().notesByBar[sourceBarTag] = mem().notesByBar[sourceBarTag].filter(
      (note) => {
        return !sourceBarNotes.includes(note)
      }
    )
  }
  setLatestMap(mapSongToMidiTicks())
}

/**
 * Copy all notes to the first available empty bar. Create new bars as necessary. Do not copy onto occupied bars; we are duplicating and creating new bar ids.
 * Unique IDs should be re-generated so uniqueness is maintained.
 **/
export const copyBarNotesToEndOfPhase_ = (
  barIds: string[],
  cb?: (barIds: string[]) => void
) => {
  for (const barId of barIds) {
    const parsed = parseColonTag(barId)
    if (!parsed) {
      throw new Error(`${barId} is not a bar tag`)
    }
    const [phaseName] = parsed

    if (!phaseExists(phaseName)) {
      throw new Error(`Phase ${phaseName} does not exist`)
    }
    // Get all bars in the phase
    const allPhaseBars = getAllPhaseBars(phaseName)

    // Find the first empty bar or create a new one
    let targetBarId: string | undefined

    // Check existing bars for empty ones
    for (const existingBarId of allPhaseBars) {
      const barNotes = mem().notesByBar[existingBarId]
      if (!barNotes || barNotes.length === 0) {
        targetBarId = existingBarId
        break
      }
    }
    // If no empty bar found, create a new one at the end
    if (targetBarId === undefined) {
      const lastBarIndex =
        allPhaseBars.length > 0
          ? parseInt(allPhaseBars[allPhaseBars.length - 1].split(':')[1])
          : -1
      const newBarIndex = lastBarIndex + 1
      targetBarId = `${phaseName}:${newBarIndex}`

      // Ensure the new bar exists in memory
      mem().notesByBar[targetBarId] = []
    }

    // Copy the notes from source bar to target bar
    copyBarNotesWithNoteIdsAndGroupIds(barId, targetBarId)
  }
}

declare global {
  interface Window {
    copyBarNotesToEndOfPhase: (
      barIds: string[],
      cb?: (arg: string[]) => void
    ) => void
  }
}
window.copyBarNotesToEndOfPhase = copyBarNotesToEndOfPhase_
export const copyBarNotesToEndOfPhase = window.copyBarNotesToEndOfPhase
