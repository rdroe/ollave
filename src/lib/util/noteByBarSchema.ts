import { z } from 'zod'

import { parseNoteTags } from './noteParsingUtil'
import { isNoteNameWithOctave } from './noteValidationUtil'
const requiredTags = ['noteId', 'barDelay']
export const tagsObjSchema = z.array(z.string()).transform((tags) => {
  return Object.fromEntries(parseNoteTags(tags))
})
export const tagsSchema = z.array(z.string()).refine(
  (tags) => {
    const tagNames = tags.map((tag) => tag.split('=')[0])
    return requiredTags.every((tag) => tagNames.includes(tag))
  },
  {
    message: 'Tags must include both noteId and barDelay',
  }
)

export const noteByBarSchema = z.object({
  note: z.string().refine((str) => {
    const isValid = isNoteNameWithOctave(str) ?? false
    if (!isValid) {
      console.error(`Invalid note name: ${str}`)
    }
    return isValid
  }),
  tags: tagsSchema,
  tagsObj: z.record(
    z.string(),
    /* tag data */ z.array(
      z.string().or(z.number()).or(z.boolean()).or(z.null())
    )
  ),
})
