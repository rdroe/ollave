// Usage example for the new async mapSongToMidiTicks function
// This example shows how the web worker now properly handles proxy objects
import { mapSongToMidiTicks, mapSongToMidiTicksSync } from './mapSongToTicks'

// Example of how to use the new async version
export async function processSongWithWorker() {
  try {
    console.log('Starting song processing with web worker...')
    console.log(
      'Note: Proxy objects are now properly serialized for worker communication'
    )

    // The function is now async and will use a web worker
    // The worker manager automatically handles serialization of proxy objects
    const midiMap = await mapSongToMidiTicks()

    console.log('Song processing completed:', midiMap)
    return midiMap
  } catch (error) {
    console.error('Error processing song:', error)
    throw error
  }
}

// Example of how to use the synchronous fallback
export function processSongSync() {
  console.log('Starting song processing synchronously...')

  // This will always run synchronously (useful for debugging or when workers aren't available)
  const midiMap = mapSongToMidiTicksSync()

  console.log('Synchronous song processing completed:', midiMap)
  return midiMap
}

// Example of handling both cases
export async function processSongWithFallback() {
  try {
    // Try async version first (with web worker)
    return await mapSongToMidiTicks()
  } catch (error) {
    console.warn('Async processing failed, using sync fallback:', error)
    // Fallback to synchronous version
    return mapSongToMidiTicksSync()
  }
}

// Example of processing multiple songs
export async function processMultipleSongs() {
  const songs = ['song1', 'song2', 'song3'] // Example song names

  const results = await Promise.all(
    songs.map(async (songName) => {
      try {
        const midiMap = await mapSongToMidiTicks()
        return { songName, midiMap, success: true }
      } catch (error) {
        return { songName, error, success: false }
      }
    })
  )

  return results
}
