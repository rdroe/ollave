import { isFraction, tickCounts } from "src/commands/phase/observables/masterTicksObservable"
import { peprnIsNum, strjson } from "./helpers"

export type TagData = (number | string | boolean | null)[]
export type TagEntry = [name: string, data: TagData]
export type TagEntries = [name: string, data: TagData][]

export const parseNoteTags = (tags: string[]): TagEntries => {

    const parsedTags = tags.reduce((accum, tag) => {
        if (!tag.includes('=')) {
            return [...accum, [tag, []] as [nm: string, data: TagData]]
        }
        const split = tag.split('=')

        const right = peprnIsNum(split[1]) ? parseFloat(split[1]) : split[1]
        return [...accum, [
            split[0], [right]
        ]] as TagEntries
    }, [] as TagEntries)

    return parsedTags
}

export const calcFractionalDelay = (parsedTags: TagEntries) => {
    let newNoteDelay = 0
    parsedTags.forEach(([name, data]: [nm: string, data: TagData]) => {

        if (isFraction(name)) {
            const start = newNoteDelay
            const [num] = data
            if (typeof num === 'number') {
                const taggedTickFactor = tickCounts[name]

                newNoteDelay += (taggedTickFactor * num)

            } else {
                const str = strjson(parsedTags)
                throw new Error(`Non-numeric fractional delay ${JSON.stringify(
                    num
                )} ; all tag entries: ${str}`)
            }

            console.log('is fractional', { name, parsedTags, start, newNoteDelay })
        }

    })
    return newNoteDelay
}

export const calcTickDelay = (parsedTags: TagEntries) => {
    let newNoteDelay = 0
    const delay = parsedTags.find(([name]: [nm: string, data: TagData]) => {
        return name == 'barDelay'
    })

    if (delay) {
        const [noteCnt] = delay[1]
        if (typeof noteCnt === 'number') {
            newNoteDelay += noteCnt
        } else {
            throw new Error(`Non-numeric eigth note ${JSON.stringify(
                delay
            )}`)
        }
    }
    return newNoteDelay
}

export const tagsDeleteMatching1 = (fn: (te: TagEntry) => boolean, tagEntries: TagEntries): TagEntries => {
    return tagEntries.filter(fn)
}

export const tagsDeleteMatching2 = (fn: (te: string) => boolean, tagEntries: string[]): string[] => {
    return tagEntries.filter(fn)
}

export const deleteTagByName = (tagsReference: string[]) => {

}
