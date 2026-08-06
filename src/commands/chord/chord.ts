import { Module } from 'peprn/util'

import { mem } from '../../core/mem'
import { phaseScale } from '../../lib/helpers'
import { mixtureSuggestions } from '../../lib/mixture'
import { nextChord, nextChordDetail } from '../../lib/nextChord'
import type { ChordSuggestion } from '../../lib/nextChord'
import { pivotSuggestions } from '../../lib/pivots'
import { randomProgression } from '../../lib/randomProgression'
import { parseChordCsvArg } from '../../lib/util/barsUtil'
import { chordGraphCreate } from '../../lib/util/graphUtil'
import { figuredVoicings } from '../../lib/voiceLeading'
import type { RankedSuggestion } from '../../lib/voiceLeading'

// The CLI face of the 0.4.0 chord-assistance API. Every function it wraps is a
// pure library call; this module's whole job is key resolution, argument
// shaping and turning the library's deliberate throws into readable lines.
//
//   chord next Am --detail --mixture --smooth
//   chord sketch C --length 8 --seed 42
//   chord pivots Am
//   chord mixture
//   chord progressions A minor

type Key = { tonic: string; scale: string }

/**
 * Where the key comes from when the user does not say.
 *
 * Precedence: explicit --tonic/--scale, then the named --phase, then the most
 * recently added phase in mem(). The phase lookup goes through
 * `phaseScale(name, undefined, undefined, false)` — the same call the redwood
 * app makes — and the trailing `false` is load-bearing: it reads the phase's
 * key WITHOUT writing scale tags back onto its notes. Asking "what comes after
 * Am?" must never mutate the song.
 */
const resolveKey = (
  tonicArg: unknown,
  scaleArg: unknown,
  phaseArg: unknown
): { key: Key; source: string } | { error: string } => {
  const tonic = typeof tonicArg === 'string' ? tonicArg : undefined
  const scale = typeof scaleArg === 'string' ? scaleArg : undefined

  if (tonic && scale) {
    return { key: { tonic, scale }, source: 'flags' }
  }
  if (tonic || scale) {
    return {
      error: `--tonic and --scale must be given together (got ${
        tonic ? `--tonic ${tonic}` : `--scale ${scale}`
      }); or omit both to use the phase's key`,
    }
  }

  const phases = mem().phases
  const phaseNames = Object.keys(phases)
  const requested = typeof phaseArg === 'string' ? phaseArg : undefined

  if (requested && !phases[requested]) {
    return {
      error: `phase '${requested}' not found${
        phaseNames.length
          ? ` — known phases: ${phaseNames.join(', ')}`
          : ' — no phases exist yet'
      }`,
    }
  }

  // "most recent" is insertion order of mem().phases, which is the order the
  // phases were created in. Documented rather than clever: pass --phase when
  // that is not the one you mean.
  const phaseName = requested ?? phaseNames[phaseNames.length - 1]

  if (!phaseName) {
    return {
      error:
        'no key to work in: pass --tonic and --scale (e.g. --tonic A --scale minor), or create a phase and set its scale first',
    }
  }

  const { scaleTonic, scaleName } = phaseScale(
    phaseName,
    undefined,
    undefined,
    false
  )

  if (!scaleTonic || !scaleName) {
    return {
      error: `phase '${phaseName}' has no scale set — run 'phase ${phaseName} scale <tonic> <scale>', or pass --tonic and --scale here`,
    }
  }

  return {
    key: { tonic: scaleTonic, scale: scaleName },
    source: `phase ${phaseName}`,
  }
}

const keyLabel = (key: Key) => `${key.tonic} ${key.scale}`

/**
 * The library throws for chords that are not nodes in the key's graph, and for
 * strings that are not chords at all. Both are expected user input at a CLI, so
 * the raw internal wording ("could not obtain Cmaj7,3 in graph for A minor") is
 * rewritten into something a player can act on.
 */
