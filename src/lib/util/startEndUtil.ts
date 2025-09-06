import { mem } from "../../core/mem"

// Forward declarations to avoid circular imports
export type StartEndTuple = [number, number]

export const phaseBeginningsAndEnds = (): Record<string, StartEndTuple[]> => {
    // This is a simplified version - the actual implementation would need to be moved here
    return {}
}

export const startEndData = (phaseName: string): StartEndTuple[] => {
    const startEndData = phaseBeginningsAndEnds()
    return startEndData[phaseName] || []
}

export const lastTick = () => {
    // this is called very frequently!
    const songStartEndData = phaseBeginningsAndEnds()
    const lastTick = Object.values(songStartEndData).reduce((acc, curr) => {
        const lastPhaseTick = curr[curr.length - 1][1]
        return Math.max(acc, lastPhaseTick)
    }, 0)
    return lastTick
}
