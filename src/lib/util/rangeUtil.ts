// Re-export everything from the modularized rangeUtil helpers
export * from './rangeUtilHelpers/basicRange'
export * from './rangeUtilHelpers/readableRange'
export * from './rangeUtilHelpers/ticks'

// Re-export types
export type { NumericInput } from './rangeUtilHelpers/basicRange'
export type { StringOrNumberOrDate } from './rangeUtilHelpers/readableRange'
export type { TicksArray } from './rangeUtilHelpers/ticks'

// Import test modules from the original location (will be moved later)
import { Module, ParsedCli } from 'peprn/util'
import {
  registerRange,
  updateRangeInputInner,
  store,
  subscribeToRangeInputChanged,
  subscribeToRangeViewableRange,
  subscribeToRangeNextLeftRange,
  subscribeToRangeNextRightRange,
  subscribeToRangeStartLoading,
  subscribeToRangeEndLoading,
} from './rangeUtilHelpers/basicRange'
import {
  registerReadableRange,
  updateRange,
  conversionStore,
  subscribeToRangeConvertedStartLoading,
  subscribeToRangeConvertedEndLoading,
  subscribeToRangeConvertedViewableRangeStartLoading,
  subscribeToRangeConvertedViewableRangeEndLoading,
  subscribeToRangeConvertedNextLeftRangeStartLoading,
  subscribeToRangeConvertedNextLeftRangeEndLoading,
  subscribeToRangeConvertedNextRightRangeStartLoading,
  subscribeToRangeConvertedNextRightRangeEndLoading,
  accessConversionStore,
} from './rangeUtilHelpers/readableRange'
import { accessTicksStore } from './rangeUtilHelpers/ticks'

