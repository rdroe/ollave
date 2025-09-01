import { Module } from 'peprn/util'
import { mem } from '../../lib/schemas'

export default {

    fn: () => Promise.resolve(),
    submodules: {
        loggle: {
            fn: () => {
                if (mem().doLog) {
                    mem().doLog = false
                } else {
                    mem().doLog = true
                }
                return Promise.resolve()
            }

        }
    }

} as Module
