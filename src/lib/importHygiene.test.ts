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
})