const explain = (err: unknown, chord: string, key: Key): string => {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('in graph for')) {
    return `${chord} is not part of the ${keyLabel(key)} chord map — try 'chord progressions ${key.tonic} ${key.scale}' to see which chords are`
  }
  if (msg.includes('could not get chord name')) {
    return `'${chord}' is not a chord name`
  }
  if (msg.includes('Invalid scale name') || msg.includes('Unrecognized scale')) {
    return `${keyLabel(key)} is not a key ollave can build a chord map for — major and minor keys are supported`
  }
  if (msg.includes('Unsupported mode')) {
    return `${keyLabel(key)} is not supported — chord maps exist only for major and minor keys`
  }
  return msg
}

/** first positional, as a chord name; positionals arrive numberized sometimes */
const firstPositional = (args: {
  positionalNonCommands: (string | number)[]
}): string | undefined => {
  const [first] = args.positionalNonCommands
  return first === undefined ? undefined : String(first)
}

/**
 * The voicing to measure smoothness FROM, derived from the input chord itself.
 *
 * `rankByVoiceLeading` requires a `fromVoicing` and throws without one, but
 * making the user type ['A3','C4','E4'] to ask a one-line question is a bad
 * trade. `parseChordCsvArg` already resolves a chord name to real pitches in a
 * key — including the chord-function names V64/N6/Aug6, which have no spelling
 * of their own — so the chord the user named supplies its own root-position
 * voicing. Octave 3 matches the library's own default.
 */
const voicingFor = (chord: string, key: Key): string[] | null => {
  try {
    const [notes] = parseChordCsvArg(`${chord},3`, keyLabel(key))
    return notes.length > 0 ? notes : null
  } catch {
    return null
  }
}

const isRanked = (sug: ChordSuggestion): sug is RankedSuggestion =>
  typeof (sug as RankedSuggestion).distance === 'number'

/**
 * one detail line: 'Dm   IVm    strong   D3 F3 A3   d2'
 *
 * For a FIGURED suggestion the notes column shows the chord voiced with the
 * figured bass ('C  I6  dotted  E3 G3 C4  bass=E') rather than in root
 * position. Showing root-position notes beside the roman 'I6' would state the
 * inversion and then contradict it, which is the one thing this line must not
 * do — the bass is the entire content of the suggestion.
 */
const formatSuggestion = (sug: ChordSuggestion): string => {
  const figured =
    sug.figure && !isRanked(sug)
      ? figuredVoicings(sug.name, sug.figure, { minOctave: 3, maxOctave: 3 })[0]
      : undefined
  const parts = [
    sug.name,
    sug.roman,
    sug.strength,
    (isRanked(sug) ? sug.suggestedVoicing : (figured ?? sug.notes)).join(' '),
  ]
  if (sug.bass) {
    parts.push(`bass=${sug.bass}`)
  }
  if (isRanked(sug)) {
    parts.push(`d${sug.distance}`)
  }
  if (sug.contextMatch !== undefined) {
    parts.push(sug.contextMatch ? 'context' : '-')
  }
  return parts.join('  ')
}

const nextFn = async (args: {
  positionalNonCommands: (string | number)[]
  detail?: boolean
  mixture?: boolean
  smooth?: boolean
  prev?: string | string[]
  tonic?: string
  scale?: string
  phase?: string
}) => {
  const chord = firstPositional(args)
  if (!chord) {
    return { formatted: { error: 'usage: chord next <chordName>' } }
  }

  const resolved = resolveKey(args.tonic, args.scale, args.phase)
  if ('error' in resolved) {
    return { formatted: { error: resolved.error } }
  }
  const { key } = resolved

  // --mixture and --smooth are only expressible through the detail call, so
  // either one implies --detail rather than being silently ignored.
  const wantDetail = !!(args.detail || args.mixture || args.smooth)

  const prev =
    args.prev === undefined
      ? undefined
      : (Array.isArray(args.prev) ? args.prev : [args.prev]).map(String)

  try {
    if (!wantDetail) {
      const names = nextChord(`${chord},3`, key.tonic, key.scale)
      return {
        formatted: {
          key: keyLabel(key),
          from: chord,
          next: names,
        },
      }
    }

    let fromVoicing: string[] | undefined
    if (args.smooth) {
      const derived = voicingFor(chord, key)
      if (!derived) {
        return {
          formatted: {
            error: `--smooth needs the notes of ${chord}, which could not be resolved in ${keyLabel(key)}`,
          },
        }
      }
      fromVoicing = derived
    }

    const suggestions = nextChordDetail(`${chord},3`, key.tonic, key.scale, {
      ...(prev ? { prev } : {}),
      ...(args.mixture ? { include: ['mixture' as const] } : {}),
      ...(fromVoicing ? { rankBy: 'voiceLeading' as const, fromVoicing } : {}),
    })

    return {
      formatted: {
        key: keyLabel(key),
        from: fromVoicing ? `${chord} (${fromVoicing.join(' ')})` : chord,
        next: suggestions.map(formatSuggestion),
      },
    }
  } catch (err) {
    return { formatted: { error: explain(err, chord, key) } }
  }
}