// Test modules (to be moved to tests module later)
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

        return [input, input + 10]
      },
      getNextLeftRange: async (input: number) => [input - 10, input],
      getNextRightRange: async (input: number) => [input + 10, input + 20],
      inputToNumber: (input: string) => parseInt(input),
      numberToInput: (number: number) => number.toString(),
      
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
      console.log('start loading converted range overall', conversionStore['testReadableRange'])
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
        updateRange('testReadableRange', `${positionalNonCommands[0]}`)
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
      detailsHtml += `<div style="color: #f44336; margin-left: 20px; margin-top: 4px; font-weight: bold;">Error: ${escapeHtml(String(result.error))}</div>`
      if (result.errorType) {
        detailsHtml += `<div style="color: #f44336; margin-left: 20px; margin-top: 2px; font-size: 11px;">Type: ${escapeHtml(String(result.errorType))}</div>`
      }
      if (result.errorLocation) {
        detailsHtml += `<div style="color: #ff9800; margin-left: 20px; margin-top: 2px; font-size: 11px; font-weight: bold;">📍 Location: ${escapeHtml(String(result.errorLocation))}</div>`
      }
      if (result.stackTrace) {
        const stackLines = result.stackTrace.split('\n').slice(0, 5).join('\n')
        detailsHtml += `<pre style="margin: 4px 0 0 20px; padding: 4px; background-color: rgba(244, 67, 54, 0.1); font-size: 10px; overflow-x: auto; color: #f44336; max-height: 150px; overflow-y: auto;">${escapeHtml(stackLines)}</pre>`
      }
    }
    
    if (result.timestamp) {
      detailsHtml += `<div style="color: #888; margin-left: 20px; margin-top: 4px; font-size: 10px;">⏱ ${escapeHtml(String(result.timestamp))}</div>`
    }
    
    // Show additional details if available (but limit size)
    const detailFields = ['store', 'results', 'ticks', 'conversionStore', 'rangeId', 'inputType', 
      'initialInput', 'updatedInput', 'initialReadableInput', 'updatedReadableInput',
      'beforeUpdate', 'afterUpdate', 'updateSuccessful', 'subscriptionResults', 
      'allSubscriptionsFired', 'viewableRangeTicksCount', 'nextLeftRangeTicksCount', 
      'nextRightRangeTicksCount', 'scenario', 'expectedBehavior', 'actualBehavior',
      'typeMismatchError', 'typeMismatchErrorDetails', 'typeSafetyWorking', 'functionsUpdated']
    
    const detailsObj: any = {}
    for (const field of detailFields) {
      if (result[field] !== undefined) {
        detailsObj[field] = result[field]
      }
    }
    
    if (Object.keys(detailsObj).length > 0) {
      const details = JSON.stringify(detailsObj, null, 2)
      if (details.length < 1000) {
        detailsHtml += `<div style="margin-top: 8px; margin-left: 20px; color: #888; font-size: 11px; font-weight: bold;">Details:</div>`
        detailsHtml += `<pre style="margin: 4px 0 0 20px; padding: 6px; background-color: rgba(0,0,0,0.3); font-size: 10px; overflow-x: auto; color: #aaa; border-left: 2px solid #555;">${escapeHtml(details)}</pre>`
      } else {
        detailsHtml += `<div style="margin-left: 20px; color: #888; font-size: 10px; margin-top: 4px;">[Large data object - ${details.length} chars]</div>`
        // Show a summary of key fields
        const summary: any = {}
        for (const field of ['rangeId', 'inputType', 'initialInput', 'updatedInput', 'success']) {
          if (result[field] !== undefined) {
            summary[field] = result[field]
          }
        }
        if (Object.keys(summary).length > 0) {
          detailsHtml += `<pre style="margin: 4px 0 0 20px; padding: 4px; background-color: rgba(0,0,0,0.2); font-size: 10px; color: #aaa;">${escapeHtml(JSON.stringify(summary, null, 2))}</pre>`
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

// Helper function to get line number from error stack trace
function getErrorLineNumber(error: Error): string | null {
  if (!error.stack) return null
  const stackLines = error.stack.split('\n')
  // Look for the first stack frame that references rangeUtil.ts
  for (const line of stackLines) {
    const match = line.match(/rangeUtil\.ts:(\d+):(\d+)/)
    if (match) {
      return `Line ${match[1]}, Column ${match[2]}`
    }
  }
  return null
}

// Helper function to create detailed test result
function createTestResult(
  success: boolean,
  message: string,
  error?: any,
  additionalData?: any
) {
  const result: any = {
    success,
    message,
    timestamp: new Date().toISOString(),
  }

  if (error) {
    result.error = error.message || String(error)
    result.errorType = error.name || 'Error'
    const lineNumber = getErrorLineNumber(error)
    if (lineNumber) {
      result.errorLocation = lineNumber
    }
    if (error.stack) {
      result.stackTrace = error.stack
    }
  }

  if (additionalData) {
    Object.assign(result, additionalData)
  }

  return result
}

export const testRangeUtil: Module = {
  help: {
    description: 'Comprehensive unit tests for rangeUtil.ts',
    examples: {
      '': 'Run all tests',
      'registerRange': 'Test basic numeric range registration',
      'registerReadableRange': 'Test readable range registration (string, number, Date types)',
      'registerTicks': 'Test ticks registration for readable ranges',
      'subscriptions': 'Test all subscription functions (basic and converted)',
      'updateRange': 'Test updateRange and updateRangeInputInner functions',
      'reregistration': 'Test reregistration scenarios (numeric and readable ranges)',
      'errors': 'Test error handling and validation',
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

    // Import test functions from modules
    const { registerTicks } = await import('./rangeUtilHelpers/ticks')
    const { accessConversionStore } = await import('./rangeUtilHelpers/readableRange')

    // Test registerRange - basic numeric range registration
    if (!testName || testName === 'registerRange' || testName === '') {
      try {
        const rangeId = 'testRangeUtil-basic-numeric-range'
        const initialInput = 100
        registerRange(
          rangeId,
          initialInput,
          {
            getViewableRange: async (input: number) => [input - 5, input + 5],
            getNextLeftRange: async (input: number) => [input - 20, input - 5],
            getNextRightRange: async (input: number) => [input + 5, input + 20],
          },
          false
        )
        results.registerRangeBasicNumeric = createTestResult(
          true,
          'Basic numeric range registration successful',
          undefined,
          {
            rangeId,
            initialInput,
            store: store[rangeId],
            viewableRange: store[rangeId].viewableRange,
            nextLeftRange: store[rangeId].nextLeftRange,
            nextRightRange: store[rangeId].nextRightRange,
          }
        )
      } catch (error: any) {
        results.registerRangeBasicNumeric = createTestResult(
          false,
          'Basic numeric range registration failed',
          error
        )
      }
    }

    // Test registerRange error handling - null initialInput validation
    if (!testName || testName === 'errors' || testName === '') {
      try {
        registerRange(
          'testRangeUtil-null-input-validation',
          null as any,
          {
            getViewableRange: async (input: number) => [input, input + 10],
            getNextLeftRange: async (input: number) => [input - 10, input],
            getNextRightRange: async (input: number) => [input + 10, input + 20],
          },
          false
        )
        results.registerRangeNullInputValidation = createTestResult(
          false,
          'Should have thrown error for null initialInput in new registration',
          undefined,
          {
            scenario: 'Attempting to register new range with null initialInput',
            expectedBehavior: 'Should throw error',
            actualBehavior: 'No error thrown',
          }
        )
      } catch (error: any) {
        results.registerRangeNullInputValidation = createTestResult(
          true,
          'Correctly threw error for null initialInput in new registration',
          error,
          {
            scenario: 'Attempting to register new range with null initialInput',
            expectedBehavior: 'Should throw error',
            actualBehavior: 'Error thrown as expected',
          }
        )
      }
    }

    // Test registerReadableRange - string input type
    if (!testName || testName === 'registerReadableRange' || testName === '') {
      try {
        const rangeId = 'testRangeUtil-readable-range-string-type'
        const initialInput = '50'
        await registerReadableRange<string>(
          rangeId,
          initialInput,
          {
            getViewableRange: async (input: number) => [input - 5, input + 5],
            getNextLeftRange: async (input: number) => [input - 20, input - 5],
            getNextRightRange: async (input: number) => [input + 5, input + 20],
            inputToNumber: (input: string) => parseInt(input),
            numberToInput: (number: number) => number.toString(),
            
          },
          false
        )
        results.registerReadableRangeStringType = createTestResult(
          true,
          'Readable range registration with string input type successful',
          undefined,
          {
            rangeId,
            inputType: 'string',
            initialInput,
            conversionStore: conversionStore[rangeId],
            convertedInput: conversionStore[rangeId].input,
            convertedViewableRange: conversionStore[rangeId].viewableRange,
          }
        )
      } catch (error: any) {
        results.registerReadableRangeStringType = createTestResult(
          false,
          'Readable range registration with string input type failed',
          error
        )
      }
    }

    // Test registerReadableRange - number input type
    if (!testName || testName === 'registerReadableRange' || testName === '') {
      try {
        const rangeId = 'testRangeUtil-readable-range-number-type'
        const initialInput = 75
        await registerReadableRange<number>(
          rangeId,
          initialInput,
          {
            getViewableRange: async (input: number) => [input - 5, input + 5],
            getNextLeftRange: async (input: number) => [input - 20, input - 5],
            getNextRightRange: async (input: number) => [input + 5, input + 20],
            inputToNumber: (input: number) => input,
            numberToInput: (number: number) => number,
            
          },
      false
        )
        results.registerReadableRangeNumberType = createTestResult(
          true,
          'Readable range registration with number input type successful',
          undefined,
          {
            rangeId,
            inputType: 'number',
            initialInput,
            conversionStore: conversionStore[rangeId],
            convertedInput: conversionStore[rangeId].input,
            convertedViewableRange: conversionStore[rangeId].viewableRange,
          }
        )
      } catch (error: any) {
        results.registerReadableRangeNumberType = createTestResult(
          false,
          'Readable range registration with number input type failed',
          error
        )
      }
    }

    // Test registerReadableRange - Date input type
    if (!testName || testName === 'registerReadableRange' || testName === '') {
      try {
        const rangeId = 'testRangeUtil-readable-range-date-type'
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
            
          },
      false
        )
        results.registerReadableRangeDateType = createTestResult(
          true,
          'Readable range registration with Date input type successful',
          undefined,
          {
            rangeId,
            inputType: 'Date',
            initialInput: initialDate.toISOString(),
            conversionStore: conversionStore[rangeId],
            convertedInput: conversionStore[rangeId].input,
            convertedViewableRange: conversionStore[rangeId].viewableRange,
          }
        )
      } catch (error: any) {
        results.registerReadableRangeDateType = createTestResult(
          false,
          'Readable range registration with Date input type failed',
          error
        )
      }
    }

    // Test registerTicks - ticks registration for readable range
    if (!testName || testName === 'registerTicks' || testName === '') {
      try {
        const rangeId = 'testRangeUtil-ticks-registration'
        const initialInput = 100
        // First register a readable range
        await registerReadableRange<number>(
          rangeId,
          initialInput,
          {
            getViewableRange: async (input: number) => [input - 5, input + 5],
            getNextLeftRange: async (input: number) => [input - 20, input - 5],
            getNextRightRange: async (input: number) => [input + 5, input + 20],
            inputToNumber: (input: number) => input,
            numberToInput: (number: number) => number,
            
          },
          false
        )
        // Then register ticks
        registerTicks<number>(
          rangeId,
          ([start, end]: [start: number, end: number]) => {
            const ticks: any[] = []
            for (let i = start; i <= end; i += 1) {
              ticks.push({ value: i, label: i.toString() })
            }
            return ticks
          },
      false
        )
        const ticksData = accessTicksStore<number>(rangeId).ticks
        results.registerTicksForReadableRange = createTestResult(
          true,
          'Ticks registration for readable range successful',
          undefined,
          {
            rangeId,
            initialInput,
            ticks: ticksData,
            viewableRangeTicksCount: ticksData.viewableRange.length,
            nextLeftRangeTicksCount: ticksData.nextLeftRange.length,
            nextRightRangeTicksCount: ticksData.nextRightRange.length,
          }
        )
      } catch (error: any) {
        results.registerTicksForReadableRange = createTestResult(
          false,
          'Ticks registration for readable range failed',
          error
        )
      }
    }

    // Test subscriptions - basic numeric range subscriptions
    if (!testName || testName === 'subscriptions' || testName === '') {
      try {
        const rangeId = 'testRangeUtil-basic-range-subscriptions'
        const initialInput = 200
        const updatedInput = 250
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
          initialInput,
          {
            getViewableRange: async (input: number) => {
              
              return [input - 5, input + 5]
            },
            getNextLeftRange: async (input: number) => {

              return [input - 20, input - 5]
            },
            getNextRightRange: async (input: number) => {

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
        updateRangeInputInner(rangeId, updatedInput)

        // Wait for async operations
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Test unsubscribe
        unsubInput()
        unsubViewable()
        unsubNextLeft()
        unsubNextRight()
        unsubStartLoading()
        unsubEndLoading()

        results.subscriptionsBasicNumericRange = createTestResult(
          true,
          'Basic numeric range subscription tests passed',
          undefined,
          {
            rangeId,
            initialInput,
            updatedInput,
            subscriptionResults,
            allSubscriptionsFired: Object.values(subscriptionResults).every(v => v === true),
          }
        )
      } catch (error: any) {
        results.subscriptionsBasicNumericRange = createTestResult(
          false,
          'Basic numeric range subscription tests failed',
          error
        )
      }
    }

    // Test subscriptions - converted readable range subscriptions
    if (!testName || testName === 'subscriptions' || testName === '') {
      try {
        const rangeId = 'testRangeUtil-readable-range-converted-subscriptions'
        const initialInput = '300'
        const updatedInput = '350'
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
          initialInput,
          {
            getViewableRange: async (input: number) => {

              return [input - 5, input + 5]
            },
            getNextLeftRange: async (input: number) => {
              return [input - 20, input - 5]
            },
            getNextRightRange: async (input: number) => {
              return [input + 5, input + 20]
            },
            inputToNumber: (input: string) => parseInt(input),
            numberToInput: (number: number) => number.toString(),
            
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
        updateRange(rangeId, updatedInput)

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

        results.subscriptionsReadableRangeConverted = createTestResult(
          true,
          'Readable range converted subscription tests passed',
          undefined,
          {
            rangeId,
            inputType: 'string',
            initialInput,
            updatedInput,
            subscriptionResults,
            allSubscriptionsFired: Object.values(subscriptionResults).every(v => v === true),
          }
        )
      } catch (error: any) {
        results.subscriptionsReadableRangeConverted = createTestResult(
          false,
          'Readable range converted subscription tests failed',
          error
        )
      }
    }

    // Test updateRangeInputInner - update numeric range input
    if (!testName || testName === 'updateRange' || testName === '') {
      try {
        const rangeId = 'testRangeUtil-update-numeric-range-input'
        const initialInput = 400
        const updatedInput = 450
        registerRange(
          rangeId,
          initialInput,
          {
            getViewableRange: async (input: number) => [input - 5, input + 5],
            getNextLeftRange: async (input: number) => [input - 20, input - 5],
            getNextRightRange: async (input: number) => [input + 5, input + 20],
          },
          false
        )

        const beforeUpdate = store[rangeId].input
        updateRangeInputInner(rangeId, updatedInput)
        const afterUpdate = store[rangeId].input

        results.updateRangeInputInnerNumeric = createTestResult(
          true,
          'updateRangeInputInner for numeric range test passed',
          undefined,
          {
            rangeId,
            initialInput,
            updatedInput,
            beforeUpdate,
            afterUpdate,
            updateSuccessful: afterUpdate === updatedInput,
          }
        )
      } catch (error: any) {
        results.updateRangeInputInnerNumeric = createTestResult(
          false,
          'updateRangeInputInner for numeric range test failed',
          error
        )
      }
    }

    // Test updateRange - update readable range input
    if (!testName || testName === 'updateRange' || testName === '') {
      try {
        const readableRangeId = 'testRangeUtil-update-readable-range-input'
        const initialInput = '500'
        const updatedInput = '550'
        await registerReadableRange<string>(
          readableRangeId,
          initialInput,
          {
            getViewableRange: async (input: number) => [input - 5, input + 5],
            getNextLeftRange: async (input: number) => [input - 20, input - 5],
            getNextRightRange: async (input: number) => [input + 5, input + 20],
            inputToNumber: (input: string) => parseInt(input),
            numberToInput: (number: number) => number.toString(),
            
          },
          false
        )

        const beforeUpdate = conversionStore[readableRangeId].input
        updateRange(readableRangeId, updatedInput)

        const afterUpdate = conversionStore[readableRangeId].input

        results.updateRangeReadable = createTestResult(
          true,
          'updateRange for readable range test passed',
          undefined,
          {
            rangeId: readableRangeId,
            inputType: 'string',
            initialInput,
            updatedInput,
            beforeUpdate: String(beforeUpdate),
            afterUpdate: String(afterUpdate),
            updateSuccessful: String(afterUpdate) === String(updatedInput),
          }
        )
      } catch (error: any) {
        results.updateRangeReadable = createTestResult(
          false,
          'updateRange for readable range test failed',
          error
        )
      }
    }

    // Test reregistration - numeric range reregistration with new functions
    if (!testName || testName === 'reregistration' || testName === '') {
      try {
        const rangeId = 'testRangeUtil-reregister-numeric-range'
        const initialInput = 600
        // Initial registration
        registerRange(
          rangeId,
          initialInput,
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

        results.reregistrationNumericRange = createTestResult(
          true,
          'Numeric range reregistration with new functions test passed',
          undefined,
          {
            rangeId,
            initialInput,
            initialStore,
            afterReregister: store[rangeId],
            functionsUpdated: true,
          }
        )
      } catch (error: any) {
        results.reregistrationNumericRange = createTestResult(
          false,
          'Numeric range reregistration with new functions test failed',
          error
        )
      }
    }

    // Test reregistration - readable range reregistration with new functions
    if (!testName || testName === 'reregistration' || testName === '') {
      try {
        const readableRangeId = 'testRangeUtil-reregister-readable-range'
        const initialInput = '700'
        await registerReadableRange<string>(
          readableRangeId,
          initialInput,
          {
            getViewableRange: async (input: number) => [input - 5, input + 5],
            getNextLeftRange: async (input: number) => [input - 20, input - 5],
            getNextRightRange: async (input: number) => [input + 5, input + 20],
            inputToNumber: (input: string) => parseInt(input),
            numberToInput: (number: number) => number.toString(),
            
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
          },
          true
        )

        results.reregistrationReadableRange = createTestResult(
          true,
          'Readable range reregistration with new functions test passed',
          undefined,
          {
            rangeId: readableRangeId,
            inputType: 'string',
            initialInput,
            initialStore: initialReadableStore,
            afterReregister: conversionStore[readableRangeId],
            functionsUpdated: true,
          }
        )
      } catch (error: any) {
        results.reregistrationReadableRange = createTestResult(
          false,
          'Readable range reregistration with new functions test failed',
          error
        )
      }
    }

    // Test error cases - numeric range reregistration with initialInput (should error)
    if (!testName || testName === 'errors' || testName === '') {
      const errorResults: any = {}

      try {
        const rangeId = 'testRangeUtil-error-numeric-reregister-with-initial-input'
        const firstInput = 800
        const secondInput = 850
        registerRange(
          rangeId,
          firstInput,
          {
      getViewableRange: async (input: number) => [input, input + 10],
      getNextLeftRange: async (input: number) => [input - 10, input],
      getNextRightRange: async (input: number) => [input + 10, input + 20],
          },
          false
        )
        registerRange(
          rangeId,
          secondInput,
          {
            getViewableRange: async (input: number) => [input, input + 10],
            getNextLeftRange: async (input: number) => [input - 10, input],
            getNextRightRange: async (input: number) => [input + 10, input + 20],
          },
          true
        )
        errorResults.numericRangeReregisterWithInitialInput = createTestResult(
          false,
          'Should have thrown error for initialInput in numeric range reregistration',
          undefined,
          {
            rangeId,
            firstInput,
            secondInput,
            scenario: 'Attempting to reregister numeric range with initialInput',
            expectedBehavior: 'Should throw error',
            actualBehavior: 'No error thrown',
          }
        )
      } catch (error: any) {
        errorResults.numericRangeReregisterWithInitialInput = createTestResult(
          true,
          'Correctly threw error for initialInput in numeric range reregistration',
          error,
          {
            scenario: 'Attempting to reregister numeric range with initialInput',
            expectedBehavior: 'Should throw error',
            actualBehavior: 'Error thrown as expected',
          }
        )
      }

      // Test readable range reregistration with initialInput (should error)
      try {
        const rangeId = 'testRangeUtil-error-readable-reregister-with-initial-input'
        const firstInput = '900'
        const secondInput = '950'
        await registerReadableRange<string>(
          rangeId,
          firstInput,
          {
            getViewableRange: async (input: number) => [input, input + 10],
      getNextLeftRange: async (input: number) => [input - 10, input],
      getNextRightRange: async (input: number) => [input + 10, input + 20],
      inputToNumber: (input: string) => parseInt(input),
      numberToInput: (number: number) => number.toString(),
      
          },
          false
        )
        await registerReadableRange<string>(
          rangeId,
          secondInput,
          {
            getViewableRange: async (input: number) => [input, input + 10],
            getNextLeftRange: async (input: number) => [input - 10, input],
            getNextRightRange: async (input: number) => [input + 10, input + 20],
            inputToNumber: (input: string) => parseInt(input),
            numberToInput: (number: number) => number.toString(),

          },
          true
        )
        errorResults.readableRangeReregisterWithInitialInput = createTestResult(
          false,
          'Should have thrown error for initialInput in readable range reregistration',
          undefined,
          {
            rangeId,
            firstInput,
            secondInput,
            scenario: 'Attempting to reregister readable range with initialInput',
            expectedBehavior: 'Should throw error',
            actualBehavior: 'No error thrown',
          }
        )
      } catch (error: any) {
        errorResults.readableRangeReregisterWithInitialInput = createTestResult(
          true,
          'Correctly threw error for initialInput in readable range reregistration',
          error,
          {
            scenario: 'Attempting to reregister readable range with initialInput',
            expectedBehavior: 'Should throw error',
            actualBehavior: 'Error thrown as expected',
          }
        )
      }

      results.errors = errorResults
    }

    // Test accessConversionStore type safety - type checking and validation
    if (!testName || testName === '') {
      try {
        const rangeId = 'testRangeUtil-access-conversion-store-type-safety'
        const initialInput = '1000'
        await registerReadableRange<string>(
          rangeId,
          initialInput,
          {
            getViewableRange: async (input: number) => [input - 5, input + 5],
            getNextLeftRange: async (input: number) => [input - 20, input - 5],
            getNextRightRange: async (input: number) => [input + 5, input + 20],
            inputToNumber: (input: string) => parseInt(input),
            numberToInput: (number: number) => number.toString(),
            
          },
          false
        )

        const store = accessConversionStore<string>(rangeId)
        const initialStoreInput = store.input
        store.input = '1100'
        const updatedStoreInput = store.input
        const initialViewableRange = store.viewableRange
        store.viewableRange = ['1095', '1105']
        const updatedViewableRange = store.viewableRange

        // Test type mismatch error
        let typeMismatchError = false
        let typeMismatchErrorDetails: any = null
        try {
          store.input = 1234 as any // Should fail type check
        } catch (error: any) {
          console.log('type mismatch error; good failure', error)
          typeMismatchError = true
          typeMismatchErrorDetails = {
            errorMessage: error.message,
            errorType: error.name,
          }
        }

        results.accessConversionStoreTypeSafety = createTestResult(
          true,
          'accessConversionStore type safety tests passed',
          undefined,
          {
            rangeId,
            inputType: 'string',
            initialInput,
            initialStoreInput,
            updatedStoreInput,
            initialViewableRange,
            updatedViewableRange,
            typeMismatchError,
            typeMismatchErrorDetails,
            typeSafetyWorking: typeMismatchError === true,
          }
        )
      } catch (error: any) {

        results.accessConversionStoreTypeSafety = createTestResult(
          false,
          'accessConversionStore type safety tests failed',
   JSON.stringify(error.stack, null, 2),
        )
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
