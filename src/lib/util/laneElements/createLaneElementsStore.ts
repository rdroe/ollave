import { createStore } from 'zustand'

export type LaneElementPreCalculation<
  InputType extends string | number | Date,
> = {
  laneId: string
  elementId: string
  xInput: InputType
  x: null
  y: null // null is pre-calculation. the y coord depends on the number of overlapping elements above it and begin before it
  width: number
  height: number
}

export type LaneElementWithX<InputType extends string | number | Date> = {
  laneId: string
  elementId: string
  xInput: InputType
  x: number
  y: null // null is pre-calculation. the y coord depends on the number of overlapping elements above it and begin before it
  width: number
  height: number
}

export type LaneElementPostCalculation<
  InputType extends string | number | Date,
> = {
  laneId: string
  elementId: string
  xInput: InputType
  x: number
  y: number
  width: number
  height: number
}

export const createLaneElementsStore = <
  InputType extends string | number | Date,
>(
  initialLaneElements: LaneElementPreCalculation<InputType>[],
  {
    inputToNumber,
    numberToInput,
  }: {
    inputToNumber: (input: InputType) => number
    numberToInput: (number: number) => InputType
  }
) => {
  return createStore<{
    laneElementsPreCalculation: LaneElementPreCalculation<InputType>[]
    laneElements: LaneElementWithX<InputType>[]
    getX: (userX: InputType) => number
    getInputFromX: (x: number) => InputType
  }>(() => ({
    laneElementsPreCalculation: initialLaneElements,
    laneElements: initialLaneElements.map((item) => ({
      ...item,
      x: inputToNumber(item.xInput),
      y: null,
    })),
    getX: (userX: InputType) => {
      return inputToNumber(userX)
    },
    getInputFromX: (x: number) => {
      return numberToInput(x)
    },
    updateLaneElements: (laneElements: LaneElementWithX<InputType>[]) => {
      return {
        laneElements: laneElements,
        laneElementsPreCalculation: laneElements.map((item) => ({
          ...item,
          x: numberToInput(item.x),
          y: null,
        })),
      }
    },
  }))
}
