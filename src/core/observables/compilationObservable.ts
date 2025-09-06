import { Observable } from "rxjs";
import {  MidiMap } from "../../lib/mapSongToTicks";
import { mem } from "../mem";
import { compileNotesByBarToTracks, compilePhasesToTracks, saveSongAndTracks } from "../../lib/util/schemaUtil";

(window as any).compileEventTarget = new window.EventTarget();

export function setLatestMap(map: MidiMap) {
    mem().latestMap = map;
    // mem().song["track-ids"] = mem().tracks.map((track) => track.id)
    mem().song["track-ids"] = mem().tracks.map((track) => [track.id, 0])
    compilePhasesToTracks(); // ensures that only active phases are saved, old ones oprhaned in db. @todo: code does exist that looks at orphaned ids, but nothing is done with them
    compileNotesByBarToTracks();
    saveSongAndTracks();
    (window as any).compileEventTarget.dispatchEvent(new window.CustomEvent("compiled"))
}

export const compilationObservable = new Observable<MidiMap>((subscriber) => {
    (window as any).compileEventTarget.addEventListener("compiled", () => {
        subscriber.next(mem())
    })
})
