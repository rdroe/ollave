// Re-export everything from the modularized rangeUtil helpers
export * from './rangeUtilHelpers/basicRange'
export * from './rangeUtilHelpers/readableRange'
export * from './rangeUtilHelpers/ticks'

// Re-export types
export type { NumericInput } from './rangeUtilHelpers/basicRange'
export type { StringOrNumberOrDate } from './rangeUtilHelpers/readableRange'
export type { TicksArray } from './rangeUtilHelpers/ticks'

import { convertAlphadex, numberToAlphadex } from './alphadex'
import { DimensionalRange, registerDimensionalRange, subscribeToDimensionalRangeConvertedEndLoading, updateDimensionalRange, updateDimensionalRangeParams } from './rangeUtilHelpers/dimensionalRange'
import { accessConversionStore, subscribeToRangeInitialization } from './rangeUtilHelpers/readableRange'

// Re-export test modules from the separate test file
export { testRangeInner, testReadableRange, testRangeUtil } from './rangeUtilTests'
const rangeId = 'dimensionalRange'
export const dimensionalRange: DimensionalRange = {
  zoom: 1,
  unitSize: 0.1,
  unitsPerViewportWidth: 10,
  leftPrefetchFactor: 2,
  rightPrefetchFactor: 2,
}

export const createDomRangeDemo = () => {
  if (typeof document === 'undefined') return


  const initLetterRaw = numberToAlphadex(Math.random() * 20)
  const initLetter = Math.random() < 0.1 ? initLetterRaw : `-${initLetterRaw}`

  let currentScroll: string | null = null

  const getCurrentLetter = () => currentScroll || initLetter

  const incrementUtil = (letter: string) => {
    const n = convertAlphadex(letter)
    return numberToAlphadex(n + dimensionalRange.unitSize)
  }

  const decrementUtil = (letter: string) => {
    const n = convertAlphadex(letter)
    return numberToAlphadex(n - dimensionalRange.unitSize)
  }

  type RangePair = [number, number]

  const ticksInRange = (range: RangePair): string[] => {
    const [start, end] = range
    const ticks: string[] = []
    if (!Number.isFinite(start) || !Number.isFinite(end)) return ticks
    const step = Math.max(dimensionalRange.unitSize, 0.1)
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
    updateDimensionalRange(rangeId, prevLetter)
  })
  const nextBtn = makeButton('next', () => {
    const nextLetter = incrementUtil(getCurrentLetter())
    currentScroll = nextLetter 
    updateDimensionalRange(rangeId, nextLetter)
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
    console.log('zooming in', dimensionalRange.zoom)
    dimensionalRange.zoom = dimensionalRange.zoom + 0.5
    updateDimensionalRangeParams(rangeId, dimensionalRange)
  })
  const zoomOutBtn = makeButton('zoom out', () => {
    console.log('zooming out', dimensionalRange.zoom)
    dimensionalRange.zoom = dimensionalRange.zoom - 0.5
    if (dimensionalRange.zoom <= 0) dimensionalRange.zoom = 0.5
    updateDimensionalRangeParams(rangeId, dimensionalRange)
  })

  // unitSize controls
  const unitSizeLabel = makeLabel('unitSize')
  const unitSizeValue = makeValue()
  const unitSizeUpBtn = makeButton('unitSize up', () => {
    dimensionalRange.unitSize = dimensionalRange.unitSize + 0.05
    updateDimensionalRangeParams(rangeId, dimensionalRange)
  })
  const unitSizeDownBtn = makeButton('unitSize down', () => {
    dimensionalRange.unitSize = dimensionalRange.unitSize - 0.05
    if (dimensionalRange.unitSize <= 0.01) dimensionalRange.unitSize = 0.01
    updateDimensionalRangeParams(rangeId, dimensionalRange)
  })

  // unitsPerViewportWidth controls
  const upvwLabel = makeLabel('unitsPerViewportWidth')
  const upvwValue = makeValue()
  const upvwUpBtn = makeButton('unitsPerViewportWidth up', () => {
    dimensionalRange.unitsPerViewportWidth = dimensionalRange.unitsPerViewportWidth + 1
    updateDimensionalRangeParams(rangeId, dimensionalRange)
  })
  const upvwDownBtn = makeButton('unitsPerViewportWidth down', () => {
    dimensionalRange.unitsPerViewportWidth = dimensionalRange.unitsPerViewportWidth - 1
    if (dimensionalRange.unitsPerViewportWidth <= 1) dimensionalRange.unitsPerViewportWidth = 1
    updateDimensionalRangeParams(rangeId, dimensionalRange)
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
    const rangeStore = accessConversionStore(rangeId)
    letterValue.textContent = `${rangeStore.input}`
    viewableValue.textContent = rangeStore.viewableRange.join(', ')
    nextLeftValue.textContent = rangeStore.nextLeftRange.join(', ')
    nextRightValue.textContent = rangeStore.nextRightRange.join(', ')
    currentTicksValue.textContent = ticksInRange(rangeStore.viewableRange.map(convertAlphadex) as RangePair).join(', ')
    nextLeftTicksValue.textContent = ticksInRange(rangeStore.nextLeftRange.map(convertAlphadex) as RangePair).join(', ')
    nextRightTicksValue.textContent = ticksInRange(rangeStore.nextRightRange.map(convertAlphadex) as RangePair).join(', ')
    zoomValue.textContent = dimensionalRange.zoom.toString()
    unitSizeValue.textContent = dimensionalRange.unitSize.toString()
    upvwValue.textContent = dimensionalRange.unitsPerViewportWidth.toString()
  }

  document.body.appendChild(root)
  subscribeToRangeInitialization(rangeId, render)
  registerDimensionalRange(rangeId, {
    initialInput: initLetter,
    dimensionalRange,
    inputToNumber: convertAlphadex,
    numberToInput: numberToAlphadex,
  })
  subscribeToDimensionalRangeConvertedEndLoading(rangeId, render)
}