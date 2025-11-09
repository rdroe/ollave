import { Module, ParsedCli } from 'peprn/util'

type NumericInput = number

const emitters: {
  [rangeId: string]: {
    inputChanged: EventTarget
    viewableRange: EventTarget
    nextLeftRange: EventTarget
    nextRightRange: EventTarget
    loading: EventTarget
    loadingRefCount: number
    cleanup: (() => void)[]
  }
} = {}

const store: {
  [rangeId: string]: {
    input: NumericInput
    viewableRange: [start: number, end: number]
    nextLeftRange: [start: number, end: number]
    nextRightRange: [start: number, end: number]
    loading: boolean
    fns: {
      getViewableRange: (
        input: NumericInput
      ) => Promise<[start: number, end: number]>
      getNextLeftRange: (
        input: NumericInput
      ) => Promise<[start: number, end: number]>
      getNextRightRange: (
        input: NumericInput
      ) => Promise<[start: number, end: number]>
    }
  }
} = {}

const INPUT_CHANGED_EVENT = 'INPUT_CHANGED'
const INPUT_AFTER_CHANGED_EVENT = 'INPUT_AFTER_CHANGED'
const VIEWABLE_RANGE_EVENT = 'VIEWABLE_RANGE'
const NEXT_LEFT_RANGE_EVENT = 'NEXT_LEFT_RANGE'
const NEXT_RIGHT_RANGE_EVENT = 'NEXT_RIGHT_RANGE'
const LOADING_EVENT = 'LOADING'
const getEventNames2 = (rangeId: string) => {
  return {
    inputChanged: `${rangeId}-${INPUT_CHANGED_EVENT}`,
    inputAfterChanged: `${rangeId}-${INPUT_AFTER_CHANGED_EVENT}`,
    viewableRange: `${rangeId}-${VIEWABLE_RANGE_EVENT}`,
    nextLeftRange: `${rangeId}-${NEXT_LEFT_RANGE_EVENT}`,
    nextRightRange: `${rangeId}-${NEXT_RIGHT_RANGE_EVENT}`,
    loading: `${rangeId}-${LOADING_EVENT}`,
  }
}

function internalInputChangedListener(
  event: Event & { detail: { rangeId: string; input: NumericInput } }
) {
  const { rangeId, input } = event.detail
  if (!rangeId || input === undefined) {
    throw new Error('Invalid event detail')
  }
  store[rangeId].input = event.detail.input
  emitters[rangeId].inputChanged.dispatchEvent(
    new CustomEvent(getEventNames2(rangeId).inputAfterChanged, {
      detail: { rangeId: rangeId },
    })
  )
}

