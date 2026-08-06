import { z } from 'zod'

// Moved from src/commands/phase/phase.ts so lib modules don't import from
// commands (avoids module-init cycles; commands/phase re-exports for compat).
const isTuple = (tuple: unknown): tuple is [string, number] => {
  return Array.isArray(tuple) && tuple.length === 2
}

export const parseColonTag = (
  str: string
): null | [semantic: string, number: number] => {
  let result: null | [semantic: string, number: number] = null
  if (str.match(/[^\:]\:[0-9]+/)) {
    const tuple = z
      .tuple([
        z.string(),
        z.number().or(
          z.string().transform((str) => {
            if (typeof str !== 'string') {
              throw new Error('str is not a string')
            }
            return parseInt(str)
          })
        ),
      ])
      .parse(str.split(':'))
    if (isTuple(tuple)) {
      result = tuple
    }
  }
  return result
}
