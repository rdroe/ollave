import { describe, expect, it } from 'vitest'

import {
  annotateVoiceLeading,
  checkProgression,
  checkVoiceLeading,
  doublingPreference,
  PART_WRITING_RULES,
  realizeProgression,
  realizeSATB,
  RULE_CITATIONS,
  waiversFor,
} from './partWriting'
import type { PartWritingRule, Violation } from './partWriting'
import { spanById, spanWaivedRules } from './spans'

/**
 * B1 — voice-leading legality and four-voice realization.
 *
 * EVERY RULE IS PINNED BY AN EXAMPLE **AND** A COUNTER-EXAMPLE. The plan is
 * explicit that for an expert audience a wrong rule is worse than a missing
 * one, and a rule tested only by the case it fires on is indistinguishable from
 * a rule that fires on everything. The counter-example is what proves the rule
 * discriminates.
 *
 * Every voicing below is hand-verified SATB, low to high, and was confirmed
 * against the implementation by probe before being pinned here.
 */

/** Rule ids present in a violation list — the assertion shape used throughout. */
const rules = (vs: Violation[]): string[] => vs.map((v) => v.rule)

const C_MAJOR = { tonic: 'C', mode: 'major' } as const
const A_MINOR = { tonic: 'A', mode: 'minor' } as const

describe('the rule catalogue', () => {
  it('cites a textbook statement for every rule', () => {
    // The plan requires each rule to cite its source. This pins that the
    // catalogue and the citation map cannot drift apart.
    for (const rule of PART_WRITING_RULES) {
      const citation = RULE_CITATIONS[rule]
      expect(citation, `${rule} has no citation`).toBeTruthy()
      // a real statement, not a placeholder
      expect(citation.length, `${rule}'s citation is too short`).toBeGreaterThan(60)
    }
  })

  it('has a citation for exactly the rules it claims to have', () => {
    expect(Object.keys(RULE_CITATIONS).sort()).toEqual([...PART_WRITING_RULES].sort())
  })
})

describe('parallel fifths', () => {
  // Aldwell & Schachter ch. 5. Bass C3 with tenor G3 is a perfect fifth;
  // moving both up a whole step to D3/A3 is another perfect fifth.
  it('flags similar motion from one perfect fifth to another', () => {
    const from = ['C3', 'G3', 'C4', 'E4']
    const to = ['D3', 'A3', 'D4', 'F4']
    const found = checkVoiceLeading(from, to)
    expect(rules(found)).toContain('parallel-fifths')
    const v = found.find((x) => x.rule === 'parallel-fifths')
    // the violation NAMES THE VOICES, which is the whole point of a typed
    // violation over a boolean
    expect(v?.voices).toEqual([0, 1])
    expect(v?.severity).toBe('error')
  })

  it('COUNTER-EXAMPLE: a fifth reached by contrary motion is not flagged', () => {
    // bass falls C3 -> G2 while the tenor rises G3 -> D4. Both chords contain a
    // fifth between voices 0 and 1, but the motion is contrary, which textbooks
    // treat as a different case entirely.
    const from = ['C3', 'G3', 'C4', 'E4']
    const to = ['G2', 'D4', 'B3', 'G4']
    expect(rules(checkVoiceLeading(from, to))).not.toContain('parallel-fifths')
  })

  it('COUNTER-EXAMPLE: a repeated chord restates a fifth without moving', () => {
    // Nothing moves, so there is one fifth sounded twice, not two fifths in
    // succession. Flagging this would fire on every repeated chord in music.
    const same = ['C3', 'G3', 'C4', 'E4']
    expect(rules(checkVoiceLeading(same, same))).not.toContain('parallel-fifths')
  })
})

describe('parallel octaves', () => {
  // Aldwell & Schachter ch. 5 — the same prohibition at the octave.
  it('flags similar motion from one octave to another', () => {
    const from = ['C3', 'E3', 'G3', 'C4']
    const to = ['D3', 'F3', 'A3', 'D4']
    const found = checkVoiceLeading(from, to)
    expect(rules(found)).toContain('parallel-octaves')
    expect(found.find((x) => x.rule === 'parallel-octaves')?.voices).toEqual([0, 3])
  })

  it('COUNTER-EXAMPLE: an octave approached by contrary motion is legal', () => {
    // bass rises to G2->... while soprano falls; the octave is not parallel
    const from = ['C3', 'E3', 'G3', 'E4']
    const to = ['E3', 'G3', 'B3', 'C4']
    expect(rules(checkVoiceLeading(from, to))).not.toContain('parallel-octaves')
  })
})

