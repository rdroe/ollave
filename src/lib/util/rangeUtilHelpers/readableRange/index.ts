import type { NumericInput } from '../basicRange'
import {
  registerRange,
  updateRangeInputInner,
  emitters,
  getEventNames2,
  setConversionStoreCallbacks,
  unregisterRange,
} from '../basicRange'

export type StringOrNumberOrDate = string | number | Date

export const conversionStore: {
  [rangeId: string]: {
    input: NumericInput
    viewableRange: [start: StringOrNumberOrDate, end: StringOrNumberOrDate]
    nextLeftRange: [start: StringOrNumberOrDate, end: StringOrNumberOrDate]
    nextRightRange: [start: StringOrNumberOrDate, end: StringOrNumberOrDate]
    convertedLoading: boolean
    convertedViewableRangeLoading: boolean
    convertedNextLeftRangeLoading: boolean
    convertedNextRightRangeLoading: boolean
    fns: {
      numberToInput: (number: number) => StringOrNumberOrDate
      inputToNumber: (input: StringOrNumberOrDate) => number
    }
  }
} = {}

export const conversionEmitters: {
  [rangeId: string]: {
    inputConverted: EventTarget
    viewableRangeConverted: EventTarget
    nextLeftRangeConverted: EventTarget
    nextRightRangeConverted: EventTarget
    convertedLoading: EventTarget
    convertedViewableRangeLoading: EventTarget
    convertedNextLeftRangeLoading: EventTarget
    convertedNextRightRangeLoading: EventTarget
    cleanup: (() => void)[]
  }
} = {}

const INPUT_CONVERTED_EVENT = 'INPUT_CONVERTED'
const INPUT_AFTER_CONVERTED_EVENT = 'INPUT_AFTER_CONVERTED'
const VIEWABLE_RANGE_CONVERTED_EVENT = 'VIEWABLE_RANGE_CONVERTED'
const NEXT_LEFT_RANGE_CONVERTED_EVENT = 'NEXT_LEFT_RANGE_CONVERTED'
const NEXT_RIGHT_RANGE_CONVERTED_EVENT = 'NEXT_RIGHT_RANGE_CONVERTED'
const CONVERTED_VIEWABLE_RANGE_LOADING_EVENT =
  'CONVERTED_VIEWABLE_RANGE_LOADING'
const CONVERTED_NEXT_LEFT_RANGE_LOADING_EVENT =
  'CONVERTED_NEXT_LEFT_RANGE_LOADING'
const CONVERTED_NEXT_RIGHT_RANGE_LOADING_EVENT =
  'CONVERTED_NEXT_RIGHT_RANGE_LOADING'
const CONVERTED_LOADING_EVENT = 'CONVERTED_LOADING'


export const getConversionEventNames = (rangeId: string) => {
  return {
    inputConverted: `${rangeId}-${INPUT_CONVERTED_EVENT}`,
    inputAfterConverted: `${rangeId}-${INPUT_AFTER_CONVERTED_EVENT}`,
    viewableRangeConverted: `${rangeId}-${VIEWABLE_RANGE_CONVERTED_EVENT}`,
    nextLeftRangeConverted: `${rangeId}-${NEXT_LEFT_RANGE_CONVERTED_EVENT}`,
    nextRightRangeConverted: `${rangeId}-${NEXT_RIGHT_RANGE_CONVERTED_EVENT}`,
    convertedLoading: `${rangeId}-${CONVERTED_LOADING_EVENT}`,
    convertedViewableRangeLoading: `${rangeId}-${CONVERTED_VIEWABLE_RANGE_LOADING_EVENT}`,
    convertedNextLeftRangeLoading: `${rangeId}-${CONVERTED_NEXT_LEFT_RANGE_LOADING_EVENT}`,
    convertedNextRightRangeLoading: `${rangeId}-${CONVERTED_NEXT_RIGHT_RANGE_LOADING_EVENT}`,
  }
}
// initialization subscribers are handled differently. 
// the user may need to know when the range is initialized before the emitters are keyed.
const initializationSubscribers: {
  [rangeId: string]: (() => void)[]
} = {}

