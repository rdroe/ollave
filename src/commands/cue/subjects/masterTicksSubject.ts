import { Observable, Subject, Subscriber, } from 'rxjs'
import { curr, masterTicksObservable, tickCounts } from '../observables/masterTicksObservable'

export type Cue = [
    name: string,
    start: number,
    interval: number,
    observable: Observable<any> | null,
]

export const masterTicksSubject = new Subject<number>();

masterTicksObservable.subscribe(masterTicksSubject)

// utility function to create an observable (cue) that subscribing notes can use. the subscribers (notes) will be triggered at every observables interval passing.
export const makeSubscribe = (parent: null | Cue) => {
    return function subscribe(subscriber: Subscriber<any>) {
        masterTicksSubject.subscribe({
            next: (aTick) => {
                if (aTick % tickCounts.bar === 0) {
                    subscriber.next({
                        count: aTick,
                        sizeMs: tickCounts.bar,
                        started: 0
                    })
                }
            }
        })

        return function unsubscribe() {
            subscriber.complete()
        };
    }
}
