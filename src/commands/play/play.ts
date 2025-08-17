import { Module } from 'peprn/util'
import { Subscription } from 'rxjs'
import { playTriads, Triad } from 'src/lib/music';
import { findPhase } from '../phase/phase';
import { mem } from '../../lib/mem';
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

const module: Module = {
    help: {
        description: 'Start a note playing on a stream',
        examples: {

        }
    },
    fn: async (args) => {
        return null
    },
    submodules: {}
}

export default module