function inputAfterChangedListener(
  event: Event & { detail: { rangeId: string } }
) {
  const { rangeId } = event.detail
  if (!rangeId) {
    throw new Error('Invalid event detail')
  }
  store[rangeId].loading = true
  emitters[rangeId].loading.dispatchEvent(
    new CustomEvent(getEventNames2(rangeId).loading, {
      detail: { rangeId: rangeId, loading: true },
    })
  )
  const newInput = store[rangeId].input
  if (accessConversionStore(rangeId).convertedLoading === false) {
    console.log(
      'setting converted loading to true in convertUpdatedNextRightRangeLoadingHandler'
    )
    accessConversionStore(rangeId).convertedLoading = true
    conversionEmitters[rangeId].convertedLoading.dispatchEvent(
      new CustomEvent(getConversionEventNames(rangeId).convertedLoading, {
        detail: { rangeId: rangeId, loading: true },
      })
    )
  }
  conversionEmitters[rangeId].convertedViewableRangeLoading.dispatchEvent(
    new CustomEvent(
      getConversionEventNames(rangeId).convertedViewableRangeLoading,
      {
        detail: { rangeId: rangeId, viewableRangeLoading: true },
      }
    )
  )
  emitters[rangeId].loadingRefCount++
  store[rangeId].fns.getViewableRange(newInput).then((viewableRange) => {
    store[rangeId].viewableRange = viewableRange
    emitters[rangeId].loadingRefCount--
    if (emitters[rangeId].loadingRefCount === 0) {
      store[rangeId].loading = false
      emitters[rangeId].loading.dispatchEvent(
        new CustomEvent(getEventNames2(rangeId).loading, {
          detail: { rangeId: rangeId, loading: false },
        })
      )
    }
    emitters[rangeId].viewableRange.dispatchEvent(
      new CustomEvent(getEventNames2(rangeId).viewableRange, {
        detail: {
          rangeId: rangeId,
          viewableRange: store[rangeId].viewableRange,
        },
      })
    )
  })
  emitters[rangeId].loadingRefCount++
  conversionEmitters[rangeId].convertedNextLeftRangeLoading.dispatchEvent(
    new CustomEvent(
      getConversionEventNames(rangeId).convertedNextLeftRangeLoading,
      {
        detail: { rangeId: rangeId, nextLeftRangeLoading: true },
      }
    )
  )
  store[rangeId].fns.getNextLeftRange(newInput).then((nextLeftRange) => {
    emitters[rangeId].loadingRefCount--
    if (emitters[rangeId].loadingRefCount === 0) {
      store[rangeId].loading = false
      emitters[rangeId].loading.dispatchEvent(
        new CustomEvent(getEventNames2(rangeId).loading, {
          detail: { rangeId: rangeId, loading: false },
        })
      )
    }
    store[rangeId].nextLeftRange = nextLeftRange
    emitters[rangeId].nextLeftRange.dispatchEvent(
      new CustomEvent(getEventNames2(rangeId).nextLeftRange, {
        detail: {
          rangeId: rangeId,
          nextLeftRange: store[rangeId].nextLeftRange,
        },
      })
    )
  })
  conversionEmitters[rangeId].convertedNextRightRangeLoading.dispatchEvent(
    new CustomEvent(
      getConversionEventNames(rangeId).convertedNextRightRangeLoading,
      {
        detail: { rangeId: rangeId, nextRightRangeLoading: true },
      }
    )
  )
  emitters[rangeId].loadingRefCount++
  store[rangeId].fns.getNextRightRange(newInput).then((nextRightRange) => {
    emitters[rangeId].loadingRefCount--
    if (emitters[rangeId].loadingRefCount === 0) {
      store[rangeId].loading = false
      emitters[rangeId].loading.dispatchEvent(
        new CustomEvent(getEventNames2(rangeId).loading, {
          detail: { rangeId: rangeId, loading: false },
        })
      )
    }
    store[rangeId].nextRightRange = nextRightRange
    emitters[rangeId].nextRightRange.dispatchEvent(
      new CustomEvent(getEventNames2(rangeId).nextRightRange, {
        detail: {
          rangeId: rangeId,
          nextRightRange: store[rangeId].nextRightRange,
        },
      })
    )
  })
}

