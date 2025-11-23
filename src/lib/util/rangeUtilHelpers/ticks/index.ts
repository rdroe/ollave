import type { StringOrNumberOrDate } from '../readableRange'
import {
  accessConversionStore,
  getConversionEventNames,
  conversionEmitters,
} from '../readableRange'

export type TicksArray<InputType extends StringOrNumberOrDate> = Array<{
  value: InputType
  label: string
  dimensions?: { width: number; height: number }
}>

const ticksStore: {
  [rangeId: string]: {
    ticks: {
      viewableRange: TicksArray<StringOrNumberOrDate>
      nextLeftRange: TicksArray<StringOrNumberOrDate>
      nextRightRange: TicksArray<StringOrNumberOrDate>
    }
    fns: {
      createDefaultTicks: (
        inputRange: [start: StringOrNumberOrDate, end: StringOrNumberOrDate]
      ) => TicksArray<StringOrNumberOrDate>
    }
  }
} = {}

const ticksEmitters: {
  [rangeId: string]: {
    ticksChanged: EventTarget
    loading: boolean
    cleanup: (() => void)[]
  }
} = {}

const TICKS_CHANGED_EVENT = 'TICKS_CHANGED'

const getTicksEventNames = (rangeId: string) => {
  return {
    ticksChanged: `${rangeId}-${TICKS_CHANGED_EVENT}`,
  }
}

export const accessTicksStore = <InputType extends StringOrNumberOrDate>(
  rangeId: string
) => {
  return {
    ticks: ticksStore[rangeId].ticks as {
      viewableRange: TicksArray<InputType>
      nextLeftRange: TicksArray<InputType>
      nextRightRange: TicksArray<InputType>
    },
    fns: ticksStore[rangeId].fns,
  } as {
    ticks: {
      viewableRange: TicksArray<InputType>
      nextLeftRange: TicksArray<InputType>
      nextRightRange: TicksArray<InputType>
    }
    fns: {
      createDefaultTicks: (
        inputRange: [start: InputType, end: InputType]
      ) => TicksArray<InputType>
    }
  }
}

// listens for the readable range to be updated, and creates the ticks array for the range passed as input
const viewableRangeTicksChangedHandler = <
  InputType extends StringOrNumberOrDate,
>(
  conversionEvent: Event & {
    detail: {
      rangeId: string
      viewableRange: [start: InputType, end: InputType]
    }
  }
): void => {
  const { rangeId, viewableRange } = conversionEvent.detail
  if (!rangeId || viewableRange === undefined) {
    throw new Error('Invalid event detail')
  }
  accessTicksStore<InputType>(rangeId).ticks.viewableRange =
    accessTicksStore<InputType>(rangeId).fns.createDefaultTicks(viewableRange)
}

const nextLeftRangeTicksChangedHandler = <
  InputType extends StringOrNumberOrDate,
>(
  conversionEvent: Event & {
    detail: {
      rangeId: string
      nextLeftRange: [start: InputType, end: InputType]
    }
  }
): void => {
  const { rangeId, nextLeftRange } = conversionEvent.detail
  if (!rangeId || nextLeftRange === undefined) {
    throw new Error('Invalid event detail')
  }
  accessTicksStore<InputType>(rangeId).ticks.nextLeftRange =
    accessTicksStore<InputType>(rangeId).fns.createDefaultTicks(nextLeftRange)
}

const nextRightRangeTicksChangedHandler = <
  InputType extends StringOrNumberOrDate,
>(
  conversionEvent: Event & {
    detail: {
      rangeId: string
      nextRightRange: [start: InputType, end: InputType]
    }
  }
): void => {
  const { rangeId, nextRightRange } = conversionEvent.detail
  if (!rangeId || nextRightRange === undefined) {
    throw new Error('Invalid event detail')
  }
  accessTicksStore<InputType>(rangeId).ticks.nextRightRange =
    accessTicksStore<InputType>(rangeId).fns.createDefaultTicks(nextRightRange)
}

export const registerTicks = <InputType extends StringOrNumberOrDate>(
  rangeId: string,
  createDefaultTicks: ([start, end]: [
    start: InputType,
    end: InputType,
  ]) => TicksArray<StringOrNumberOrDate>,
  isReregistration: boolean = false
) => {
  // ticks are registered to respond to the human-readable ranges being updated, such as viewable range, next left range, next right range in the reagle range.
  // so we need to register the ticks to respond to the readable range events.
  // this function assumes the readable range (and at a lower level, the numeric range) with rangeId is already registered
  // First, set up this range id in the ticks store and emitters
  const conversionEventNames = getConversionEventNames(rangeId)
  if (ticksEmitters[rangeId] && !isReregistration) {
    // todo: remove the appropriate ticksStore fns and ticksEmitters, etc.
  } else {
    ticksEmitters[rangeId] = {
      ticksChanged: new EventTarget(),
      loading: false,
      cleanup: [],
    }

    const currentViewableRange =
      accessConversionStore<InputType>(rangeId).viewableRange
    const currentNextLeftRange =
      accessConversionStore<InputType>(rangeId).nextLeftRange
    const currentNextRightRange =
      accessConversionStore<InputType>(rangeId).nextRightRange

    ticksStore[rangeId] = {
      ticks: {
        viewableRange: createDefaultTicks(currentViewableRange),
        nextLeftRange: createDefaultTicks(currentNextLeftRange),
        nextRightRange: createDefaultTicks(currentNextRightRange),
      },
      fns: {
        createDefaultTicks: createDefaultTicks,
      },
    }
    // listen for the conversion events
    conversionEmitters[rangeId].viewableRangeConverted.addEventListener(
      conversionEventNames.viewableRangeConverted,
      viewableRangeTicksChangedHandler<InputType>
    )
    conversionEmitters[rangeId].nextLeftRangeConverted.addEventListener(
      conversionEventNames.nextLeftRangeConverted,
      nextLeftRangeTicksChangedHandler<InputType>
    )
    conversionEmitters[rangeId].nextRightRangeConverted.addEventListener(
      conversionEventNames.nextRightRangeConverted,
      nextRightRangeTicksChangedHandler<InputType>
    )
  }
}

