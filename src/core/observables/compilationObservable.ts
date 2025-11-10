import { Observable } from 'rxjs'

import { MidiMap } from '../../lib/mapSongToTicks'
import { MidiMappingResult } from '../../lib/shared/midiMappingCore'
import {
  compileNotesByBarToTracks,
  compilePhasesToTracks,
  saveSongAndTracks,
} from '../../lib/util/schemaUtil'
import { mem } from '../mem'

const compileEventTarget = new window.EventTarget()
const onCompileCallbacks: ((
  map: MidiMap,
  phaseAndBarStartAndEndTicks: {
    phases: { [phaseName: string]: [startTick: number, endTick: number] }
    bars: { [barName: string]: [startTick: number, endTick: number] }
  }
) => void | Promise<void>)[] = []

const compilationObservable_ = new Observable<MidiMap>((subscriber) => {
  compileEventTarget.addEventListener('compiled', () => {
    subscriber.next(mem())
  })
})
;(window as any).compilationObservable_ =
  compilationObservable_ as Observable<MidiMap>

export const compilationObservable = compilationObservable_

async function setLatestMap_(mapProm: Promise<MidiMappingResult>) {
  const { map, phaseAndBarStartAndEndTicks } = await mapProm
  mem().latestPhaseAndBarStartAndEndTicks = phaseAndBarStartAndEndTicks
  mem().latestMap = map
  // mem().song["track-ids"] = mem().tracks.map((track) => track.id)
  mem().song['track-ids'] = mem().tracks.map((track) => [track.id, 0])
  compilePhasesToTracks() // ensures that only active phases are saved, old ones oprhaned in db. @todo: code does exist that looks at orphaned ids, but nothing is done with them
  compileNotesByBarToTracks()
  saveSongAndTracks()
  compileEventTarget.dispatchEvent(new CustomEvent('compiled'))
  onCompileCallbacks.forEach((fn) => fn(map, phaseAndBarStartAndEndTicks))
  return map
}

declare global {
  interface Window {
    setLatestMap: (mapProm: Promise<MidiMappingResult>) => Promise<MidiMap>
  }
}
window.setLatestMap = setLatestMap_

export const setLatestMap = window.setLatestMap

export const runOnCompilation = (
  fn: (
    map: MidiMap,
    phaseAndBarStartAndEndTicks: {
      phases: { [phaseName: string]: [startTick: number, endTick: number] }
      bars: { [barName: string]: [startTick: number, endTick: number] }
    }
  ) => void
) => {
  onCompileCallbacks.push(fn)
}
export const runOnCompilationAsync = (fn: () => Promise<void>) => {
  onCompileCallbacks.push(fn)
}
