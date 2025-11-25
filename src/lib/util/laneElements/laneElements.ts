import {
    createLaneElementsStore,
    LaneElementPostCalculation,
  } from './createLaneElementsStore'
  import { convertAlphadex, numberToAlphadex } from '../alphadex'
  
  // returns a randomly generated LaneElementPreCalculation[] for prepoulating the store
  // suited to xInputValue, this will be e.g. a.0, b.20, gg.25, etc.
  const generateInitialXInputs = (lengthOfOutput: number = 15) => {
    // first, get a random array of numbers that are multiples of 5
    const randomNumbers = Array.from(
      { length: lengthOfOutput },
      () => Math.floor(Math.random() * 100) * 5
    )
    // then, convert each number to a string that is a multiple of 5
    const randomNumbersStrings = randomNumbers.map((number) =>
      numberToAlphadex(number)
    )
    // then, return the array of strings
    return randomNumbersStrings
  }
  
  const generateInitialHeight = (lengthOfOutput: number = 15) => {
    // return a random array of numbers that are multiples of 5 between 20 and 150
    const randomNumbers = Array.from(
      { length: lengthOfOutput },
      () => Math.floor(Math.random() * 130) * 5 + 20
    )
    // then, return the array of numbers
    return randomNumbers
  }
  
  const generateInitialWidth = (lengthOfOutput: number = 15) => {
    // return a random array of numbers that are multiples of 5 between 20 and 150
    const randomNumbers = Array.from(
      { length: lengthOfOutput },
      () => Math.floor(Math.random() * 130) * 5 + 20
    )
    // then, return the array of numbers
    return randomNumbers
  }
  
  const initialTestInputs = generateInitialXInputs()
  const initialTestHeights = generateInitialHeight()
  const initialTestWidths = generateInitialWidth()
  let laneIdItr = 0
  const whichTimeline = () => {
    laneIdItr++
    if (laneIdItr < 2) {
      return 'timeline-1'
    } else if (laneIdItr < 5) {
      return 'timeline-2'
    } else {
      return 'timeline-3'
    }
  }
  const laneElementsTest = createLaneElementsStore(
    [
      ...initialTestInputs.map((xInput, index) => ({
        laneId: whichTimeline(),
        elementId: `elem-${index + 1}`,
        xInput,
        x: null,
        y: null,
        width: initialTestWidths[index],
        height: initialTestHeights[index],
      })),
    ],
    {
      inputToNumber: convertAlphadex,
      numberToInput: numberToAlphadex,
    }
  )
  
  const cacheLaneElementYCoords = <InputType extends string | number | Date>(
    laneId: string,
    store: ReturnType<typeof createLaneElementsStore<InputType>>,
    range: [startX: number, endX: number]
  ): LaneElementPostCalculation<InputType>[] => {
    const laneElementItems = store.getState().laneElements.filter((item) => {
      const elementStart = store.getState()?.getX?.(item.xInput)
      const elementEnd = item.x + item.width
      const rangeStart = range[0]
      const rangeEnd = range[1]
  
      // Element overlaps with range if it starts before range ends AND ends after range starts
      return elementStart < rangeEnd && elementEnd > rangeStart
    })
  
    // Filter elements for the specific lane
    const filteredLaneElements = laneElementItems.filter(
      (item) => item.laneId === laneId
    )
  
    // Sort the lane elements by x coordinate (start time)
    const sortedElements = [...filteredLaneElements].sort((a, b) => a.x - b.x)
  
    // Calculate Y coordinates for each element
    const elementsWithYCoords: LaneElementPostCalculation<InputType>[] = []
  
    for (let i = 0; i < sortedElements.length; i++) {
      const currentElement = sortedElements[i]
  
      // Find the lowest available Y coordinate (lane) where this element can fit
      let yCoord = 0
      let foundValidLane = false
  
      while (!foundValidLane) {
        // Check if this Y coordinate conflicts with any previous element
        let hasConflict = false
  
        for (let j = 0; j < i; j++) {
          const previousElement = elementsWithYCoords[j]
  
          // Check if elements overlap in time
          const currentStart = currentElement.x
          const currentEnd = currentElement.x + currentElement.width
          const previousStart = previousElement.x
          const previousEnd = previousElement.x + previousElement.width
  
          // Elements overlap if one starts before the other ends
          const overlapsInTime =
            currentStart < previousEnd && previousStart < currentEnd
  
          // Check if elements overlap in space (same Y coordinate or overlapping vertically)
          const currentYTop = yCoord
          const currentYBottom = yCoord + currentElement.height
          const previousYTop = previousElement.y
          const previousYBottom = previousElement.y + previousElement.height
  
          // Elements overlap vertically if one's top is above the other's bottom
          const overlapsInSpace =
            currentYTop < previousYBottom && currentYBottom > previousYTop
  
          if (overlapsInTime && overlapsInSpace) {
            hasConflict = true
            break
          }
        }
  
        if (!hasConflict) {
          foundValidLane = true
        } else {
          // Move to the next lane by finding the bottom of the conflicting element
          // Find the highest bottom edge of all conflicting elements at this y level
          let maxBottom = yCoord
          for (let j = 0; j < i; j++) {
            const previousElement = elementsWithYCoords[j]
            const currentStart = currentElement.x
            const currentEnd = currentElement.x + currentElement.width
            const previousStart = previousElement.x
            const previousEnd = previousElement.x + previousElement.width
            const overlapsInTime =
              currentStart < previousEnd && previousStart < currentEnd
  
            if (overlapsInTime) {
              const previousBottom = previousElement.y + previousElement.height
              if (previousBottom > maxBottom) {
                maxBottom = previousBottom
              }
            }
          }
          yCoord = maxBottom
        }
      }
  
      elementsWithYCoords.push({
        ...currentElement,
        y: yCoord,
      })
    }
  
    return elementsWithYCoords
  }
  
  const getLaneElementXCoordsFn = <InputType extends string | number | Date>(
    laneId: string,
    store: ReturnType<typeof createLaneElementsStore<InputType>>,
    range: [startX: number, endX: number] = [-Infinity, Infinity]
  ) => {
    // all the y coords need to be calculated to get any singly y coord. this is because the y coord depends on the number of overlapping elements above it and beginning before it
    const allElementsCached = cacheLaneElementYCoords(laneId, store, range)
    return (elementId: string): number => {
      // having cached the y coords, we can now return the x coord
      const element = allElementsCached.find(
        (elem) => elem.elementId === elementId
      )
      return element ? element.x : -1
    }
  }
  
  // Export functions for testing
  export { cacheLaneElementYCoords, getLaneElementXCoordsFn, laneElementsTest }
  