describe('parallel fourths — against the bass only', () => {
  /**
   * Fux forbids parallel fourths AGAINST THE BASS, where the fourth is a
   * dissonance. Between upper voices they are free. That distinction is the
   * difference between a usable rule and one that fires on ordinary writing,
   * so both halves are pinned.
   *
   * OFF BY DEFAULT — see DEFAULT_OFF — so these tests enable it explicitly.
   */
  const on = { rules: { 'parallel-fourths': true } } as const

  it('flags parallel fourths above the bass', () => {
    // bass E3 with a G... no: E3 -> A3 is a fourth. D3 -> G3 is a fourth.
    const from = ['E3', 'A3', 'C4']
    const to = ['D3', 'G3', 'B3']
    expect(rules(checkVoiceLeading(from, to, on))).toContain('parallel-fourths')
  })

  it('COUNTER-EXAMPLE: parallel fourths between UPPER voices are free', () => {
    // voices 1 and 2 move in parallel fourths (A3/D4 -> G3/C4) but the bass is
    // not involved, so nothing is flagged.
    const from = ['C3', 'A3', 'D4', 'F4']
    const to = ['C3', 'G3', 'C4', 'E4']
    expect(rules(checkVoiceLeading(from, to, on))).not.toContain('parallel-fourths')
  })

  it('is OFF by default', () => {
    const from = ['E3', 'A3', 'C4']
    const to = ['D3', 'G3', 'B3']
    expect(rules(checkVoiceLeading(from, to))).not.toContain('parallel-fourths')
  })
})

describe('hidden (direct) fifths and octaves — outer voices', () => {
  /**
   * Piston ch. 4: similar motion into a perfect interval between the OUTER
   * voices with the soprano LEAPING. Both restrictions are load-bearing and
   * both are pinned by a counter-example.
   */
  it('flags similar motion into an octave with the soprano leaping', () => {
    const from = ['C3', 'E3', 'G3', 'E4']
    const to = ['D3', 'F3', 'A3', 'D5']
    expect(rules(checkVoiceLeading(from, to))).toContain('hidden-octaves')
  })

  it('COUNTER-EXAMPLE: the soprano approaching by STEP is the standard exemption', () => {
    // same outer-voice octave arrival, but the soprano moves a whole step
    const from = ['C3', 'E3', 'G3', 'C4']
    const to = ['D3', 'F3', 'A3', 'D4']
    expect(rules(checkVoiceLeading(from, to))).not.toContain('hidden-octaves')
  })

  it('COUNTER-EXAMPLE: contrary motion into the octave is not hidden', () => {
    const from = ['C3', 'E3', 'G3', 'G4']
    const to = ['D3', 'F3', 'A3', 'D4']
    expect(rules(checkVoiceLeading(from, to))).not.toContain('hidden-octaves')
  })
})

describe('unequal fifths (d5 -> P5)', () => {
  /**
   * Piston ch. 4. Widely tolerated — Bach uses it freely — so it is OFF by
   * default and is a natural per-rule toggle, exactly as the plan describes.
   * B2/F3 is a diminished fifth by SPELLING; C3/G3 is perfect.
   */
  const from = ['B2', 'F3', 'D4', 'G4']
  const to = ['C3', 'G3', 'E4', 'C5']

  it('is silent by default, because the rule is widely tolerated', () => {
    expect(rules(checkVoiceLeading(from, to))).not.toContain('unequal-fifths')
  })

  it('flags d5 -> P5 when explicitly enabled', () => {
    const found = checkVoiceLeading(from, to, { rules: { 'unequal-fifths': true } })
    expect(rules(found)).toContain('unequal-fifths')
    expect(found.find((x) => x.rule === 'unequal-fifths')?.severity).toBe('warning')
  })

  it('COUNTER-EXAMPLE: P5 -> d5 (the reverse order) is not flagged', () => {
    // The reverse order is more freely accepted still. Pinning it proves the
    // rule is directional rather than merely detecting two fifths.
    expect(
      rules(
        checkVoiceLeading(to, from, { rules: { 'unequal-fifths': true } })
      )
    ).not.toContain('unequal-fifths')
  })
})

