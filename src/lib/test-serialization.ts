// Test file for serialization fix
import { mapSongToMidiTicks } from './mapSongToTicks'
import { makeNoteByBar } from './schemas'

// Create test data with proxy objects (like the real NoteByBar objects)
const mockPhases = {
  'phase1': {
    id: 1,
    name: 'phase1',
    'follows-ids': [],
    barSizeMultiplier: 1
  }
}

// Create NoteByBar objects that will have proxy objects
const mockNote1 = makeNoteByBar('C4', ['noteId=test1', 'barDelay=0', 'quarter=1'])
const mockNote2 = makeNoteByBar('D4', ['noteId=test2', 'barDelay=0', 'eighth=1'])

const mockNotesByBar = {
  'phase1:0': [mockNote1, mockNote2]
}

// Mock the mem function for testing
const originalMem = (global as any).mem
;(global as any).mem = () => ({
  phases: mockPhases,
  notesByBar: mockNotesByBar
})

async function testSerializationFix() {
  console.log('Testing serialization fix for proxy objects...')

  try {
    // Test the async version (with web worker and serialization)
    const startTime = performance.now()
    const result = await mapSongToMidiTicks()
    const endTime = performance.now()

    console.log('✅ Web worker with serialization succeeded!')
    console.log('Result:', result)
    console.log('Processing time:', endTime - startTime, 'ms')

    // Verify the result structure
    if (typeof result === 'object' && result !== null) {
      console.log('✅ Result is a valid object')

      // Check if we have any tick entries
      const tickCount = Object.keys(result).length
      console.log(`✅ Found ${tickCount} tick entries`)

      if (tickCount > 0) {
        console.log('✅ Processing completed successfully with data')
      } else {
        console.log('⚠️  No tick data found (this might be expected for the test data)')
      }
    } else {
      console.log('❌ Result is not a valid object')
    }

  } catch (error) {
    console.error('❌ Test failed:', error)

    // Check if it's the specific proxy cloning error
    if (error instanceof Error && error.message.includes('Proxy object could not be cloned')) {
      console.error('❌ Still getting proxy cloning error - fix not working')
    } else {
      console.error('❌ Different error occurred:', error.message)
    }
  } finally {
    // Restore original mem function
    if (originalMem) {
      (global as any).mem = originalMem
    }
  }
}

// Export for use in other test files
export { testSerializationFix }

// Run test if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
  testSerializationFix()
}
