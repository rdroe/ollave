import { Observable } from "rxjs";
import {  MidiMap } from "../../lib/mapSongToTicks";
import { mem } from "../../lib/mem";
import { compileNotesByBarToTracks, saveSongAndTracks } from "src/lib/helpers";


// create custom events
(window as any).compiledEvent = 
(window as any).compileEventTarget = new window.EventTarget();

export function setLatestMap(map: MidiMap) {  
    mem().latestMap = map;
    mem().song["track-ids"] = mem().tracks.map((track) => [track.id, 0])
    compileNotesByBarToTracks();
    saveSongAndTracks();
    (window as any).compileEventTarget.dispatchEvent(new window.CustomEvent("compiled"))
}

export const compilationObservable = new Observable<MidiMap>((subscriber) => {
    (window as any).compileEventTarget.addEventListener("compiled", () => {
        subscriber.next(mem())
    })
})

