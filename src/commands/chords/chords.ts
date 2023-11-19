import { fakeCli } from 'peprn/browser'
import { Module } from 'peprn/util'
import { Chord, Note, Scale, Mode, Collection } from 'tonal'
import { z } from 'zod'

// Mode.triads("major", "C");
// => ["C", "Dm", "Em", "F", "G", "Am", "Bdim"];


export default {
    fn: async () => {
        return null
    },
    submodules: {
        '$': {
            fn: async (args) => {
                return args['$']
            },
            submodules: {
            }
        }
    }
} as Module
