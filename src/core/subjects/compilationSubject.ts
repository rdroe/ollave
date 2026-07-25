import { Observer, Subject } from 'rxjs'

// getDebugLgger removed - not used by web app
import { mem, Mem } from '../mem'
import { compilationObservable } from '../observables'

// declare window type a window property for the compilation subject
declare global {
  interface Window {
    compilationSubject: Subject<any>
    makeCompilationSubscribe_: typeof makeCompilationSubscribe_
  }
}

window.compilationSubject = new Subject<any>()
// log functionality removed - not used by web app
function makeCompilationSubscribe_<RetType>(obj: {
  name: string
  selector: (mem: Mem) => RetType
  compare?: (a: RetType, b: RetType) => boolean
  clone?: (a: RetType) => RetType
}) {
  let isInitialized: boolean = false
  let prev: RetType | null = null
  let prevStr: string | null = null
  const subscribe = (subscriber: Observer<RetType>) => {
    const subjectUnsubscribe = window.compilationSubject.subscribe({
      next: (_: number) => {
        // log removed - not used by web app
        const newVal = obj.selector(mem())
        if (obj.compare) {
          // Caller-supplied comparator (may deliberately compare a subset of
          // fields); keep the clone so prev can't be mutated out from under it.
          const compared = obj.compare(newVal, prev)
          if (!compared || !isInitialized) {
            isInitialized = true
            prev = (obj.clone || structuredClone)(newVal)
            subscriber.next(newVal)
          }
        } else {
          // Default path: one native serialize, compared as a string. Replaces
          // deepEqual (slow generic walk) + structuredClone (second walk) per
          // emission — with per-note subscribers that was the dominant cost of
          // every compile on long songs. Selector outputs are plain JSON-safe
          // data built in deterministic key order.
          const newStr = JSON.stringify(newVal)
          if (newStr !== prevStr || !isInitialized) {
            isInitialized = true
            prevStr = newStr
            subscriber.next(newVal)
          }
        }
      },
      error: (err) => {
        console.error('compilationSubject error', err)
        subscriber.error(err)
      },
      complete: () => {
        subscriber.complete()
      },
    })
    return function unsubscribe() {
      subscriber.complete()
      subjectUnsubscribe.unsubscribe()
    }
  }
  return subscribe
}
window.makeCompilationSubscribe_ = makeCompilationSubscribe_
setTimeout(() => {
  compilationObservable.subscribe(window.compilationSubject)
}, 1000)

export const makeCompilationSubscribe = window.makeCompilationSubscribe_