const sketchFn = async (args: {
  positionalNonCommands: (string | number)[]
  length?: number
  seed?: number
  dotted?: number
  tonic?: string
  scale?: string
  phase?: string
}) => {
  const chord = firstPositional(args)
  if (!chord) {
    return { formatted: { error: 'usage: chord sketch <startChord>' } }
  }

  const resolved = resolveKey(args.tonic, args.scale, args.phase)
  if ('error' in resolved) {
    return { formatted: { error: resolved.error } }
  }
  const { key } = resolved

  const length =
    typeof args.length === 'number' && args.length > 0 ? args.length : 8

  try {
    const names = randomProgression(
      `${chord},3`,
      key.tonic,
      key.scale,
      length,
      {
        ...(typeof args.seed === 'number' ? { seed: args.seed } : {}),
        ...(typeof args.dotted === 'number'
          ? { weights: { dotted: args.dotted } }
          : {}),
      }
    )

    return {
      formatted: {
        key: keyLabel(key),
        // a walk can legitimately stop short of `length` when a chord has
        // nowhere left to go; say so rather than looking truncated
        ...(names.length < length
          ? { note: `walk ended after ${names.length} of ${length} chords` }
          : {}),
        progression: names.join(' '),
        ...(typeof args.seed === 'number' ? { seed: args.seed } : {}),
      },
    }
  } catch (err) {
    return { formatted: { error: explain(err, chord, key) } }
  }
}

const pivotsFn = async (args: {
  positionalNonCommands: (string | number)[]
  tonic?: string
  scale?: string
  phase?: string
}) => {
  const chord = firstPositional(args)
  if (!chord) {
    return { formatted: { error: 'usage: chord pivots <chordName>' } }
  }

  const resolved = resolveKey(args.tonic, args.scale, args.phase)
  if ('error' in resolved) {
    return { formatted: { error: resolved.error } }
  }
  const { key } = resolved

  try {
    const pivots = pivotSuggestions(chord, key.tonic, key.scale)
    if (pivots.length === 0) {
      return {
        formatted: {
          key: keyLabel(key),
          pivots: `${chord} belongs to no other major or minor key`,
        },
      }
    }
    return {
      formatted: {
        key: keyLabel(key),
        from: chord,
        // 'C major  VIm  4 continuations'
        pivots: pivots.map(
          (p) =>
            `${p.targetKey}  ${p.romanThere}  ${p.follow.length} continuation${
              p.follow.length === 1 ? '' : 's'
            }`
        ),
      },
    }
  } catch (err) {
    return { formatted: { error: explain(err, chord, key) } }
  }
}

const mixtureFn = async (args: {
  positionalNonCommands: (string | number)[]
  tonic?: string
  scale?: string
  phase?: string
}) => {
  const resolved = resolveKey(args.tonic, args.scale, args.phase)
  if ('error' in resolved) {
    return { formatted: { error: resolved.error } }
  }
  const { key } = resolved

  try {
    const borrowed = mixtureSuggestions(key.tonic, key.scale)
    if (borrowed.length === 0) {
      return {
        formatted: {
          key: keyLabel(key),
          // mixture returns [] for unsupported modes rather than throwing
          mixture: `no borrowed chords are defined for ${keyLabel(key)}`,
        },
      }
    }
    return {
      formatted: {
        key: keyLabel(key),
        mixture: borrowed.map((s) => `${s.roman}=${s.name}  ${s.notes.join(' ')}`),
      },
    }
  } catch (err) {
    return { formatted: { error: explain(err, keyLabel(key), key) } }
  }
}

