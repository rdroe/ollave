import { createApp } from 'peprn/node'
import { beforeEach, describe, expect, it } from 'vitest'

import { mem } from '../../core/mem'
import { getTriadByRomanNumeral } from '../../lib/graphh'

import chord from './chord'

// The command surface is exercised by calling each submodule's `fn` directly
// with a fabricated ParsedCli-shaped object, the same way peprn would.

type Args = Record<string, unknown> & {
  positionalNonCommands: (string | number)[]
}

const sub = (name: string) => {
  const mod = chord.submodules?.[name]
  if (!mod?.fn) throw new Error(`no submodule ${name}`)
  return mod.fn
}

const call = async (name: string, args: Partial<Args> = {}) =>
  (await sub(name)(
    { positionalNonCommands: [], ...args } as never,
    undefined,
    undefined,
    undefined
  )) as { formatted: Record<string, unknown> | unknown[] }

/** the `formatted` object, narrowed for assertion */
const fmt = async (name: string, args: Partial<Args> = {}) => {
  const res = await call(name, args)
  return res.formatted as Record<string, unknown>
}

const addPhase = (
  name: string,
  scaleTonic: string | null,
  scaleName: string | null
) => {
  mem().phases[name] = {
    id: Object.keys(mem().phases).length + 1,
    name,
    scaleTonic,
    scaleName,
    'follows-ids': [],
    barSizeMultiplier: null,
  }
}

beforeEach(() => {
  mem().phases = {}
})

describe('chord next', () => {
  it('lists names for a chord in the key', async () => {
    const f = await fmt('next', {
      positionalNonCommands: ['Am'],
      tonic: 'A',
      scale: 'minor',
    })
    expect(f.key).toBe('A minor')
    expect(f.next).toEqual([
      'Am',
      'Dm',
      'G',
      'C',
      'F',
      'Bdim',
      'V64',
      'G#dim',
      'E',
    ])
  })

  it('--detail adds roman, strength and notes', async () => {
    const f = await fmt('next', {
      positionalNonCommands: ['Am'],
      tonic: 'A',
      scale: 'minor',
      detail: true,
    })
    const lines = f.next as string[]
    expect(lines[0]).toBe('Am  Im  strong  A3 C4 E4')
  })

  it('--detail shows dotted edges that the names-only call omits', async () => {
    // E in A minor has one strong edge (Am); the dotted ones are the Picardy
    // third and the two sevenths — the names-only call still shows just Am
    const names = await fmt('next', {
      positionalNonCommands: ['E'],
      tonic: 'A',
      scale: 'minor',
    })
    expect(names.next).toEqual(['Am'])

    const detail = await fmt('next', {
      positionalNonCommands: ['E'],
      tonic: 'A',
      scale: 'minor',
      detail: true,
    })
    // Stage M-A: the inversions join the dotted layer. Each figured line shows
    // the chord voiced with the FIGURED bass and names that bass, so the notes
    // column never contradicts the roman.
    expect(detail.next).toEqual([
      'Am  Im  strong  A3 C4 E4',
      'A  I  dotted  A3 C#4 E4',
      'E7  V7  dotted  E3 G#3 B3 D4',
      'Am7  Im7  dotted  A3 C4 E4 G4',
      'Am  Im6  dotted  C3 E3 A3  bass=C',
      'E7  V65  dotted  G#3 B3 D4 E4  bass=G#',
      'E7  V43  dotted  B3 D4 E4 G#4  bass=B',
      'E7  V42  dotted  D3 E3 G#3 B3  bass=D',
    ])
  })

  it('--mixture implies detail and appends borrowed chords', async () => {
    const f = await fmt('next', {
      positionalNonCommands: ['C'],
      tonic: 'C',
      scale: 'major',
      mixture: true,
    })
    const lines = f.next as string[]
    expect(lines.some((l) => l.startsWith('Fm  iv  mixture'))).toBe(true)
  })

  it('--smooth derives fromVoicing from the chord and ranks by distance', async () => {
    const f = await fmt('next', {
      positionalNonCommands: ['C'],
      tonic: 'C',
      scale: 'major',
      smooth: true,
    })
    // the voicing was derived, not supplied
    expect(f.from).toBe('C (C3 E3 G3)')
    const lines = f.next as string[]
    // every line carries a distance, and they are non-decreasing
    const distances = lines.map((l) => {
      const m = l.match(/ d(\d+)/)
      return m ? Number(m[1]) : -1
    })
    expect(distances.every((d) => d >= 0)).toBe(true)
    expect([...distances].sort((a, b) => a - b)).toEqual(distances)
  })

  it('--prev annotates context matches and sorts them first', async () => {
    const f = await fmt('next', {
      positionalNonCommands: ['Bdim'],
      tonic: 'A',
      scale: 'minor',
      detail: true,
      prev: 'Am',
    })
    const lines = f.next as string[]
    expect(lines[0]).toContain('context')
    expect(lines.some((l) => l.trimEnd().endsWith('-'))).toBe(true)
  })

  it('reports a chord that is not in the key map without throwing', async () => {
    const f = await fmt('next', {
      positionalNonCommands: ['Cmaj7'],
      tonic: 'A',
      scale: 'minor',
    })
    expect(f.error).toBe(
      "Cmaj7 is not part of the A minor chord map — try 'chord progressions A minor' to see which chords are"
    )
  })

  it('reports a string that is not a chord at all', async () => {
    const f = await fmt('next', {
      positionalNonCommands: ['Fun'],
      tonic: 'A',
      scale: 'minor',
    })
    expect(f.error).toBe("'Fun' is not a chord name")
  })

  it('requires --tonic and --scale together', async () => {
    const f = await fmt('next', {
      positionalNonCommands: ['Am'],
      tonic: 'A',
    })
    expect(f.error).toContain('must be given together')
  })
})

