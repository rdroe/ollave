
// using the currently loaded song, do any of the following.
// updated both mem.ts and the database.

import { phases } from "./mem"

// phase <new-phase> follows <existing-phase>
export async function phaseFollowsPhase(subject: string, objects: string[]) {
    objects.forEach((obj) => {
        if (!phases[obj]) {
            throw new Error(`phase ${obj} does not exist`)
        }
    })

    // if subject exists, add follows-ids.
    if (phases[subject]) {
        phases[subject]["follows-ids"] = phases[subject]["follows-ids"].concat(objects.map((obj) => phases[obj].id ?? phases[obj]["temp-id"]))

        // if subject does not exist, create it with a default note block (1 empty bar) and the specified  follows-ids.
    } else {

        phases[subject] = {
            id: null,
            "temp-id": null,
            "follows-ids": objects.map((obj) => phases[obj].id)
        }


    }
}
export async function phaseUnfollows(subject: string, objects: string[]) {
    // where this subject is followed, remove this subject from the follows-ids
    // remove all follows-ids from subject
}


