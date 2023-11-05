import { Observable, Subscription } from "rxjs"

export const subscriptions: {
    [key: string]: Subscription

} = {}

export const observables: {
    [key: string]: Observable<any>
} = {}
