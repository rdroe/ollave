import type { StringOrNumberOrDate } from '../readableRange'
import { conversionEmitters } from '../readableRange'
import {
  getConversionEventNames,
} from '../readableRange'
import { store as basicRangeStore } from '../basicRange'

export type TicksArray<InputType extends StringOrNumberOrDate> = Array<{
  value: InputType
  label: string
  dimensions?: { width: number; height: number }
}>

type Emitters = {
  [rangeId: string]: Record<string, EventTarget>
}

type Cleanup = {
  [rangeId: string]: (() => void)[]
}

type Fns = {
  [rangeId: string]: {
    [ticksType: string]: (inputRange: [start: number, end: number]) => Promise<TicksArray<number>>
  }
}
const fns: Fns = {}

const emitters: Emitters = {}
const cleanup: Cleanup = {}
export  const ticksStore: {
  [rangeId: string]: {
    ticks: {
      viewableRange: TicksArray<number>
      nextLeftRange: TicksArray<number>
      nextRightRange: TicksArray<number>
    }
    loading: {
      viewableRange: boolean
      nextLeftRange: boolean
      nextRightRange: boolean
    }
  }
} = {}


const addEventHandlerAndTrigger = (rangeId: string, baseName: string, 
  handler: (event: Event) => void,
  addTriggeringEventHandlerFn?: (
    readableEmitters: typeof conversionEmitters,
    ticksEmitters: Emitters,
  ) => void, 
) => {

  if (!emitters[rangeId]) {

    cleanup[rangeId] = []
    emitters[rangeId] = {}
  }
  if (!emitters[rangeId][baseName]) {
    emitters[rangeId][baseName] = new EventTarget()
  } else {
    throw new Error(`Emitter ${baseName} already exists`)
  }
  emitters[rangeId][baseName].addEventListener(baseName, handler)
  cleanup[rangeId].push(() => {
    emitters[rangeId][baseName].removeEventListener(baseName, handler)
  })

  if (addTriggeringEventHandlerFn) {
    addTriggeringEventHandlerFn(conversionEmitters, emitters)
  } 
}
const completionEvents = {
  'viewableRange' : 'VIEWABLE_TICKS_LOADING_COMPLETE',
  'nextLeftRange' : 'NEXT_LEFT_TICKS_LOADING_COMPLETE',
  'nextRightRange' : 'NEXT_RIGHT_TICKS_LOADING_COMPLETE',
}
const TICKS_LOADING_COMPLETE_EVENT = 'TICKS_LOADING_COMPLETE'
const isLoading: {
  [rangeId: string]: Record<"viewableRange" | "nextLeftRange" | "nextRightRange", boolean>
} = {}

function getTicksLoadingStartHandler(rangeId: string, rangeName: "viewableRange" | "nextLeftRange" | "nextRightRange") { 
  return function () {
    const range = basicRangeStore[rangeId][rangeName]
    if (!range) {
      throw new Error(`${rangeName} not found`)
    }
    ticksStore[rangeId].loading[rangeName] = true
    isLoading[rangeId][rangeName] = true

      fns[rangeId].createDefaultTicks(range).then((ticks) => { 

      ticksStore[rangeId].ticks[rangeName] = ticks

      const completionEvent = completionEvents[rangeName]
      if (!emitters[rangeId][completionEvent]) {
        emitters[rangeId][completionEvent] = new EventTarget() 
      }
      emitters[rangeId][completionEvent].dispatchEvent(new CustomEvent(completionEvent, {
        detail: {
          name: completionEvent, 
          boolean: true,
        },
      }))
    }).catch((error) => {
      console.error(`Error loading ticks for ${rangeName} ${rangeId}`, error)
    })
  }
} 

function getDispatchAdder(rangeId: string, eventName: string, emitterName: keyof Omit<typeof conversionEmitters[string], "cleanup">, detailProp: "viewableRangeLoading" | "nextLeftRangeLoading" | "nextRightRangeLoading"  ) {
  return function dispatchAdder(cEmitters: typeof conversionEmitters, ticksEmitters: Emitters)  {
    const myHandler = (event: Event & { detail: {
      [key in typeof detailProp]: boolean
    } }) => {
      if (!event.detail[detailProp]) {
        ticksEmitters[rangeId][eventName].dispatchEvent(new CustomEvent(eventName, {
          detail: {
            rangeId: rangeId,
          },
        }))
      }
    }

    cEmitters[rangeId][emitterName].addEventListener(getConversionEventNames(rangeId)[emitterName],  myHandler) 
    cEmitters[rangeId].cleanup.push(() => {
      cEmitters[rangeId][emitterName].removeEventListener(getConversionEventNames(rangeId)[emitterName], myHandler)
    })
    cleanup[rangeId].push(() => {
      cEmitters[rangeId][emitterName].removeEventListener(getConversionEventNames(rangeId)[emitterName], myHandler)
    })
  }
}

const getCompletionEventHandler = (rangeId: string, rangeName: "viewableRange" | "nextLeftRange" | "nextRightRange") => {
  return function handler() {
    isLoading[rangeId][rangeName] = false
    const otherRangesLoadingEntriesLength = Object.entries(isLoading[rangeId]).filter(([key, value]) => key !== rangeName && value === true).length
    if (otherRangesLoadingEntriesLength === 0) {
      ticksStore[rangeId].loading[rangeName] = false
      emitters[rangeId][TICKS_LOADING_COMPLETE_EVENT].dispatchEvent(new CustomEvent(TICKS_LOADING_COMPLETE_EVENT, {
        detail: {
          name: TICKS_LOADING_COMPLETE_EVENT,
          boolean: true,
        },
      }))
    }
  }
}