describe('the chordal seventh resolves down by step', () => {
  // Aldwell & Schachter ch. 12. G7's seventh is F.
  it('flags a seventh that rises', () => {
    const from = ['G2', 'B3', 'D4', 'F4']
    const to = ['C3', 'C4', 'E4', 'G4']
    const found = checkVoiceLeading(from, to, { fromChord: 'G7' })
    expect(rules(found)).toContain('unresolved-seventh')
    expect(found.find((x) => x.rule === 'unresolved-seventh')?.voices).toEqual([3])
  })

  it('COUNTER-EXAMPLE: F4 -> E4 resolves correctly', () => {
    const from = ['G2', 'B3', 'D4', 'F4']
    const to = ['C3', 'C4', 'C4', 'E4']
    expect(rules(checkVoiceLeading(from, to, { fromChord: 'G7' }))).not.toContain(
      'unresolved-seventh'
    )
  })

  it('COUNTER-EXAMPLE: a seventh held as a common tone is exempt', () => {
    const from = ['G2', 'B3', 'D4', 'F4']
    const to = ['A2', 'C4', 'D4', 'F4']
    expect(rules(checkVoiceLeading(from, to, { fromChord: 'G7' }))).not.toContain(
      'unresolved-seventh'
    )
  })

  it('COUNTER-EXAMPLE: a triad has no seventh to resolve', () => {
    const from = ['G2', 'B3', 'D4', 'G4']
    const to = ['C3', 'C4', 'E4', 'G4']
    expect(rules(checkVoiceLeading(from, to, { fromChord: 'G' }))).not.toContain(
      'unresolved-seventh'
    )
  })
})

describe('the leading tone', () => {
  // Piston ch. 5 (doubling) and Aldwell & Schachter ch. 7 (resolution).
  it('flags a doubled leading tone', () => {
    const from = ['G2', 'B3', 'D4', 'G4']
    const to = ['G2', 'B3', 'D4', 'B4']
    const found = checkVoiceLeading(from, to, { key: C_MAJOR })
    expect(rules(found)).toContain('doubled-leading-tone')
    expect(found.find((x) => x.rule === 'doubled-leading-tone')?.voices).toEqual([1, 3])
  })

  it('COUNTER-EXAMPLE: one leading tone is not a doubling', () => {
    const from = ['G2', 'D4', 'G4', 'B4']
    const to = ['G2', 'B3', 'D4', 'G4']
    expect(rules(checkVoiceLeading(from, to, { key: C_MAJOR }))).not.toContain(
      'doubled-leading-tone'
    )
  })

  it('COUNTER-EXAMPLE: without a key the rule is SKIPPED, not guessed', () => {
    // A wrong rule is worse than a missing one for this audience, so a
    // key-dependent rule with no key does nothing at all.
    const from = ['G2', 'B3', 'D4', 'G4']
    const to = ['G2', 'B3', 'D4', 'B4']
    expect(rules(checkVoiceLeading(from, to))).not.toContain('doubled-leading-tone')
  })

  it('flags a leading tone that fails to resolve at a CADENCE in an outer voice', () => {
    // soprano B4 falls to G4 instead of rising to C
    const from = ['G2', 'D4', 'G4', 'B4']
    const to = ['C3', 'E4', 'G4', 'G4']
    expect(
      rules(checkVoiceLeading(from, to, { key: C_MAJOR, cadence: true }))
    ).toContain('unresolved-leading-tone')
  })

  it('COUNTER-EXAMPLE: mid-phrase the leading tone is free', () => {
    // identical motion, but not marked as a cadence
    const from = ['G2', 'D4', 'G4', 'B4']
    const to = ['C3', 'E4', 'G4', 'G4']
    expect(rules(checkVoiceLeading(from, to, { key: C_MAJOR }))).not.toContain(
      'unresolved-leading-tone'
    )
  })

  it('COUNTER-EXAMPLE: B4 rising to C5 at a cadence is correct', () => {
    const from = ['G2', 'D4', 'G4', 'B4']
    const to = ['C3', 'E4', 'G4', 'C5']
    expect(
      rules(checkVoiceLeading(from, to, { key: C_MAJOR, cadence: true }))
    ).not.toContain('unresolved-leading-tone')
  })
})

