import { Observable, Subscription } from "rxjs"
import { PhaseRecord, SongRecord, TrackRecord } from "./commands/song/song"
import { BarTagPercent, MidiMap } from "./mapSongToTicks"
type Unsubscribe = ReturnType<Observable<any>["subscribe"]>
export type NoteByBar = {
    note: string;
    tags: string[];
}
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

    songNames: string[]
    song: Exclude<SongRecord, "id"> & { id: number } | null,
    track: Exclude<TrackRecord, "id"> & { id: number } | null,
    phases: {
        [phaseName: string]: PhaseRecord & {
            "temp-id": number | null
        }
    }
    notesByBar: {
        [barTag: string]: NoteByBar[]
    },
    latestMap: MidiMap
    graphs: { [userScaleWithTonic: string]: any[] }
    played: {
        songTick: number
        tags: string[]
        time: number
    }[],
    adjustedCursor: number,
    doLog: boolean
}

const mem_: Mem = {
    subscriptions: {},
    songPauses: {},

    observables: {},
    song: null,
    track: null,
    phases: {},
    notesByBar: {},
    songNames: [],
    latestMap: {},
    graphs: {},
    played: [],
    adjustedCursor: 0,
    doLog: true
};

(window as any).mem = mem_
export const mem = () => (window as any).mem as Mem

