import {  Observer, Subject, Subscriber, Subscription } from "rxjs";
import { mem, Mem } from "../mem";
import { compilationObservable } from "../observables";
import { getDebugLgger } from "../../lib/log";

// declare window type a window property for the compilation subject
declare global {
    interface Window {
        compilationSubject: Subject<any>
        makeCompilationSubscribe_: typeof makeCompilationSubscribe_
    }
};

window.compilationSubject = new Subject<any>();
const log = getDebugLgger()
function makeCompilationSubscribe_ <RetType>(obj: {
    name: string,
    selector: (mem: Mem) => RetType,
    compare?: (a: RetType, b: RetType) => boolean
    clone?: (a: RetType) => RetType
}) {

    let isInitialized: boolean = false
    let prev: RetType | null =  null
    const subscribe = (subscriber: Observer<RetType>) => {
        const subjectUnsubscribe = window.compilationSubject.subscribe({
            next: (_: number) => {
                log('makeCompilationSubscribe', obj.name, 'next')
                const newVal = obj.selector(mem())
                const compared = obj.compare(newVal, prev)
                if (!compared || !isInitialized) {
                    isInitialized = true
                    prev = (obj.clone || structuredClone)(newVal)
                    subscriber.next(newVal)
                }
            },
            error: (err) => {
                console.error('compilationSubject error', err)
                subscriber.error(err)
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
window.makeCompilationSubscribe_ = makeCompilationSubscribe_
compilationObservable.subscribe(window.compilationSubject)

export const makeCompilationSubscribe = window.makeCompilationSubscribe_

