import { describe, expect, it } from 'vitest'

import { compileGesturesToNotes, sanitizePassthroughTags } from './compile'
import { CompileCtx, Gesture } from './schemas'

/**
 * passthroughTags — the "loss-preserving" half of legacy-bar synthesis.
 *
 * Musical/user tags must survive a synthesize/compile round trip, but a stored
 * tag must never be able to set identity or placement keys: doing so would let
 * an old noteId alias a live note, or link a bar document into a reusable
 * template's propagation.
 */

const ctx: CompileCtx = {
  phaseName: 'verse',
  scaleTonic: 'A',
  scaleName: 'minor',
  barSizeMultiplier: 1,
  octave: '3',
}

const gestureWith = (passthroughTags: string[]): Gesture => ({
  id: 'g1',
  startStep: 0,
  source: { kind: 'voicing', pitches: ['C3', 'E3'] },
  mode: 'strum',
  direction: 'down',
  spread: 'tight',
  velocity: 90,
  durationTicks: 128,
  attacks: [
    {
      offsetTicks: 0,
      selection: { kind: 'all' },
      action: { kind: 'pluck' },
      passthroughTags,
    },
  ],
})

const tagKeys = (tags: string[]) =>
  tags.map((t) => (t.includes('=') ? t.slice(0, t.indexOf('=')) : t))

describe('sanitizePassthroughTags', () => {
  it('keeps ordinary musical and user tags', () => {
    expect(sanitizePassthroughTags(['mood=calm', 'articulation=legato'], [])).toEqual(
      ['mood=calm', 'articulation=legato']
    )
  })

  it('strips every identity and placement key', () => {
    const stripped = sanitizePassthroughTags(
      [
        'noteId=old',
        'groupId=old',
        'layer=old',
        'barId=intro:0',
        'gestureId=old',
        'custom=true',
        'customBar=name',
        'customBarId=3',
        'customBarInstance=xyz',
        'mood=calm',
      ],
      []
    )

    expect(stripped).toEqual(['mood=calm'])
  })

  it('drops a key compilation already emitted, so the compiled value wins', () => {
    expect(
      sanitizePassthroughTags(['velocity=1', 'mood=calm'], ['velocity=90'])
    ).toEqual(['mood=calm'])
  })

  it('keeps only the first of a duplicated key', () => {
    expect(sanitizePassthroughTags(['mood=calm', 'mood=tense'], [])).toEqual([
      'mood=calm',
    ])
  })

  it('handles absent or empty input', () => {
    expect(sanitizePassthroughTags(undefined, [])).toEqual([])
    expect(sanitizePassthroughTags([], [])).toEqual([])
  })

  it('keeps a valueless tag', () => {
    expect(sanitizePassthroughTags(['staccato'], [])).toEqual(['staccato'])
  })
})

describe('compile appends passthrough tags', () => {
  it('adds them to every note the attack emits', () => {
    const { notes } = compileGesturesToNotes([gestureWith(['mood=calm'])], ctx)

    expect(notes).toHaveLength(2)
    notes.forEach((n) => {
      expect(n.tags).toContain('mood=calm')
    })
  })

  it('appends them after the compiled tags', () => {
    const { notes } = compileGesturesToNotes([gestureWith(['mood=calm'])], ctx)

    const tags = notes[0].tags
    expect(tags[tags.length - 1]).toBe('mood=calm')
  })

  it('never lets a passthrough tag overwrite a generated identity tag', () => {
    const { notes } = compileGesturesToNotes(
      [gestureWith(['noteId=forged', 'groupId=forged', 'barId=forged'])],
      ctx
    )

    notes.forEach((n) => {
      expect(n.tags).not.toContain('noteId=forged')
      expect(n.tags).not.toContain('groupId=forged')
      expect(n.tags).not.toContain('barId=forged')
      // the real generated ones are still there, exactly once each
      expect(tagKeys(n.tags).filter((k) => k === 'noteId')).toHaveLength(1)
      expect(tagKeys(n.tags).filter((k) => k === 'groupId')).toHaveLength(1)
    })
    // two notes of one attack share a groupId but never a noteId
    const noteIds = notes.map(
      (n) => n.tags.find((t) => t.startsWith('noteId=')) as string
    )
    expect(new Set(noteIds).size).toBe(2)
  })

  it('does not let a passthrough tag relink a note to a reusable template', () => {
    const { notes } = compileGesturesToNotes(
      [gestureWith(['customBarId=99', 'customBar=other', 'custom=true'])],
      ctx
    )

    notes.forEach((n) => {
      expect(tagKeys(n.tags)).not.toContain('customBarId')
      expect(tagKeys(n.tags)).not.toContain('customBar')
      expect(tagKeys(n.tags)).not.toContain('custom')
    })
  })

  it('leaves compiled output unchanged when no passthrough tags are present', () => {
    const withoutField = compileGesturesToNotes([gestureWith([])], ctx)
    const nonePresent = compileGesturesToNotes(
      [
        {
          ...gestureWith([]),
          attacks: [
            {
              offsetTicks: 0,
              selection: { kind: 'all' },
              action: { kind: 'pluck' },
            },
          ],
        },
      ],
      ctx
    )

    const strip = (tags: string[]) =>
      tags.filter(
        (t) =>
          !t.startsWith('noteId=') &&
          !t.startsWith('groupId=') &&
          !t.startsWith('layer=')
      )

    expect(withoutField.notes.map((n) => strip(n.tags))).toEqual(
      nonePresent.notes.map((n) => strip(n.tags))
    )
  })

  it('applies passthrough tags on the strum path too', () => {
    const strummed: Gesture = {
      ...gestureWith([]),
      attacks: [
        {
          offsetTicks: 0,
          selection: { kind: 'all' },
          action: { kind: 'strum', direction: 'down', spreadTicks: 8 },
          passthroughTags: ['mood=calm', 'noteId=forged'],
        },
      ],
    }

    const { notes } = compileGesturesToNotes([strummed], ctx)

    expect(notes.length).toBeGreaterThan(0)
    notes.forEach((n) => {
      expect(n.tags).toContain('mood=calm')
      expect(n.tags).not.toContain('noteId=forged')
    })
  })
})