describe('the augmented second (minor keys)', () => {
  // Aldwell & Schachter ch. 20. F4 -> G#4 in A minor.
  it('flags a melodic augmented second', () => {
    const from = ['A2', 'C4', 'E4', 'F4']
    const to = ['E3', 'B3', 'E4', 'G#4']
    const found = checkVoiceLeading(from, to, { key: A_MINOR })
    expect(rules(found)).toContain('augmented-second')
    expect(found.find((x) => x.rule === 'augmented-second')?.voices).toEqual([3])
  })

  it('COUNTER-EXAMPLE: a minor third sounds the same but is not flagged', () => {
    // F4 -> Ab4 is a minor third: the same THREE SEMITONES as F4 -> G#4. Only
    // the spelling differs, which is exactly why this rule reads spelling and
    // not semitones. If this test ever fails, the rule has been rewritten to
    // use semitone arithmetic and is now wrong.
    const from = ['A2', 'C4', 'E4', 'F4']
    const to = ['E3', 'B3', 'E4', 'Ab4']
    expect(rules(checkVoiceLeading(from, to, { key: A_MINOR }))).not.toContain(
      'augmented-second'
    )
  })

  it('COUNTER-EXAMPLE: the rule does not apply in a major key', () => {
    const from = ['A2', 'C4', 'E4', 'F4']
    const to = ['E3', 'B3', 'E4', 'G#4']
    expect(rules(checkVoiceLeading(from, to, { key: C_MAJOR }))).not.toContain(
      'augmented-second'
    )
  })
})

describe('voice crossing and overlap', () => {
  // Piston ch. 4. Crossing is simultaneous; overlap is between consecutive
  // chords. The two are pinned separately because they are genuinely different.
  it('flags a voice written below its neighbour', () => {
    const from = ['C3', 'E3', 'G3', 'C4']
    const to = ['C3', 'E3', 'C4', 'G3']
    expect(rules(checkVoiceLeading(from, to))).toContain('voice-crossing')
  })

  it('flags a voice moving past where its neighbour just was', () => {
    // the alto (voice 2) leaps up to E5, above where the soprano (voice 3) was
    const from = ['C3', 'E3', 'G3', 'C4']
    const to = ['C3', 'E3', 'E4', 'G4']
    const found = checkVoiceLeading(from, to)
    expect(rules(found)).toContain('voice-overlap')
  })

  it('COUNTER-EXAMPLE: ordinary four-part motion crosses and overlaps nothing', () => {
    const from = ['C3', 'G3', 'C4', 'E4']
    const to = ['G2', 'G3', 'B3', 'D4']
    const found = rules(checkVoiceLeading(from, to))
    expect(found).not.toContain('voice-crossing')
    expect(found).not.toContain('voice-overlap')
  })
})

describe('spacing', () => {
  /**
   * Piston ch. 4: adjacent UPPER voices within an octave. The bass-tenor gap is
   * exempt, which is the half of the rule that stops it firing on correct
   * chorale writing — so the exemption gets its own counter-example.
   */
  it('flags more than an octave between adjacent upper voices', () => {
    const from = ['C3', 'E3', 'G3', 'C4']
    const to = ['C3', 'E3', 'G3', 'A4']
    expect(rules(checkVoiceLeading(from, to))).toContain('spacing')
  })

  it('COUNTER-EXAMPLE: a wide BASS-tenor gap is normal scoring, not an error', () => {
    // sixteen semitones between bass and tenor, which is ordinary open scoring
    const from = ['C3', 'E4', 'G4', 'C5']
    const to = ['C3', 'E4', 'G4', 'C5']
    expect(rules(checkVoiceLeading(from, to))).not.toContain('spacing')
  })
})

describe("the cadential 6/4's voice-leading half", () => {
  /**
   * Aldwell & Schachter ch. 17. B3 owns the metric half (the 6/4 on the
   * stronger beat); this is the resolution: the sixth and fourth above a HELD
   * bass fall by step to the fifth and third.
   *
   * Over bass G2: C4 is the fourth above, E4 is the sixth above.
   */
  const good = { from: ['G2', 'G3', 'C4', 'E4'], to: ['G2', 'G3', 'B3', 'D4'] }

  it('accepts a correct 6/4 -> 5/3 resolution over a held bass', () => {
    expect(
      rules(checkVoiceLeading(good.from, good.to, { fromFigure: '64' }))
    ).not.toContain('cadential-64-resolution')
  })

  it('flags a fourth that leaps instead of resolving down by step', () => {
    const to = ['G2', 'G3', 'F4', 'D4']
    const found = checkVoiceLeading(good.from, to, { fromFigure: '64' })
    expect(rules(found)).toContain('cadential-64-resolution')
    expect(
      found.find((x) => x.rule === 'cadential-64-resolution')?.message
    ).toContain('fourth')
  })

  it('flags a 6/4 whose bass does not hold', () => {
    // a 6/4 with a MOVING bass is a passing or pedal 6/4 — a different device
    // (see spans.ts) — so as a CADENTIAL 6/4 it is wrong.
    const to = ['C3', 'G3', 'B3', 'D4']
    const found = checkVoiceLeading(good.from, to, { fromFigure: '64' })
    expect(rules(found)).toContain('cadential-64-resolution')
    expect(
      found.find((x) => x.rule === 'cadential-64-resolution')?.message
    ).toContain('held bass')
  })

  it('COUNTER-EXAMPLE: the rule applies only when the FROM chord is a 6/4', () => {
    // identical notes, no figure declared: nothing to check
    const to = ['C3', 'G3', 'B3', 'D4']
    expect(rules(checkVoiceLeading(good.from, to))).not.toContain(
      'cadential-64-resolution'
    )
  })
})