export const registerRange = <InputType extends NumericInput>(
  rangeId: string,
  initialInput: number,
  {
    getViewableRange,
    getNextLeftRange,
    getNextRightRange,
  }: {
    getViewableRange: (
      input: InputType
    ) => Promise<[start: number, end: number]>
    getNextLeftRange: (
      input: InputType
    ) => Promise<[start: number, end: number]>
    getNextRightRange: (
      input: InputType
    ) => Promise<[start: number, end: number]>
  },
  isReregistration: boolean = false
) => {
  const { inputChanged: inputChangedEventName } = getEventNames2(rangeId)
  if (emitters[rangeId] && !isReregistration) {
    return
  }

  if (isReregistration) {
    if (initialInput !== null) {
      throw new Error('Initial input disallowed for reregistration')
    }
    emitters[rangeId].inputChanged.removeEventListener(
      inputChangedEventName,
      internalInputChangedListener
    )
    emitters[rangeId].inputChanged.removeEventListener(
      getEventNames2(rangeId).inputAfterChanged,
      inputAfterChangedListener
    )
    emitters[rangeId].cleanup.forEach((cleanupFn) => cleanupFn())
  } else {
    if (initialInput === null) {
      throw new Error('Initial input required for new registration')
    }
    emitters[rangeId] = {
      inputChanged: new EventTarget(),
      viewableRange: new EventTarget(),
      nextLeftRange: new EventTarget(),
      nextRightRange: new EventTarget(),
      loading: new EventTarget(),
      loadingRefCount: 0,
      cleanup: [],
    }
    store[rangeId] = {
      input: initialInput,
      viewableRange: [0, 0],
      nextLeftRange: [0, 0],
      nextRightRange: [0, 0],
      loading: false,
      fns: {
        getViewableRange: getViewableRange,
        getNextLeftRange: getNextLeftRange,
        getNextRightRange: getNextRightRange,
      },
    }
  }
  store[rangeId].fns = {
    getViewableRange: getViewableRange,
    getNextLeftRange: getNextLeftRange,
    getNextRightRange: getNextRightRange,
  }
  emitters[rangeId].inputChanged.addEventListener(
    inputChangedEventName,
    internalInputChangedListener
  )
  emitters[rangeId].inputChanged.addEventListener(
    getEventNames2(rangeId).inputAfterChanged,
    inputAfterChangedListener
  )
}

export const subscribeToRangeInputChanged = (
  rangeId: string,
  callback: (input: NumericInput) => void
) => {
  function thisCallback(
    event: Event & {
      detail: { rangeId: string; input: NumericInput }
    }
  ) {
    callback(event.detail.input)
  }
  emitters[rangeId].inputChanged.addEventListener(
    getEventNames2(rangeId).inputChanged,
    thisCallback
  )
  emitters[rangeId].cleanup.push(() => {
    emitters[rangeId].inputChanged.removeEventListener(
      getEventNames2(rangeId).inputChanged,
      thisCallback
    )
  })
  return function unsubscribe() {
    emitters[rangeId].inputChanged.removeEventListener(
      getEventNames2(rangeId).inputChanged,
      thisCallback
    )
  }
}

export const subscribeToRangeViewableRange = (
  rangeId: string,
  callback: (viewableRange: [start: number, end: number]) => void
) => {
  function thisCallback(
    event: Event & {
      detail: { rangeId: string; viewableRange: [start: number, end: number] }
    }
  ) {
    callback(event.detail.viewableRange)
  }
  emitters[rangeId].viewableRange.addEventListener(
    getEventNames2(rangeId).viewableRange,
    thisCallback
  )
  emitters[rangeId].cleanup.push(() => {
    emitters[rangeId].viewableRange.removeEventListener(
      getEventNames2(rangeId).viewableRange,
      thisCallback
    )
  })
  return function unsubscribe() {
    emitters[rangeId].viewableRange.removeEventListener(
      getEventNames2(rangeId).viewableRange,
      thisCallback
    )
  }
}

export const subscribeToRangeNextLeftRange = (
  rangeId: string,
  callback: (nextLeftRange: [start: number, end: number]) => void
) => {
  function thisCallback(
    event: Event & {
      detail: { rangeId: string; nextLeftRange: [start: number, end: number] }
    }
  ) {
    callback(event.detail.nextLeftRange)
  }
  emitters[rangeId].nextLeftRange.addEventListener(
    getEventNames2(rangeId).nextLeftRange,
    thisCallback
  )
  emitters[rangeId].cleanup.push(() => {
    emitters[rangeId].nextLeftRange.removeEventListener(
      getEventNames2(rangeId).nextLeftRange,
      thisCallback
    )
  })
  return function unsubscribe() {
    emitters[rangeId].nextLeftRange.removeEventListener(
      getEventNames2(rangeId).nextLeftRange,
      thisCallback
    )
  }
}

