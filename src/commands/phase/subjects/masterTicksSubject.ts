import { Subject, Subscriber, } from 'rxjs'
import { masterTicksObservable, tickCounts, } from '../observables/masterTicksObservable'

export const masterTicksSubject = new Subject<number>();

masterTicksObservable.subscribe(masterTicksSubject)

// utility function to subscribe on a bar-length basis
export const makeSubscribe = () => {
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