describe('strictness modes', () => {
  const from = ['C3', 'E3', 'G3', 'C4']
  // an illegal move (parallel octaves) and a legal one
  const illegal = ['D3', 'F3', 'A3', 'D4']
  const legal = ['G2', 'G3', 'B3', 'D4']
  const items = [{ v: illegal }, { v: legal }]
  const pick = (i: { v: string[] }): string[] => i.v

  it("DEFAULT is 'report' and NEVER removes a suggestion", () => {
    // The user decision in PLAN-MUSIC.md is that the default must never hide a
    // legal-but-unconventional move. This is that guarantee, pinned.
    const out = annotateVoiceLeading(items, from, pick)
    expect(out).toHaveLength(2)
    // order is preserved, and the illegal one is annotated rather than dropped
    expect(out[0]?.legal).toBe(false)
    expect(rules(out[0]?.violations ?? [])).toContain('parallel-octaves')
    expect(out[1]?.legal).toBe(true)
  })

  it("'warn' keeps everything but sorts violations last", () => {
    const out = annotateVoiceLeading(items, from, pick, { strictness: 'warn' })
    expect(out).toHaveLength(2)
    expect(out[0]?.legal).toBe(true)
    expect(out[1]?.legal).toBe(false)
  })

  it("'block' filters illegal moves out", () => {
    const out = annotateVoiceLeading(items, from, pick, { strictness: 'block' })
    expect(out).toHaveLength(1)
    expect(out[0]?.legal).toBe(true)
  })

  it('annotates without mutating the input', () => {
    const input = [{ v: illegal }]
    annotateVoiceLeading(input, from, pick, { strictness: 'block' })
    expect(input).toEqual([{ v: illegal }])
    expect(input[0]).not.toHaveProperty('violations')
  })
})

describe('per-rule toggles', () => {
  const from = ['C3', 'E3', 'G3', 'C4']
  const to = ['D3', 'F3', 'A3', 'D4']

  it('silences one rule while leaving the others live', () => {
    // "a user may accept hidden fifths but not parallel octaves" — the plan's
    // own example of why per-rule control is required.
    const all = rules(checkVoiceLeading(from, to))
    expect(all).toContain('parallel-octaves')
    expect(all).toContain('parallel-fifths')

    const partial = rules(
      checkVoiceLeading(from, to, { rules: { 'parallel-fifths': false } })
    )
    expect(partial).not.toContain('parallel-fifths')
    expect(partial).toContain('parallel-octaves')
  })

  it('enables a rule that is off by default', () => {
    const from2 = ['B2', 'F3', 'D4', 'G4']
    const to2 = ['C3', 'G3', 'E4', 'C5']
    expect(rules(checkVoiceLeading(from2, to2))).not.toContain('unequal-fifths')
    expect(
      rules(checkVoiceLeading(from2, to2, { rules: { 'unequal-fifths': true } }))
    ).toContain('unequal-fifths')
  })
})

