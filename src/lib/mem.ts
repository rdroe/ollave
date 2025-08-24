import { Observable, Subscription } from "rxjs"
import { PhaseRecord, SongRecord, TrackRecord } from "../commands/song/song"
import { BarTagPercent, MidiMap } from "./mapSongToTicks"
import { parseNoteTags, TagData, tagDataSchema, TagEntries, TagEntry } from "./tags"
type Unsubscribe = ReturnType<Observable<any>["subscribe"]>
import { z } from "zod"
import { isNoteNameWithOctave } from "../commands/bars/utils"
import { randId } from "./helpers"
export type NoteByBarInner = {
    note: string;
    _tags: string[]
    tagsObj: {
        [key: string]: TagData
    }
    set tags(tags: string[])
    get tags(): string[]

}

export type NoteByBar = Omit<NoteByBarInner, '_tags' | 'clone' > & {
    tags: string[]
}

const requiredTags = ['noteId', 'barDelay']
export const tagsObjSchema = z.array(z.string()).transform(
    (tags) => Object.fromEntries((parseNoteTags(tags)))
)
const tagsSchema = z.array(z.string()).refine((tags) => {
    const tagNames = tags.map((tag) => tag.split('=')[0]) 
    return requiredTags.every((tag) => tagNames.includes(tag))
}, {
    message: 'Tags must include both noteId and barDelay'
})
export const noteByBarSchema = z.object({
    note: z.string().refine((str) => isNoteNameWithOctave(str) ?? false),
    tags: tagsSchema,
    tagsObj: z.record(z.string(), tagDataSchema).refine((obj) => {
        return requiredTags.every((tag) => obj[tag] !== undefined)
    }, {
        message: 'Tags must include both noteId and barDelay'
    })
})
export const cloneNoteByBar = (note: NoteByBar): NoteByBar => {
    return wrapWithGetters(makeNoteByBar(note.note, structuredClone(note.tags).map((tag) => tag.split('=').join('='))))
}
const wrapWithGetters = (note: z.infer<typeof noteByBarSchema>): NoteByBarInner => {
    const _tags = note.tags
    const settableObj: z.infer<typeof tagsObjSchema> = {}
    const handler = {
        set(target: z.infer<typeof tagsObjSchema>, prop: string, value: TagData) {
            target[prop] = value 
            const existingTagsIndex = _tags.findIndex((tag) => tag.startsWith(`${prop}=`))
            if (existingTagsIndex !== -1) {
                _tags[existingTagsIndex] = `${prop}=${value.join(',')}`
            } else {
                _tags.push(`${prop}=${value.join(',')}`)
            }
            return true
        }
    }
    const proxy = new Proxy<z.infer<typeof tagsObjSchema>>(settableObj, handler)
    const goodTagsObj: z.infer<typeof tagsObjSchema> = {
        ...note.tagsObj,
        noteId: note.tagsObj.noteId ?? [randId('', 6)],
        barDelay: note.tagsObj.barDelay ?? [0]
    }
    // initialize proxy (the tagsObj) with existing tags
    Object.keys(goodTagsObj).forEach((key) => {
        proxy[key] = goodTagsObj[key]
    })

    return {
        note: note.note,
        tagsObj: proxy,
        _tags,
        get tags() {
            return this._tags
        },
        set tags(tags: string[]) {
            this._tags = tags
            const newTagsObj = tagsObjSchema.parse(tags)
            Object.keys(newTagsObj).forEach((key) => {
                proxy[key] = newTagsObj[key]
            })
        }
    }
}

export const makeNoteByBar = (note: string, tags: string[]): NoteByBar => {

    if (!tagsSchema.safeParse({ tags }).success) {
        if (!tags.find((tag) => tag.startsWith('noteId='))) {
            tags.push(`noteId=${randId('', 6)}`)
        }
        if (!tags.find((tag) => tag.startsWith('barDelay='))) {
            tags.push(`barDelay=0`)
        }
    }

    const tagsObj = tagsObjSchema.parse(tags)

    const noteByBarSansSetters = noteByBarSchema.parse({ note, tags, tagsObj })
    return wrapWithGetters(noteByBarSansSetters)
}

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
    track: null,
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