/**
 * `chord progressions <tonic> <scale>` — every chord in the key's map with its
 * roman numeral.
 *
 * This subcommand exists because `getTriadByRomanNumeral` in lib/graphh.ts has
 * always called `fakeCli('chord progressions <tonic> <scale>')`, a command that
 * never existed — so that function threw on its first line for its whole life.
 * The shape below is dictated by that caller: it reads `.formatted[0]` and
 * expects an object whose values are `{ roman, chordName }`. Hence formatted is
 * an ARRAY whose single element is that object, which is why this one
 * subcommand's return shape differs from its siblings.
 */
const progressionsFn = async (args: {
  positionalNonCommands: (string | number)[]
  tonic?: string
  scale?: string
  phase?: string
}) => {
  const [tonicArg, scaleArg] = args.positionalNonCommands.map((a) => String(a))

  const resolved = resolveKey(
    tonicArg ?? args.tonic,
    scaleArg ?? args.scale,
    args.phase
  )
  if ('error' in resolved) {
    return { formatted: { error: resolved.error } }
  }
  const { key } = resolved

  try {
    const graph = chordGraphCreate(key.tonic, key.scale)
    // `formatted` on the graph is a non-enumerable self-reference, so plain
    // enumeration already excludes it.
    const entries: { [idx: string]: { roman: string; chordName: string } } = {}
    // iterate keys, not entries: the graph's declared type includes its own
    // `formatted` self-reference, which widens the entry value type
    Object.keys(graph).forEach((chordName, idx) => {
      entries[idx] = { roman: graph[chordName].roman, chordName }
    })
    return { formatted: [entries] }
  } catch (err) {
    return { formatted: { error: explain(err, keyLabel(key), key) } }
  }
}

export default {
  help: {
    description:
      'Ask what can follow a chord: continuations, borrowed colour, pivots and sketches',
    examples: {
      'next Am': 'Chords that can follow Am (key comes from the current phase)',
      'next Am --detail': 'Same, with roman numeral, strength and notes',
      'next C --tonic C --scale major --mixture': 'Include borrowed chords',
      'next C --smooth': 'Order by how little the voices have to move',
      'next Bdim --detail --prev F': 'Rank by what came before',
      'sketch C --length 8 --seed 42': 'A reproducible eight-chord walk',
      'pivots Am': 'Keys this chord could modulate into',
      mixture: 'Borrowed chords available in the current key',
      'progressions A minor': 'Every chord in the key, with roman numerals',
    },
  },
  yargs: {
    detail: { alias: 'd', type: 'boolean' },
    mixture: { alias: 'm', type: 'boolean' },
    smooth: { alias: 's', type: 'boolean' },
    prev: { alias: 'p', type: 'string' },
    tonic: { alias: 't', type: 'string' },
    scale: { alias: 'k', type: 'string' },
    phase: { alias: 'f', type: 'string' },
    length: { alias: 'l', type: 'number' },
    seed: { alias: 'e', type: 'number' },
    dotted: { alias: 'o', type: 'number' },
  },
  fn: async () => {
    return {
      formatted: {
        usage:
          'chord next <chord> [-d|-m|-s] [--prev <chord>] | chord sketch <chord> [--length n] [--seed n] | chord pivots <chord> | chord mixture | chord progressions <tonic> <scale>',
        key: 'key defaults to the current phase\'s scale; override with --tonic and --scale',
      },
    }
  },
  submodules: {
    next: { fn: nextFn },
    sketch: { fn: sketchFn },
    pivots: { fn: pivotsFn },
    mixture: { fn: mixtureFn },
    progressions: { fn: progressionsFn },
  },
} as Module
