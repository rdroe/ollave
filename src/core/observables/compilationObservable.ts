import { Observable } from "rxjs";
import {  MidiMap } from "../../lib/mapSongToTicks";
import { mem } from "../mem";
import { compileNotesByBarToTracks, compilePhasesToTracks, saveSongAndTracks } from "../../lib/util/schemaUtil";

const compileEventTarget = new window.EventTarget();


const compilationObservable_ = new Observable<MidiMap>((subscriber) => {
  compileEventTarget.addEventListener("compiled", () => {
      subscriber.next(mem())
  })
});
(window as any).compilationObservable_ = compilationObservable_ as Observable<MidiMap>

export const compilationObservable = (window as any).compilationObservable_ as Observable<MidiMap>


export function setLatestMap(map: MidiMap) {
    mem().latestMap = map;
    // mem().song["track-ids"] = mem().tracks.map((track) => track.id)
    mem().song["track-ids"] = mem().tracks.map((track) => [track.id, 0])
    compilePhasesToTracks(); // ensures that only active phases are saved, old ones oprhaned in db. @todo: code does exist that looks at orphaned ids, but nothing is done with them
    compileNotesByBarToTracks();
    saveSongAndTracks();
    compileEventTarget.dispatchEvent(new CustomEvent(("compiled")))
}
//

