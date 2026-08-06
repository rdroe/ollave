import { describe, expect, it } from 'vitest'

// Guards against module-init landmines: these modules must be importable
// without dragging in browser-only side effects (music.ts constructs a
// Tone.js Piano and starts loading samples at module scope). A failure here
// usually means someone imported a barrel ('..', '../lib', '../../core')
// instead of the concrete module — the same class of bug as the prod init
// cycle fixed in e302ee7.
describe('lib modules import without browser-only side effects', () => {
  it('imports graphh', async () => {
    const mod = await import('./graphh')
    expect(typeof mod.chordNameWithNotes).toBe('function')
  })
  it('imports graphUtil', async () => {
    const mod = await import('./util/graphUtil')
    expect(typeof mod.chordGraphCreate).toBe('function')
  })
  it('imports nextChord', async () => {
    const mod = await import('./nextChord')
    expect(typeof mod.nextChord).toBe('function')
  })
  it('imports barsUtil', async () => {
    const mod = await import('./util/barsUtil')
    expect(typeof mod.parseChordCsvArg).toBe('function')
  })
  it('imports addChord', async () => {
    const mod = await import('./addChord')
    expect(typeof mod.addChord).toBe('function')
  })
  it('imports voiceLeading', async () => {
    const mod = await import('./voiceLeading')
    expect(typeof mod.rankByVoiceLeading).toBe('function')
  })
  it('imports mixture', async () => {
    const mod = await import('./mixture')
    expect(typeof mod.mixtureSuggestions).toBe('function')
  })
  it('imports pivots', async () => {
    const mod = await import('./pivots')
    expect(typeof mod.pivotSuggestions).toBe('function')
  })
  it('imports randomProgression', async () => {
    const mod = await import('./randomProgression')
    expect(typeof mod.randomProgressionDetail).toBe('function')
  })

  // nextChord now imports mixture and voiceLeading AT RUNTIME for its
  // convenience options, while barsUtil (which nextChord also imports) imports
  // voiceLeading for smooth voicing. That is a cycle unless the shared
  // `ChordSuggestion` type stays in its own zero-import module — importing
  // voiceLeading FIRST is the order that would expose a half-initialized
  // nextChord binding if the loop were ever closed.
  it('imports voiceLeading before nextChord without a partial-init failure', async () => {
    const vl = await import('./voiceLeading')
    const nc = await import('./nextChord')
    expect(typeof vl.rankByVoiceLeading).toBe('function')
    expect(typeof nc.nextChordDetail).toBe('function')
    // exercise the composed path end to end
    const sugs = nc.nextChordDetail('Am,3', 'A', 'minor', {
      include: ['mixture'],
      rankBy: 'voiceLeading',
      fromVoicing: ['A3', 'C4', 'E4'],
    })
    expect(sugs.length).toBeGreaterThan(0)
  })

  it('has no runtime edge from voiceLeading or mixture back to nextChord', async () => {
    // structural assertion on the SOURCE: the cycle is prevented by these two
    // modules never naming nextChord, not by luck of evaluation order.
    const { readFileSync } = await import('node:fs')
    for (const file of ['voiceLeading', 'mixture']) {
      const src = readFileSync(`src/lib/${file}.ts`, 'utf8')
      const imports = src
        .split('\n')
        .filter((l) => /^import\s/.test(l))
        .join('\n')
      expect(imports, `${file}.ts must not import nextChord`).not.toMatch(
        /from '\.\/nextChord'/
      )
    }
  })
})
