import { MidiMap } from "../../../lib/mapSongToTicks";
import { mem } from "../../../lib/mem";



export function setLatestMap(map: MidiMap) {
    mem().latestMap = map
}