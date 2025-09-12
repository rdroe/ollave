// Test file for web worker implementation
import { mapSongToMidiTicks, mapSongToMidiTicksSync } from './mapSongToTicks'

// Mock data for testing
const mockPhases = {
  phase1: {
    id: 1,
    name: 'phase1',
    'follows-ids': [],
    barSizeMultiplier: 1,
  },
}

const mockNotesByBar = {
  'phase1:0': [
    {
      note: 'C4',
      tags: ['noteId=test1', 'barDelay=0', 'quarter=1'],
    },
  ],
}

// Mock the mem function for testing
const originalMem = (global as any).mem
;(global as any).mem = () => ({
  phases: mockPhases,
  notesByBar: mockNotesByBar,
})

async function testWorkerImplementation() {
  console.log('Testing web worker implementation...')

  try {
    // Test the async version (with web worker)
    const startTime = performance.now()
    const result = await mapSongToMidiTicks()
    const endTime = performance.now()

    console.log('Web worker result:', result)
    console.log('Web worker processing time:', endTime - startTime, 'ms')

    // Test the synchronous version for comparison
    const syncStartTime = performance.now()
    const syncResult = mapSongToMidiTicksSync()
    const syncEndTime = performance.now()

    console.log('Synchronous result:', syncResult)
    console.log(
      'Synchronous processing time:',
      syncEndTime - syncStartTime,
      'ms'
    )

    // Compare results
    const resultsMatch = JSON.stringify(result) === JSON.stringify(syncResult)
    console.log('Results match:', resultsMatch)
  } catch (error) {
    console.error('Test failed:', error)
  } finally {
    // Restore original mem function
    if (originalMem) {
      ;(global as any).mem = originalMem
    }
  }
}

// Export for use in other test files
export { testWorkerImplementation }

// Run test if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
  testWorkerImplementation()
}
