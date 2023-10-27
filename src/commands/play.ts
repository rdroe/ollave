import { Module, SyncChildCalls } from 'nyargs';
import { isStringNumNum, makeSubmodule, passivelyNumberize } from '../lib/helpers'
import { find, Subscription } from 'rxjs'
import { playTriads, Triad } from 'src/lib/music';
import { playNotes } from 'src/lib/midi';
import { cuesNamespace } from '../data'
import { findCue } from './cue2';
type Fraction = [number, number]

// in-memory namespace for notes
export const notesNamespace: {
    initialized: boolean, // whether the namespace has been initialized
    names: { // the actual namespace
        [noteName: string]: { // the note name
            interval: null | Fraction, // the interval at which the note should be played
            subscription: Subscription | null // the subscription to the cue
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


// Cli subcommand definition "nts" (the user types "play nts <arg1> <arg2> ..." to call this)
const nts = makeSubmodule('nts', async (cliArgs) => {
    // example: cliArgs = { positional: ['c4', '64', '1'] }
    const { positional } = cliArgs

    const [str, num1, num2] = positional.map(passivelyNumberize)
    const tri = [str, num1, num2]
    return isStringNumNum(tri)
        ? playNotes([tri])
        : null
}, ntsHelp)


const parseNoteAndName = (str: string): [note: string, names?: string] => {
    const parsed = str.split(',')
    const [note, ...names] = parsed
    return names.length ? [note, names.join(',')] : [note, ','];
}


const initializeOrClear = (noteNameData: string) => {
    if (notesNamespace.names[noteNameData]) {
        console.log('unsubscribing', noteNameData, notesNamespace.names[noteNameData])
        notesNamespace.names[noteNameData].subscription.unsubscribe()
        notesNamespace.names[noteNameData].interval = null
    } else {
        console.log('initializing', noteNameData)
        notesNamespace.names[noteNameData] = { interval: null, subscription: null }
    }

}

const st = makeSubmodule('st', async ({ positional }) => {

    const positionalArgs = positional.map(passivelyNumberize)
    if (!isStringNumNum(positionalArgs)) return { message: 'invalid arguments' }

    const [noteNameData, numerator, divisor] = positionalArgs
    const [note, nm] = parseNoteAndName(noteNameData)

    const [, , , observable = null] = findCue(nm) ?? []


    if (!observable) return { message: `observable ${nm} not found for note ${note}` }

    // possible unsubscribe
    initializeOrClear(noteNameData)

    notesNamespace.names[noteNameData].subscription = observable.subscribe({
        // this is the callback that will be called when the observable emits
        // actually play the note
        next: (...args: unknown[]) => {
            const triad = [note, 0.25, 0] as Triad
            console.log('playing triad', triad)
            playTriads([triad])

        },
        error: (e) => {
            console.error('subsciber error', e)
        }
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
