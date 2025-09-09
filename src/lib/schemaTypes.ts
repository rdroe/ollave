import { z } from 'zod'

export type TagData = (number | string | boolean | null)[]

export const tagDataSchema = z.array(
  z.string().or(z.number()).or(z.boolean()).or(z.null())
)
export type TagEntry = [name: string, data: TagData]
export type TagEntries = [name: string, data: TagData][]