describe('key resolution', () => {
  it('falls back to the most recent phase scale', async () => {
    addPhase('alpha', 'C', 'major')
    addPhase('omega', 'A', 'minor')
    const f = await fmt('next', { positionalNonCommands: ['Am'] })
    expect(f.key).toBe('A minor')
  })

  it('--phase selects a specific phase', async () => {
    addPhase('alpha', 'C', 'major')
    addPhase('omega', 'A', 'minor')
    const f = await fmt('next', {
      positionalNonCommands: ['C'],
      phase: 'alpha',
    })
    expect(f.key).toBe('C major')
  })

  it('does not mutate the phase it reads the key from', async () => {
    addPhase('alpha', 'C', 'major')
    await fmt('next', { positionalNonCommands: ['C'] })
    expect(mem().phases.alpha.scaleTonic).toBe('C')
    expect(mem().phases.alpha.scaleName).toBe('major')
  })

  it('explains when no phase exists', async () => {
    const f = await fmt('next', { positionalNonCommands: ['Am'] })
    expect(f.error).toContain('no key to work in')
  })

  it('explains when the phase has no scale set', async () => {
    addPhase('alpha', null, null)
    const f = await fmt('next', { positionalNonCommands: ['Am'] })
    expect(f.error).toContain("phase 'alpha' has no scale set")
  })

  it('explains when a named phase does not exist', async () => {
    addPhase('alpha', 'C', 'major')
    const f = await fmt('next', {
      positionalNonCommands: ['C'],
      phase: 'nope',
    })
    expect(f.error).toContain("phase 'nope' not found")
    expect(f.error).toContain('alpha')
  })
})

describe('chord sketch', () => {
  it('is deterministic for a given seed', async () => {
    const args = {
      positionalNonCommands: ['C'],
      tonic: 'C',
      scale: 'major',
      seed: 42,
      length: 8,
    }
    const a = await fmt('sketch', args)
    const b = await fmt('sketch', args)
    expect(a.progression).toBe(b.progression)
    // the seeded walk shifted when the sevenths were promoted, and again when
    // Stage M-A added the inversion edges: new dotted edges are extra weighted
    // choices, so a given seed lands differently. Determinism (a === b above)
    // is the property under test and is unaffected.
    expect(a.progression).toBe('C G G7 C G C Bdim C')
    expect(a.seed).toBe(42)
  })

  it('defaults to eight chords', async () => {
    // Seed changed from 12345 to 1 for Stage M-A. The default LENGTH is what
    // this test is about, and eight is still the default — but a walk may
    // legitimately stop short when it reaches a terminal node, and 12345 now
    // ends on the Picardy 'A' after six chords (it has no outgoing edges of
    // its own). Seed 1 completes, so the assertion measures the default rather
    // than the dead-end policy, which randomProgression.test.ts covers.
    const f = await fmt('sketch', {
      positionalNonCommands: ['Am'],
      tonic: 'A',
      scale: 'minor',
      seed: 1,
    })
    expect((f.progression as string).split(' ')).toHaveLength(8)
  })

  it('honours --length and --dotted', async () => {
    const f = await fmt('sketch', {
      positionalNonCommands: ['C'],
      tonic: 'C',
      scale: 'major',
      seed: 7,
      length: 4,
      dotted: 10,
    })
    expect((f.progression as string).split(' ')).toHaveLength(4)
  })

  it('reports a start chord outside the key map', async () => {
    const f = await fmt('sketch', {
      positionalNonCommands: ['Cmaj7'],
      tonic: 'A',
      scale: 'minor',
    })
    expect(f.error).toContain('not part of the A minor chord map')
  })
})

