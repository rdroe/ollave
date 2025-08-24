import { Subject, Subscriber } from "rxjs";
import { mem, Mem } from "../../../lib/mem";

import { masterTicksObservable } from "../observables/masterTicksObservable";


export const compilationSubject = new Subject<any>();

// utility function to subscribe only when the latestMap reference is updated
export const makeCompilationSubscribe = <RetType>(obj: {
    selector: (mem: Mem) => RetType,
    compare?: (a: RetType, b: RetType) => boolean
}) => {
    let latestMap = mem().latestMap || {}
    let prev: RetType | null = null
    return function subscribe(subscriber: Subscriber<RetType>) {
        const subjectUnsubscribe = compilationSubject.subscribe({
            next: (_: number) => {
                // if the CURRENT latestMap (that is, on mem) is the same, no next.
                if (mem().latestMap === latestMap) {
                    return
                }
                latestMap = mem().latestMap
                const newVal = obj.selector(mem())
                if (!obj.compare(newVal, prev)) {
                    prev = newVal
                    subscriber.next(newVal)
                }
            },
            complete: () => {
                subscriber.complete()
            }
        })
        return function unsubscribe() {
            subscriber.complete()
            subjectUnsubscribe.unsubscribe()
        }
    }
}

masterTicksObservable.subscribe(compilationSubject)