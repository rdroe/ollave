// Re-export everything from the modularized rangeUtil helpers
export * from './rangeUtilHelpers/basicRange'
export * from './rangeUtilHelpers/readableRange'
export * from './rangeUtilHelpers/ticks'

// Re-export types
export type { NumericInput } from './rangeUtilHelpers/basicRange'
export type { StringOrNumberOrDate } from './rangeUtilHelpers/readableRange'
export type { TicksArray } from './rangeUtilHelpers/ticks'

// Re-export test modules from the separate test file
export { testRangeInner, testReadableRange, testRangeUtil } from './rangeUtilTests'