export const subscribeToRangeInitialization = (
  rangeId: string,
  callback: () => void
) => {
  if (!initializationSubscribers[rangeId]) {
    initializationSubscribers[rangeId] = []
  }
  initializationSubscribers[rangeId].push(callback) 
  return function unsubscribe() {
    initializationSubscribers[rangeId] = initializationSubscribers[rangeId].filter((cb) => cb !== callback)
  }
}



const isMatchingInputType = <InputType extends StringOrNumberOrDate>(
  toReplace: any,
  value: StringOrNumberOrDate
): value is InputType => {
  if (
    typeof toReplace === typeof value &&
    toReplace instanceof Date === value instanceof Date
  ) {
    return true
  }
  return false
}

const requireMatchingInputType = <InputType extends StringOrNumberOrDate>(
  toReplace: any,
  value: StringOrNumberOrDate,
  note: string = ''
): InputType => {
  if (!isMatchingInputType<InputType>(toReplace, value)) {
    throw new Error('Input type mismatch; ' + note + (note? '; ' : '') + ' toReplace: ' + JSON.stringify(toReplace, null, 2) + ' value: ' + JSON.stringify(value, null, 2))
  }
  return value
}

export const accessConversionStore = <
  InputType extends StringOrNumberOrDate = StringOrNumberOrDate,
>(
  rangeId: string
) => {
  return {
    get input() {
      return conversionStore[rangeId].input as InputType
    },
    set input(value: InputType) {

      // @ts-expect-error - we know that the input is a proper type
      conversionStore[rangeId].input = requireMatchingInputType<InputType>(
        conversionStore[rangeId].input,
        value
      )
    },
    get viewableRange() {
      return conversionStore[rangeId].viewableRange as [
        start: InputType,
        end: InputType,
      ]
    },
    set viewableRange(value: [start: InputType, end: InputType]) {
      conversionStore[rangeId].viewableRange = [
        requireMatchingInputType<InputType>(
          conversionStore[rangeId].viewableRange[0],
          value[0]
        ),

        requireMatchingInputType<InputType>(
          conversionStore[rangeId].viewableRange[1],
          value[1]
        ),
      ]
    },
    get nextLeftRange() {
      return conversionStore[rangeId].nextLeftRange as [
        start: InputType,
        end: InputType,
      ]
    },
    set nextLeftRange(value: [start: InputType, end: InputType]) {
      conversionStore[rangeId].nextLeftRange = [

        requireMatchingInputType<InputType>(
          conversionStore[rangeId].nextLeftRange[0],
          value[0]
        ),
        requireMatchingInputType<InputType>(
          conversionStore[rangeId].nextLeftRange[1],
          value[1]
        ),
      ]
    },
    get nextRightRange() {
      return conversionStore[rangeId].nextRightRange as [
        start: InputType,
        end: InputType,
      ]
    },
    set nextRightRange(value: [start: InputType, end: InputType]) {
      conversionStore[rangeId].nextRightRange = [
        requireMatchingInputType<InputType>(
          conversionStore[rangeId].nextRightRange[0],
          value[0]
        ),
        requireMatchingInputType<InputType>(
          conversionStore[rangeId].nextRightRange[1],
          value[1]
        ),
      ]
    },
    get convertedLoading() {
      return conversionStore[rangeId].convertedLoading
    },
    set convertedLoading(value: boolean) {
      conversionStore[rangeId].convertedLoading = value
    },
    get convertedViewableRangeLoading() {
      return conversionStore[rangeId].convertedViewableRangeLoading
    },
    set convertedViewableRangeLoading(value: boolean) {
      conversionStore[rangeId].convertedViewableRangeLoading = value
    },
    get convertedNextLeftRangeLoading() {
      return conversionStore[rangeId].convertedNextLeftRangeLoading
    },
    set convertedNextLeftRangeLoading(value: boolean) {
      conversionStore[rangeId].convertedNextLeftRangeLoading = value
    },
    get convertedNextRightRangeLoading() {
      return conversionStore[rangeId].convertedNextRightRangeLoading
    },
    set convertedNextRightRangeLoading(value: boolean) {
      conversionStore[rangeId].convertedNextRightRangeLoading = value
    },
  }
}

