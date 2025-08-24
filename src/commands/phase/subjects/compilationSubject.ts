import { Observable, Observer, Subject, Subscriber, Subscription } from "rxjs";
import { mem, Mem } from "../../../lib/mem";

import { masterTicksObservable } from "../observables/masterTicksObservable";
import { compilationObservable } from "../observables/compilationObservable";


const compilationSubject = new Subject<any>();

export const makeCompilationSubscribe = <RetType>(obj: {
    selector: (mem: Mem) => RetType,
    compare?: (a: RetType, b: RetType) => boolean
    clone?: (a: RetType) => RetType
}) => {
    let isInitialized: boolean = false
    let prev: RetType | null =  null
    const subscribe = (subscriber: Observer<RetType>) => {
        const subjectUnsubscribe = compilationSubject.subscribe({
            next: (_: number) => {
                const newVal = obj.selector(mem())
                const compared = obj.compare(newVal, prev)
                if (!compared || !isInitialized) {
                    isInitialized = true
                    prev = (obj.clone || structuredClone)(newVal)
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
    return subscribe
}

compilationObservable.subscribe(compilationSubject)