// Simple nextChord implementation for chord progression suggestions
// This provides basic chord progression logic for the web app

export const nextChord = (
  chord: string,
  tonic?: string | null,
  scale?: string | null
): string[] => {
  // Basic chord progressions - this is a simplified implementation
  // In a full implementation, this would use music theory to suggest appropriate next chords

  const commonProgressions: { [key: string]: string[] } = {
    C: ['F', 'G', 'Am'],
    F: ['C', 'G', 'Am'],
    G: ['C', 'D', 'Em'],
    Am: ['F', 'G', 'C'],
    Dm: ['G', 'Am', 'Bb'],
    Em: ['Am', 'G', 'C'],
    Bb: ['F', 'G', 'C'],
    D: ['G', 'A', 'Bm'],
    A: ['D', 'E', 'F#m'],
    E: ['A', 'B', 'C#m'],
    B: ['E', 'F#', 'G#m'],
    'F#': ['B', 'C#', 'D#m'],
    'C#': ['F#', 'G#', 'A#m'],
    'G#': ['C#', 'D#', 'E#m'],
    'D#': ['G#', 'A#', 'B#m'],
    'A#': ['D#', 'E#', 'F##m'],
    'E#': ['A#', 'B#', 'C##m'],
    'B#': ['E#', 'F##', 'G##m'],
    'F##': ['B#', 'C##', 'D##m'],
    'C##': ['F##', 'G##', 'A##m'],
    'G##': ['C##', 'D##', 'E##m'],
    'D##': ['G##', 'A##', 'B##m'],
    'A##': ['D##', 'E##', 'F###m'],
    'E##': ['A##', 'B##', 'C###m'],
    'B##': ['E##', 'F###', 'G###m'],
  }

  // Extract the root note from the chord (remove extensions like 'm', '7', etc.)
  const rootNote = chord.replace(/[^A-G#b]/g, '')

  // Get common progressions for this root note
  const progressions = commonProgressions[rootNote] || []

  // Return the progressions, or fallback to common chords if no specific progression found
  if (progressions.length > 0) {
    return progressions
  }

  // Fallback: return some common chords
  return ['C', 'F', 'G', 'Am']
}
