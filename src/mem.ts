import { Observable, Subscription } from "rxjs"
import { PhaseRecord, SongRecord, TrackRecord } from "./commands/song/song"
import { BarTagPercent } from "./mapSongToTicks"
type Unsubscribe = ReturnType<Observable<any>["subscribe"]>
export type Mem = {
    subscriptions: {
        [key: string]: Subscription
    }
    observables: {
        [key: string]: Unsubscribe
    }
    songPauses: {
        [key: string]: BarTagPercent
    }
    publishedCursor: number
    songNames: string[]
    song: Exclude<SongRecord, "id"> & { id: number } | null,
    track: Exclude<TrackRecord, "id"> & { id: number } | null,
    phases: {
        [phaseName: string]: PhaseRecord & {
            "temp-id": number | null
        }
    }
    notesByBar: {
        [barTag: string]: {
            barTag: string;
            note: string;
            tags: string[];
        }[]
    },
}

const mem_: Mem = {
    subscriptions: {},
    songPauses: {},
    publishedCursor: 0,
    observables: {},
    song: null,
    track: null,
    phases: {},
    notesByBar: {},
    songNames: []
};

(window as any).mem = mem_
export const mem = () => (window as any).mem as Mem

