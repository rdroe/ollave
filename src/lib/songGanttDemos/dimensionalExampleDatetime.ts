import {
  accessConversionStore,
  DimensionalRange,
  registerDimensionalRange,
  registerTicks,
  subscribeToRangeInitialization,
  subscribeToTicksInitialization,
  subscribeToTicksLoadingComplete,
  ticksStore,
  TicksArray,
  updateDimensionalRange,
  updateDimensionalRangeParams,
} from 'open-range'

import {
  granularityLabel,
  granularityToMs,
  TIME_GRANULARITIES,
  type TimeGranularity,
} from './timeGranularity'

const rangeId = 'dimensionalRangeDatetime'

/** Internal axis is always UTC epoch milliseconds. */
export function datetimeIsoToMs(iso: string): number {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : Date.now()
}

export function msToDatetimeIso(ms: number): string {
  return new Date(ms).toISOString()
}

let currentGranularity: TimeGranularity = 'day'

function makeDimensionalRange(): DimensionalRange {
  return {
    zoom: 1,
    unitSize: granularityToMs(currentGranularity),
    unitsPerViewportWidth: 10,
    leftPrefetchFactor: 2,
    rightPrefetchFactor: 2,
  }
}

let dimensionalRange: DimensionalRange = makeDimensionalRange()

type RangePair = [number, number]

function formatTickLabel(ms: number): string {
  const d = new Date(ms)
  switch (currentGranularity) {
    case 'minute':
    case 'hour':
      return d.toISOString().slice(0, 16).replace('T', ' ')
    case 'day':
      return d.toISOString().slice(0, 10)
    case 'week': {
      const start = new Date(ms)
      return `W ${start.toISOString().slice(0, 10)}`
    }
    case 'month':
      return d.toISOString().slice(0, 7)
    case 'year':
      return d.toISOString().slice(0, 4)
    default:
      return d.toISOString()
  }
}

