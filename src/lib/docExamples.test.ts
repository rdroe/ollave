import { describe, expect, it } from 'vitest'
import { composeProgression, composeModulation, composeSpan } from './composeProgression'
import { pathToCadence, cadenceOptions } from './progressionPath'
import { pathThroughModulation, pivotsBetween } from './modulation'
import { chromaticPivotSources, enharmonicPivotSource } from './chromaticPivots'
import { realizeProgression, checkVoiceLeading } from './partWriting'
import { suggestHarmonicRhythm } from './harmonicRhythm'
import { detectCadences, cadenceDefinition } from './cadence'
import { spanById, spanWaivedRules } from './spans'
import { functionOf } from './harmonicFunction'
import { arpUpAttacks } from './barTemplates/attackPresets'
import { compileGesturesToNotes } from './barTemplates/compile'
import { CompileCtx, Gesture } from './barTemplates/schemas'

/**
 * Every code example in `docs/chord-assistance.md` and `docs/chord-theory.md`,
 * executed.
 *
 * The docs open with "Every example here is real output, not illustrative" —
 * which is a promise, and a promise about output is exactly the kind that rots
 * silently. A doc example that has drifted is worse than no example: it teaches
 * a wrong answer with the authority of documentation.
 *
 * So the docs are pinned rather than trusted. Every assertion here is copied
 * from a code fence in one of those two files, and a change that alters any of
 * these outputs fails HERE, next to the values, rather than being discovered by
 * a reader following the docs into a wrong result.
 *
 * If one of these fails, the fix is usually to update the doc — the library
 * changing is normal. What must not happen is the assertion being relaxed while
 * the doc keeps claiming the old value.
 */
