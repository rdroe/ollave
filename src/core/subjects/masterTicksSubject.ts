import { Subject, Subscriber, } from 'rxjs'
import { masterTicksObservable } from '../observables/masterTicksObservable'

export const masterTicksSubject = new Subject<number>();

masterTicksObservable.subscribe(masterTicksSubject)


// utility function to subscribe on a bar-length basis
export const makeTickSubscribe = (initTick: number = 0) => {
    return function subscribe(subscriber: Subscriber<{tick: number}>) {
        let tick = initTick
        const subjectUnsubscribe = masterTicksSubject.subscribe({
            next: () => {
                subscriber.next({
                    tick,
                })
                tick += 1
            }
        })
        return function unsubscribe() {

            subscriber.complete()
            subjectUnsubscribe.unsubscribe()
        };
    }
}