function convertUpdatedInputHandler<InputType extends StringOrNumberOrDate>(
  event: Event & { detail: { rangeId: string; input: NumericInput } }
) {
  const { rangeId, input } = event.detail
  if (!rangeId || input === undefined) {
    throw new Error('Invalid event detail')
  }

  // @ts-expect-error - we know that the input is a proper type
  conversionStore[rangeId].input = conversionStore[rangeId].fns.numberToInput(
    input
  ) as InputType
  conversionEmitters[rangeId].inputConverted.dispatchEvent(
    new CustomEvent(getConversionEventNames(rangeId).inputConverted, {
      detail: { rangeId, input: conversionStore[rangeId].input },
    })
  )
}

function convertUpdatedViewableRangeHandler<
  InputType extends StringOrNumberOrDate,
>(
  event: Event & {
    detail: {
      rangeId: string
      viewableRange: [start: InputType, end: InputType]
    }
  }
) {
  const { rangeId, viewableRange } = event.detail
  if (!rangeId || viewableRange === undefined) {
    throw new Error('Invalid event detail')
  }

  const {numberToInput} = conversionStore[rangeId].fns
    accessConversionStore<InputType>(rangeId).viewableRange = viewableRange.map((value) => numberToInput(value as number)) as [start: InputType, end: InputType]
  conversionEmitters[rangeId].viewableRangeConverted.dispatchEvent(
    new CustomEvent(getConversionEventNames(rangeId).viewableRangeConverted, {
      detail: {
        rangeId: rangeId,
        viewableRange: accessConversionStore<InputType>(rangeId).viewableRange,
      },
    })
  )
  conversionEmitters[rangeId].convertedViewableRangeLoading.dispatchEvent(
    new CustomEvent(
      getConversionEventNames(rangeId).convertedViewableRangeLoading,
      {
        detail: { rangeId: rangeId, viewableRangeLoading: false },
      }
    )
  )
}

function convertUpdatedNextLeftRangeHandler<
  InputType extends StringOrNumberOrDate,
>(
  event: Event & {
    detail: {
      rangeId: string
      nextLeftRange: [start: InputType, end: InputType]
    }
  }
) {
  const { rangeId, nextLeftRange } = event.detail
  if (!rangeId || nextLeftRange === undefined) {
    throw new Error('Invalid event detail')
  }

  const {numberToInput} = conversionStore[rangeId].fns
  accessConversionStore<InputType>(rangeId).nextLeftRange = nextLeftRange.map((value) => numberToInput(value as number)) as [start: InputType, end: InputType]
  conversionEmitters[rangeId].nextLeftRangeConverted.dispatchEvent(
    new CustomEvent(getConversionEventNames(rangeId).nextLeftRangeConverted, {
      detail: {
        rangeId: rangeId,
        nextLeftRange: accessConversionStore<InputType>(rangeId).nextLeftRange,
      },
    })
  )
  conversionEmitters[rangeId].convertedNextLeftRangeLoading.dispatchEvent(
    new CustomEvent(
      getConversionEventNames(rangeId).convertedNextLeftRangeLoading,
      {
        detail: { rangeId: rangeId, nextLeftRangeLoading: false },
      }
    )
  )
}

function convertUpdatedNextRightRangeHandler<
  InputType extends StringOrNumberOrDate,
>(
  event: Event & {
    detail: {
      rangeId: string
      nextRightRange: [start: InputType, end: InputType]
    }
  }
) {
  const { rangeId, nextRightRange } = event.detail
  if (!rangeId || nextRightRange === undefined) {
    throw new Error('Invalid event detail')
  }
  const {numberToInput} = conversionStore[rangeId].fns
  accessConversionStore<InputType>(rangeId).nextRightRange = nextRightRange.map((value) => numberToInput(value as number)) as [start: InputType, end: InputType]
  conversionEmitters[rangeId].nextRightRangeConverted.dispatchEvent(
    new CustomEvent(getConversionEventNames(rangeId).nextRightRangeConverted, {
      detail: {
        rangeId: rangeId,
        nextRightRange:
          accessConversionStore<InputType>(rangeId).nextRightRange,
      },
    })
  )
  conversionEmitters[rangeId].convertedNextRightRangeLoading.dispatchEvent(
    new CustomEvent(
      getConversionEventNames(rangeId).convertedNextRightRangeLoading,
      {
        detail: { rangeId: rangeId, nextRightRangeLoading: false },
      }
    )
  )
}

