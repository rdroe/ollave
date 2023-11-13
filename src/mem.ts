import { Observable, Subscription } from "rxjs"
export type Mem = {
    subscriptions: {
        [key: string]: Subscription
    }
    observables: {
        [key: string]: Observable<any>
    }
    songNames: string[]
    song: {
        name: string | null
        id: null | number,
        extraTracks?: {
            [id: number]: string | number
        }
    }
    track: {
        id: number | null
        start: number | null
    }
    phases: {
        [phaseName: string]: {
            id: number | null;
            "temp-id": number | null;
            "follows-ids": number[];
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
    song: {
        name: null,
        id: null
    },
    track: {
        id: null,
        start: null
    },
    phases: {},
    notesByBar: {},
    songNames: []
};

(window as any).mem = mem_
export const mem = () => (window as any).mem as Mem

