export type NumericInput = number

export const emitters: {
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

export const store: {
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

export const getEventNames2 = (rangeId: string) => {
  return {
    inputChanged: `${rangeId}-${INPUT_CHANGED_EVENT}`,
    inputAfterChanged: `${rangeId}-${INPUT_AFTER_CHANGED_EVENT}`,
    viewableRange: `${rangeId}-${VIEWABLE_RANGE_EVENT}`,
    nextLeftRange: `${rangeId}-${NEXT_LEFT_RANGE_EVENT}`,
    nextRightRange: `${rangeId}-${NEXT_RIGHT_RANGE_EVENT}`,
    loading: `${rangeId}-${LOADING_EVENT}`,
  }
}

// Callbacks for conversion store integration
// When these are set, the conversion store is guaranteed to exist for any rangeId that uses them
let getConversionStore: ((rangeId: string) => { convertedLoading: boolean }) | null = null
let getConversionEmitters: ((rangeId: string) => {
  convertedLoading: EventTarget
  convertedViewableRangeLoading: EventTarget
  convertedNextLeftRangeLoading: EventTarget
  convertedNextRightRangeLoading: EventTarget
}) | null = null
let getConversionEventNames: ((rangeId: string) => {
  convertedLoading: string
  convertedViewableRangeLoading: string
  convertedNextLeftRangeLoading: string
  convertedNextRightRangeLoading: string
}) | null = null

export function setConversionStoreCallbacks(
  getStore: (rangeId: string) => { convertedLoading: boolean },
  getEmitters: (rangeId: string) => {
    convertedLoading: EventTarget
    convertedViewableRangeLoading: EventTarget
    convertedNextLeftRangeLoading: EventTarget
    convertedNextRightRangeLoading: EventTarget
  },
  getEventNames: (rangeId: string) => {
    convertedLoading: string
    convertedViewableRangeLoading: string
    convertedNextLeftRangeLoading: string
    convertedNextRightRangeLoading: string
  }
) {
  getConversionStore = getStore
  getConversionEmitters = getEmitters
  getConversionEventNames = getEventNames
}

export function internalInputChangedListener(
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

export function inputAfterChangedListener(
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
  
  // Conversion store integration (required when callbacks are set)
  if (getConversionStore && getConversionEmitters && getConversionEventNames) {
    const conversionStore = getConversionStore(rangeId)
    const conversionEmitters = getConversionEmitters(rangeId)
    const conversionEventNames = getConversionEventNames(rangeId)
    
    if (conversionStore.convertedLoading === false) {
      conversionStore.convertedLoading = true
      conversionEmitters.convertedLoading.dispatchEvent(
        new CustomEvent(conversionEventNames.convertedLoading, {
          detail: { rangeId: rangeId, loading: true },
        })
      )
    }
    conversionEmitters.convertedViewableRangeLoading.dispatchEvent(
      new CustomEvent(conversionEventNames.convertedViewableRangeLoading, {
        detail: { rangeId: rangeId, viewableRangeLoading: true },
      })
    )
  }
  
  emitters[rangeId].loadingRefCount++
  store[rangeId].fns.getViewableRange(newInput).then((viewableRange) => {
    store[rangeId].viewableRange = viewableRange
    emitters[rangeId].loadingRefCount--

    emitters[rangeId].viewableRange.dispatchEvent(
      new CustomEvent(getEventNames2(rangeId).viewableRange, {
        detail: {
          rangeId: rangeId,
          viewableRange: store[rangeId].viewableRange,
        },
      })
    )
    if (emitters[rangeId].loadingRefCount === 0) {

      store[rangeId].loading = false
      emitters[rangeId].loading.dispatchEvent(
        new CustomEvent(getEventNames2(rangeId).loading, {
          detail: { rangeId: rangeId, loading: false },
        })
      )
    }
  })
  
  if (getConversionEmitters && getConversionEventNames) {
    const conversionEmitters = getConversionEmitters(rangeId)
    const conversionEventNames = getConversionEventNames(rangeId)
    
    emitters[rangeId].loadingRefCount++
    conversionEmitters.convertedNextLeftRangeLoading.dispatchEvent(
      new CustomEvent(conversionEventNames.convertedNextLeftRangeLoading, {
        detail: { rangeId: rangeId, nextLeftRangeLoading: true },
      })
    )
  }
  
  emitters[rangeId].loadingRefCount++
  store[rangeId].fns.getNextLeftRange(newInput).then((nextLeftRange) => {
    emitters[rangeId].loadingRefCount--

    store[rangeId].nextLeftRange = nextLeftRange
    emitters[rangeId].nextLeftRange.dispatchEvent(
      new CustomEvent(getEventNames2(rangeId).nextLeftRange, {
        detail: {
          rangeId: rangeId,
          nextLeftRange: store[rangeId].nextLeftRange,
        },
      })
    )
    if (emitters[rangeId].loadingRefCount === 0) {
      store[rangeId].loading = false
      emitters[rangeId].loading.dispatchEvent(
        new CustomEvent(getEventNames2(rangeId).loading, {
          detail: { rangeId: rangeId, loading: false },
        })
      )
    }
  })
  
  if (getConversionEmitters && getConversionEventNames) {
    const conversionEmitters = getConversionEmitters(rangeId)
    const conversionEventNames = getConversionEventNames(rangeId)
    
    conversionEmitters.convertedNextRightRangeLoading.dispatchEvent(
      new CustomEvent(conversionEventNames.convertedNextRightRangeLoading, {
        detail: { rangeId: rangeId, nextRightRangeLoading: true },
      })
    )
  }
  
  emitters[rangeId].loadingRefCount++
  store[rangeId].fns.getNextRightRange(newInput).then((nextRightRange) => {
    emitters[rangeId].loadingRefCount--

    store[rangeId].nextRightRange = nextRightRange
    emitters[rangeId].nextRightRange.dispatchEvent(
      new CustomEvent(getEventNames2(rangeId).nextRightRange, {
        detail: {
          rangeId: rangeId,
          nextRightRange: store[rangeId].nextRightRange,
        },
      })
    )
    if (emitters[rangeId].loadingRefCount === 0) {
      store[rangeId].loading = false
      emitters[rangeId].loading.dispatchEvent(
        new CustomEvent(getEventNames2(rangeId).loading, {
          detail: { rangeId: rangeId, loading: false },
        })
      )
    }
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
      console.log('reregistration basic range 0', rangeId)
      console.log('initial input 0', initialInput)
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
    // emitters[rangeId].cleanup.forEach((cleanupFn) => cleanupFn())
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


// remove all listeners and cleanup for a range, return a function to unsubscribe
export const unregisterRange = (rangeId: string) => {
  emitters[rangeId].inputChanged.removeEventListener(
    getEventNames2(rangeId).inputChanged,
    internalInputChangedListener
  )
  emitters[rangeId].inputChanged.removeEventListener(
    getEventNames2(rangeId).inputAfterChanged,
    inputAfterChangedListener
  )

  emitters[rangeId].cleanup.forEach((cleanupFn) => cleanupFn())
  emitters[rangeId].cleanup = []

}