function convertUpdatedViewableRangeLoadingHandler<
  InputType extends StringOrNumberOrDate,
>(
  event: Event & {
    detail: {
      rangeId: string
      viewableRangeLoading: boolean
    }
  }
) {
  const { rangeId, viewableRangeLoading } = event.detail
  if (!rangeId || viewableRangeLoading === undefined) {
    throw new Error('Invalid event detail')
  }
  if (viewableRangeLoading) {
    accessConversionStore<InputType>(rangeId).convertedViewableRangeLoading =
      true
  } else {
    accessConversionStore<InputType>(rangeId).convertedViewableRangeLoading =
      false
    if (accessConversionStore<InputType>(rangeId).convertedLoading === false) {
      return
    }
    const otherRangesLoading =
      accessConversionStore<InputType>(rangeId).convertedNextLeftRangeLoading ||
      accessConversionStore<InputType>(rangeId).convertedNextRightRangeLoading

    if (!otherRangesLoading) {

      accessConversionStore<InputType>(rangeId).convertedLoading = false
      conversionEmitters[rangeId].convertedLoading.dispatchEvent(
        new CustomEvent(getConversionEventNames(rangeId).convertedLoading, {
          detail: { rangeId: rangeId, loading: false },
        })
      )
    }
  }
}

function convertUpdatedNextLeftRangeLoadingHandler<
  InputType extends StringOrNumberOrDate,
>(
  event: Event & {
    detail: {
      rangeId: string
      nextLeftRangeLoading: boolean
    }
  }
) {
  const { rangeId, nextLeftRangeLoading } = event.detail
  if (!rangeId || nextLeftRangeLoading === undefined) {
    throw new Error('Invalid event detail')
  }

  if (nextLeftRangeLoading) {
    accessConversionStore<InputType>(rangeId).convertedNextLeftRangeLoading =
      true
  } else {
    accessConversionStore<InputType>(rangeId).convertedNextLeftRangeLoading =
      false
    if (accessConversionStore<InputType>(rangeId).convertedLoading === false) {
      return
    }
    const otherRangesLoading =
      accessConversionStore<InputType>(rangeId).convertedViewableRangeLoading ||
      accessConversionStore<InputType>(rangeId).convertedNextRightRangeLoading

    if (!otherRangesLoading) {

      accessConversionStore<InputType>(rangeId).convertedLoading = false
      conversionEmitters[rangeId].convertedLoading.dispatchEvent(
        new CustomEvent(getConversionEventNames(rangeId).convertedLoading, {
          detail: { rangeId: rangeId, loading: false },
        })
      )
    }
  }
}

function convertUpdatedNextRightRangeLoadingHandler<
  InputType extends StringOrNumberOrDate,
>(
  event: Event & {
    detail: {
      rangeId: string
      nextRightRangeLoading: boolean
    }
  }
) {
  const { rangeId, nextRightRangeLoading } = event.detail
  if (!rangeId || nextRightRangeLoading === undefined) {
    throw new Error('Invalid event detail')
  }

  if (nextRightRangeLoading) {
    accessConversionStore<InputType>(rangeId).convertedNextRightRangeLoading =
      true
  } else {
    accessConversionStore<InputType>(rangeId).convertedNextRightRangeLoading =
      false
    if (accessConversionStore<InputType>(rangeId).convertedLoading === false) {
      return
    }
    const otherRangesLoading =
      accessConversionStore<InputType>(rangeId).convertedViewableRangeLoading ||
      accessConversionStore<InputType>(rangeId).convertedNextLeftRangeLoading

    if (!otherRangesLoading) {

      accessConversionStore<InputType>(rangeId).convertedLoading = false
      conversionEmitters[rangeId].convertedLoading.dispatchEvent(
        new CustomEvent(getConversionEventNames(rangeId).convertedLoading, {
          detail: { rangeId: rangeId, loading: false },
        })
      )
    }
  }
}

