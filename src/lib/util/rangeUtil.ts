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

// Comprehensive test module for rangeUtil
const testRangeUtilStore: {
  cleanups: (() => void)[]
  testResults: {
    [testName: string]: any
  }
} = {
  cleanups: [],
  testResults: {},
}

// Helper function to create or get test results container
function getOrCreateTestResultsContainer(): HTMLElement {
  let container = document.getElementById('test-range-util-results')
  if (!container) {
    container = document.createElement('div')
    container.id = 'test-range-util-results'
    container.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 400px;
      max-height: 80vh;
      overflow-y: auto;
      background-color: #1e1e1e;
      color: #d4d4d4;
      padding: 15px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      z-index: 10000;
      border-left: 2px solid #333;
      box-shadow: -2px 0 10px rgba(0,0,0,0.5);
    `
    
    // Add close button
    const closeButton = document.createElement('button')
    closeButton.textContent = '×'
    closeButton.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: #444;
      color: #fff;
      border: none;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    `
    closeButton.onmouseover = () => {
      closeButton.style.background = '#666'
    }
    closeButton.onmouseout = () => {
      closeButton.style.background = '#444'
    }
    closeButton.onclick = () => {
      container.style.display = 'none'
    }
    container.appendChild(closeButton)
    
    document.body.appendChild(container)
  } else {
    // Show container if it was hidden
    container.style.display = 'block'
  }
  return container
}

// Helper function to format and display test results
function displayTestResults(results: any) {
  const container = getOrCreateTestResultsContainer()
  
  // Calculate summary - flatten nested results
  let passCount = 0
  let failCount = 0
  const testNames: string[] = []
  const flattenedResults: any = {}
  
  for (const [testName, result] of Object.entries(results)) {
    if (testName === 'errors' && result && typeof result === 'object') {
      // Handle nested error results
      for (const [errorTestName, errorResult] of Object.entries(result as any)) {
        const fullName = `errors.${errorTestName}`
        testNames.push(fullName)
        flattenedResults[fullName] = errorResult
        if (errorResult && typeof errorResult === 'object' && 'success' in errorResult) {
          if (errorResult.success) {
            passCount++
          } else {
            failCount++
          }
        }
      }
    } else {
      testNames.push(testName)
      flattenedResults[testName] = result
      if (result && typeof result === 'object' && 'success' in result) {
        if (result.success) {
          passCount++
        } else {
          failCount++
        }
      }
    }
  }
  
  // Create summary HTML
  const summaryHtml = `
    <div style="margin-bottom: 15px; padding-bottom: 10px; padding-right: 30px; border-bottom: 2px solid #444; position: relative;">
      <h3 style="margin: 0 0 10px 0; color: #fff; font-size: 16px;">Test Results Summary</h3>
      <div style="display: flex; gap: 20px;">
        <span style="color: #4caf50; font-weight: bold;">✓ Passed: ${passCount}</span>
        <span style="color: ${failCount > 0 ? '#f44336' : '#4caf50'}; font-weight: bold;">✗ Failed: ${failCount}</span>
        <span style="color: #888;">Total: ${testNames.length}</span>
      </div>
    </div>
  `
  
  // Create detailed results HTML
  let detailsHtml = '<div style="line-height: 1.6;">'
  
  for (const testName of testNames) {
    const result = flattenedResults[testName]
    if (!result || typeof result !== 'object') continue
    
    const isSuccess = result.success === true
    const statusColor = isSuccess ? '#4caf50' : '#f44336'
    const statusIcon = isSuccess ? '✓' : '✗'
    const statusText = isSuccess ? 'PASS' : 'FAIL'
    
    detailsHtml += `
      <div style="margin-bottom: 12px; padding: 8px; background-color: ${isSuccess ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)'}; border-left: 3px solid ${statusColor};">
        <div style="font-weight: bold; color: ${statusColor}; margin-bottom: 4px;">
          ${statusIcon} ${testName}: <span style="color: ${statusColor};">${statusText}</span>
        </div>
    `
    
    if (result.message) {
      detailsHtml += `<div style="color: #bbb; margin-left: 20px; margin-top: 4px;">${escapeHtml(String(result.message))}</div>`
    }
    
    if (result.error) {
      detailsHtml += `<div style="color: #f44336; margin-left: 20px; margin-top: 4px; font-style: italic;">Error: ${escapeHtml(String(result.error))}</div>`
    }
    
    // Show additional details if available (but limit size)
    if (result.store || result.results || result.ticks || result.initialInput || result.updatedInput) {
      const detailsObj = result.store || result.results || result.ticks || 
        (result.initialInput !== undefined ? { initialInput: result.initialInput, updatedInput: result.updatedInput } : null) ||
        (result.initialReadableInput !== undefined ? { initialReadableInput: result.initialReadableInput, updatedReadableInput: result.updatedReadableInput } : null)
      if (detailsObj) {
        const details = JSON.stringify(detailsObj, null, 2)
        if (details.length < 500) {
          detailsHtml += `<pre style="margin: 4px 0 0 20px; padding: 4px; background-color: rgba(0,0,0,0.3); font-size: 10px; overflow-x: auto; color: #aaa;">${escapeHtml(details)}</pre>`
        } else {
          detailsHtml += `<div style="margin-left: 20px; color: #888; font-size: 10px;">[Large data object - ${details.length} chars]</div>`
        }
      }
    }
    
    detailsHtml += '</div>'
  }
  
  detailsHtml += '</div>'
  
  // Update container
  container.innerHTML = summaryHtml + detailsHtml
  
  // Scroll to top
  container.scrollTop = 0
}

