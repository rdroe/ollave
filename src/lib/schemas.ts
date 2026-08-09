import { z } from 'zod'

import { TagData } from './schemaTypes'
import { elementsById } from './ui/elements'
import { addStartEnd } from './ui/note/startEnd'
import { randId } from './util/common'
import { noteByBarSchema, tagsSchema } from './util/noteByBarSchema'
import { parseNoteTags } from './util/noteParsingUtil'

export type NoteByBarInner = {
  note: string
  _tags: string[]
  tagsObj: {
    [key: string]: TagData
  }
  set tags(tags: string[])
  get tags(): string[]
}

export type NoteByBar = Omit<NoteByBarInner, '_tags' | 'clone'> & {
  tags: string[]
}

export const tagsObjSchema = z.array(z.string()).transform((tags) => {
  return Object.fromEntries(parseNoteTags(tags))
})

export const cloneNoteByBar = (note: NoteByBar | null): NoteByBar | null => {
  if (!note) {
    return null
  }
  return wrapWithGetters(
    makeNoteByBar(
      note.note,
      structuredClone(note.tags).map((tag) => tag.split('=').join('='))
    )
  )
}
const wrapWithGetters = (
  note: z.infer<typeof noteByBarSchema>
): NoteByBarInner & {
  afterChangeFunctions: {
    [key: string]: (
      updatedTagName: string,
      updatedTagValue: TagData,
      tagsObjCopy: z.infer<typeof tagsObjSchema>
    ) => void
  }
} => {
  const afterChangeFunctions: {
    [key: string]: (
      updatedTagName: string,
      updatedTagValue: TagData,
      tagsObjCopy: z.infer<typeof tagsObjSchema>
    ) => void
  } = {}
  const _tags = note.tags.concat()
  const settableObj: z.infer<typeof tagsObjSchema> = {}
  const handler = {
    set(target: z.infer<typeof tagsObjSchema>, prop: string, value: TagData) {
      target[prop] = value
      const existingTagsIndex = _tags.findIndex((tag) =>
        tag.startsWith(`${prop}=`)
      )
      if (existingTagsIndex !== -1) {
        _tags[existingTagsIndex] = `${prop}=${value.join(',')}`
      } else {
        _tags.push(`${prop}=${value.join(',')}`)
      }
      return true
    },
  }
  const proxy = new Proxy<z.infer<typeof tagsObjSchema>>(settableObj, handler)
  const goodTagsObj: z.infer<typeof tagsObjSchema> = {
    ...note.tagsObj,
    noteId: note.tagsObj.noteId ?? [randId('', 6)],
    barDelay: note.tagsObj.barDelay ?? [0],
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
      Object.keys(afterChangeFunctions).forEach((key) => {
        afterChangeFunctions[key](key, newTagsObj[key], newTagsObj)
      })
    },
    afterChangeFunctions,
  }
}
let testMode = false
export const updateTestMode = (testModeArg: boolean) => {
  testMode = testModeArg
}
export const makeNoteByBar = (
  note: string,
  tags: string[]
): NoteByBar & {
  afterChangeFunctions: {
    [key: string]: (
      updatedTagName: string,
      updatedTagValue: TagData,
      tagsObjCopy: z.infer<typeof tagsObjSchema>
    ) => void
  }
} => {

  if (!tagsSchema.safeParse({ tags }).success) {
    if (!tags.find((tag) => tag.startsWith('noteId='))) {
      tags.push(`noteId=${randId('', 6)}`)
    }
    if (!tags.find((tag) => tag.startsWith('barDelay='))) {
      tags.push(`barDelay=0`)
    }
  }

  const tagsUniqueByName = [...new Set(tags.map((tag) => tag.split('=')[0]))]
  const tagsReversed = tags.reverse()
  const latestTagsWithValue = tagsUniqueByName.map((tagName) => {
    return tagsReversed.find((tag) => tag.split('=')[0] === tagName)
  })

  const tagsObj = tagsObjSchema.parse(tags)

  const noteByBarSansSettersOutput = noteByBarSchema.safeParse({
    note,
    tags: latestTagsWithValue,
    tagsObj,
  })
  if (!noteByBarSansSettersOutput.success) {
    console.error({
      note,
      tags: latestTagsWithValue,
      tagsObj,
    })
    console.error('Failed to parse note by bar: ' + noteByBarSansSettersOutput.error.message)
    // legacy contract: callers treat makeNoteByBar as always succeeding and a
    // parse failure has always yielded a null element; keep that shape rather
    // than throwing (behavior change) or rippling `| null` through every
    // caller (type change)
    return null as never
  }
  const noteByBarSansSetters = noteByBarSansSettersOutput.data

  const retObj = wrapWithGetters(noteByBarSansSetters)
  const noteId = z.string().parse(noteByBarSansSetters.tagsObj.noteId?.[0])
  if (testMode) {
    const controls1 = document.querySelector('#controls-1')
    if (!controls1) {
      return retObj
    }
    const existentNoteElement = elementsById.note[noteId]
    if (!existentNoteElement) {
      const noteElem = createDomElementFromHtml(
        `<div style="color: black;" class="note noteId-${noteId}" id="note-${noteId}">${retObj.note}</div>`
      )
      elementsById.note[noteId] = noteElem
      controls1.appendChild(noteElem)
    }

    addStartEnd(noteId)
  }
  return retObj
}
export function createDomElementFromHtml(html: string) {
  const div = document.createElement('div')
  div.innerHTML = html
  return div
}
const songRecordSchema_ = z.object({
  id: z
    .number()
    .refine((id) => id !== undefined, { message: 'id is required' }),
  name: z.string(),
  tempo: z.number(),
  'track-ids': z
    .array(z.tuple([z.number(), z.number()]))
    .transform((tracks) =>
      tracks.map(
        ([trackId, start]) => [trackId, start] as [id: number, start: number]
      )
    ),
})
export const songRecordSchema = {
  //
  parse: (data: unknown) => songRecordSchema_.parse(data),
}
export const phaseRecordSchema = z.object({
  id: z.number(),
  name: z.string(), //
  scaleName: z.string().nullable().optional(),
  scaleTonic: z.string().nullable().optional(),
  'follows-ids': z.array(z.number()),
  speed: z.number().nullable().optional(),
  barSizeMultiplier: z.number().nullable(),
})

export const notesByBarSchema = z.record(
  z.string(),
  z
    .array(noteByBarSchema)
    .transform((notes) => notes.map((note) => noteByBarSchema.parse(note)))
)
export const trackRecordSchema = z.object({
  id: z.number(),
  'phase-ids': z.array(z.number()),
  'phase-names': z.array(z.string()),
  notesByBar: notesByBarSchema,
  /**
   * Optional so every existing IndexedDB row still parses untouched. Absent
   * means "derive it" — see trackLabel/trackChannel — rather than a stored
   * default, so old rows are never rewritten just to gain metadata.
   */
  name: z.string().optional(),
  channel: z.number().int().min(0).max(15).optional(),
})

/** Display label for a track: its stored name, else its 1-based position. */
export const trackLabel = (
  track: { name?: string },
  trackIndex: number
): string => track.name ?? `Track ${trackIndex + 1}`

/**
 * MIDI channel for a track: its stored channel, else its index clamped to the
 * 16-channel range. Channel 9 (percussion) is deliberately NOT skipped in this
 * release — see the plan's deferred list.
 */
export const trackChannel = (
  track: { channel?: number },
  trackIndex: number
): number => track.channel ?? Math.min(trackIndex, 15)