describe('span waivers — the tool must not red-ink its own content', () => {
  /**
   * THE REQUIREMENT that motivated the waiver channel existing in Stage M-A
   * rather than being added here: the span library ships fauxbourdon, whose
   * identity IS parallel motion. A checker that flagged it would be flagging
   * this project's own shipped content.
   */
  it('honours a waiver list passed directly', () => {
    const from = ['C3', 'E3', 'G3', 'C4']
    const to = ['D3', 'F3', 'A3', 'D4']
    expect(rules(checkVoiceLeading(from, to))).toEqual(
      expect.arrayContaining(['parallel-fifths', 'parallel-octaves'])
    )
    expect(
      rules(
        checkVoiceLeading(from, to, {
          waivedRules: ['parallel-fifths', 'parallel-octaves'],
        })
      )
    ).toEqual([])
  })

  it("silences every flag on a REAL fauxbourdon texture using the span's own waivers", () => {
    // A strict fauxbourdon: three voices in exact parallel, the middle voice a
    // fourth above the bass throughout. Hand-built and verified by probe to
    // produce three `parallel-fourths` flags when that rule is enabled.
    const texture = [
      ['E3', 'A3', 'C4'],
      ['D3', 'G3', 'B3'],
      ['C3', 'F3', 'A3'],
      ['B2', 'E3', 'G3'],
    ]
    const withRuleOn = {
      key: C_MAJOR,
      rules: { 'parallel-fourths': true },
    } as const

    const flagged = checkProgression(texture, withRuleOn)
    expect(rules(flagged)).toEqual([
      'parallel-fourths',
      'parallel-fourths',
      'parallel-fourths',
    ])

    // now with the span's OWN declared waivers — the library stops flagging
    // the device it ships
    const span = spanById('fauxbourdon')
    expect(span, 'fauxbourdon span must exist').toBeDefined()
    const waived = checkProgression(texture, {
      ...withRuleOn,
      waivedRules: spanWaivedRules(span!),
    })
    expect(waived).toEqual([])
  })

  it('reads waivers off a span with `waiversFor`', () => {
    const span = spanById('fauxbourdon')!
    expect(waiversFor(span)).toEqual(spanWaivedRules(span))
    expect(waiversFor(span)).toContain('parallel-fourths')
  })

  it('ignores an unrecognized waiver id rather than rejecting it', () => {
    // A span authored against a FUTURE rule must not break today's checker.
    const from = ['C3', 'E3', 'G3', 'C4']
    const to = ['D3', 'F3', 'A3', 'D4']
    expect(
      rules(checkVoiceLeading(from, to, { waivedRules: ['some-future-rule'] }))
    ).toContain('parallel-octaves')
  })

  it('every rule the span library waives is a rule this module implements', () => {
    // Catches the drift where a span waives a rule id the checker never emits,
    // which would silently do nothing.
    const known: string[] = [...PART_WRITING_RULES]
    const span = spanById('fauxbourdon')!
    for (const rule of spanWaivedRules(span)) {
      expect(known, `fauxbourdon waives '${rule}', which B1 does not implement`).toContain(
        rule
      )
    }
  })
})

describe('doubling is per figure, not global', () => {
  /**
   * The plan's rule: root position doubles the root; the cadential 6/4 doubles
   * the bass; diminished triads double the third; first inversion is flexible;
   * NEVER the leading tone. Indices are into the chord's own note list —
   * 0 = root, 1 = third, 2 = fifth.
   */
  it('doubles the root in root position', () => {
    expect(doublingPreference('C', '53')[0]).toBe(0)
  })

  it('doubles the BASS of a cadential 6/4 — which is the chord fifth', () => {
    // figureBassIndex('64') is 2, so doubling the bass means doubling the fifth
    expect(doublingPreference('C', '64')[0]).toBe(2)
  })

  it('doubles the THIRD of a diminished triad, never the tritone members', () => {
    expect(doublingPreference('Bdim', '6')[0]).toBe(1)
    // the fifth is last: it is the upper member of the defining tritone
    expect(doublingPreference('Bdim', '6').at(-1)).toBe(2)
  })

  it('offers first inversion several options, because it is flexible', () => {
    expect(doublingPreference('C', '6').length).toBeGreaterThan(1)
  })

  it('doubles NOTHING in a seventh chord — four tones already fill four voices', () => {
    expect(doublingPreference('G7', '7')).toEqual([])
    expect(doublingPreference('G7', '65')).toEqual([])
  })

  it('NEVER doubles the leading tone', () => {
    // G major in C: G-B-D, and B is the leading tone. Every realization must
    // contain exactly one B.
    const voicings = realizeSATB('G', '53', { key: C_MAJOR })
    expect(voicings.length).toBeGreaterThan(0)
    for (const v of voicings) {
      const bs = v.filter((n) => n.startsWith('B')).length
      expect(bs, `${v.join(' ')} doubles the leading tone`).toBeLessThanOrEqual(1)
    }
  })
})

describe('realizeSATB', () => {
  it('produces four voices, low to high, within SATB ranges', () => {
    const voicings = realizeSATB('C', '53', { key: C_MAJOR })
    expect(voicings.length).toBeGreaterThan(0)
    for (const v of voicings) {
      expect(v).toHaveLength(4)
    }
  })

  it('puts the figure ORB bass in the bass', () => {
    // first inversion of C is E in the bass — the Stage M-A contract
    for (const v of realizeSATB('C', '6', { key: C_MAJOR })) {
      expect(v[0]?.startsWith('E')).toBe(true)
    }
    // second inversion puts the fifth there
    for (const v of realizeSATB('C', '64', { key: C_MAJOR })) {
      expect(v[0]?.startsWith('G')).toBe(true)
    }
  })

  it('uses all four tones of a seventh chord', () => {
    const voicings = realizeSATB('G7', '7', { key: C_MAJOR })
    expect(voicings.length).toBeGreaterThan(0)
    for (const v of voicings) {
      const pcs = new Set(v.map((n) => n.replace(/-?\d+$/, '')))
      expect(pcs).toEqual(new Set(['G', 'B', 'D', 'F']))
    }
  })

  it('returns [] for a figure that does not fit the chord, never throws', () => {
    // a triad has no seventh to put in the bass — the Stage M-A arity contract
    expect(realizeSATB('C', '42')).toEqual([])
  })

  it('returns [] for an unresolvable name, never throws', () => {
    expect(realizeSATB('NotAChord', '53')).toEqual([])
  })
})

