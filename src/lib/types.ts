import { z } from "zod"
import { phaseRecordSchema, songRecordSchema, trackRecordSchema } from "./schemas"

export type SongRecord = ReturnType<typeof songRecordSchema.parse>
export type TrackRecord = z.infer<typeof trackRecordSchema>
export type PhaseRecord = z.infer<typeof phaseRecordSchema>