export const registerReadableRange = async <
  InputType extends StringOrNumberOrDate,
>(
  rangeId: string,
  initialInput: InputType | null,
  {
    getViewableRange,
    getNextLeftRange,
    getNextRightRange,
    inputToNumber,
    numberToInput,
  }: {
    getViewableRange: (input: number) => Promise<[start: number, end: number]>
    getNextLeftRange: (input: number) => Promise<[start: number, end: number]>
    getNextRightRange: (input: number) => Promise<[start: number, end: number]>
    inputToNumber: (input: InputType) => number
    numberToInput: (number: number) => InputType
  },
  isReregistration = false
) => {
  // During re-registration, use the current input from the store if initialInput is null
  const effectiveInput = isReregistration && initialInput === null 
    ? conversionStore[rangeId]?.input as InputType
    : initialInput

  if (effectiveInput === null) {
    if (isReregistration) {
      throw new Error('Cannot re-register: no current input in store and no initialInput provided')
    } else {
      throw new Error('Initial input required for new registration')
    }
  }

  const numericInitialInput = inputToNumber(effectiveInput)
  if (!isReregistration && typeof numericInitialInput !== 'number') {
    throw new Error('Initial input must be a  number')
  }

  registerRange(
    rangeId,
    isReregistration && initialInput === null ? null : numericInitialInput,
    {
      getViewableRange,
      getNextLeftRange,
      getNextRightRange,
    },
    isReregistration
  )

  if (conversionEmitters[rangeId] && !isReregistration) {
    return
  }

  if (isReregistration) {

    conversionEmitters[rangeId].inputConverted.removeEventListener(
      getConversionEventNames(rangeId).inputConverted,
      convertUpdatedInputHandler
    )
    conversionEmitters[rangeId].viewableRangeConverted.removeEventListener(
      getConversionEventNames(rangeId).viewableRangeConverted,
      convertUpdatedViewableRangeHandler
    )
    conversionEmitters[rangeId].nextLeftRangeConverted.removeEventListener(
      getConversionEventNames(rangeId).nextLeftRangeConverted,
      convertUpdatedNextLeftRangeHandler
    )
    conversionEmitters[rangeId].nextRightRangeConverted.removeEventListener(
      getConversionEventNames(rangeId).nextRightRangeConverted,
      convertUpdatedNextRightRangeHandler
    )

    conversionEmitters[
      rangeId
    ].convertedNextRightRangeLoading.removeEventListener(
      getConversionEventNames(rangeId).convertedNextRightRangeLoading,
      convertUpdatedNextRightRangeLoadingHandler
    )
    // this is commented out because I think we want to keep the user subscriptions. 
    // conversionEmitters[rangeId].cleanup.forEach((cleanupFn) => cleanupFn())
    // conversionEmitters[rangeId].cleanup = []
  } else {
    conversionEmitters[rangeId] = {
      inputConverted: new EventTarget(),
      viewableRangeConverted: new EventTarget(),
      nextLeftRangeConverted: new EventTarget(),
      nextRightRangeConverted: new EventTarget(),
      convertedLoading: new EventTarget(),
      convertedViewableRangeLoading: new EventTarget(),
      convertedNextLeftRangeLoading: new EventTarget(),
      convertedNextRightRangeLoading: new EventTarget(),
      cleanup: [],
    }
  }
  // Use effectiveInput (which uses current store input during re-registration if initialInput is null)
  conversionStore[rangeId] = {
    input: effectiveInput as NumericInput,
    // todo: Make this async. do it by setting these first to default values, then after the  this object in conversionStore is set, fire the proper events
    viewableRange: (await getViewableRange(inputToNumber(effectiveInput))).map((value) => numberToInput(value)) as [start: InputType, end: InputType],
    nextLeftRange: (await getNextLeftRange(inputToNumber(effectiveInput))).map((value) => numberToInput(value)) as [start: InputType, end: InputType],
    nextRightRange: (await getNextRightRange(inputToNumber(effectiveInput))).map((value) => numberToInput(value)) as [start: InputType, end: InputType],
    convertedLoading: false,
    convertedViewableRangeLoading: false,
    convertedNextLeftRangeLoading: false,
    convertedNextRightRangeLoading: false,
    fns: {
      numberToInput: numberToInput as (number: number) => InputType,
      inputToNumber: inputToNumber as (input: InputType) => number,
    },
  }

  // as range inner emitters fire, we need to convert the input, viewable range, next left range, and next right range to the InputType
  emitters[rangeId].inputChanged.addEventListener(
    getEventNames2(rangeId).inputChanged,
    convertUpdatedInputHandler<InputType>
  )
  emitters[rangeId].viewableRange.addEventListener(
    getEventNames2(rangeId).viewableRange,
    convertUpdatedViewableRangeHandler<InputType>
  )
  emitters[rangeId].nextLeftRange.addEventListener(
    getEventNames2(rangeId).nextLeftRange,
    convertUpdatedNextLeftRangeHandler<InputType>
  )
  emitters[rangeId].nextRightRange.addEventListener(
    getEventNames2(rangeId).nextRightRange,
    convertUpdatedNextRightRangeHandler<InputType>
  )
  conversionEmitters[rangeId].convertedViewableRangeLoading.addEventListener(
    getConversionEventNames(rangeId).convertedViewableRangeLoading,
    convertUpdatedViewableRangeLoadingHandler<InputType>
  )
  conversionEmitters[rangeId].convertedNextLeftRangeLoading.addEventListener(
    getConversionEventNames(rangeId).convertedNextLeftRangeLoading,
    convertUpdatedNextLeftRangeLoadingHandler<InputType>
  )
  conversionEmitters[rangeId].convertedNextRightRangeLoading.addEventListener(
    getConversionEventNames(rangeId).convertedNextRightRangeLoading,
    convertUpdatedNextRightRangeLoadingHandler<InputType>
  )
  // complete the above todo; fire events that will properly set the ranges based on initial input.
  const unsubscribeInit = subscribeToRangeConvertedEndLoading(rangeId, () => {
    fireInitialEvents() 
    unsubscribeInit()
  }) 
  
  function fireInitialEvents() { 
    initializationSubscribers[rangeId]?.forEach((callback) => callback()) 
  }

  updateRange(rangeId, effectiveInput)


}