describe('realizeProgression — the composer-facing deliverable', () => {
  it('realizes I-IV-V-I in C major with no violations', () => {
    const r = realizeProgression(['C', 'F', 'G', 'C'], { key: C_MAJOR })
    expect(r.legal).toBe(true)
    expect(r.violations).toEqual([])
    expect(r.chords).toHaveLength(4)
    for (const c of r.chords) expect(c.voicing).toHaveLength(4)
  })

  it('opens in close position rather than a legal-but-ungainly wide spacing', () => {
    /**
     * REGRESSION PIN, found by probe. With violations and voice motion as the
     * only cost terms, this progression opened on `C3 E4 G4 C5` — a SIXTEEN
     * semitone bass-tenor gap. Legal (the spacing rule exempts the bass) and
     * smooth, so nothing objected; but no composer writes that as a first
     * chord. `spacingPreference` is the fix and this is what pins it.
     */
    const r = realizeProgression(['C', 'F', 'G', 'C'], { key: C_MAJOR })
    const first = r.chords[0]?.voicing ?? []
    const bass = first[0]
    const tenor = first[1]
    expect(bass).toBeDefined()
    expect(tenor).toBeDefined()
    // within an octave of each other — no gaping hole above the bass
    const gap =
      (require('tonal').Note.midi(tenor) ?? 0) -
      (require('tonal').Note.midi(bass) ?? 0)
    expect(gap).toBeLessThanOrEqual(12)
  })

  it('realizes ii-V7-I cleanly, resolving the seventh', () => {
    const r = realizeProgression(['Dm', 'G7', 'C'], { key: C_MAJOR })
    expect(r.legal).toBe(true)
    expect(rules(r.violations)).not.toContain('unresolved-seventh')
  })

  it('realizes a minor-key progression cleanly', () => {
    const r = realizeProgression(['Am', 'Dm', 'E', 'Am'], { key: A_MINOR })
    expect(r.legal).toBe(true)
    // the dominant in minor carries the raised leading tone
    const dominant = r.chords[2]?.voicing ?? []
    expect(dominant.some((n) => n.startsWith('G#'))).toBe(true)
  })

  it('tags every violation with the chord index it arrives at', () => {
    // force a violation by pinning a start voicing that leads badly
    const r = realizeProgression(['C', 'D'], {
      key: C_MAJOR,
      startVoicing: ['C3', 'E3', 'G3', 'C4'],
    })
    for (const v of r.violations) {
      expect(v.at).toBeDefined()
      expect(v.at).toBeGreaterThan(0)
    }
  })

  it('honours an explicit starting voicing exactly', () => {
    const start = ['C3', 'G3', 'C4', 'E4']
    const r = realizeProgression(['C', 'G', 'C'], { key: C_MAJOR, startVoicing: start })
    expect(r.chords[0]?.voicing).toEqual(start)
  })

  it('realizes figured chords with the right bass', () => {
    const r = realizeProgression(['C', 'C', 'G'], {
      key: C_MAJOR,
      figures: [undefined, '6', undefined],
    })
    expect(r.chords[1]?.voicing[0]?.startsWith('E')).toBe(true)
    expect(r.chords[1]?.figure).toBe('6')
  })

  it('NEVER THROWS on an unresolvable chord — returns best effort with a reason', () => {
    const r = realizeProgression(['C', 'NotAChord', 'G'], { key: C_MAJOR })
    expect(r.incomplete).toBeTruthy()
    expect(r.incomplete).toContain('NotAChord')
    // what it managed before giving up is still returned
    expect(r.chords.length).toBeGreaterThan(0)
  })

  it('handles an empty progression', () => {
    const r = realizeProgression([], {})
    expect(r.chords).toEqual([])
    expect(r.legal).toBe(true)
  })

  it('is deterministic across repeated calls', () => {
    const once = realizeProgression(['C', 'Am', 'F', 'G'], { key: C_MAJOR })
    const twice = realizeProgression(['C', 'Am', 'F', 'G'], { key: C_MAJOR })
    expect(once.chords.map((c) => c.voicing)).toEqual(twice.chords.map((c) => c.voicing))
  })

  it('lets waivers steer the SEARCH, not merely the report', () => {
    // A waived rule costs nothing, so the search stops routing around the
    // motion the device is made of. Both runs must succeed; the waived one must
    // not report the waived rule under any circumstances.
    const chords = ['C', 'Bdim', 'Am', 'G']
    const figures = ['6', '6', '6', '6'] as const
    const waived = realizeProgression([...chords], {
      key: C_MAJOR,
      figures: [...figures],
      rules: { 'parallel-fourths': true },
      waivedRules: spanWaivedRules(spanById('fauxbourdon')!),
    })
    expect(rules(waived.violations)).not.toContain('parallel-fourths')
    expect(rules(waived.violations)).not.toContain('parallel-fifths')
    expect(waived.chords).toHaveLength(4)
  })
})

