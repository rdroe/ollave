import { z } from 'zod'

import { phaseRecordSchema } from '../schemas'

export type PhaseRecord = z.infer<typeof phaseRecordSchema>