describe('chord pivots', () => {
  it('lists target key, role and follow count', async () => {
    const f = await fmt('pivots', {
      positionalNonCommands: ['Am'],
      tonic: 'A',
      scale: 'minor',
    })
    // continuation counts include the dotted seventh edges added when the
    // sevenths became chart nodes, and (Stage M-B) the three dotted
    // augmented-sixth edges the predominants now carry in BOTH charts. Only
    // the two predominant rows moved (+3 each): Am is iv in E minor and ii in
    // G major, but vi/v/iii elsewhere, and those are not predominants.
    expect(f.pivots).toEqual([
      'C major  VIm  6 continuations',
      'D minor  Vm  0 continuations',
      'E minor  IVm  17 continuations',
      'F major  IIIm  7 continuations',
      'G major  IIm  16 continuations',
    ])
  })
})

describe('chord mixture', () => {
  it('lists borrowed chords for the key', async () => {
    const f = await fmt('mixture', { tonic: 'C', scale: 'major' })
    expect(f.mixture).toEqual([
      'iv=Fm  F3 Ab3 C4',
      'ii°=Ddim  D3 F3 Ab3',
      'bIII=Eb  Eb3 G3 Bb3',
      'bVI=Ab  Ab3 C4 Eb4',
      'bVII=Bb  Bb3 D4 F4',
    ])
  })

  it('uses the phase key when no flags are given', async () => {
    addPhase('alpha', 'A', 'minor')
    const f = await fmt('mixture')
    expect(f.key).toBe('A minor')
    expect(f.mixture).toEqual(['IV=D  D3 F#3 A3'])
  })
})

describe('chord progressions', () => {
  it('returns formatted[0] as a roman/chordName map', async () => {
    const res = await call('progressions', {
      positionalNonCommands: ['A', 'minor'],
    })
    const entries = (res.formatted as unknown[])[0] as {
      [idx: string]: { roman: string; chordName: string }
    }
    expect(entries['0']).toEqual({ roman: 'Im', chordName: 'Am' })
    expect(Object.values(entries)).toContainEqual({
      roman: 'V',
      chordName: 'E',
    })
  })

  // The reason this subcommand exists: getTriadByRomanNumeral has called
  // `fakeCli('chord progressions ...')` since it was written, against a command
  // that never existed, so it threw on its first line for its whole life. This
  // registers a real peprn app carrying the module — the same wiring myapp.ts
  // does — and drives the library function through the CLI it always assumed.
  it('makes getTriadByRomanNumeral work', async () => {
    await createApp({ id: 'cli', modules: { chord } } as never)

    expect(await getTriadByRomanNumeral('A', 'minor', 'Im')).toBe('Am')
    expect(await getTriadByRomanNumeral('A', 'minor', 'V')).toBe('E')
    expect(await getTriadByRomanNumeral('C', 'major', 'I')).toBe('C')
    // it lowercases the scale name before dispatching, so 'Minor' works too
    expect(await getTriadByRomanNumeral('A', 'Minor', 'IVm')).toBe('Dm')
  })

  it('getTriadByRomanNumeral still throws for an absent roman numeral', async () => {
    await createApp({ id: 'cli', modules: { chord } } as never)
    await expect(
      getTriadByRomanNumeral('A', 'minor', 'bIX')
    ).rejects.toThrow('Could not find triad for roman numeral bIX')
  })
})

describe('chord (bare)', () => {
  it('returns usage text', async () => {
    const res = (await chord.fn?.(
      { positionalNonCommands: [] } as never,
      undefined,
      undefined,
      undefined
    )) as { formatted: Record<string, unknown> }
    expect(res.formatted.usage).toContain('chord next')
  })
})
