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
      // Stage M-C (C2): the deceptive resolution V -> VI
      'F  VI  dotted  F3 A3 C4',
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
    //
    // Stage M-C (C2) moved E minor alone, 17 -> 19: Am is `IVm` there and the
    // minor chart's iv gained two cadence edges (`IVm -> Im`, the plagal
    // close, and `IVm6`, the Phrygian half cadence's approach). G major is
    // unchanged because the MAJOR chart was not touched — which is the check
    // worth having in this row.
    expect(f.pivots).toEqual([
      'C major  VIm  6 continuations',
      'D minor  Vm  0 continuations',
      'E minor  IVm  19 continuations',
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

// ---------------------------------------------------------------------------
// Stage M-C — the composed capabilities
// ---------------------------------------------------------------------------

describe('chord cadence', () => {
  it('writes a four-bar phrase to a cadence, in four voices and in the bar', async () => {
    const f = await fmt('cadence', {
      positionalNonCommands: ['C'],
      to: 'PAC',
      bars: 4,
      tonic: 'C',
      scale: 'major',
    })
    expect(f.key).toBe('C major')
    expect(f.cadence).toBe('perfect authentic cadence')
    expect(f.summary).toBe('I - IIm - V - I')
    // roman, chord, figure, function, four voices, metric placement
    expect(f.bars).toEqual([
      'I         C      53  T  C3 C4 E4 G4          b0+0 downbeat',
      'IIm       Dm     53  PD D3 A3 D4 F4          b0+128 beat',
      'V         G      53  D  G3 B3 D4 G4          b0+256 secondary',
      'I         C      53  T  C3 C4 E4 G4          b0+384 beat',
    ])
    expect(f.legal).toBe('no voice-leading violations')
  })

  it('shows the figure in the roman, which is the Phrygian cadence itself', async () => {
    // routable only because of C2, and the '6' is the device — the bass falls a
    // semitone from b6 to 5
    const f = await fmt('cadence', {
      positionalNonCommands: ['Am'],
      to: 'phrygian-half',
      bars: 3,
      tonic: 'A',
      scale: 'minor',
    })
    expect(f.summary).toBe('Im - IVm6 - V')
    expect((f.bars as string[])[1]).toBe(
      'IVm6      Dm     6   PD F2 D3 A3 D4          b0+128 beat'
    )
  })

  it('names the cadence types it accepts rather than failing silently', async () => {
    const f = await fmt('cadence', {
      positionalNonCommands: ['C'],
      to: 'bogus',
      tonic: 'C',
      scale: 'major',
    })
    expect(f.error).toContain('--to must be one of')
    expect(f.error).toContain('PAC')
  })

  it('reports an impossible request rather than throwing', async () => {
    const f = await fmt('cadence', {
      positionalNonCommands: ['C'],
      to: 'phrygian-half',
      tonic: 'C',
      scale: 'major',
    })
    expect(f.incomplete).toContain('does not exist in major')
    expect(f.bars).toBeUndefined()
  })
})

describe('chord modulate', () => {
  it('names the pivot in BOTH keys — the point of the feature', async () => {
    const f = await fmt('modulate', {
      positionalNonCommands: ['Am'],
      key: 'C major',
      to: 'PAC',
      bars: 4,
      tonic: 'A',
      scale: 'minor',
    })
    expect(f.key).toBe('A minor -> C major')
    expect(f.summary).toBe('Im - IVm=IIm - V - I')
    expect(f.pivot).toBe('Dm  IVm / IIm  (diatonic, bar 2)')
    expect(f.legal).toBe('no voice-leading violations')
  })

  it('routes the enharmonic modulation, which needs the chromatic pivots', async () => {
    // C major and Db major share no diatonic chord; without C1's sources this
    // is `no-pivot-available`. Chromatic sources are on by default here.
    const f = await fmt('modulate', {
      positionalNonCommands: ['C'],
      key: 'Db major',
      bars: 4,
      tonic: 'C',
      scale: 'major',
    })
    expect(f.summary).toBe('I - IIm - Ger6=V7 - I')
    // the two spellings, which is what an enharmonic pivot IS
    expect(f.pivot).toBe('Ger6 = Ab7  Ger6 / V7  (enharmonic, bar 3)')
    expect((f.notes as string[]).join(' ')).toContain('respelling F# as Gb')
  })

  it('--diatonic drops the chromatic sources', async () => {
    const f = await fmt('modulate', {
      positionalNonCommands: ['C'],
      key: 'Db major',
      bars: 4,
      diatonic: true,
      tonic: 'C',
      scale: 'major',
    })
    // and then the modulation is honestly unavailable
    expect(f.incomplete).toContain('no pivot')
    expect(f.summary).toBeUndefined()
  })

  it('explains the --key format rather than guessing', async () => {
    const f = await fmt('modulate', {
      positionalNonCommands: ['C'],
      tonic: 'C',
      scale: 'major',
    })
    expect(f.error).toContain('--key must name the target key')
  })
})

describe('chord realize', () => {
  it('writes four voices for chords the composer already has', async () => {
    const f = await fmt('realize', {
      positionalNonCommands: ['C,F,G,C'],
      tonic: 'C',
      scale: 'major',
    })
    expect(f.bars).toEqual([
      'C      53  C3 C4 E4 G4          b0+0 downbeat',
      'F      53  F3 C4 F4 A4          b0+128 beat',
      'G      53  G3 B3 D4 G4          b0+256 secondary',
      'C      53  C3 C4 E4 G4          b0+384 beat',
    ])
    expect(f.legal).toBe('no voice-leading violations')
  })

  it("realizes one of the library's own spans, with its own waivers", async () => {
    const f = await fmt('realize', {
      span: 'fauxbourdon',
      tonic: 'C',
      scale: 'major',
    })
    expect(f.span).toBe('fauxbourdon')
    expect(f.summary).toBe('I6 - VIIdim6 - VIm6 - V6')
    expect((f.notes as string[]).join(' ')).toContain('waived for this span')
    // a span is a texture, not a close, so no cadence is claimed for it
    expect(f.cadence).toBeUndefined()
  })

  it('lists the spans it knows when given one it does not', async () => {
    const f = await fmt('realize', { span: 'nope', tonic: 'C', scale: 'major' })
    expect(f.error).toContain('fauxbourdon')
    expect(f.error).toContain('descending-fifths')
  })
})

describe('chord analyze', () => {
  it('labels the cadences in music the composer already wrote', async () => {
    const f = await fmt('analyze', {
      positionalNonCommands: ['C,F,Dm,G,Am,F,G,C'],
      tonic: 'C',
      scale: 'major',
    })
    expect(f.progression).toBe('C F Dm G Am F G C')
    const lines = f.cadences as string[]
    // the deceptive cadence, at full confidence
    expect(lines).toContain('bar 4-5  deceptive cadence  V -> VIm  (G Am)  high')
    // and the closing one, DOWNGRADED with its reason printed rather than
    // swallowed — refusing to overclaim is the feature
    expect(lines.some((l) => l.includes('imperfect authentic') && l.includes('medium'))).toBe(true)
    expect(lines.some((l) => l.includes('No soprano supplied'))).toBe(true)
  })

  it('says so when nothing closes', async () => {
    const f = await fmt('analyze', {
      positionalNonCommands: ['C,Em'],
      tonic: 'C',
      scale: 'major',
    })
    expect(f.cadences).toContain('no cadence found')
  })
})
