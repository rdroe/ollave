import { describe, expect, it } from 'vitest'

import { chordContextAt, NotesByBarLike } from './chordContextUtil'

/**
 * Synthetic fixture: two phases, three bars in `verse`.
 *
 * verse:0 — one chord group (Am / Im), two notes, barDelay 0.
 * verse:1 — EMPTY (sparse: no key at all) — intermediate gap.
 * verse:2 — two chord groups: g2 at barDelay 64 (chord=Dm), g1 at barDelay 0
 *   (chord=G) — out of barDelay order in the raw array, to prove sorting.
 *   Also one note with a groupId but NO chord= tag (should be ignored), and
 *   one note with chord= but no groupId (should be ignored).
 *
 * bridge:0 — single group, one note whose note name is unparsable ('xyz'),
 *   alongside two parsable notes, to test voicing sort placement.
 */
const fixture: NotesByBarLike = {
  'verse:0': [
    { note: 'A3', tags: ['groupId=g0', 'chord=Am', 'roman=Im', 'barDelay=0'] },
    { note: 'C4', tags: ['groupId=g0', 'chord=Am', 'barDelay=0'] },
  ],
  'verse:2': [
    { note: 'D4', tags: ['groupId=g2', 'chord=Dm', 'roman=iv', 'barDelay=64'] },
    { note: 'F4', tags: ['groupId=g2', 'chord=Dm', 'barDelay=64'] },
    { note: 'G3', tags: ['groupId=g1', 'chord=G', 'roman=VII', 'barDelay=0'] },
    { note: 'B3', tags: ['groupId=g1', 'chord=G', 'barDelay=0'] },
    // groupId but no chord= anywhere in the group -> ignored
    { note: 'E5', tags: ['groupId=g3', 'barDelay=32'] },
    // chord= but no groupId -> ignored
    { note: 'C5', tags: ['chord=C', 'barDelay=32'] },
  ],
  'bridge:0': [
    {
      note: 'xyz',
      tags: ['groupId=b0', 'chord=Csus4', 'barDelay=0'],
    },
    { note: 'E4', tags: ['groupId=b0', 'chord=Csus4', 'barDelay=0'] },
    { note: 'C4', tags: ['groupId=b0', 'chord=Csus4', 'barDelay=0'] },
  ],
}

describe('chordContextAt', () => {
  it('gap 0: prev empty, next = first group of bar 0', () => {
    const ctx = chordContextAt(fixture, 'verse', 0)
    expect(ctx.prev).toEqual([])
    expect(ctx.next).toEqual({
      chord: 'Am',
      roman: 'Im',
      barIndex: 0,
      barDelay: 0,
      voicing: ['A3', 'C4'],
    })
  })

  it('final gap (gapIndex === barCount): next is null', () => {
    // barCount for 'verse' = 1 + max index (2) = 3
    const ctx = chordContextAt(fixture, 'verse', 3)
    expect(ctx.next).toBeNull()
    // prev = ALL chord groups chronologically: bar0 g0, bar2 g1 (delay0), bar2 g2 (delay64)
    expect(ctx.prev.map((g) => g.chord)).toEqual(['Am', 'G', 'Dm'])
  })

  it('sparse intermediate bar (verse:1 missing) contributes no groups', () => {
    const ctx = chordContextAt(fixture, 'verse', 2)
    // prev should include bar0's group only (bar1 sparse/missing)
    expect(ctx.prev.map((g) => g.chord)).toEqual(['Am'])
    // next = first group at or after bar 2, ordered by barDelay: G (0) before Dm (64)
    expect(ctx.next?.chord).toBe('G')
  })

  it('two chord groups in one bar are ordered by barDelay, not raw array order', () => {
    const ctx = chordContextAt(fixture, 'verse', 3)
    const bar2Groups = ctx.prev.filter((g) => g.barIndex === 2)
    expect(bar2Groups.map((g) => g.chord)).toEqual(['G', 'Dm'])
    expect(bar2Groups.map((g) => g.barDelay)).toEqual([0, 64])
  })

  it('a group lacking any chord= tag is ignored; a chord= note lacking groupId is ignored', () => {
    const ctx = chordContextAt(fixture, 'verse', 3)
    const chords = ctx.prev.map((g) => g.chord)
    expect(chords).not.toContain('C') // the groupId-less chord=C note
    // g3 (groupId but no chord=) never surfaces as a chord at all
    expect(ctx.prev.every((g) => g.chord !== undefined)).toBe(true)
  })

  it('voicing is ascending by midi; an unparsable note name sorts first', () => {
    const ctx = chordContextAt(fixture, 'bridge', 0)
    expect(ctx.next?.voicing).toEqual(['xyz', 'C4', 'E4'])
  })

  it('roman is null when absent', () => {
    const ctx = chordContextAt(fixture, 'bridge', 0)
    expect(ctx.next?.roman).toBeNull()
  })
})