export const subscribeToRangeConvertedStartLoading = (
  rangeId: string,
  callback: () => void
) => {
  function thisCallback(
    event: Event & { detail: { rangeId: string; loading: boolean } }
  ) {
    const { rangeId, loading } = event.detail
    if (!rangeId || loading === undefined) {
      throw new Error('Invalid event detail')
    }
    if (loading) {
      callback()
    }
  }
  conversionEmitters[rangeId].convertedLoading.addEventListener(
    getConversionEventNames(rangeId).convertedLoading,
    thisCallback
  )
  return function unsubscribe() {
    conversionEmitters[rangeId].convertedLoading.removeEventListener(
      getConversionEventNames(rangeId).convertedLoading,
      thisCallback
    )
  }
}

export const subscribeToRangeConvertedEndLoading = (
  rangeId: string,
  callback: () => void
) => {
  function thisCallback(
    event: Event & { detail: { rangeId: string; loading: boolean } }
  ) {
    const { rangeId, loading } = event.detail
    if (!rangeId || loading === undefined) {
      throw new Error('Invalid event detail')
    }
    if (!loading) {
      callback()
    }
  }
  conversionEmitters[rangeId].convertedLoading.addEventListener(
    getConversionEventNames(rangeId).convertedLoading,
    thisCallback
  )
  return function unsubscribe() {
    conversionEmitters[rangeId].convertedLoading.removeEventListener(
      getConversionEventNames(rangeId).convertedLoading,
      thisCallback
    )
  }
}

