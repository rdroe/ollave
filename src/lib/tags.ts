import { isFraction, tickCounts } from "src/commands/phase/observables/masterTicksObservable"
import { peprnIsNum, strjson } from "./helpers"
import { isCsvArg, parseCsvArg } from "src/commands/bars/utils"
import { NoteByBar } from "src/mem"
import { z } from 'zod'

export type TagData = (number | string | boolean | null)[]
export type TagEntry = [name: string, data: TagData]
export type TagEntries = [name: string, data: TagData][]

export const parseNoteTags = (tags: string[]): TagEntries => {

    const parsedTags = tags.reduce((accum, tag) => {
        if (!tag.includes('=')) {
            return [...accum, [tag, []] as [nm: string, data: TagData]]
        }
        const split = tag.split('=')
        let tagDat: TagData = []

        if (peprnIsNum(split[1])) {
            tagDat = [parseFloat(split[1])]
        } else if (isCsvArg(split[1])) {
            tagDat = parseCsvArg(split[1])
        } else {
            tagDat = [split[1]]
        }

        return [...accum, [
            split[0], tagDat
        ]] as TagEntries
    }, [] as TagEntries)

    return parsedTags
}

export const unparseTagEntries = (tes: TagEntries) => {
    return tes.map(
        ([k, td]) => {
            return `${k}=${td.toString()}`
        }
    )
}

export const filterDelayTags = (note: NoteByBar, retainBarDelay = false) => {
    const parsedTagz = parseNoteTags(note.tags)
    const cleaned = tagsDeleteMatching1(
        ([k]) => {
            if (isFraction(k)) return false
            if (!retainBarDelay) {
                if (k === 'barDelay') {
                    return false
                }
            }
            return true
        },
        parsedTagz
    )
    note.tags = unparseTagEntries(cleaned)
    return note
}

export const filterBarDelayTag = (note: NoteByBar,) => {
    const parsedTagz = parseNoteTags(note.tags)
    const cleaned = tagsDeleteMatching1(
        ([k]) => {

            if (k === 'barDelay') {
                return false
            }
            return true
        },
        parsedTagz
    )
    note.tags = unparseTagEntries(cleaned)
    return note
}

export const calcFractionalDelay = (parsedTags: TagEntries) => {
    let newNoteDelay = 0
    parsedTags.forEach(([name, data]: [nm: string, data: TagData]) => {
        if (isFraction(name)) {
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

export const groupNotesByFirstTagDatum = (notes: NoteByBar[], tag: TagEntry[0]): NoteByBar[][] => {

    const hash: { [groupId: string | number]: NoteByBar[] } = {}

    notes.forEach((note) => {
        const tagData = noteTagDatum(note, tag)
        if (!tagData) throw new Error(`At least one of the notes had no data for tag ${tag}`)
        const [firstElem] = tagData
        if (typeof firstElem === 'number' || typeof firstElem === 'string') {
            const ownGroup = hash[firstElem] ?? [] as NoteByBar[]
            ownGroup.push(note)
            hash[firstElem] = ownGroup
        } else throw new Error(`While grouping notes, the group identifier datum was non-number and non-string`)

    })
    console.log('group result', hash)
    return Object.values(hash)
}

export const tagsDeleteMatching1 = (fn: (te: TagEntry) => boolean, tagEntries: TagEntries): TagEntries => {
    return tagEntries.filter(fn)
}

export const tagsDeleteMatching2 = (fn: (te: string) => boolean, tagEntries: string[]): string[] => {
    return tagEntries.filter(fn)
}

export const tagDataOrNull = (note: NoteByBar, tag: string): null | TagEntry[1] => {
    const parsed = parseNoteTags(note.tags)
    const found = parsed.find(([tag1]) => tag1 === tag)
    if (!found) return null
    return found[1]

}

export const deleteTagByName = (tagsReference: string[]) => {

}

export const latestNote = (notes1: NoteByBar[]): NoteByBar | null => {

    const sortedNotes1 = notes1.slice().sort(({ tags: aTags }, { tags: bTags }) => {
        const timeA = calcFractionalDelay(
            parseNoteTags(aTags),
        )
        const timeB = calcFractionalDelay(
            parseNoteTags(bTags),
        )
        const ret1 = timeB - timeA


        return ret1

    }).reverse()
    console.log('next123 notes', sortedNotes1)
    const latestChordNote = sortedNotes1.find(({ tags }) => {
        console.log('next123 chord', tags)
        return !!tags.find((tag) => tag.startsWith('chord'))
    })

    if (latestChordNote === undefined && sortedNotes1 && sortedNotes1.length > 0) {
        console.error('Could not find any notes with a `chord*` tag')
    }

    console.log('next123 notes2', latestChordNote)
    return latestChordNote ?? null
}

export const earliestNote = (notes1: NoteByBar[]): NoteByBar | null => {
    const sortedNotes1 = notes1.slice().sort(({ tags: aTags }, { tags: bTags }) => {
        const timeA = calcFractionalDelay(
            parseNoteTags(aTags),
        )
        const timeB = calcFractionalDelay(
            parseNoteTags(bTags),
        )
        const ret1 = timeB - timeA


        return ret1

    })

    return sortedNotes1[0] ?? null
}

const noteTagDatum = (note: NoteByBar, tagName: string): null | TagEntry[1] => {
    return parseNoteTags(note.tags).find(([k]) => k === tagName)[1] ?? null
}

export const scale = function parseNoteScale(note: NoteByBar): [ltr: string, name: string] | null {

    const tonicDat = tagDataOrNull(
        note, 'scaleTonic'
    )
    const scaleNameDat = tagDataOrNull(
        note, 'scaleName'
    )

    if (!scaleNameDat || !tonicDat) return null

    const retVal = [
        tonicDat[0],
        scaleNameDat[0],

    ]

    return z.tuple([
        z.string(),
        z.string()
    ]).parse(
        retVal
    ) as [ltr: string, nm: string]

}