export const registerTicks = (rangeId: string, createDefaultTicks: (inputRange: [start: number, end: number]) => Promise<TicksArray<number>>, runImmediately: boolean = false) => {
  fns[rangeId] = {
    createDefaultTicks: createDefaultTicks,
  }
  if (ticksStore[rangeId]) {
    unregisterTicks(rangeId)
  }
  if (!ticksStore[rangeId]) {
    ticksStore[rangeId] = {
      ticks: {
        viewableRange: [],
        nextLeftRange: [],
        nextRightRange: [],
      },
      loading: {
        viewableRange: false,
        nextLeftRange: false,
        nextRightRange: false,
      }
    }
  }
  if (!cleanup[rangeId]) {
    cleanup[rangeId] = []
  }
  if (!isLoading[rangeId]) {
    isLoading[rangeId] = {
      viewableRange: false,
      nextLeftRange: false,
      nextRightRange: false,
    }
  }

  if (!emitters[rangeId]) {
    emitters[rangeId] = {}
  }
  if (!emitters[rangeId][TICKS_LOADING_COMPLETE_EVENT]) {
    emitters[rangeId][TICKS_LOADING_COMPLETE_EVENT] = new EventTarget()
  }

  const completionEventHandlerViewableRange = getCompletionEventHandler(rangeId, 'viewableRange')
  const completionEventHandlerNextLeftRange = getCompletionEventHandler(rangeId, 'nextLeftRange')
  const completionEventHandlerNextRightRange = getCompletionEventHandler(rangeId, 'nextRightRange')
  addEventHandlerAndTrigger(rangeId, completionEvents.viewableRange, completionEventHandlerViewableRange)
  addEventHandlerAndTrigger(rangeId, completionEvents.nextLeftRange, completionEventHandlerNextLeftRange)
  addEventHandlerAndTrigger(rangeId, completionEvents.nextRightRange, completionEventHandlerNextRightRange)

  const viewableTicksLoadingStartHandler = getTicksLoadingStartHandler(rangeId, 'viewableRange') 
  const nextLeftTicksLoadingStartHandler = getTicksLoadingStartHandler(rangeId, 'nextLeftRange') 
  const nextRightTicksLoadingStartHandler = getTicksLoadingStartHandler(rangeId, 'nextRightRange') 

  const dispatchAdderViewableRange = getDispatchAdder(rangeId, 'VIEWABLE_TICKS_LOADING', 'convertedViewableRangeLoading', 'viewableRangeLoading')
  const dispatchAdderNextLeftRange = getDispatchAdder(rangeId, 'NEXT_LEFT_TICKS_LOADING', 'convertedNextLeftRangeLoading', 'nextLeftRangeLoading')
  const dispatchAdderNextRightRange = getDispatchAdder(rangeId, 'NEXT_RIGHT_TICKS_LOADING', 'convertedNextRightRangeLoading', 'nextRightRangeLoading')
  addEventHandlerAndTrigger(rangeId, 'VIEWABLE_TICKS_LOADING', viewableTicksLoadingStartHandler, dispatchAdderViewableRange)
  addEventHandlerAndTrigger(rangeId, 'NEXT_LEFT_TICKS_LOADING', nextLeftTicksLoadingStartHandler, dispatchAdderNextLeftRange)
  addEventHandlerAndTrigger(rangeId, 'NEXT_RIGHT_TICKS_LOADING', nextRightTicksLoadingStartHandler, dispatchAdderNextRightRange)

  if (runImmediately) {
    viewableTicksLoadingStartHandler()
    nextLeftTicksLoadingStartHandler()
    nextRightTicksLoadingStartHandler()
  }
}

export const unregisterTicks = (rangeId: string) => {
  cleanup[rangeId].forEach((cleanupFn) => cleanupFn())
  cleanup[rangeId] = []
  emitters[rangeId] = {}
  ticksStore[rangeId] = undefined
  isLoading[rangeId] = undefined
}


export const subscribeToTicksLoadingComplete = (rangeId: string, callback: (ticks: (typeof ticksStore[string])['ticks']) => void) => {
  function handler() {
    callback(ticksStore[rangeId].ticks)
  }
  emitters[rangeId][TICKS_LOADING_COMPLETE_EVENT].addEventListener(TICKS_LOADING_COMPLETE_EVENT, handler)
  cleanup[rangeId].push(() => {
    emitters[rangeId][TICKS_LOADING_COMPLETE_EVENT].removeEventListener(TICKS_LOADING_COMPLETE_EVENT, handler)
  })
  return function unsubscribe() {
    emitters[rangeId][TICKS_LOADING_COMPLETE_EVENT].removeEventListener(TICKS_LOADING_COMPLETE_EVENT, handler)
  }
}

export const updateTicksMethod = (rangeId: string, createDefaultTicks: (inputRange: [start: number, end: number]) => Promise<TicksArray<number>>) => {
  fns[rangeId].createDefaultTicks = createDefaultTicks
}

const onInitOnceFns: {
  [rangeId: string]: {
    allRanges: () => void 
  }
} = {}

export const subscribeToTicksInitialization = (rangeId: string, callback: (ticks: (typeof ticksStore[string])['ticks']) => void) => {


  const cleanupFn = () => {
    emitters[rangeId][TICKS_LOADING_COMPLETE_EVENT].removeEventListener(TICKS_LOADING_COMPLETE_EVENT, thisHandler)
  } 
  const thisHandler = () => {
    callback(ticksStore[rangeId].ticks)
    cleanupFn()
  }

  emitters[rangeId][TICKS_LOADING_COMPLETE_EVENT].addEventListener(TICKS_LOADING_COMPLETE_EVENT, thisHandler)
  
  return cleanupFn
}