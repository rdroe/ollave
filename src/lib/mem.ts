import { Observable, Subscription } from "rxjs"
import { PhaseRecord, SongRecord, TrackRecord } from "../commands/song/song"
import { BarTagPercent, MidiMap } from "./mapSongToTicks"
import { parseNoteTags, TagData, TagEntries, TagEntry } from "./tags"
type Unsubscribe = ReturnType<Observable<any>["subscribe"]>
import { z } from "zod"
import { isNoteNameWithOctave } from "../commands/bars/utils"
export type NoteByBar = {
    note: string;
    _tags: string[]
    tagsObj: {
        [key: string]: TagData
    }
    set tags(tags: string[])
    get tags(): string[]
}

const requiredTags = ['noteId', 'barDelay'] 
const tagsObjSchema = z.array(z.string()).transform(
    (tags) => Object.fromEntries((parseNoteTags(tags)))
)
const tagsSchema = z.array(z.string()).refine((tags) => {
    const tagNames = tags.map((tag) => tag.split('=')[0]) 
    return requiredTags.every((tag) => tagNames.includes(tag))
}, {
    message: 'Tags must include both noteId and barDelay'
})
export const noteByBarSchema = z.object({
    note: z.string().refine(isNoteNameWithOctave),
    tags: tagsSchema,
    tagsObj: z.object({
        noteId: z.array(z.string().or(z.number())),
        barDelay: z.array(z.number())
    })
})

const wrapWithGetters = (note: z.infer<typeof noteByBarSchema>): NoteByBar => {
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
            this.tagsObj = new Proxy(newTagsObj, handler)
        }
    }
}

export const makeNoteByBar = (note: string, tags: string[]): NoteByBar => {
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

