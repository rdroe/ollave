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


export const createDomRangeDemo = () => {
  const rangeDemo = document.createElement('div')
  rangeDemo.id = 'range-demo'
  rangeDemo.style.cssText = `
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
  document.body.appendChild(rangeDemo)
} 


/**
This is a project from a different repo. 
By name the utities are the same (rangeUtil, rangeUtilHelpers, rangeUtilTests), but the code is different
Though import paths will be different. 

I want to make a pure javascript (no react / jsx ) version of the jsx app below. 



import { Button } from '@mui/material'
import { createStore, useStore } from 'zustand'

import { numberToAlphadex, convertAlphadex } from './rangeExampleUtils'
import { useRangeInner } from './useRangeInner'

const initLetterRaw = numberToAlphadex(Math.random() * 20)
const initLetter = Math.random() < 0.1 ? initLetterRaw : `-${initLetterRaw}`

type TimelineDimensionStore = {
  zoom: number
  unitSize: number
  unitsPerViewportWidth: number
  leftPrefetchFactor: number
  rightPrefetchFactor: number
}
const timelineDimensionStore = createStore<TimelineDimensionStore>((set) => ({
  zoom: 1,
  unitSize: 0.1,
  unitsPerViewportWidth: 10,
  leftPrefetchFactor: 2,
  rightPrefetchFactor: 2,
}))

export default function NewTimelineRange() {
  const {
    zoom,
    unitSize,
    unitsPerViewportWidth,
    leftPrefetchFactor,
    rightPrefetchFactor,
  } = useStore(timelineDimensionStore)

  const {
    viewableRange,
    nextLeftRange,
    nextRightRange,
    setPendingInput,
    currentScroll,
    ticksInRange,
    incrementUtil,
    decrementUtil,
  } = useRangeInner(initLetter, {
    zoom,
    unitSize,
    unitsPerViewportWidth,
    leftPrefetchFactor,
    rightPrefetchFactor,
    inputToRangeNumber: convertAlphadex,
    rangeNumberToInput: numberToAlphadex,
  })

  return (
    <div>
      <div>letter</div>
      <div>{currentScroll || initLetter}</div>{' '}
      <div className="flex gap-2">
        <Button
          onClick={() => {
            const prevLetter = decrementUtil(currentScroll || initLetter)
            setPendingInput(prevLetter)
          }}
        >
          prev
        </Button>
        <Button
          onClick={() => {
            const nextLetter = incrementUtil(currentScroll || initLetter)
            setPendingInput(nextLetter)
          }}
        >
          next
        </Button>
      </div>
      <div>viewableRange</div>
      <div>{viewableRange.join(', ')}</div>
      <div>nextLeftRange</div>
      <div>{nextLeftRange.join(', ')}</div>
      <div>nextRightRange</div>
      <div>{nextRightRange.join(', ')}</div>
      <div>currentTicks</div>
      <div>{ticksInRange(viewableRange).join(', ')}</div>
      <div>nextLeftTicks</div>
      <div>{ticksInRange(nextLeftRange).join(', ')}</div>
      <div>nextRightTicks</div>
      <div>{ticksInRange(nextRightRange).join(', ')}</div>
      <div>zoom</div>
      <div>{zoom}</div>
      <Button
        onClick={() => {
          timelineDimensionStore.setState({ zoom: zoom + 0.5 })
        }}
      >
        zoom in
      </Button>
      <Button
        onClick={() => {
          timelineDimensionStore.setState({ zoom: zoom - 0.5 })
        }}
      >
        zoom out
      </Button>
      <div>unitSize</div>
      <div>{unitSize}</div>
      <Button
        onClick={() => {
          timelineDimensionStore.setState({
            unitSize: unitSize + 0.05,
          })
        }}
      >
        unitSize up
      </Button>
      <Button
        onClick={() => {
          timelineDimensionStore.setState({
            unitSize: unitSize - 0.05,
          })
        }}
      >
        unitSize down
      </Button>
      <div>unitsPerViewportWidth</div>
      <div>{unitsPerViewportWidth}</div>
      <Button
        onClick={() => {
          timelineDimensionStore.setState({
            unitsPerViewportWidth: unitsPerViewportWidth + 1,
          })
        }}
      >
        unitsPerViewportWidth up
      </Button>
      <Button
        onClick={() => {
          timelineDimensionStore.setState({
            unitsPerViewportWidth: unitsPerViewportWidth - 1,
          })
        }}
      >
        unitsPerViewportWidth down
      </Button>
    </div>
  )
}

 */