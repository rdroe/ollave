import { Mem } from "./types"

// Re-export Mem type for backward compatibility
export type { Mem }

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

