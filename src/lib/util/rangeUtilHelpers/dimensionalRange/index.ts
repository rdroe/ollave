// 

import { conversionStore, registerReadableRange, subscribeToRangeConvertedEndLoading, unregisterReadableRange, updateRange } from "../readableRange"

export  type DimensionalRange = {
    zoom: number
    unitSize: number
    leftPrefetchFactor: number
    rightPrefetchFactor: number
    unitsPerViewportWidth: number
}



//wraps registerReadableRange, redefining the functions and re-registering as appropriate. 
const getDimensionalRangeFunctions = (dimensionalRange: DimensionalRange) => {
   const { zoom, unitSize, leftPrefetchFactor, rightPrefetchFactor, unitsPerViewportWidth } = dimensionalRange
    const getViewableRange = (input: number): Promise<[start: number, end: number]> => {
        const start = input - unitSize * unitsPerViewportWidth * zoom
        const end = input + unitSize * unitsPerViewportWidth * zoom
        return Promise.resolve([start, end])
    }
    const getNextLeftRange = (input: number): Promise<[start: number, end: number]> => {
        const start = input - unitSize * unitsPerViewportWidth * zoom * leftPrefetchFactor
        const end = input - unitSize * unitsPerViewportWidth * zoom
        return Promise.resolve([start, end])
    }
    const getNextRightRange = (input: number): Promise<[start: number, end: number]> => {
        const start = input + unitSize * unitsPerViewportWidth * zoom
        const end = input + unitSize * unitsPerViewportWidth * zoom * rightPrefetchFactor
        return Promise.resolve([start, end])
    }
    return {
        getViewableRange,
        getNextLeftRange,
        getNextRightRange,
    }
}

type DimensionalRegistration<InputType extends string | number | Date> = {
    initialInput: InputType
    dimensionalRange: DimensionalRange
    inputToNumber: (input: InputType) => number
    numberToInput: (number: number) => InputType,
}

export const registerDimensionalRange = <InputType extends string | number | Date>(rangeId: string, params: DimensionalRegistration<InputType>) => {
    if (conversionStore[rangeId]) {
        throw new Error('Readable range underlying dimensional range already registered')
    }
    const {  initialInput, dimensionalRange, inputToNumber, numberToInput } = params
    const fns = getDimensionalRangeFunctions(dimensionalRange)
    registerReadableRange<InputType>(rangeId, initialInput, {
        getViewableRange: fns.getViewableRange,
        getNextLeftRange: fns.getNextLeftRange,
        getNextRightRange: fns.getNextRightRange,
        inputToNumber,
        numberToInput,
    }, false) 

}
export const unregisterDimensionalRange = <InputType extends string | number | Date>(rangeId: string) => {
    if (!conversionStore[rangeId]) {
        throw new Error('Dimensional range not found')
    }
    unregisterReadableRange(rangeId)   
}

export const updateDimensionalRange = updateRange

export const updateDimensionalRangeParams = <InputType extends string | number | Date>(rangeId: string, dimensionalRange: DimensionalRange) => {
    if (!conversionStore[rangeId]) {
        throw new Error('Dimensional range not found')
    }

    const fns = getDimensionalRangeFunctions(dimensionalRange)
    registerReadableRange(rangeId, null, {
        getViewableRange: fns.getViewableRange,
        getNextLeftRange: fns.getNextLeftRange,
        getNextRightRange: fns.getNextRightRange,
        inputToNumber: conversionStore[rangeId].fns.inputToNumber,
        numberToInput: conversionStore[rangeId].fns.numberToInput,
    }, true)
}

export const subscribeToDimensionalRangeConvertedEndLoading = (rangeId: string, callback: () => void) => {
    return subscribeToRangeConvertedEndLoading(rangeId, callback)
}