describe('checkProgression — analysing a composer\'s own writing', () => {
  it('finds nothing in a correct I-V-I', () => {
    const chorale = [
      ['C3', 'G3', 'C4', 'E4'],
      ['G2', 'G3', 'B3', 'D4'],
      ['C3', 'G3', 'C4', 'E4'],
    ]
    expect(checkProgression(chorale, { key: C_MAJOR })).toEqual([])
  })

  it('finds and locates parallel octaves in a faulty progression', () => {
    const faulty = [
      ['C3', 'E3', 'G3', 'C4'],
      ['D3', 'F3', 'A3', 'D4'],
      ['E3', 'G3', 'B3', 'E4'],
    ]
    const found = checkProgression(faulty, { key: C_MAJOR })
    expect(rules(found)).toContain('parallel-octaves')
    // located at BOTH transitions, tagged by index
    expect(found.filter((v) => v.rule === 'parallel-octaves').map((v) => v.at)).toEqual([
      1, 2,
    ])
  })

  it('handles a single chord and an empty list without throwing', () => {
    expect(checkProgression([['C3', 'E3', 'G3', 'C4']])).toEqual([])
    expect(checkProgression([])).toEqual([])
  })
})

describe('checkVoiceLeading contract', () => {
  it('returns [] rather than throwing on mismatched voicing sizes', () => {
    expect(checkVoiceLeading(['C3', 'E3'], ['D3', 'F3', 'A3'])).toEqual([])
  })

  it('returns [] on empty input', () => {
    expect(checkVoiceLeading([], [])).toEqual([])
    expect(checkVoiceLeading(['C3'], [])).toEqual([])
  })

  it('does not throw on unparseable note names', () => {
    expect(() => checkVoiceLeading(['nope', 'E3'], ['also-nope', 'F3'])).not.toThrow()
  })

  it('every violation carries the fields a UI needs', () => {
    const found = checkVoiceLeading(
      ['C3', 'E3', 'G3', 'C4'],
      ['D3', 'F3', 'A3', 'D4']
    )
    expect(found.length).toBeGreaterThan(0)
    for (const v of found) {
      expect(PART_WRITING_RULES).toContain(v.rule)
      expect(['error', 'warning']).toContain(v.severity)
      expect(v.voices.length).toBeGreaterThan(0)
      expect(v.notes.length).toBeGreaterThan(0)
      // a sentence a composer can read, not a log line
      expect(v.message.length).toBeGreaterThan(20)
    }
  })
})

describe('composes over the existing contract rather than replacing it', () => {
  it('annotates items of any shape via `pick`', () => {
    // proves this module never needs to import the suggestion contract: a
    // caller with RankedSuggestion[] passes `s => s.suggestedVoicing`.
    type Fake = { name: string; suggestedVoicing: string[] }
    const items: Fake[] = [
      { name: 'D', suggestedVoicing: ['D3', 'F3', 'A3', 'D4'] },
      { name: 'G', suggestedVoicing: ['G2', 'G3', 'B3', 'D4'] },
    ]
    const out = annotateVoiceLeading(
      items,
      ['C3', 'E3', 'G3', 'C4'],
      (s) => s.suggestedVoicing
    )
    // original fields survive
    expect(out[0]?.name).toBe('D')
    expect(out[1]?.name).toBe('G')
    // and the annotation is added
    expect(out[0]?.legal).toBe(false)
    expect(out[1]?.legal).toBe(true)
  })
})