describe('every doc example is real output', () => {
  it('assistance §11', () => {
    expect(pathToCadence('C','PAC',4,'C','major').paths[0].summary).toBe('I - IIm - V - I')
    expect(pathToCadence('Am','plagal',3,'A','minor').paths[0].summary).toBe('Im - IVm - Im')
    expect(pathToCadence('Am','phrygian-half',3,'A','minor').paths[0].summary).toBe('Im - IVm6 - V')
    expect(pathToCadence('Am','evaded',3,'A','minor').paths[0].summary).toBe('Im - V42 - Im6')
    const r = pathToCadence('C','phrygian-half',4,'C','major')
    expect(r.paths).toEqual([]); expect(r.reason).toBe('cadence-unavailable-in-key')
    expect(cadenceOptions('C',4,'C','major').filter(o=>o.best).map(o=>[o.type,o.best!.summary])).toEqual([
      ['PAC','I - IIm - V - I'],['IAC','I - IIm - V - I'],['half','I - I - IIm - V'],
      ['deceptive','I - IIm - V - VIm'],['plagal','I - I - IV - I'],['evaded','I - I - V42 - I6']])
  })
  it('assistance §12', () => {
    const r = pathThroughModulation('Am','PAC',4,'A','minor','C','major')
    expect(r.plans[0].summary).toBe('Im - IVm=IIm - V - I')
    expect([r.plans[0].pivot.name, r.plans[0].pivot.romanHere, r.plans[0].pivot.romanThere, r.plans[0].pivotIndex]).toEqual(['Dm','IVm','IIm',1])
    const e = pathThroughModulation('C','PAC',4,'C','major','Db','major',{extraPivots:chromaticPivotSources})
    expect(e.plans[0].summary).toBe('I - IIm - Ger6=V7 - I')
    expect([e.plans[0].pivot.name, e.plans[0].pivot.nameThere]).toEqual(['Ger6','Ab7'])
    expect(pivotsBetween('C','major','Db','major',{extraPivots:chromaticPivotSources}).map(p=>[p.name,p.nameThere,p.romanHere,p.romanThere,p.kind,p.cost]))
      .toEqual([['N6','Db','N6','I','chromatic',5],['Ger6','Ab7','Ger6','V7','enharmonic',6]])
    expect(enharmonicPivotSource('A','minor','C','minor').map(p=>[p.name,p.nameThere,p.romanThere])).toEqual([['G#dim7','Bdim7','VIIdim7']])
    expect(pivotsBetween('A','minor','C','major',{extraPivots:chromaticPivotSources})[0].name).toBe('Dm')
  })
  it('assistance §13', () => {
    const r = realizeProgression(['C','F','G','C'],{key:{tonic:'C',mode:'major'}})
    expect(r.chords.map(c=>c.voicing)).toEqual([['C3','C4','E4','G4'],['F3','C4','F4','A4'],['G3','B3','D4','G4'],['C3','C4','E4','G4']])
    expect(r.legal).toBe(true)
    expect(checkVoiceLeading(['C3','E3','G3','C4'],['D3','F3','A3','D4']).map(v=>[v.rule,v.severity]))
      .toEqual([['parallel-fifths','error'],['parallel-octaves','error']])
    expect(spanWaivedRules(spanById('fauxbourdon')!)).toEqual(['parallel-fourths','parallel-fifths','doubled-leading-tone'])
  })
  it('assistance §14', () => {
    expect(suggestHarmonicRhythm(['C','Dm','G','C'],'3/4').steps.map(s=>[s.chord,s.bar,s.barDelay,s.position.level]))
      .toEqual([['C',0,0,'downbeat'],['Dm',0,128,'beat'],['G',0,256,'beat'],['C',1,0,'downbeat']])
  })
  it('assistance §15', () => {
    const p = composeProgression('C','PAC',4,'C','major')
    expect(p.summary).toBe('I - IIm - V - I')
    expect(p.bars.map(b=>[b.roman,b.chord,b.function,b.voicing.join(' '),`b${b.placement!.bar}+${b.placement!.barDelay}`]))
      .toEqual([['I','C','T','C3 C4 E4 G4','b0+0'],['IIm','Dm','PD','D3 A3 D4 F4','b0+128'],
                ['V','G','D','G3 B3 D4 G4','b0+256'],['I','C','T','C3 C4 E4 G4','b0+384']])
    expect(p.legal).toBe(true)
    const m = composeModulation('C','PAC',4,'C','major','Db','major')
    expect([m.summary,m.pivot!.name,m.pivotIndex]).toEqual(['I - IIm - Ger6=V7 - I','Ger6',2])
    expect(m.bars.map(b=>[b.roman,b.chord,b.voicing.join(' ')])).toEqual([
      ['I','C','C3 E3 E4 G4'],['IIm','Dm','D3 A3 D4 F4'],['V7','Ab7','Ab2 Ab3 C4 Eb4'],['I','Db','Db3 Ab3 Db4 F4']])
    expect(m.legal).toBe(true)
    const v = composeProgression('Am','half',4,'A','minor')
    expect(v.summary).toBe('Im - IIdim - V64 - V')
    expect([v.bars[2].node,v.bars[2].chord,v.bars[2].figure,v.bars[2].roman,v.bars[2].voicing,v.bars[2].resolvedFrom])
      .toEqual(['V64','Am','64','V64',['E3','A3','E4','C5'],'V64'])
    expect(v.notes[0]).toBe('V64 is a chord-function node, not a chord symbol; realized as Am in 64 — the same pitches, named so they can be voiced.')
    const g = composeProgression('Ger6','half',3,'A','minor')
    expect(g.bars[0].chord).toBeNull()
    expect(g.bars[0].voicing).toEqual(['F2','A2','C4','D#4'])
    expect(g.legal).toBe(true)
    const f = composeSpan(spanById('fauxbourdon')!,'C','major')
    expect(f.summary).toBe('I6 - VIIdim6 - VIm6 - V6')
    expect(f.bars.map(b=>b.voicing.join(' '))).toEqual(['E3 G3 C4 E4','D3 F3 B3 F4','C3 E3 C4 A4','B2 D3 D4 G4'])
    expect(f.legal).toBe(true)
  })
  it('assistance §16', () => {
    expect(detectCadences(['C','F','Dm','G','Am','F','G','C'],'C','major').map(c=>[c.index,c.type,c.romans.join('-'),c.confidence]))
      .toEqual([[2,'half','IIm-V','low'],[3,'deceptive','V-VIm','high'],[5,'half','IV-V','low'],[6,'IAC','V-I','medium']])
    expect(detectCadences([{name:'G',soprano:'D'},{name:'C',soprano:'C'}],'C','major')[0].type).toBe('PAC')
  })
  it('theory §12/§13/§14', () => {
    expect(['I','IIm','V','V64','N6','Ger6','VIIdim7'].map(r=>[r,functionOf(r)]))
      .toEqual([['I','T'],['IIm','PD'],['V','D'],['V64','D'],['N6','PD'],['Ger6','PD'],['VIIdim7','D']])
    const d = cadenceDefinition('phrygian-half')!
    expect(d.approach).toEqual(['IVm6','IVm']); expect(d.arrival).toEqual(['V']); expect(d.specificity).toBe(3)
    const cm = pivotsBetween('C','major','A','minor')
    expect(cm.find(p=>p.name==='Dm')!.cost).toBe(0)
    expect(cm.find(p=>p.name==='Bdim')!.cost).toBe(2)
  })
  it('assistance — voicings and attacks in bar templates', () => {
    const ctx: CompileCtx = {
      phaseName: 'verse',
      scaleTonic: 'C',
      scaleName: 'major',
      barSizeMultiplier: 1,
      octave: '3',
    }
    const gesture: Gesture = {
      id: 'doc1',
      startStep: 0,
      source: { kind: 'voicing', pitches: ['C3', 'C4', 'E4', 'G4'], chord: 'C', roman: 'I' },
      mode: 'strum', direction: 'down', spread: 'tight',
      velocity: 90, durationTicks: 128,
      attacks: arpUpAttacks({ count: 4, subdivisionTicks: 32 }),
    }
    expect(compileGesturesToNotes([gesture], ctx).notes.map(n => n.note))
      .toEqual(['C3', 'C4', 'E4', 'G4'])
  })
})
