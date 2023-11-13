import { Subject, Subscriber, } from 'rxjs'
import { masterTicksObservable, tickCounts, } from '../observables/masterTicksObservable'

export const masterTicksSubject = new Subject<number>();

masterTicksObservable.subscribe(masterTicksSubject)


// utility function to subscribe on a bar-length basis
export const makeTickSubscribe = (initTick: number) => {
    return function subscribe(subscriber: Subscriber<any>) {
        masterTicksSubject.subscribe({
            next: (aTick) => {
                subscriber.next({
                    tick: aTick, // convert world
                })
            }
        })
        return function unsubscribe() {
            subscriber.complete()
        };
    }
}
