import { Subject, Subscriber } from "rxjs";
import { mem, Mem } from "../../../lib/mem";

import { masterTicksObservable } from "../observables/masterTicksObservable";


export const compilationSubject = new Subject<any>();

// utility function to subscribe only when the latestMap reference is updated
export const makeCompilationSubscribe = (obj: {
    prev: any,
    selector: (mem: Mem) => any,
    compare?: (a: any, b: any) => boolean
}) => {
    let latestMap = mem().latestMap || {}
    return function subscribe(subscriber: Subscriber<any>) {
        const subjectUnsubscribe = compilationSubject.subscribe({
            next: () => {
                // if the CURRENT latestMap (that is, on mem) is the same, no next.
                if (mem().latestMap === latestMap) {
                    return
                }
                latestMap = mem().latestMap
                const newVal = obj.selector(mem())
                console.log('newVal', newVal)
                if (obj.compare(newVal, obj.prev)) {
                    obj.prev = newVal
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