export const subscribeToRangeNextRightRange = (
  rangeId: string,
  callback: (nextRightRange: [start: number, end: number]) => void
) => {
  function thisCallback(
    event: Event & {
      detail: { rangeId: string; nextRightRange: [start: number, end: number] }
    }
  ) {
    callback(event.detail.nextRightRange)
  }
  emitters[rangeId].nextRightRange.addEventListener(
    getEventNames2(rangeId).nextRightRange,
    thisCallback
  )
  emitters[rangeId].cleanup.push(() => {
    emitters[rangeId].nextRightRange.removeEventListener(
      getEventNames2(rangeId).nextRightRange,
      thisCallback
    )
  })
  return function unsubscribe() {
    emitters[rangeId].nextRightRange.removeEventListener(
      getEventNames2(rangeId).nextRightRange,
      thisCallback
    )
  }
}

export const subscribeToRangeStartLoading = (
  rangeId: string,
  callback: () => void
) => {
  function thisCallback(event: Event & { detail: { rangeId: string } }) {
    const { rangeId } = event.detail
    if (!rangeId) {
      throw new Error('Invalid event detail')
    }
    if (store[rangeId].loading) {
      callback()
    }
  }
  emitters[rangeId].loading.addEventListener(
    getEventNames2(rangeId).loading,
    thisCallback
  )
  emitters[rangeId].cleanup.push(() => {
    emitters[rangeId].loading.removeEventListener(
      getEventNames2(rangeId).loading,
      thisCallback
    )
  })
  return function unsubscribe() {
    emitters[rangeId].loading.removeEventListener(
      getEventNames2(rangeId).loading,
      thisCallback
    )
  }
}

export const subscribeToRangeEndLoading = (
  rangeId: string,
  callback: () => void
) => {
  function thisCallback(event: Event & { detail: { rangeId: string } }) {
    const { rangeId } = event.detail
    if (!rangeId) {
      throw new Error('Invalid event detail')
    }
    if (!store[rangeId].loading) {
      callback()
    }
  }
  emitters[rangeId].loading.addEventListener(
    getEventNames2(rangeId).loading,
    thisCallback
  )
  emitters[rangeId].cleanup.push(() => {
    emitters[rangeId].loading.removeEventListener(
      getEventNames2(rangeId).loading,
      thisCallback
    )
  })
  return function unsubscribe() {
    emitters[rangeId].loading.removeEventListener(
      getEventNames2(rangeId).loading,
      thisCallback
    )
  }
}

export const updateRangeInputInner = (rangeId: string, input: NumericInput) => {
  store[rangeId].input = input
  emitters[rangeId].inputChanged.dispatchEvent(
    new CustomEvent(getEventNames2(rangeId).inputChanged, {
      detail: { rangeId: rangeId, input: input },
    })
  )
}

/// human readable range

