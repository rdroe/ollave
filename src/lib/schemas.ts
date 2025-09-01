import { Observable, Subscription } from "rxjs"
import { PhaseRecord, SongRecord, TrackRecord } from "../commands/song/song"
import { BarTagPercent, MidiMap } from "./mapSongToTicks"
import { parseNoteTags, TagData, tagDataSchema, TagEntries, TagEntry } from "./tags"
type Unsubscribe = ReturnType<Observable<any>["subscribe"]>
import { z } from "zod"
import { isNoteNameWithOctave } from "./util/barsUtil"
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
    const _tags = note.tags.concat()
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

export const songRecordSchema_ = z.object({
    id: z.number(),
    name: z.string(),
    tempo: z.number(),
    "track-ids": z.array(
        z.tuple([z.number(), z.number()])
    ).transform((tracks) => tracks.map(([trackId, start]) => ([ trackId, start ] as [id: number, start: number])))
})

export const songRecordSchema = {
    parse: (data: any) => songRecordSchema_.parse(data) as SongRecord
}



export const phaseRecordSchema = z.object({
    id: z.number(),
    name: z.string(),
    start: z.number(),
    end: z.number(),
    "follows-ids": z.array(z.number()),
    speed: z.number(),
    barSizeMultiplier: z.number(),
    scaleName: z.string().nullable(),
    scaleTonic: z.string().nullable()
})

export const notesByBarSchema = z.record(z.string(), z.array(noteByBarSchema).transform((notes) => notes.map(note => noteByBarSchema.parse(note))))
export const trackRecordSchema = z.object({
    id: z.number(),
    "phase-ids": z.array(z.number()),
    "phase-names": z.array(z.string()),
    notesByBar: notesByBarSchema
})
export const latestMapSchema = z.record(z.string(), z.number())
export const playedMapSchema = z.record(z.string(), z.number())
export const adjustedCursorSchema = z.number()
export const doLogSchema = z.boolean()



export const memSchema = z.object({
    song: songRecordSchema,
    track: trackRecordSchema,
    phases: z.record(z.string(), phaseRecordSchema),
    notesByBar: notesByBarSchema,
    latestMap: latestMapSchema,
    playedMap: playedMapSchema,
    adjustedCursor: adjustedCursorSchema,
    doLog: doLogSchema
})
