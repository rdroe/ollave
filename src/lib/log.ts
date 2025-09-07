import { mem } from "src/core/mem"



export const getDebugLgger = () => (...args: any[]) => {
    if (mem().doLog) {
        console.log(...args)
    }
}