export const subscribeToRangeConvertedViewableRangeStartLoading = (
  rangeId: string,
  callback: () => void
) => {
  function thisCallback(
    event: Event & {
      detail: { rangeId: string; viewableRangeLoading: boolean }
    }
  ) {
    const { rangeId, viewableRangeLoading } = event.detail
    if (!rangeId || viewableRangeLoading === undefined) {
      throw new Error('Invalid event detail')
    }
    if (viewableRangeLoading) {
      callback()
    }
  }
  conversionEmitters[rangeId].convertedViewableRangeLoading.addEventListener(
    getConversionEventNames(rangeId).convertedViewableRangeLoading,
    thisCallback
  )
  return function unsubscribe() {
    conversionEmitters[
      rangeId
    ].convertedViewableRangeLoading.removeEventListener(
      getConversionEventNames(rangeId).convertedViewableRangeLoading,
      thisCallback
    )
  }
}

export const subscribeToRangeConvertedViewableRangeEndLoading = (
  rangeId: string,
  callback: () => void
) => {
  function thisCallback(
    event: Event & {
      detail: { rangeId: string; viewableRangeLoading: boolean }
    }
  ) {
    const { rangeId, viewableRangeLoading } = event.detail
    if (!rangeId || viewableRangeLoading === undefined) {
      throw new Error('Invalid event detail')
    }
    if (!viewableRangeLoading) {
      callback()
    }
  }
  conversionEmitters[rangeId].convertedViewableRangeLoading.addEventListener(
    getConversionEventNames(rangeId).convertedViewableRangeLoading,
    thisCallback
  )
  return function unsubscribe() {
    conversionEmitters[
      rangeId
    ].convertedViewableRangeLoading.removeEventListener(
      getConversionEventNames(rangeId).convertedViewableRangeLoading,
      thisCallback
    )
  }
}

export const subscribeToRangeConvertedNextLeftRangeStartLoading = (
  rangeId: string,
  callback: () => void
) => {
  function thisCallback(
    event: Event & {
      detail: { rangeId: string; nextLeftRangeLoading: boolean }
    }
  ) {
    const { rangeId, nextLeftRangeLoading } = event.detail
    if (!rangeId || nextLeftRangeLoading === undefined) {
      throw new Error('Invalid event detail')
    }
    if (nextLeftRangeLoading) {
      callback()
    }
  }
  conversionEmitters[rangeId].convertedNextLeftRangeLoading.addEventListener(
    getConversionEventNames(rangeId).convertedNextLeftRangeLoading,
    thisCallback
  )
  return function unsubscribe() {
    conversionEmitters[
      rangeId
    ].convertedNextLeftRangeLoading.removeEventListener(
      getConversionEventNames(rangeId).convertedNextLeftRangeLoading,
      thisCallback
    )
  }
}

export const subscribeToRangeConvertedNextRightRangeStartLoading = (
  rangeId: string,
  callback: () => void
) => {
  function thisCallback(
    event: Event & {
      detail: { rangeId: string; nextRightRangeLoading: boolean }
    }
  ) {
    const { rangeId, nextRightRangeLoading } = event.detail
    if (!rangeId || nextRightRangeLoading === undefined) {
      throw new Error('Invalid event detail')
    }
    if (nextRightRangeLoading) {
      callback()
    }
  }
  conversionEmitters[rangeId].convertedNextRightRangeLoading.addEventListener(
    getConversionEventNames(rangeId).convertedNextRightRangeLoading,
    thisCallback
  )
  return function unsubscribe() {
    conversionEmitters[
      rangeId
    ].convertedNextRightRangeLoading.removeEventListener(
      getConversionEventNames(rangeId).convertedNextRightRangeLoading,
      thisCallback
    )
  }
}

export const subscribeToRangeConvertedNextLeftRangeEndLoading = (
  rangeId: string,
  callback: () => void
) => {
  function thisCallback(
    event: Event & {
      detail: { rangeId: string; nextLeftRangeLoading: boolean }
    }
  ) {
    const { rangeId, nextLeftRangeLoading } = event.detail
    if (!rangeId || nextLeftRangeLoading === undefined) {
      throw new Error('Invalid event detail')
    }
    if (!nextLeftRangeLoading) {
      callback()
    }
  }
  conversionEmitters[rangeId].convertedNextLeftRangeLoading.addEventListener(
    getConversionEventNames(rangeId).convertedNextLeftRangeLoading,
    thisCallback
  )
  return function unsubscribe() {
    conversionEmitters[
      rangeId
    ].convertedNextLeftRangeLoading.removeEventListener(
      getConversionEventNames(rangeId).convertedNextLeftRangeLoading,
      thisCallback
    )
  }
}

