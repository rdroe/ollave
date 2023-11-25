import { Subject, Subscriber, } from 'rxjs'
import { masterTicksObservable, } from '../observables/masterTicksObservable'

export const masterTicksSubject = new Subject<number>();

masterTicksObservable.subscribe(masterTicksSubject)


// utility function to subscribe on a bar-length basis
export const makeTickSubscribe = () => {
    return function subscribe(subscriber: Subscriber<any>) {
        masterTicksSubject.subscribe({
            next: (aTick) => {
                subscriber.next({
                    tick: aTick,
                })
            }
        })
        return function unsubscribe() {
            subscriber.complete()
        };
    }
}
