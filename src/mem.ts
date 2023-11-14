import { Observable, Subscription } from "rxjs"
import { PhaseRecord, SongRecord, TrackRecord } from "./commands/song/song"
export type Mem = {
    subscriptions: {
        [key: string]: Subscription
    }
    observables: {
        [key: string]: Observable<any>
    }
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
    observables: {},
    song: null,
    track: null,
    phases: {},
    notesByBar: {},
    songNames: []
};

(window as any).mem = mem_
export const mem = () => (window as any).mem as Mem

