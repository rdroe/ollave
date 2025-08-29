import { Observable } from "rxjs";
import { mapSongToMidiTicks, MidiMap } from "../../../lib/mapSongToTicks";
import { mem } from "../../../lib/mem";


// create custom events
(window as any).compiledEvent = 
(window as any).compileEventTarget = new window.EventTarget();

export function setLatestMap(map: MidiMap) {
    mem().latestMap = map;
    (window as any).compileEventTarget.dispatchEvent(new window.CustomEvent("compiled"))
}

export const compilationObservable = new Observable<MidiMap>((subscriber) => {
    (window as any).compileEventTarget.addEventListener("compiled", () => {
        subscriber.next(mem())
    })
})

