import { mem } from "../../core/mem"

export const getFollowingPhases = (phaseName: string) => {
    const phase = mem().phases[phaseName]
    const followsPhases = Object.entries(mem().phases).filter((
        [,
            { "follows-ids": followsIds }
        ]) => phase.id !== null && followsIds.includes(phase.id) || phase.id !== null && followsIds.includes(phase["id"]))

    return followsPhases
}
