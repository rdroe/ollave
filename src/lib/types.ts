import { z } from "zod"
import { phaseRecordSchema, songRecordSchema, trackRecordSchema } from "./schemas"

export type SongRecord = {
    id: number
    name: string
    tempo: number
    "track-ids": number[]
}

export type TrackRecord = z.infer<typeof trackRecordSchema>

export type PhaseRecord = {
    id: number
    name: string
    "follows-ids": number[]
    barSizeMultiplier: number
    speed: number
    scaleName: string
    scaleTonic: string
}
