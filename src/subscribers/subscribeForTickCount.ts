import { useRef } from 'react'

import {
  startCueObservable,
  stopCueObservable,
} from 'src/core/observables/songObservables'
import { masterTicksSubject } from 'src/core/subjects/masterTicksSubject'

import { mem } from '../core/mem'

export const subscribeForTickCount = (startAt: number, tickCount: number) => {
  const wasRunning = mem().isRunning === true
  stopCueObservable()
  startCueObservable(startAt)
  const unsubscribe = masterTicksSubject.subscribe({
    next: () => {
      const tick = mem().adjustedCursor
      console.log('tick', {
        tick,
        startAt,
        tickCount,
        diff: tick - startAt,
      })
      if (tick - startAt >= tickCount) {
        unsubscribe.unsubscribe()
        if (!wasRunning) {
          stopCueObservable()
        }
      }
    },
    complete: () => {
      unsubscribe.unsubscribe()
    },
  })
}