// Helper function to escape HTML
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export const testRangeUtil: Module = {
  help: {
    description: 'Comprehensive unit tests for rangeUtil.ts',
    examples: {
      '': 'Run all tests',
      'registerRange': 'Test registerRange function',
      'registerReadableRange': 'Test registerReadableRange function',
      'registerTicks': 'Test registerTicks function',
      'subscriptions': 'Test all subscription functions',
      'updateRange': 'Test updateRange and updateRangeInputInner',
      'reregistration': 'Test reregistration scenarios',
      'errors': 'Test error handling',
    },
  },
  fn: async ({
    positionalNonCommands: [testName],
    'peprn:ancestralDepth': ancestralDepth,
  }: ParsedCli & {
    positionalNonCommands: [string | undefined]
    'peprn:ancestralDepth': number
  }) => {
    if (ancestralDepth > 0) {
      return Promise.resolve({
        formatted: testRangeUtilStore.testResults,
      })
    }

    const results: any = {}

    // Test registerRange
    if (!testName || testName === 'registerRange' || testName === '') {
      try {
        const rangeId = 'testRangeUtil-basic'
        registerRange(
          rangeId,
          100,
          {
            getViewableRange: async (input: number) => [input - 5, input + 5],
            getNextLeftRange: async (input: number) => [input - 20, input - 5],
            getNextRightRange: async (input: number) => [input + 5, input + 20],
          },
          false
        )
        results.registerRange = {
          success: true,
          message: 'registerRange basic test passed',
          store: store[rangeId],
        }
      } catch (error: any) {
        results.registerRange = {
          success: false,
          error: error.message,
        }
      }
    }

    // Test registerRange with initialInput null (should error)
    if (!testName || testName === 'errors' || testName === '') {
      try {
        registerRange(
          'testRangeUtil-null-input',
          null as any,
          {
            getViewableRange: async (input: number) => [input, input + 10],
            getNextLeftRange: async (input: number) => [input - 10, input],
            getNextRightRange: async (input: number) => [input + 10, input + 20],
          },
          false
        )
        results.registerRangeNullInput = {
          success: false,
          message: 'Should have thrown error for null initialInput',
        }
      } catch (error: any) {
        results.registerRangeNullInput = {
          success: true,
          message: 'Correctly threw error for null initialInput',
          error: error.message,
        }
      }
    }

    // Test registerReadableRange with string
    if (!testName || testName === 'registerReadableRange' || testName === '') {
      try {
        const rangeId = 'testRangeUtil-readable-string'
        await registerReadableRange<string>(
          rangeId,
          '50',
          {
            getViewableRange: async (input: number) => [input - 5, input + 5],
            getNextLeftRange: async (input: number) => [input - 20, input - 5],
            getNextRightRange: async (input: number) => [input + 5, input + 20],
            inputToNumber: (input: string) => parseInt(input),
            numberToInput: (number: number) => number.toString(),
            isReregistration: false,
          },
          false
        )
        results.registerReadableRangeString = {
          success: true,
          message: 'registerReadableRange with string passed',
          store: conversionStore[rangeId],
        }
      } catch (error: any) {
        results.registerReadableRangeString = {
          success: false,
          error: error.message,
        }
      }
    }

    // Test registerReadableRange with number
    if (!testName || testName === 'registerReadableRange' || testName === '') {
      try {
        const rangeId = 'testRangeUtil-readable-number'
        await registerReadableRange<number>(
          rangeId,
          75,
          {
            getViewableRange: async (input: number) => [input - 5, input + 5],
            getNextLeftRange: async (input: number) => [input - 20, input - 5],
            getNextRightRange: async (input: number) => [input + 5, input + 20],
            inputToNumber: (input: number) => input,
            numberToInput: (number: number) => number,
            isReregistration: false,
          },
          false
        )
        results.registerReadableRangeNumber = {
          success: true,
          message: 'registerReadableRange with number passed',
          store: conversionStore[rangeId],
        }
      } catch (error: any) {
        results.registerReadableRangeNumber = {
          success: false,
          error: error.message,
        }
      }
    }

    // Test registerReadableRange with Date
    if (!testName || testName === 'registerReadableRange' || testName === '') {
      try {
        const rangeId = 'testRangeUtil-readable-date'
        const initialDate = new Date('2024-01-01')
        await registerReadableRange<Date>(
          rangeId,
          initialDate,
          {
            getViewableRange: async (input: number) => [input - 5, input + 5],
            getNextLeftRange: async (input: number) => [input - 20, input - 5],
            getNextRightRange: async (input: number) => [input + 5, input + 20],
            inputToNumber: (input: Date) => input.getTime(),
            numberToInput: (number: number) => new Date(number),
            isReregistration: false,
          },
          false
        )
        results.registerReadableRangeDate = {
          success: true,
          message: 'registerReadableRange with Date passed',
          store: conversionStore[rangeId],
        }
      } catch (error: any) {
        results.registerReadableRangeDate = {
          success: false,
          error: error.message,
        }
      }
    }

    // Test registerTicks
    if (!testName || testName === 'registerTicks' || testName === '') {
      try {
        const rangeId = 'testRangeUtil-ticks'
        // First register a readable range
        await registerReadableRange<number>(
          rangeId,
          100,
          {
            getViewableRange: async (input: number) => [input - 5, input + 5],
            getNextLeftRange: async (input: number) => [input - 20, input - 5],
            getNextRightRange: async (input: number) => [input + 5, input + 20],
            inputToNumber: (input: number) => input,
            numberToInput: (number: number) => number,
            isReregistration: false,
          },
          false
        )
        // Then register ticks
        registerTicks<number>(
          rangeId,
          ([start, end]: [start: number, end: number]) => {
            const ticks: TicksArray<number> = []
            for (let i = start; i <= end; i += 1) {
              ticks.push({ value: i, label: i.toString() })
            }
            return ticks
          },
          false
        )
        results.registerTicks = {
          success: true,
          message: 'registerTicks passed',
          ticks: accessTicksStore<number>(rangeId).ticks,
        }
      } catch (error: any) {
        results.registerTicks = {
          success: false,
          error: error.message,
        }
      }
    }

    // Test subscriptions
    if (!testName || testName === 'subscriptions' || testName === '') {
      try {
        const rangeId = 'testRangeUtil-subscriptions'
        const subscriptionResults: any = {
          inputChanged: false,
          viewableRange: false,
          nextLeftRange: false,
          nextRightRange: false,
          startLoading: false,
          endLoading: false,
        }

        registerRange(
          rangeId,
          200,
          {
            getViewableRange: async (input: number) => {
              await new Promise((resolve) => setTimeout(resolve, 10))
              return [input - 5, input + 5]
            },
            getNextLeftRange: async (input: number) => {
              await new Promise((resolve) => setTimeout(resolve, 10))
              return [input - 20, input - 5]
            },
            getNextRightRange: async (input: number) => {
              await new Promise((resolve) => setTimeout(resolve, 10))
              return [input + 5, input + 20]
            },
          },
          false
        )

        const unsubInput = subscribeToRangeInputChanged(rangeId, (input) => {
          subscriptionResults.inputChanged = true
          subscriptionResults.inputValue = input
        })

        const unsubViewable = subscribeToRangeViewableRange(
          rangeId,
          (viewableRange) => {
            subscriptionResults.viewableRange = true
            subscriptionResults.viewableRangeValue = viewableRange
          }
        )

        const unsubNextLeft = subscribeToRangeNextLeftRange(
          rangeId,
          (nextLeftRange) => {
            subscriptionResults.nextLeftRange = true
            subscriptionResults.nextLeftRangeValue = nextLeftRange
          }
        )

        const unsubNextRight = subscribeToRangeNextRightRange(
          rangeId,
          (nextRightRange) => {
            subscriptionResults.nextRightRange = true
            subscriptionResults.nextRightRangeValue = nextRightRange
          }
        )

        const unsubStartLoading = subscribeToRangeStartLoading(rangeId, () => {
          subscriptionResults.startLoading = true
        })

        const unsubEndLoading = subscribeToRangeEndLoading(rangeId, () => {
          subscriptionResults.endLoading = true
        })

        // Trigger an update
        updateRangeInputInner(rangeId, 250)

        // Wait for async operations
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Test unsubscribe
        unsubInput()
        unsubViewable()
        unsubNextLeft()
        unsubNextRight()
        unsubStartLoading()
        unsubEndLoading()

        results.subscriptions = {
          success: true,
          message: 'Subscription tests passed',
          results: subscriptionResults,
        }
      } catch (error: any) {
        results.subscriptions = {
          success: false,
          error: error.message,
        }
      }
    }

    // Test converted range subscriptions
    if (!testName || testName === 'subscriptions' || testName === '') {
      try {
        const rangeId = 'testRangeUtil-converted-subscriptions'
        const subscriptionResults: any = {
          convertedStartLoading: false,
          convertedEndLoading: false,
          viewableRangeStartLoading: false,
          viewableRangeEndLoading: false,
          nextLeftRangeStartLoading: false,
          nextLeftRangeEndLoading: false,
          nextRightRangeStartLoading: false,
          nextRightRangeEndLoading: false,
        }

        await registerReadableRange<string>(
          rangeId,
          '300',
          {
            getViewableRange: async (input: number) => {
              await new Promise((resolve) => setTimeout(resolve, 10))
              return [input - 5, input + 5]
            },
            getNextLeftRange: async (input: number) => {
              await new Promise((resolve) => setTimeout(resolve, 10))
              return [input - 20, input - 5]
            },
            getNextRightRange: async (input: number) => {
              await new Promise((resolve) => setTimeout(resolve, 10))
              return [input + 5, input + 20]
            },
            inputToNumber: (input: string) => parseInt(input),
            numberToInput: (number: number) => number.toString(),
            isReregistration: false,
          },
          false
        )

        const unsubConvertedStart = subscribeToRangeConvertedStartLoading(
          rangeId,
          () => {
            subscriptionResults.convertedStartLoading = true
          }
        )

        const unsubConvertedEnd = subscribeToRangeConvertedEndLoading(
          rangeId,
          () => {
            subscriptionResults.convertedEndLoading = true
          }
        )

        const unsubViewableStart =
          subscribeToRangeConvertedViewableRangeStartLoading(rangeId, () => {
            subscriptionResults.viewableRangeStartLoading = true
          })

        const unsubViewableEnd =
          subscribeToRangeConvertedViewableRangeEndLoading(rangeId, () => {
            subscriptionResults.viewableRangeEndLoading = true
          })

        const unsubNextLeftStart =
          subscribeToRangeConvertedNextLeftRangeStartLoading(rangeId, () => {
            subscriptionResults.nextLeftRangeStartLoading = true
          })

        const unsubNextLeftEnd =
          subscribeToRangeConvertedNextLeftRangeEndLoading(rangeId, () => {
            subscriptionResults.nextLeftRangeEndLoading = true
          })

        const unsubNextRightStart =
          subscribeToRangeConvertedNextRightRangeStartLoading(rangeId, () => {
            subscriptionResults.nextRightRangeStartLoading = true
          })

        const unsubNextRightEnd =
          subscribeToRangeConvertedNextRightRangeEndLoading(rangeId, () => {
            subscriptionResults.nextRightRangeEndLoading = true
          })

        // Trigger an update
        updateRange(rangeId, '350')

        // Wait for async operations
        await new Promise((resolve) => setTimeout(resolve, 150))

        // Cleanup
        unsubConvertedStart()
        unsubConvertedEnd()
        unsubViewableStart()
        unsubViewableEnd()
        unsubNextLeftStart()
        unsubNextLeftEnd()
        unsubNextRightStart()
        unsubNextRightEnd()

        results.convertedSubscriptions = {
          success: true,
          message: 'Converted subscription tests passed',
          results: subscriptionResults,
        }
      } catch (error: any) {
        results.convertedSubscriptions = {
          success: false,
          error: error.message,
        }
      }
    }

    // Test updateRange and updateRangeInputInner
    if (!testName || testName === 'updateRange' || testName === '') {
      try {
        const rangeId = 'testRangeUtil-update'
        registerRange(
          rangeId,
          400,
          {
            getViewableRange: async (input: number) => [input - 5, input + 5],
            getNextLeftRange: async (input: number) => [input - 20, input - 5],
            getNextRightRange: async (input: number) => [input + 5, input + 20],
          },
          false
        )

        console.log('store 0', store, {
          rangeId
        })
        const initialInput = store[rangeId].input
        updateRangeInputInner(rangeId, 450)
        console.log('store 1', store, {
          rangeId
        })
        const updatedInput = store[rangeId].input

        results.updateRangeInputInner = {
          success: true,
          message: 'updateRangeInputInner test passed',
          initialInput,
          updatedInput,
        }

        // Test updateRange with readable range
        const readableRangeId = 'testRangeUtil-update-readable'
        await registerReadableRange<string>(
          readableRangeId,
          '500',
          {
            getViewableRange: async (input: number) => [input - 5, input + 5],
            getNextLeftRange: async (input: number) => [input - 20, input - 5],
            getNextRightRange: async (input: number) => [input + 5, input + 20],
            inputToNumber: (input: string) => parseInt(input),
            numberToInput: (number: number) => number.toString(),
            isReregistration: false,
          },
          false
        )

        const initialReadableInput = conversionStore[readableRangeId].input
        updateRange(readableRangeId, '550')
        await new Promise((resolve) => setTimeout(resolve, 50))
        const updatedReadableInput = conversionStore[readableRangeId].input

        results.updateRange = {
          success: true,
          message: 'updateRange test passed',
          initialReadableInput,
          updatedReadableInput,
        }
      } catch (error: any) {
        results.updateRange = {
          success: false,
          error: error.message,
        }
      }
    }

    // Test reregistration
    if (!testName || testName === 'reregistration' || testName === '') {
      try {
        const rangeId = 'testRangeUtil-reregister'
        // Initial registration
        registerRange(
          rangeId,
          600,
          {
            getViewableRange: async (input: number) => [input - 5, input + 5],
            getNextLeftRange: async (input: number) => [input - 20, input - 5],
            getNextRightRange: async (input: number) => [input + 5, input + 20],
          },
          false
        )

        const initialStore = { ...store[rangeId] }

        // Reregister with new functions
        registerRange(
          rangeId,
          null as any,
          {
            getViewableRange: async (input: number) => [input - 10, input + 10],
            getNextLeftRange: async (input: number) => [input - 30, input - 10],
            getNextRightRange: async (input: number) => [input + 10, input + 30],
          },
          true
        )

        results.reregistration = {
          success: true,
          message: 'Reregistration test passed',
          initialStore,
          afterReregister: store[rangeId],
        }

        // Test readable range reregistration
        const readableRangeId = 'testRangeUtil-reregister-readable'
        await registerReadableRange<string>(
          readableRangeId,
          '700',
          {
            getViewableRange: async (input: number) => [input - 5, input + 5],
            getNextLeftRange: async (input: number) => [input - 20, input - 5],
            getNextRightRange: async (input: number) => [input + 5, input + 20],
            inputToNumber: (input: string) => parseInt(input),
            numberToInput: (number: number) => number.toString(),
            isReregistration: false,
          },
          false
        )

        const initialReadableStore = { ...conversionStore[readableRangeId] }

        await registerReadableRange<string>(
          readableRangeId,
          null,
          {
            getViewableRange: async (input: number) => [input - 10, input + 10],
            getNextLeftRange: async (input: number) => [input - 30, input - 10],
            getNextRightRange: async (input: number) => [input + 10, input + 30],
            inputToNumber: (input: string) => parseInt(input),
            numberToInput: (number: number) => number.toString(),
            isReregistration: true,
          },
          true
        )

        results.reregistrationReadable = {
          success: true,
          message: 'Readable range reregistration test passed',
          initialStore: initialReadableStore,
          afterReregister: conversionStore[readableRangeId],
        }
      } catch (error: any) {
        results.reregistration = {
          success: false,
          error: error.message,
        }
      }
    }

    // Test error cases
    if (!testName || testName === 'errors' || testName === '') {
      const errorResults: any = {}

      // Test reregistration with initialInput (should error)
      try {
        registerRange(
          'testRangeUtil-error-reregister-with-input',
          800,
          {
            getViewableRange: async (input: number) => [input, input + 10],
            getNextLeftRange: async (input: number) => [input - 10, input],
            getNextRightRange: async (input: number) => [input + 10, input + 20],
          },
          false
        )
        registerRange(
          'testRangeUtil-error-reregister-with-input',
          850,
          {
            getViewableRange: async (input: number) => [input, input + 10],
            getNextLeftRange: async (input: number) => [input - 10, input],
            getNextRightRange: async (input: number) => [input + 10, input + 20],
          },
          true
        )
        errorResults.reregisterWithInput = {
          success: false,
          message: 'Should have thrown error for initialInput in reregistration',
        }
      } catch (error: any) {
        errorResults.reregisterWithInput = {
          success: true,
          message: 'Correctly threw error for initialInput in reregistration',
          error: error.message,
        }
      }

      // Test readable range reregistration with initialInput (should error)
      try {
        await registerReadableRange<string>(
          'testRangeUtil-error-readable-reregister',
          '900',
          {
            getViewableRange: async (input: number) => [input, input + 10],
            getNextLeftRange: async (input: number) => [input - 10, input],
            getNextRightRange: async (input: number) => [input + 10, input + 20],
            inputToNumber: (input: string) => parseInt(input),
            numberToInput: (number: number) => number.toString(),
            isReregistration: false,
          },
          false
        )
        await registerReadableRange<string>(
          'testRangeUtil-error-readable-reregister',
          '950',
          {
            getViewableRange: async (input: number) => [input, input + 10],
            getNextLeftRange: async (input: number) => [input - 10, input],
            getNextRightRange: async (input: number) => [input + 10, input + 20],
            inputToNumber: (input: string) => parseInt(input),
            numberToInput: (number: number) => number.toString(),
            isReregistration: true,
          },
          true
        )
        errorResults.readableReregisterWithInput = {
          success: false,
          message:
            'Should have thrown error for initialInput in readable reregistration',
        }
      } catch (error: any) {
        errorResults.readableReregisterWithInput = {
          success: true,
          message:
            'Correctly threw error for initialInput in readable reregistration',
          error: error.message,
        }
      }

      results.errors = errorResults
    }

    // Test accessConversionStore type safety
    if (!testName || testName === '') {
      try {
        const rangeId = 'testRangeUtil-type-safety'
        await registerReadableRange<string>(
          rangeId,
          '1000',
          {
            getViewableRange: async (input: number) => [input - 5, input + 5],
            getNextLeftRange: async (input: number) => [input - 20, input - 5],
            getNextRightRange: async (input: number) => [input + 5, input + 20],
            inputToNumber: (input: string) => parseInt(input),
            numberToInput: (number: number) => number.toString(),
            isReregistration: false,
          },
          false
        )

        const store = accessConversionStore<string>(rangeId)
        const input = store.input
        store.input = '1100'
        const viewableRange = store.viewableRange
        store.viewableRange = ['1095', '1105']

        // Test type mismatch error
        let typeMismatchError = false
        try {
          store.input = 1234 as any // Should fail type check
        } catch (error: any) {
          typeMismatchError = true
        }

        results.typeSafety = {
          success: true,
          message: 'Type safety tests passed',
          input,
          viewableRange,
          typeMismatchError,
        }
      } catch (error: any) {
        results.typeSafety = {
          success: false,
          error: error.message,
        }
      }
    }

    testRangeUtilStore.testResults = results
    
    // Display results in DOM
    displayTestResults(results)
    
    return Promise.resolve({
      formatted: results,
    })
  },
  submodules: {
    cleanup: {
      fn: async () => {
        const countBefore = testRangeUtilStore.cleanups.length
        ;[...testRangeUtilStore.cleanups].forEach((cleanup) => {
          cleanup()
        })
        testRangeUtilStore.cleanups = []
        return Promise.resolve({
          countBefore,
          countAfter: testRangeUtilStore.cleanups.length,
          message: 'Cleanup completed',
        })
      },
    },
  },
}