export const createDimensionalExampleDatetime = () => {
  if (typeof document === 'undefined') return

  const initMs = Date.now()
  const initIso = msToDatetimeIso(initMs)

  let currentScroll: string | null = null
  const getCurrent = () => currentScroll ?? initIso

  const getViewableRangeWidth = (): number => {
    try {
      const rangeStore = accessConversionStore(rangeId)
      const [start, end] = rangeStore.viewableRange.map((v) => datetimeIsoToMs(v as string)) as RangePair
      return Math.abs(end - start)
    } catch {
      const viewportWidth =
        (dimensionalRange.unitSize * dimensionalRange.unitsPerViewportWidth) /
        dimensionalRange.zoom
      return viewportWidth
    }
  }

  const incrementUtil = (iso: string) => {
    const n = datetimeIsoToMs(iso)
    const w = getViewableRangeWidth()
    return msToDatetimeIso(n + w)
  }

  const decrementUtil = (iso: string) => {
    const n = datetimeIsoToMs(iso)
    const w = getViewableRangeWidth()
    return msToDatetimeIso(n - w)
  }

  const ticksInRange = (range: RangePair): TicksArray<number> => {
    const [start, end] = range
    const ticks: TicksArray<number> = []
    if (!Number.isFinite(start) || !Number.isFinite(end)) return ticks
    const step = Math.max(dimensionalRange.unitSize, 1)
    if (step <= 0) return ticks
    if (start <= end) {
      for (let v = start; v <= end + 1e-9; v += step) {
        const rounded = Math.round(v)
        ticks.push({ value: rounded, label: formatTickLabel(rounded) })
      }
    } else {
      for (let v = start; v >= end - 1e-9; v -= step) {
        const rounded = Math.round(v)
        ticks.push({ value: rounded, label: formatTickLabel(rounded) })
      }
    }
    return ticks
  }

  const root = document.createElement('div')
  root.id = 'dimensional-example-datetime'
  root.style.cssText = `
    position: fixed;
    top: 0;
    right: 800px;
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
    box-sizing: border-box;
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
    el.style.wordBreak = 'break-all'
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

  const granLabel = makeLabel('unitSize granularity (axis step)')
  const granSelect = document.createElement('select')
  granSelect.style.marginBottom = '8px'
  granSelect.style.maxWidth = '100%'
  for (const g of TIME_GRANULARITIES) {
    const opt = document.createElement('option')
    opt.value = g
    opt.textContent = granularityLabel(g)
    granSelect.appendChild(opt)
  }
  granSelect.value = currentGranularity
  granSelect.addEventListener('change', () => {
    currentGranularity = granSelect.value as TimeGranularity
    dimensionalRange.unitSize = granularityToMs(currentGranularity)
    updateDimensionalRangeParams(rangeId, dimensionalRange)
  })

  const centerLabel = makeLabel('center (ISO UTC ↔ ms)')
  const centerValue = makeValue()

  const letterButtonsRow = document.createElement('div')
  const prevBtn = makeButton('prev window', () => {
    const prevIso = decrementUtil(getCurrent())
    currentScroll = prevIso
    updateDimensionalRange(rangeId, prevIso)
  })
  const nextBtn = makeButton('next window', () => {
    const nextIso = incrementUtil(getCurrent())
    currentScroll = nextIso
    updateDimensionalRange(rangeId, nextIso)
  })
  letterButtonsRow.appendChild(prevBtn)
  letterButtonsRow.appendChild(nextBtn)

  const viewableLabel = makeLabel('viewableRange (ms)')
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

  const zoomLabel = makeLabel('zoom')
  const zoomValue = makeValue()
  const zoomInBtn = makeButton('zoom in', () => {
    dimensionalRange.zoom = dimensionalRange.zoom + 0.5
    updateDimensionalRangeParams(rangeId, dimensionalRange)
  })
  const zoomOutBtn = makeButton('zoom out', () => {
    dimensionalRange.zoom = dimensionalRange.zoom - 0.5
    if (dimensionalRange.zoom <= 0) dimensionalRange.zoom = 0.5
    updateDimensionalRangeParams(rangeId, dimensionalRange)
  })

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

  root.appendChild(granLabel)
  root.appendChild(granSelect)
  root.appendChild(centerLabel)
  root.appendChild(centerValue)
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

  root.appendChild(upvwLabel)
  root.appendChild(upvwValue)
  root.appendChild(upvwUpBtn)
  root.appendChild(upvwDownBtn)

  const tickmarkContainer = document.createElement('div')
  tickmarkContainer.id = 'tickmark-container-datetime'
  tickmarkContainer.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50px;
    width: 600px;
    height: 120px;
    background-color: #2a2a2a;
    border: 2px solid #555;
    border-radius: 8px;
    padding: 0;
    z-index: 10001;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    box-sizing: border-box;
  `

  const tickmarkRuler = document.createElement('div')
  tickmarkRuler.style.cssText = `
    position: relative;
    width: 100%;
    height: 60px;
    border-top: 2px solid #666;
    margin-top: 10px;
  `

  const tickmarkTitle = document.createElement('div')
  tickmarkTitle.textContent = 'Tickmarks (datetime)'
  tickmarkTitle.style.cssText = `
    color: #d4d4d4;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    font-weight: bold;
    margin-bottom: 5px;
  `

  tickmarkContainer.appendChild(tickmarkTitle)
  tickmarkContainer.appendChild(tickmarkRuler)

  const renderTickmarks = () => {
    const rangeStore = accessConversionStore(rangeId)
    const ticks = ticksStore[rangeId]?.ticks?.viewableRange
    if (!ticks || ticks.length < 1) return
    const rangeWidth = ticks[ticks.length - 1].value - ticks[0].value
    const rangeStart = ticks[0].value

    tickmarkRuler.innerHTML = ''

    if (!Number.isFinite(rangeWidth) || rangeWidth === 0) {
      return
    }

    ticks.forEach(({ value: tick, label: tickStr }) => {
      if (!Number.isFinite(tick)) return
      const position = ((tick - rangeStart) / rangeWidth) * 100

      const tickLine = document.createElement('div')
      tickLine.style.cssText = `
        position: absolute;
        left: ${position}%;
        top: 0;
        width: 1px;
        height: 20px;
        background-color: #888;
        transform: translateX(-50%);
      `

      const tickLabel = document.createElement('div')
      tickLabel.textContent = tickStr
      tickLabel.style.cssText = `
        position: absolute;
        left: ${position}%;
        top: 22px;
        transform: translateX(-50%);
        color: #aaa;
        font-family: 'Courier New', monospace;
        font-size: 9px;
        white-space: nowrap;
      `

      tickmarkRuler.appendChild(tickLine)
      tickmarkRuler.appendChild(tickLabel)
    })

    const centerMs = datetimeIsoToMs(rangeStore.input as string)
    const centerPosition = ((centerMs - rangeStart) / rangeWidth) * 100
    const centerIndicator = document.createElement('div')
    centerIndicator.style.cssText = `
      position: absolute;
      left: ${centerPosition}%;
      top: 0;
      width: 2px;
      height: 30px;
      background-color: #6bcf7f;
      transform: translateX(-50%);
      z-index: 10;
    `
    tickmarkRuler.appendChild(centerIndicator)
  }

  const render = () => {
    const rangeStore = accessConversionStore(rangeId)
    const ms = datetimeIsoToMs(rangeStore.input as string)
    centerValue.textContent = `${rangeStore.input}  |  ${ms} ms`
    viewableValue.textContent = rangeStore.viewableRange.join(', ')
    nextLeftValue.textContent = rangeStore.nextLeftRange.join(', ')
    nextRightValue.textContent = rangeStore.nextRightRange.join(', ')
    currentTicksValue.textContent = ticksInRange(
      rangeStore.viewableRange.map((v) => datetimeIsoToMs(v as string)) as RangePair
    )
      .map((t) => `${t.label}`)
      .join(', ')
    nextLeftTicksValue.textContent = ticksInRange(
      rangeStore.nextLeftRange.map((v) => datetimeIsoToMs(v as string)) as RangePair
    )
      .map((t) => `${t.label}`)
      .join(', ')
    nextRightTicksValue.textContent = ticksInRange(
      rangeStore.nextRightRange.map((v) => datetimeIsoToMs(v as string)) as RangePair
    )
      .map((t) => `${t.label}`)
      .join(', ')
    zoomValue.textContent = dimensionalRange.zoom.toString()
    upvwValue.textContent = dimensionalRange.unitsPerViewportWidth.toString()

    renderTickmarks()
  }

  document.body.appendChild(root)
  document.body.appendChild(tickmarkContainer)

  subscribeToRangeInitialization(rangeId, () => {
    registerTicks(rangeId, async ([start, end]: [number, number]) => {
      return ticksInRange([start, end])
    }, true)
    subscribeToTicksInitialization(rangeId, () => {
      render()
    })
    subscribeToTicksLoadingComplete(rangeId, () => {
      render()
    })
    render()
  })

  registerDimensionalRange(rangeId, {
    initialInput: initIso,
    dimensionalRange,
    inputToNumber: datetimeIsoToMs,
    numberToInput: msToDatetimeIso,
  })
}
