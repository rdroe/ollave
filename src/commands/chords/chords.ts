import { Module } from 'peprn/util'

// Mode.triads("major", "C");
// => ["C", "Dm", "Em", "F", "G", "Am", "Bdim"];

export default {
    fn: async () => {
        return null
    },
    submodules: {
        '$': {

            fn: async (args) => {
                const phaseOrBar = args['$']
            },
            submodules: {
                shape: {
                    fn: async () => { },
                }
            }
        },
    }
} as Module
