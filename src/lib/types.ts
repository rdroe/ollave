import { z } from 'zod'

import {
  phaseRecordSchema,
  songRecordSchema,
  trackRecordSchema,
} from './schemas'

export type SongRecord = {
  id: number
  name: string
  tempo: number
  'track-ids'?: [id: number, dat: number][]
}

export type TrackRecord = z.infer<typeof trackRecordSchema>
