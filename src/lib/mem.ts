import { Observable, Subscription } from "rxjs"
import { PhaseRecord, SongRecord, TrackRecord } from "../commands/song/song"
import { BarTagPercent, MidiMap } from "./mapSongToTicks"
type Unsubscribe = ReturnType<Observable<any>["subscribe"]>
import { NoteByBar } from "./schemas"

export type Mem = {
    subscriptions: {
        [key: string]: Subscription
    }
    functions: {
        [songName: string]:{ [fnName: string]: (tick: number, rawTick: number, snapShot: Mem, songName: string) => void}
    },  
    observables: {
        [songName: string]: {
            [fnName: string]: Unsubscribe
        }
    }
    songPauses: {
        [key: string]: BarTagPercent
    }
    songNames: string[]
    song: Exclude<SongRecord, "id"> & { id: number } | null,
    tracks: TrackRecord[],
    phases: {
        [phaseName: string]: PhaseRecord & {
            "temp-id": number | null,
            name: string
        }
    }
    notesByBar: {
        [barTag: string]: NoteByBar[]
    },
    latestMap: MidiMap
    playedMap: MidiMap
    graphs: { [userScaleWithTonic: string]: any[] }
    played: {
        songTick: number
        note: string
        tags: string[]
        time: number
    }[],
    adjustedCursor: number,
    doLog: boolean
}

const mem_: Mem = {
    subscriptions: {},
    songPauses: {},
    functions: {},
    observables: {},
    song: null,
    tracks: [],
    phases: {},
    notesByBar: {},
    songNames: [],
    latestMap: {},
    playedMap: {},
    graphs: {},
    played: [],
    adjustedCursor: 0,
    doLog: true
};

(window as any).mem = mem_
export const mem = () => (window as any).mem as Mem
