import { Module } from 'peprn/util'
import { mem } from '../../mem'

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
                console.log('logging var', mem().doLog)
                return Promise.resolve()
            }

        }
    }

} as Module
