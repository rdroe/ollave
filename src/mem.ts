import { Observable, Subscription } from "rxjs"

export const subscriptions: {
    [key: string]: Subscription
} = {}

export const observables: {
    [key: string]: Observable<any>
} = {}

export const songNames: string[] = []

export const song: {
    name: string | null
    id: null | number,
    extraTracks?: {
        [id: number]: string | number
    }
} = {
    name: null,
    id: null
}

export const track: {
    id: number | null
    start: number | null
} = {
    id: null,
    start: null
}

export const phases: {
    [phaseName: string]: {
        id: number | null;
        "temp-id": number | null;
        "follows-ids": number[];
    }
} = {}

export const notesByBar: {
    [barTag: string]: {
        "bar-tag": string;
        note: string;
        tags: string[];
    }[]
} = {}