const conversionStore: {
  [rangeId: string]: {
    input: NumericInput
    viewableRange: [start: number, end: number]
    nextLeftRange: [start: number, end: number]
    nextRightRange: [start: number, end: number]
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

const conversionEmitters: {
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
const getConversionEventNames = (rangeId: string) => {
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

type StringOrNumberOrDate = string | number | Date

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

// const accessConversionStore = <InputType extends StringOrNumberOrDate>(
//   rangeId: string
// ) => {
//   return {
//     input: conversionStore[rangeId].input as InputType,
//     viewableRange: conversionStore[rangeId].viewableRange as [
//       start: InputType,
//       end: InputType,
//     ],
//     nextLeftRange: conversionStore[rangeId].nextLeftRange as [
//       start: InputType,
//       end: InputType,
//     ],
//     nextRightRange: conversionStore[rangeId].nextRightRange as [
//       start: InputType,
//       end: InputType,
//     ],
//     convertedLoading: conversionStore[rangeId].convertedLoading,
//     convertedViewableRangeLoading:
//       conversionStore[rangeId].convertedViewableRangeLoading,
//     convertedNextLeftRangeLoading:
//       conversionStore[rangeId].convertedNextLeftRangeLoading,
//     convertedNextRightRangeLoading:
//       conversionStore[rangeId].convertedNextRightRangeLoading,
//   }
// }
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
  value: StringOrNumberOrDate
): InputType => {
  if (!isMatchingInputType<InputType>(toReplace, value)) {
    throw new Error('Input type mismatch')
  }
  return value
}
const accessConversionStore = <
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
        // @ts-expect-error - we know that the viewable range is a proper type
        requireMatchingInputType<InputType>(
          conversionStore[rangeId].viewableRange[0],
          value[0]
        ),
        // @ts-expect-error - we know that the viewable range is a proper type
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
        // @ts-expect-error - we know that the next left range is a proper type
        requireMatchingInputType<InputType>(
          conversionStore[rangeId].nextLeftRange[0],
          value[0]
        ),
        // @ts-expect-error - we know that the next left range is a proper type
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
        // @ts-expect-error - we know that the next right range is a proper type
        requireMatchingInputType<InputType>(
          conversionStore[rangeId].nextRightRange[0],
          value[0]
        ),
        // @ts-expect-error - we know that the next right range is a proper type
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

  accessConversionStore<InputType>(rangeId).viewableRange = viewableRange
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

  accessConversionStore<InputType>(rangeId).nextLeftRange = nextLeftRange
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
  accessConversionStore<InputType>(rangeId).nextRightRange = nextRightRange
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
    // if (accessConversionStore<InputType>(rangeId).convertedLoading === false) {
    //   console.log(
    //     'setting converted loading to true in convertUpdatedViewableRangeLoadingHandler'
    //   )
    //   accessConversionStore<InputType>(rangeId).convertedLoading = true
    //   conversionEmitters[rangeId].convertedLoading.dispatchEvent(
    //     new CustomEvent(getConversionEventNames(rangeId).convertedLoading, {
    //       detail: { rangeId: rangeId, loading: true },
    //     })
    //   )
    // }
    accessConversionStore<InputType>(rangeId).convertedViewableRangeLoading =
      true
  } else {
    accessConversionStore<InputType>(rangeId).convertedViewableRangeLoading =
      false
    // viewableRange laoding is done
    // we can set loading to false ONLY IF the other ranges are also note loading
    if (accessConversionStore<InputType>(rangeId).convertedLoading === false) {
      return
    }
    const otherRangesLoading =
      accessConversionStore<InputType>(rangeId).convertedNextLeftRangeLoading ||
      accessConversionStore<InputType>(rangeId).convertedNextRightRangeLoading

    if (!otherRangesLoading) {
      console.log(
        'setting converted loading to false in convertUpdatedViewableRangeLoadingHandler'
      )
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
    // if (accessConversionStore<InputType>(rangeId).convertedLoading === false) {
    //   console.log(
    //     'setting converted loading to true in convertUpdatedNextLeftRangeLoadingHandler'
    //   )
    //   accessConversionStore<InputType>(rangeId).convertedLoading = true
    //   conversionEmitters[rangeId].convertedLoading.dispatchEvent(
    //     new CustomEvent(getConversionEventNames(rangeId).convertedLoading, {
    //       detail: { rangeId: rangeId, loading: true },
    //     })
    //   )

    // }
    accessConversionStore<InputType>(rangeId).convertedNextLeftRangeLoading =
      true
  } else {
    accessConversionStore<InputType>(rangeId).convertedNextLeftRangeLoading =
      false
    // nextLeftRange loading is done
    // we can set loading to false ONLY IF the other ranges are also note loading
    if (accessConversionStore<InputType>(rangeId).convertedLoading === false) {
      return
    }
    const otherRangesLoading =
      accessConversionStore<InputType>(rangeId).convertedViewableRangeLoading ||
      accessConversionStore<InputType>(rangeId).convertedNextRightRangeLoading

    if (!otherRangesLoading) {
      console.log(
        'setting converted loading to false in convertUpdatedNextLeftRangeLoadingHandler'
      )
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
    // if (accessConversionStore<InputType>(rangeId).convertedLoading === false) {
    //   console.log(
    //     'setting converted loading to true in convertUpdatedNextRightRangeLoadingHandler'
    //   )
    //   accessConversionStore<InputType>(rangeId).convertedLoading = true
    //   conversionEmitters[rangeId].convertedLoading.dispatchEvent(
    //     new CustomEvent(getConversionEventNames(rangeId).convertedLoading, {
    //       detail: { rangeId: rangeId, loading: true },
    //     })
    //   )
    // }
    accessConversionStore<InputType>(rangeId).convertedNextRightRangeLoading =
      true
  } else {
    accessConversionStore<InputType>(rangeId).convertedNextRightRangeLoading =
      false
    // nextRightRange loading is done
    // we can set loading to false ONLY IF the other ranges are also note loading
    if (accessConversionStore<InputType>(rangeId).convertedLoading === false) {
      return
    }
    const otherRangesLoading =
      accessConversionStore<InputType>(rangeId).convertedViewableRangeLoading ||
      accessConversionStore<InputType>(rangeId).convertedNextLeftRangeLoading

    if (!otherRangesLoading) {
      console.log(
        'setting converted loading to false in convertUpdatedNextRightRangeLoadingHandler'
      )
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
    isReregistration: boolean
  },
  isReregistration = false
) => {
  registerRange(
    rangeId,
    inputToNumber(initialInput),
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
    if (initialInput !== null) {
      throw new Error('Initial input disallowed for reregistration')
    }

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
    conversionEmitters[rangeId].cleanup.forEach((cleanupFn) => cleanupFn())
    conversionEmitters[rangeId].cleanup = []
  } else {
    if (initialInput === null) {
      throw new Error('Initial input required for new registration')
    }
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
  conversionStore[rangeId] = {
    input: inputToNumber(initialInput),
    viewableRange: await getViewableRange(inputToNumber(initialInput)),
    nextLeftRange: await getNextLeftRange(inputToNumber(initialInput)),
    nextRightRange: await getNextRightRange(inputToNumber(initialInput)),
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
const accessTicksStore = <InputType extends StringOrNumberOrDate>(
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

export type TicksArray<InputType extends StringOrNumberOrDate> = Array<{
  value: InputType
  label: string
  dimensions?: { width: number; height: number }
}>

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

const testRangeStore: {
  cleanups: (() => void)[]
} = {
  cleanups: [],
}
export const testRangeInner: Module = {
  fn: ({
    'peprn:ancestralDepth': ancestralDepth,
  }: ParsedCli & {
    'peprn:ancestralDepth': number
  }) => {
    console.log('ancestralDepth', ancestralDepth)
    if (ancestralDepth > 0) {
      return Promise.resolve({
        formatted: store['testRange'],
      })
    }
    registerRange('testRange', 0, {
      getViewableRange: async (input: number) => [input, input + 10],
      getNextLeftRange: async (input: number) => [input - 10, input],
      getNextRightRange: async (input: number) => [input + 10, input + 20],
    })
    testRangeStore.cleanups = [
      ...testRangeStore.cleanups,
      subscribeToRangeInputChanged('testRange', (input: number) => {
        console.log('input changed', input)
      }),
      subscribeToRangeViewableRange(
        'testRange',
        (viewableRange: [start: number, end: number]) => {
          console.log('viewable range', viewableRange)
        }
      ),
      subscribeToRangeNextLeftRange(
        'testRange',
        (nextLeftRange: [start: number, end: number]) => {
          console.log('next left range', nextLeftRange)
        }
      ),
    ]
    subscribeToRangeNextRightRange(
      'testRange',
      (nextRightRange: [start: number, end: number]) => {
        console.log('next right range', nextRightRange)
      }
    )
    subscribeToRangeStartLoading('testRange', () => {
      // todo: this is not working as expected
      console.log('start loading')
    })
    subscribeToRangeEndLoading('testRange', () => {
      console.log('end loading')
    })
    return Promise.resolve({
      formatted: store['testRange'],
    })
  },
  submodules: {
    input: {
      fn: async ({
        positionalNonCommands,
      }: ParsedCli & { positionalNonCommands: [number] }) => {
        console.log('input', store['testRange'].input)
        updateRangeInputInner('testRange', positionalNonCommands[0])
      },
    },
    cleanup: {
      fn: async () => {
        const countBefore = testRangeStore.cleanups.length
        ;[...testRangeStore.cleanups].forEach((cleanup) => {
          cleanup()
          testRangeStore.cleanups = testRangeStore.cleanups.filter(
            (cleanup) => cleanup !== cleanup
          )
        })
        return Promise.resolve({
          countBefore,
          countAfter: testRangeStore.cleanups.length,
        })
      },
    },
  },
}

export const testReadableRange: Module = {
  fn: ({
    'peprn:ancestralDepth': ancestralDepth,
  }: ParsedCli & {
    'peprn:ancestralDepth': number
  }) => {
    console.log('ancestralDepth', ancestralDepth)
    if (ancestralDepth > 0) {
      return Promise.resolve({
        formatted: conversionStore['testReadableRange'],
      })
    }
    registerReadableRange<string>('testReadableRange', '0', {
      getViewableRange: async (input: number) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return [input, input + 10]
      },
      getNextLeftRange: async (input: number) => [input - 10, input],
      getNextRightRange: async (input: number) => [input + 10, input + 20],
      inputToNumber: (input: string) => parseInt(input),
      numberToInput: (number: number) => number.toString(),
      isReregistration: false,
    })

    testRangeStore.cleanups = [
      ...testRangeStore.cleanups,
      subscribeToRangeInputChanged('testReadableRange', (input: number) => {
        console.log('input changed', input)
      }),
      subscribeToRangeViewableRange(
        'testReadableRange',
        (viewableRange: [start: number, end: number]) => {
          console.log('viewable range', viewableRange)
        }
      ),
      subscribeToRangeNextLeftRange(
        'testReadableRange',
        (nextLeftRange: [start: number, end: number]) => {
          console.log('next left range', nextLeftRange)
        }
      ),
    ]
    subscribeToRangeNextRightRange(
      'testReadableRange',
      (nextRightRange: [start: number, end: number]) => {
        console.log('next right range', nextRightRange)
      }
    )
    subscribeToRangeStartLoading('testReadableRange', () => {
      console.log('start loading')
    })
    subscribeToRangeEndLoading('testReadableRange', () => {
      console.log('end loading')
    })
    subscribeToRangeConvertedStartLoading('testReadableRange', () => {
      console.log('start loading converted range overall')
    })
    subscribeToRangeConvertedEndLoading('testReadableRange', () => {
      console.log('end loading converted range overall')
    })
    subscribeToRangeConvertedViewableRangeStartLoading(
      'testReadableRange',
      () => {
        console.log('start loading viewable range')
      }
    )
    subscribeToRangeConvertedViewableRangeEndLoading(
      'testReadableRange',
      () => {
        console.log('end loading viewable range')
      }
    )
    subscribeToRangeConvertedNextLeftRangeStartLoading(
      'testReadableRange',
      () => {
        console.log('start loading next left range')
      }
    )
    subscribeToRangeConvertedNextLeftRangeEndLoading(
      'testReadableRange',
      () => {
        console.log('end loading next left range')
      }
    )
    subscribeToRangeConvertedNextRightRangeStartLoading(
      'testReadableRange',
      () => {
        console.log('start loading next left range')
      }
    )
    subscribeToRangeConvertedNextRightRangeEndLoading(
      'testReadableRange',
      () => {
        console.log('end loading next right range')
      }
    )

    return Promise.resolve({
      formatted: conversionStore['testReadableRange'],
    })
  },
  submodules: {
    input: {
      fn: async ({
        positionalNonCommands,
      }: ParsedCli & { positionalNonCommands: [string] }) => {
        console.log('input', conversionStore['testReadableRange'].input)
        updateRange('testReadableRange', positionalNonCommands[0])
      },
    },
  },
}
