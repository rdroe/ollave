import { mem } from '../core/mem'

export const getDebugLgger =
  () =>
  (...args: any[]) => {
    if (mem().doLog) {
      console.log(...args)
    }
  }
