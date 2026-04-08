/** Milliseconds per named granularity (calendar months/years are conventional averages). */

export const MS_PER_MINUTE = 60_000
export const MS_PER_HOUR = 3_600_000
export const MS_PER_DAY = 86_400_000
export const MS_PER_WEEK = 7 * MS_PER_DAY
/** ~30.44 days — average Gregorian month */
export const MS_PER_MONTH = Math.round((365.2425 / 12) * MS_PER_DAY)
/** ~365.25 days */
export const MS_PER_YEAR = Math.round(365.2425 * MS_PER_DAY)

export type TimeGranularity =
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'year'

export const TIME_GRANULARITIES: readonly TimeGranularity[] = [
  'minute',
  'hour',
  'day',
  'week',
  'month',
  'year',
] as const

export function granularityToMs(g: TimeGranularity): number {
  switch (g) {
    case 'minute':
      return MS_PER_MINUTE
    case 'hour':
      return MS_PER_HOUR
    case 'day':
      return MS_PER_DAY
    case 'week':
      return MS_PER_WEEK
    case 'month':
      return MS_PER_MONTH
    case 'year':
      return MS_PER_YEAR
  }
}

export function granularityLabel(g: TimeGranularity): string {
  switch (g) {
    case 'minute':
      return 'minutes'
    case 'hour':
      return 'hours'
    case 'day':
      return 'days'
    case 'week':
      return 'weeks'
    case 'month':
      return 'months'
    case 'year':
      return 'years'
  }
}
