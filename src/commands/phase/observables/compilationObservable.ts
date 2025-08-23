import { Observable } from "rxjs";
import { subscribeToSongTicks } from "src/commands/song/observables";
import { mem, Mem } from "src/lib/mem";


const observableCache : {
    _: Observable<Mem> | null
} = {
_: null
}
let latestMap: Mem['latestMap'] = {}

export const getInitializedCompilationObservable = (songName: string) => { 
    if (observableCache._) {
        console.log('compilationObservable already initialized')
        return observableCache._
    }
    const observable = new Observable<Mem>((observer) => {
        subscribeToSongTicks(
            songName,
            'compilation',
            (tick, rawTick, snapShot, songName) => {
                const latestLatestMap = mem().latestMap
                if (latestLatestMap !== latestMap) {
                    console.log('compilationObservable next')
                    console.log('observableCache', observable)
                    latestMap = latestLatestMap
                    observer.next(mem())
                }
            }
        )
    });
    observableCache._ = observable
    return observableCache._
}

// export const masterTicksObservable = new Observable(function subscribe(subscriber: Subscriber<any>) {


// masterTicksObservable.subscribe(masterTicksSubject)
// in masterTicksSubject . . . 
// const masterTicksSubject = new Subject<number>();
//  makeTickSubscribe =>  subscriber: Subscriber<any>) {}
// in observables 
// songObservable = new Observable(makeTickSubscribe(startAt))
// observables['tick'] = songObservable.subscribe({ 

// 
// compilationObservable.subscribe(masterTicksSubject)
// in compilationSubject . . . 
// const masterTicksSubject = new Subject<number>();
//  makeTickSubscribe =>  subscriber: Subscriber<any>) {}

// in observables  ( actually in init)
// songObservable = new Observable(makeTickSubscribe(startAt)) xyz
// observables['tick'] = songObservable.subscribe({ 

// xyz songObservable = getInitializedCompilationObservable(songName)

