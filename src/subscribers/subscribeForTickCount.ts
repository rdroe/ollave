import { mem } from '../core/mem'
import {
  startCueObservable,
  stopCueObservable,
} from '../core/observables/songObservables'
import { masterTicksSubject } from '../core/subjects/masterTicksSubject'

export const subscribeForTickCount = (startAt: number, tickCount: number) => {
  const wasRunning = mem().isRunning === true
  stopCueObservable()
  startCueObservable(startAt)
  const unsubscribe = masterTicksSubject.subscribe({
    next: () => {
      const tick = mem().adjustedCursor

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