export const subscribeToRangeConvertedNextRightRangeEndLoading = (
  rangeId: string,
  callback: () => void
) => {
  function thisCallback(
    event: Event & {
      detail: { rangeId: string; nextRightRangeLoading: boolean }
    }
  ) {
    const { rangeId, nextRightRangeLoading } = event.detail
    if (!rangeId || nextRightRangeLoading === undefined) {
      throw new Error('Invalid event detail')
    }
    if (!nextRightRangeLoading) {
      callback()
    }
  }
  conversionEmitters[rangeId].convertedNextRightRangeLoading.addEventListener(
    getConversionEventNames(rangeId).convertedNextRightRangeLoading,
    thisCallback
  )
  return function unsubscribe() {
    conversionEmitters[
      rangeId
    ].convertedNextRightRangeLoading.removeEventListener(
      getConversionEventNames(rangeId).convertedNextRightRangeLoading,
      thisCallback
    )
  }
}

export const updateRange = <InputType extends StringOrNumberOrDate>(
  rangeId: string,
  input: InputType
) => {
  updateRangeInputInner(
    rangeId,
    conversionStore[rangeId].fns.inputToNumber(input)
  )
}

// Initialize callbacks for basicRange integration
setConversionStoreCallbacks(
  (rangeId: string) => {
    if (!conversionStore[rangeId]) {
      return { convertedLoading: false }
    }
    return conversionStore[rangeId]
  },
  (rangeId: string) => {
    if (!conversionEmitters[rangeId]) {
      return {
        convertedLoading: new EventTarget(),
        convertedViewableRangeLoading: new EventTarget(),
        convertedNextLeftRangeLoading: new EventTarget(),
        convertedNextRightRangeLoading: new EventTarget(),
      }
    }
    return conversionEmitters[rangeId]
  },
  getConversionEventNames
)

// remove all listeners and cleanup for a range, return a function to unsubscribe
export const unregisterReadableRange = (rangeId: string) => {
  unregisterRange(rangeId)

  conversionEmitters[rangeId].inputConverted.removeEventListener(
    getConversionEventNames(rangeId).inputConverted,
    convertUpdatedInputHandler
  )
  conversionEmitters[rangeId].viewableRangeConverted.removeEventListener(
    getConversionEventNames(rangeId).viewableRangeConverted,
    convertUpdatedViewableRangeHandler
  )
  conversionEmitters[rangeId].nextLeftRangeConverted.removeEventListener(
    getConversionEventNames(rangeId).nextLeftRangeConverted,
    convertUpdatedNextLeftRangeHandler
  )
  conversionEmitters[rangeId].nextRightRangeConverted.removeEventListener(
    getConversionEventNames(rangeId).nextRightRangeConverted,
    convertUpdatedNextRightRangeHandler
  )

  conversionEmitters[rangeId].convertedViewableRangeLoading.removeEventListener(
    getConversionEventNames(rangeId).convertedViewableRangeLoading,
    convertUpdatedViewableRangeLoadingHandler
  )
  conversionEmitters[rangeId].convertedNextLeftRangeLoading.removeEventListener(
    getConversionEventNames(rangeId).convertedNextLeftRangeLoading,
    convertUpdatedNextLeftRangeLoadingHandler
  )
  conversionEmitters[rangeId].convertedNextRightRangeLoading.removeEventListener(
    getConversionEventNames(rangeId).convertedNextRightRangeLoading,
    convertUpdatedNextRightRangeLoadingHandler
  )
  conversionEmitters[rangeId].cleanup.forEach((cleanupFn) => cleanupFn())
  conversionEmitters[rangeId].cleanup = []
}