import { Module } from 'peprn/util'
import { Subscription } from 'rxjs'
import { playTriads, Triad } from 'src/lib/music';
import { findPhase } from '../phase/phase';
import { mem } from '../../mem';
import { z } from 'zod';
const { subscriptions } = mem()
type Fraction = [number, number]

// in-memory namespace for notes
export const notesNamespace: {
    names: { // the actual namespace
        [noteName: string]: { // the note name
            interval: null | Fraction, // the interval at which the note should be played
            subscription: Subscription | null // the subscription to the cue
        }
    }
} = {
    names: {}
}

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

const module: Module = {
    help: {
        description: 'Start a note playing on a stream',
        examples: {

        }
    },
    fn: async (args) => {
        return null
    },
    submodules: {
        st: {
            help: {
                description: 'start a note playing in response to a cue',
                examples: {
                    'c5,aphrodite': 'presumes a cue named "aphrodite"; on it, play a c5 note'
                }
            },
            fn: async ({ positionalNonCommands }) => {

                const [note, nm] = z.tuple([z.string()]).transform(([nnd]) => {
                    return parseNoteAndName(nnd)
                }).parse(positionalNonCommands)
                const observable = findPhase(nm)
                if (!observable) return { message: `observable ${nm} not found for note ${note}` }


                // possible unsubscribe
                subscriptions[`${note},${nm}`] = observable.subscribe({
                    // this is the callback that will be called when the observable emits
                    // actually play the note
                    next: (...args: unknown[]) => {
                        const triad = [note, 0.25, 0] as Triad
                        playTriads([triad])
                    },
                    error: (e) => {
                        console.error('subsciber error', e)
                    }
                })

            }
        }
    }
}

export default module
