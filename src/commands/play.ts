import { Module, SyncChildCalls } from 'nyargs';
import { isStringNumNum, makeSubmodule, passivelyNumberize } from '../lib/helpers'
import { Subscription } from 'rxjs'
import { playTriads, Triad } from 'src/lib/music';
import { playNotes } from 'src/lib/midi';
import { cuesNamespace } from '../data'
type Fraction = [number, number]

export const notesNamespace: {
    initialized: boolean,
    names: {
        [noteName: string]: {
            interval: null | Fraction,
            subscription: Subscription
        }
    }
} = {
    initialized: false,
    names: {}
}

const ntsHelp = {
    description: 'Play note',
    examples: {
        'c4 64 1': 'Play C4 note with one second delay (64 is currently ignored'
    }
}

const nts = makeSubmodule('nts', async ({ positional }) => {
    const [str, num1, num2] = positional.map(passivelyNumberize)
    const tri = [str, num1, num2]
    return isStringNumNum(tri) ? playNotes([tri]) : null
}, ntsHelp)

const noteAndName = (str: string): [note: string, names?: string] => {

    const parsed = str.split(',')
    const [note, ...names] = parsed
    return names.length ? [note, names.join(',')] : [note, ','];
}


const initializeOrClear = (noteNameData: string) => {

    if (notesNamespace.names[noteNameData]) {
        notesNamespace.names[noteNameData].subscription.unsubscribe()
        notesNamespace.names[noteNameData].interval = null
    } else {
        notesNamespace.names[noteNameData] = { interval: null, subscription: null }
    }

}

const st = makeSubmodule('st', async ({ positional }) => {

    const positionalArgs = positional.map(passivelyNumberize)
    if (!isStringNumNum(positionalArgs)) return null

    const [noteNameData, numerator, divisor] = positionalArgs
    const [note, nm] = noteAndName(noteNameData)

    const observable = cuesNamespace.names[nm] ? cuesNamespace.names[nm].observable : null
    if (!observable) return { message: `observable ${nm} not found for note ${note}` }
    // possible unsubscribe
    initializeOrClear(noteNameData)

    notesNamespace.names[noteNameData].subscription = observable.subscribe(() => {
        const triad = [note, 0.25, 0] as Triad
        playTriads([triad])
    })

    notesNamespace.names[noteNameData].interval = [numerator, divisor]

}, {
    description: 'start a note playing in response to a cue',
    examples: {
        'c5,aphrodite 1 1': 'presumes a cue named "aphrodite"; on it, play a c5 note (atm, timing is ignored)'
    }
})



const module: Module<{}> = {
    help: {
        description: 'Start a note playing on a stream',
        examples: {

        }
    },
    fn: async (args, childCalls: SyncChildCalls) => {
        return null
    },
    submodules: Object.fromEntries([nts, st]),

}



export default module
