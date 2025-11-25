// Re-export everything from the modularized rangeUtil helpers
export * from './rangeUtilHelpers/basicRange'
export * from './rangeUtilHelpers/readableRange'
export * from './rangeUtilHelpers/ticks'

// Re-export types
export type { NumericInput } from './rangeUtilHelpers/basicRange'
export type { StringOrNumberOrDate } from './rangeUtilHelpers/readableRange'
export type { TicksArray } from './rangeUtilHelpers/ticks'

import { convertAlphadex, numberToAlphadex } from './alphadex'

// Re-export test modules from the separate test file
export { testRangeInner, testReadableRange, testRangeUtil } from './rangeUtilTests'


export const createDomRangeDemo = () => {
  if (typeof document === 'undefined') return

  // --- State (equivalent to the zustand store in the JSX example) ---
  let zoom = 1
  let unitSize = 0.1
  let unitsPerViewportWidth = 10
  let leftPrefetchFactor = 2
  let rightPrefetchFactor = 2

  const initLetterRaw = numberToAlphadex(Math.random() * 20)
  const initLetter = Math.random() < 0.1 ? initLetterRaw : `-${initLetterRaw}`
  let currentScroll: string | null = null

  const getCurrentLetter = () => currentScroll || initLetter

  const incrementUtil = (letter: string) => {
    const n = convertAlphadex(letter)
    return numberToAlphadex(n + unitSize)
  }

  const decrementUtil = (letter: string) => {
    const n = convertAlphadex(letter)
    return numberToAlphadex(n - unitSize)
  }

  type RangePair = [number, number]

  const ticksInRange = (range: RangePair): string[] => {
    const [start, end] = range
    const ticks: string[] = []
    if (!Number.isFinite(start) || !Number.isFinite(end)) return ticks
    const step = Math.max(unitSize, 0.1)
    if (step <= 0) return ticks
    if (start <= end) {
      for (let v = start; v <= end + 1e-9; v += step) {
        const rounded = Math.round(v * 10) / 10
        ticks.push(numberToAlphadex(rounded))
      }
    } else {
      for (let v = start; v >= end - 1e-9; v -= step) {
        const rounded = Math.round(v * 10) / 10
        ticks.push(numberToAlphadex(rounded))
      }
    }
    return ticks
  }

  const computeRanges = () => {
    const center = convertAlphadex(getCurrentLetter())
    const viewportWidth = (unitsPerViewportWidth || 1) / (zoom || 1)
    const half = viewportWidth / 2

    const viewableRange: RangePair = [center - half, center + half]
    const nextLeftRange: RangePair = [
      viewableRange[0] - viewportWidth * leftPrefetchFactor,
      viewableRange[0],
    ]
    const nextRightRange: RangePair = [
      viewableRange[1],
      viewableRange[1] + viewportWidth * rightPrefetchFactor,
    ]

    return {
      viewableRange,
      nextLeftRange,
      nextRightRange,
    }
  }

  // --- DOM creation (pure JS version of the JSX app) ---
  const root = document.createElement('div')
  root.id = 'range-demo'
  root.style.cssText = `
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

  const makeLabel = (text: string) => {
    const el = document.createElement('div')
    el.textContent = text
    el.style.marginTop = '6px'
    return el
  }

  const makeValue = () => {
    const el = document.createElement('div')
    el.style.marginBottom = '4px'
    return el
  }

  const makeButton = (label: string, onClick: () => void) => {
    const btn = document.createElement('button')
    btn.textContent = label
    btn.style.marginRight = '6px'
    btn.style.marginTop = '4px'
    btn.style.padding = '2px 8px'
    btn.style.background = '#333'
    btn.style.color = '#fff'
    btn.style.border = '1px solid #555'
    btn.style.borderRadius = '3px'
    btn.style.cursor = 'pointer'
    btn.addEventListener('click', onClick)
    return btn
  }

  // Letter + prev/next
  const letterLabel = makeLabel('letter')
  const letterValue = makeValue()

  const letterButtonsRow = document.createElement('div')
  const prevBtn = makeButton('prev', () => {
    const prevLetter = decrementUtil(getCurrentLetter())
    currentScroll = prevLetter
    render()
  })
  const nextBtn = makeButton('next', () => {
    const nextLetter = incrementUtil(getCurrentLetter())
    currentScroll = nextLetter
    render()
  })
  letterButtonsRow.appendChild(prevBtn)
  letterButtonsRow.appendChild(nextBtn)

  // Ranges and ticks
  const viewableLabel = makeLabel('viewableRange')
  const viewableValue = makeValue()
  const nextLeftLabel = makeLabel('nextLeftRange')
  const nextLeftValue = makeValue()
  const nextRightLabel = makeLabel('nextRightRange')
  const nextRightValue = makeValue()

  const currentTicksLabel = makeLabel('currentTicks')
  const currentTicksValue = makeValue()
  const nextLeftTicksLabel = makeLabel('nextLeftTicks')
  const nextLeftTicksValue = makeValue()
  const nextRightTicksLabel = makeLabel('nextRightTicks')
  const nextRightTicksValue = makeValue()

  // Zoom controls
  const zoomLabel = makeLabel('zoom')
  const zoomValue = makeValue()
  const zoomInBtn = makeButton('zoom in', () => {
    zoom = zoom + 0.5
    render()
  })
  const zoomOutBtn = makeButton('zoom out', () => {
    zoom = zoom - 0.5
    if (zoom <= 0) zoom = 0.5
    render()
  })

  // unitSize controls
  const unitSizeLabel = makeLabel('unitSize')
  const unitSizeValue = makeValue()
  const unitSizeUpBtn = makeButton('unitSize up', () => {
    unitSize = unitSize + 0.05
    render()
  })
  const unitSizeDownBtn = makeButton('unitSize down', () => {
    unitSize = unitSize - 0.05
    if (unitSize <= 0.01) unitSize = 0.01
    render()
  })

  // unitsPerViewportWidth controls
  const upvwLabel = makeLabel('unitsPerViewportWidth')
  const upvwValue = makeValue()
  const upvwUpBtn = makeButton('unitsPerViewportWidth up', () => {
    unitsPerViewportWidth = unitsPerViewportWidth + 1
    render()
  })
  const upvwDownBtn = makeButton('unitsPerViewportWidth down', () => {
    unitsPerViewportWidth = unitsPerViewportWidth - 1
    if (unitsPerViewportWidth <= 1) unitsPerViewportWidth = 1
    render()
  })

  // Assemble DOM
  root.appendChild(letterLabel)
  root.appendChild(letterValue)
  root.appendChild(letterButtonsRow)

  root.appendChild(viewableLabel)
  root.appendChild(viewableValue)
  root.appendChild(nextLeftLabel)
  root.appendChild(nextLeftValue)
  root.appendChild(nextRightLabel)
  root.appendChild(nextRightValue)

  root.appendChild(currentTicksLabel)
  root.appendChild(currentTicksValue)
  root.appendChild(nextLeftTicksLabel)
  root.appendChild(nextLeftTicksValue)
  root.appendChild(nextRightTicksLabel)
  root.appendChild(nextRightTicksValue)

  root.appendChild(zoomLabel)
  root.appendChild(zoomValue)
  root.appendChild(zoomInBtn)
  root.appendChild(zoomOutBtn)

  root.appendChild(unitSizeLabel)
  root.appendChild(unitSizeValue)
  root.appendChild(unitSizeUpBtn)
  root.appendChild(unitSizeDownBtn)

  root.appendChild(upvwLabel)
  root.appendChild(upvwValue)
  root.appendChild(upvwUpBtn)
  root.appendChild(upvwDownBtn)

  const render = () => {
    const letter = getCurrentLetter()
    letterValue.textContent = letter

    const { viewableRange, nextLeftRange, nextRightRange } = computeRanges()

    const fmtRange = (r: RangePair) =>
      `${numberToAlphadex(Math.round(r[0] * 10) / 10)}, ${numberToAlphadex(
        Math.round(r[1] * 10) / 10
      )}`

    viewableValue.textContent = fmtRange(viewableRange)
    nextLeftValue.textContent = fmtRange(nextLeftRange)
    nextRightValue.textContent = fmtRange(nextRightRange)

    currentTicksValue.textContent = ticksInRange(viewableRange).join(', ')
    nextLeftTicksValue.textContent = ticksInRange(nextLeftRange).join(', ')
    nextRightTicksValue.textContent = ticksInRange(nextRightRange).join(', ')

    zoomValue.textContent = String(zoom)
    unitSizeValue.textContent = String(unitSize.toFixed(2))
    upvwValue.textContent = String(unitsPerViewportWidth)
  }

  render()
  document.body.appendChild(root)
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