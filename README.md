# Ollave - CLI-Style Music Production Framework

Ollave is a browser-based CLI-style music production framework that enables real-time music composition and playback through a command-line interface. Built with TypeScript, RxJS, and Tone.js, it provides a unique approach to music creation with phase-based composition and real-time audio synthesis.

## 🎵 Features

- **CLI Interface**: Command-line style interface running in the browser
- **Real-time Audio**: Live music playback using Tone.js and piano samples
- **Phase-based Composition**: Organize music into phases with following relationships
- **MIDI Integration**: Full MIDI tick-based timing system
- **Real-time Tempo Control**: Dynamic speed adjustment during playback
- **Chord and Scale Support**: Built-in chord progression and scale functionality
- **Export Capabilities**: Download compositions as MIDI files with tempo changes
- **Visual Feedback**: Real-time display of played notes, timing, and tempo changes

## 🏗️ Architecture

### Core Components

#### 1. **Memory System (`src/mem.ts`)**
The central state management system that maintains:
- Song data (name, tempo, tracks)
- Phase configurations
- Note-by-bar mappings
- Playback state and observables
- Real-time cursor position

#### 2. **Tick System (`src/commands/phase/observables/masterTicksObservable.ts`)**
The heartbeat of the application:
- Emits MIDI ticks at song tempo (default 120 BPM)
- Supports real-time tempo changes via "air mode"
- Manages timing relationships between phases
- Handles bar and beat subdivisions
- Provides tempo slider controls for live performance

#### 3. **Phase System (`src/commands/phase/phase.ts`)**
Organizes music into temporal sections:
- Phases can follow other phases
- Each phase has configurable length in bars
- Supports scale and tonic assignments
- Manages note tagging and organization

#### 4. **Audio Engine (`src/lib/music.ts`)**
Handles real-time audio synthesis:
- Uses Tone.js for audio processing
- Integrates with @tonejs/piano for realistic piano sounds
- Supports triad-based note playback
- Manages audio sample loading and playback

## 🎹 Commands

### Song Management

```bash
# Initialize a new song with random name
song init

# Start playing the current song
song start

# Stop playing the current song
song stop

# Download the song as MIDI file (includes tempo changes)
song dl
```

### Tempo Control

```bash
# Change playback speed in real-time (12-400 range)
tempo 100

# Set to minimum speed (12 = 14.4 BPM)
tempo 12

# Set to maximum speed (400 = 480 BPM)
tempo 400

# Add tempo slider to interface
tempo 150 --addSlider
```

### Phase Management

```bash
# Create a phase with specified number of bars
phase aphrodite 10

# Make a phase follow another phase
phase aphrodite follows zeus

# Set scale for a phase
phase aphrodite scale C major

# Unfollow a phase
phase aphrodite unfollows zeus
```

### Bar and Note Management

```bash
# Fill bars with chord progressions
bars aphrodite fill Em,3 Am,3 [] C3,E3,G#3

# Add bars to existing phase
bars aphrodite add F,4 G,4

# Repack bars with different timing
bars aphrodite repack --pack 2 4 6 2
```

### Note Timing and Delays

```bash
# Add chord to specific bar with tick delay
bar aphrodite:0 chord C,3 add 120

# Add chord with fractional delay
bar aphrodite:0 chord F,3 add 60 --delay 8th 16th

# Arrange notes with timing patterns
notes in phase aphrodite arrange 2 8th,4th half 4th,16th 4 16th,32nd

# Apply delay matrix to existing notes
notes in phase aphrodite arrange 3 8th,4th 2 16th,32nd
```

### Chord Utilities

```bash
# Get all available scales and triads
chord triads

# Generate chord progression from Roman numerals
chord fromRoman C major I IV V

# Create chord progression with program generation
chord prog C major I IV V
```

### Debug and Development

```bash
# Enable debug logging
debug on

# Test audio playback
test
```

## 🎼 Usage Examples

### Basic Song Creation

```bash
# Create a simple 4-bar progression
phase verse 4
bars verse fill C,3 F,3 G,3 C,3
song start
```

### Multi-Phase Composition

```bash
# Create verse and chorus phases
phase verse 8
bars verse fill Am,3 F,3 C,3 G,3

phase chorus 4
phase chorus follows verse
bars chorus fill C,3 F,3 G,3 C,3

song start
```

### Scale-Based Composition

```bash
# Set up a phase with C major scale
phase melody 16
phase melody scale C major
bars melody fill C,3 D,3 E,3 F,3 G,3 A,3 B,3 C,4
song start
```

### Complex Timing

```bash
# Create phase with custom timing
phase intro 8
bars intro repack --pack 4th,8th half 4th,16th
song start
```

### Advanced Note Timing

```bash
# Create phase with precise note timing
phase melody 4
bars melody fill C,3 D,3 E,3 F,3

# Add timing variations to existing notes
notes in phase melody arrange 2 8th,4th 2 16th,32nd

# Create arpeggiated patterns
notes in phase melody arrange 3 8th,4th 2 16th,32nd 1 32nd,64th
```

### Real-time Tempo Control

```bash
# Set playback speed to 50% (60 BPM)
tempo 50

# Speed up to 200% (240 BPM)
tempo 200

# Add interactive tempo slider
tempo 150 --addSlider

# Fine-tune tempo during playback
# Use the slider to adjust speed from 12-400 range
# (12 = 14.4 BPM, 400 = 480 BPM)
```

## 🎛️ Timing System Architecture

### Air Mode vs Paper Mode
Ollave supports two timing modes:

**Air Mode (Default)**: Real-time tempo control
- Dynamic speed changes during playback
- Speed range: 12-400 (0.12x to 4x base tempo)
- Interactive tempo slider support
- Immediate tempo changes without pre-planning

**Paper Mode**: Pre-planned tempo changes
- Tempo changes defined in advance
- Linear interpolation between planned changes
- Used for complex tempo maps and automation

### Tempo Control Functions
```typescript
// Set playback speed (12-400 range)
setAirSpeed(speed: number)

// Get current speed multiplier
airSpeed(): number

// Convert speed to BPM
tempoFromAirSpeed(speed: number): number

// Parse speed from string input
parseAirSpeed(speed: string): number
```

## 🎛️ Data Model

### Song Structure
```typescript
type SongRecord = {
    id?: number,
    name: string,
    tempo: number,
    "track-ids": number[]
}
```

### Phase Structure
```typescript
type PhaseRecord = {
    id?: number,
    "follows-ids": number[],
    speed: number,
    barSizeMultiplier: number,
    scaleName: string | null,
    scaleTonic: string | null
}
```

### Note Structure
```typescript
type NoteByBar = {
    note: string;
    tags: string[];
}
```

## 🔧 Development

### Prerequisites
- Node.js 16+
- Yarn package manager

### Installation
```bash
# Install dependencies
yarn install

# Start development server
yarn mon
```

### Build Commands
```bash
# TypeScript compilation (watch mode)
yarn ts-dev

# Build TypeScript
yarn ts-build

# Build JavaScript
yarn js-build

# Build CSS
yarn css-build

# Start HTTP server
yarn start
```

### Project Structure
```
src/
├── commands/          # CLI command implementations
│   ├── bar/          # Bar-level operations
│   ├── bars/         # Multi-bar operations
│   ├── chord/        # Chord utilities
│   ├── phase/        # Phase management
│   ├── play/         # Playback controls
│   └── song/         # Song-level operations
├── lib/              # Core utilities
│   ├── music.ts      # Audio engine
│   ├── midi.ts       # MIDI utilities
│   └── helpers.ts    # Helper functions
├── mem.ts            # Memory/state management
├── mem-db.ts         # Database operations
└── myapp.ts          # Main application entry
```

## 🎯 Key Concepts

### Phases
Phases are the primary organizational unit in Ollave. Each phase:
- Has a configurable length in bars
- Can follow other phases sequentially
- Can have scale and tonic assignments
- Contains bars with notes and timing information

### Bars
Bars contain the actual musical content:
- Notes with timing and velocity information
- Tags for organization and playback instructions
- Support for chord progressions and individual notes
- Flexible timing through delay and offset tags

### Ticks
The application uses MIDI ticks for precise timing:
- Default tempo: 120 BPM
- Tick resolution: 128 ticks per quarter note (PPQ)
- Supports fractional timing and delays
- Real-time tick emission for live playback
- Dynamic tempo changes during playback (12-400 range)

### Timing System
The timing system supports multiple levels of precision:
- **Bar-level timing**: `barDelay=120` (tick offset within bar)
- **Fractional timing**: `8th=1`, `16th=2` (musical note divisions)
- **Delay patterns**: `8th,4th half 4th,16th` (complex timing matrices)
- **Arpeggiation**: Automatic note spacing for chord voicings
- **Real-time tempo control**: Dynamic speed adjustment (0.12x to 4x base tempo)

### Tags
Notes use a rich tagging system:
- `chord=Cmaj` - Chord identification
- `scaleTonic=C` - Scale root note
- `scaleName=major` - Scale type
- `barDelay=120` - Tick-based timing offset
- `8th=1` - Fractional note timing (8th note delay)
- `16th=2` - Multiple fractional delays
- `layer=abc123` - Grouping identifier

## 🚀 Advanced Features

### MIDI Export
Songs can be exported as MIDI files for use in other DAWs:
```bash
song dl
```

### Real-time Visualization
The interface shows:
- Current tick position
- Recently played notes with tags
- Phase and bar relationships
- Live composition feedback
- Tempo changes and current playback speed
- Interactive tempo slider for live performance

### Scale Integration
Automatic scale-aware composition:
- Chord progressions respect assigned scales
- Note selection follows scale patterns
- Roman numeral analysis support

### Timing and Arpeggiation
Advanced timing features for musical expression:
- **Fractional delays**: Use musical note values (8th, 16th, 32nd, etc.)
- **Delay matrices**: Apply complex timing patterns to note groups
- **Arpeggiation**: Automatic chord note spacing with `notes arrange`
- **Bar-level timing**: Precise tick-based positioning within bars
- **Pattern repetition**: Apply timing patterns across multiple notes
- **Real-time tempo control**: Dynamic speed adjustment during playback

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🎵 Acknowledgments

- Built with [Tone.js](https://tonejs.github.io/) for audio synthesis
- Uses [@tonejs/piano](https://github.com/tambien/Piano) for realistic piano sounds
- Powered by [RxJS](https://rxjs.dev/) for reactive programming
- CLI framework built on [peprn](https://github.com/rdroe/peprn) 


## Expansion on notes and the memory model
Here is an example of notesByBar in the `mem()` memory model of a song playing or being composed:
```json 
...
"notesByBar": {
    "aphrodite:0": [
      {
        "note": "C3",
        "tags": [
          "layer=B9S",
          "barDelay=0",
          "chord=C",
          "lastBarTag=aphrodite:0",
          "noteLetter=C",
          "noteAcc=",
          "noteOct=3",
          "noteId=NYn",
          "groupIndex=0",
          "chordSize=3",
          "half=1",
          "quarter=1"
        ]
      },
      {
        "note": "E3",
        "tags": [
          "layer=B9S",
          "barDelay=0",
          "chord=C",
          "lastBarTag=aphrodite:0",
          "noteLetter=E",
          "noteAcc=",
          "noteOct=3",
          "noteId=ryO",
          "groupIndex=1",
          "chordSize=3"
        ]
      },
      {
        "note": "G3",
        "tags": [
          "layer=B9S",
          "barDelay=0",
          "chord=C",
          "lastBarTag=aphrodite:0",
          "noteLetter=G",
          "noteAcc=",
          "noteOct=3",
          "noteId=66K",
          "groupIndex=2",
          "chordSize=3"
        ]
      },
      {
        "note": "G3",
        "tags": [
          "layer=BTZ",
          "barDelay=0",
          "chord=G",
          "lastBarTag=aphrodite:0",
          "noteLetter=G",
          "noteAcc=",
          "noteOct=3",
          "noteId=EWY",
          "groupIndex=0",
          "chordSize=3"
        ]
      },
      {
        "note": "B3",
        "tags": [
          "layer=BTZ",
          "barDelay=0",
          "chord=G",
          "lastBarTag=aphrodite:0",
          "noteLetter=B",
          "noteAcc=",
          "noteOct=3",
          "noteId=wBg",
          "groupIndex=1",
          "chordSize=3"
        ]
      },
      {
        "note": "D4",
        "tags": [
          "layer=BTZ",
          "barDelay=0",
          "chord=G",
          "lastBarTag=aphrodite:0",
          "noteLetter=D",
          "noteAcc=",
          "noteOct=4",
          "noteId=Jnt",
          "groupIndex=2",
          "chordSize=3"
        ]
      }
    ]
  },
...
```
To be played in real time, those are compiled into a time-based format, `latestMap`:
```json

  "latestMap": {
    "0": [
      {
        "note": "E3",
        "compositionTags": [
          "layer=B9S",
          "barDelay=0",
          "chord=C",
          "lastBarTag=aphrodite:0",
          "noteLetter=E",
          "noteAcc=",
          "noteOct=3",
          "noteId=ryO",
          "groupIndex=1",
          "chordSize=3"
        ]
      },
      {
        "note": "G3",
        "compositionTags": [
          "layer=B9S",
          "barDelay=0",
          "chord=C",
          "lastBarTag=aphrodite:0",
          "noteLetter=G",
          "noteAcc=",
          "noteOct=3",
          "noteId=66K",
          "groupIndex=2",
          "chordSize=3"
        ]
      },
      {
        "note": "G3",
        "compositionTags": [
          "layer=BTZ",
          "barDelay=0",
          "chord=G",
          "lastBarTag=aphrodite:0",
          "noteLetter=G",
          "noteAcc=",
          "noteOct=3",
          "noteId=EWY",
          "groupIndex=0",
          "chordSize=3"
        ]
      },
      {
        "note": "B3",
        "compositionTags": [
          "layer=BTZ",
          "barDelay=0",
          "chord=G",
          "lastBarTag=aphrodite:0",
          "noteLetter=B",
          "noteAcc=",
          "noteOct=3",
          "noteId=wBg",
          "groupIndex=1",
          "chordSize=3"
        ]
      },
      {
        "note": "D4",
        "compositionTags": [
          "layer=BTZ",
          "barDelay=0",
          "chord=G",
          "lastBarTag=aphrodite:0",
          "noteLetter=D",
          "noteAcc=",
          "noteOct=4",
          "noteId=Jnt",
          "groupIndex=2",
          "chordSize=3"
        ]
      }
    ],
    "384": [
      {
        "note": "C3",
        "compositionTags": [
          "layer=B9S",
          "barDelay=0",
          "chord=C",
          "lastBarTag=aphrodite:0",
          "noteLetter=C",
          "noteAcc=",
          "noteOct=3",
          "noteId=NYn",
          "groupIndex=0",
          "chordSize=3",
          "half=1",
          "quarter=1"
        ]
      }
    ]
  },
  ....
```

In latestMap, the property name is a tick containing all the notes to be played on that song tick. This is the closest to real-time representation that gets stored. As the cursor moves from the beginning to the end it reads off the notes to play and plays them. 


### Planned: Graphic DSL
As a DSL for graphical interface, a DSL is planned.

phase:aphrodite
    bar(chord:C3() chord(0 4th 1 4th 2)):barname chord:G3(0 4th 1 4th 2) 
    repeat barname repeat barname repeat barname
phase:xanthippe follows aphrodite
    bar(chord:D3() chord(0 4th 1 4th 2)):barname2 chord:Em3(0 4th 1 4th 2) 
    repeat barname repeat barname2 repeat barname

# Ollave

Framework for developing musical streams

## API Exports for External Packages

Ollave provides a comprehensive API that can be imported by external packages. The library exports are organized to allow both namespace-based and direct function imports.

### Importing Individual Functions

You can import specific functions directly from the lib modules:

```typescript
// Import specific functions from mem-db
import { phaseCount, phaseExists, getAllPhaseBars } from 'ollave/lib/mem-db'

// Import utility functions from helpers
import { randId, phaseScale, isString } from 'ollave/lib/helpers'

// Import music-related functions
import { addNoteToBar } from 'ollave/lib/addNote'
import { updateNoteTag, parseNoteTags } from 'ollave/lib/tags'
```

### Importing Namespace Modules

For backward compatibility, you can also import entire modules as namespaces:

```typescript
// Import entire modules
import * as memDb from 'ollave/lib/mem-db'
import * as helpers from 'ollave/lib/helpers'

// Use with namespace
memDb.phaseCount('myPhase', 4)
helpers.randId('prefix', 8)
```

### Available Modules

#### `ollave/lib/mem-db`
Functions for managing phases and musical data in memory:
- `phaseCount(phase: string, size: number, skipCopy?: boolean)` - Set the number of bars in a phase
- `phaseExists(phase: string)` - Check if a phase exists
- `getAllPhaseBars(phase: string)` - Get all bars for a phase
- `getAllPhaseBarNotes(phase: string)` - Get all notes for a phase
- `phaseFollowsPhase(subject: string, objects: string[])` - Manage phase relationships
- `phaseUnfollows(subject: string, objects?: string[])` - Remove phase relationships
- `lastTick()` - Get the last tick in the song
- `startEndData(phaseName: string)` - Get phase timing data
- `lookUpGraph(userTonic: string, userScale: string)` - Look up chord progression graphs
- `getFollowingPhases(phaseName: string)` - Get phases that follow a given phase
- `sortByNumberAfterColon(a: string, b: string)` - Sort phase bars by number

#### `ollave/lib/helpers`
Utility functions for common operations:
- `randId(prefix?: string, length?: number)` - Generate random ID
- `phaseScale(phaseName: string, userScale?: string, userTonic?: string, doUpdatePhase?: boolean)` - Get or set phase scale
- `isString(arg: any)` - Type guard for strings
- `isNum(arg: any)` - Type guard for numbers
- `strjson(arg: any)` - Convert object to formatted JSON string
- `randomInt(min?: number, max?: number)` - Generate random integer
- `isScaleName(str: string)` - Check if string is valid scale name
- `isScaleNameWithTonic(str: string)` - Check if string is scale name with tonic

#### `ollave/lib/addNote`
Functions for adding notes to bars:
- `addNoteToBar(note: string, barTag: string, tags: string[])` - Add a note to a specific bar

#### `ollave/lib/tags`
Functions for managing note tags:
- `updateNoteTag(note: any, tagName: string, tagValues: string[])` - Update note tags
- `parseNoteTags(tags: string[])` - Parse note tags
- `calcFractionalDelay(tags: any)` - Calculate fractional delay from tags

#### `ollave/lib/graphh`
Chord progression and scale utilities:
- `ProgressionOptions` - Type for chord progression options
- `minor` - Minor scale definitions
- `allScales` - All available scales

#### `ollave/lib/music`
Music playback and audio utilities:
- `Triad` - Type for musical triads
- `RelativeNote` - Type for relative notes
- `samplerState` - Current sampler state
- `getSampler()` - Get audio sampler
- `playTriads(notes: Triad[])` - Play triad notes

#### `ollave/lib/midi`
MIDI file generation:
- `saveRaw(bytes: any, name?: string)` - Save raw MIDI data
- `addEvents(track: Midi.Track, events: RelativeNote[])` - Add events to MIDI track
- `addNoteEvents(track: Midi.Track, notes: Triad[])` - Add note events to MIDI track
- `playNotes(notes: Triad[])` - Play notes via MIDI

#### `ollave/lib/subcommands`
Subcommand parsing and execution:
- `Subcommand` - Type for subcommands
- `SubcommandPatterns` - Type for subcommand patterns
- `runSubcommandsOrNull(patterns: SubcommandPatterns, args: ParsedCli)` - Run subcommands
- `romanChordNameToRealModule` - Roman numeral chord mapping

#### `ollave/lib/mapSongToTicks`
Song timing utilities:
- `mapSongToMidiTicks()` - Map song structure to MIDI ticks

### TypeScript Support

All exports include full TypeScript type definitions. The package.json includes proper `typesVersions` configuration to ensure type resolution works correctly for both namespace and direct imports.

### Build Process

The library is built using TypeScript and esbuild, with exports configured to support both CommonJS and ES modules. The build process generates both JavaScript files and TypeScript declaration files in the `public/js/` directory.

## API Reference

This section provides detailed documentation for all exportable functions and their usage.

### Phase and Musical Data Management (`ollave/lib/mem-db`)

#### `phaseCount(phase: string, size: number, skipCopy?: boolean): Promise<void>`
Sets the number of bars in a phase. If the phase doesn't exist, it creates it with default settings.

**Parameters:**
- `phase`: The name of the phase to modify
- `size`: The desired number of bars
- `skipCopy`: If true, new bars will be empty instead of copying existing content

**Usage:**
```typescript
import { phaseCount } from 'ollave/lib/mem-db'

// Create a phase with 4 bars
await phaseCount('verse', 4)

// Resize existing phase, copying content to new bars
await phaseCount('chorus', 8, false)

// Resize without copying content
await phaseCount('bridge', 2, true)
```

#### `phaseExists(phase: string): boolean`
Checks if a phase exists in the current song.

**Parameters:**
- `phase`: The name of the phase to check

**Returns:** `true` if the phase exists, `false` otherwise

**Usage:**
```typescript
import { phaseExists } from 'ollave/lib/mem-db'

if (phaseExists('intro')) {
    console.log('Intro phase exists')
}
```

#### `getAllPhaseBars(phase: string): string[]`
Returns an array of all bar tags for a given phase, sorted by bar number.

**Parameters:**
- `phase`: The name of the phase

**Returns:** Array of bar tags (e.g., `['verse:0', 'verse:1', 'verse:2']`)

**Usage:**
```typescript
import { getAllPhaseBars } from 'ollave/lib/mem-db'

const bars = getAllPhaseBars('verse')
// Returns: ['verse:0', 'verse:1', 'verse:2', 'verse:3']
```

#### `getAllPhaseBarNotes(phase: string): NoteByBar[][]`
Returns all notes for a given phase, organized by bar.

**Parameters:**
- `phase`: The name of the phase

**Returns:** Array of note arrays, one per bar. Each inner array contains `NoteByBar` objects for that bar.

**Usage:**
```typescript
import { getAllPhaseBarNotes } from 'ollave/lib/mem-db'

const allNotes = getAllPhaseBarNotes('verse')
// Returns: [
//   [{ note: 'C4', tags: ['noteId=abc', 'barDelay=0'] }, { note: 'E4', tags: ['noteId=def', 'barDelay=240'] }], // bar 0
//   [{ note: 'G4', tags: ['noteId=ghi', 'barDelay=0'] }], // bar 1
//   [], // bar 2 (empty)
//   [{ note: 'A4', tags: ['noteId=jkl', 'barDelay=0'] }]  // bar 3
// ]
```

#### `phaseFollowsPhase(subject: string, objects: string[]): Promise<void>`
Establishes a relationship where one phase follows another phase or phases.

**Parameters:**
- `subject`: The phase that will follow
- `objects`: Array of phase names that the subject will follow

**Usage:**
```typescript
import { phaseFollowsPhase } from 'ollave/lib/mem-db'

// Make 'chorus' follow 'verse'
await phaseFollowsPhase('chorus', ['verse'])

// Make 'outro' follow both 'verse' and 'chorus'
await phaseFollowsPhase('outro', ['verse', 'chorus'])
```

#### `phaseUnfollows(subject: string, objects?: string[]): Promise<void>`
Removes phase relationships. If no objects are specified, removes all relationships.

**Parameters:**
- `subject`: The phase to modify
- `objects`: Optional array of phase names to unfollow

**Usage:**
```typescript
import { phaseUnfollows } from 'ollave/lib/mem-db'

// Remove specific relationship
await phaseUnfollows('chorus', ['verse'])

// Remove all relationships
await phaseUnfollows('outro')
```

#### `getFollowingPhases(phaseName: string): [string, any][]`
Returns all phases that follow the specified phase.

**Parameters:**
- `phaseName`: The name of the phase to check

**Returns:** Array of `[phaseName, phaseObject]` pairs for phases that follow the specified phase

**Usage:**
```typescript
import { getFollowingPhases } from 'ollave/lib/mem-db'

const followers = getFollowingPhases('verse')
// Returns: [['chorus', { id: 1, 'follows-ids': [verseId], ... }], ['bridge', { id: 2, 'follows-ids': [verseId], ... }]]
```

#### `lastTick(): number`
Returns the last tick position in the entire song.

**Returns:** The last tick number

**Usage:**
```typescript
import { lastTick } from 'ollave/lib/mem-db'

const songLength = lastTick()
console.log(`Song ends at tick ${songLength}`)
```

#### `startEndData(phaseName: string): StartEndTuple[]`
Returns timing data for a phase showing when it starts and ends.

**Parameters:**
- `phaseName`: The name of the phase

**Returns:** Array of `[startTick, endTick]` tuples

**Usage:**
```typescript
import { startEndData } from 'ollave/lib/mem-db'

const timing = startEndData('verse')
// Returns: [[0, 1920], [1920, 3840], [3840, 5760]] // Each tuple is [start, end] in ticks
```

#### `lookUpGraph(userTonic: string, userScale: string): { [chordName: string]: ProgressionOptions } | null`
Looks up chord progression graphs for a given scale and tonic.

**Parameters:**
- `userTonic`: The tonic note (e.g., 'C', 'F#')
- `userScale`: The scale name (e.g., 'major', 'minor')

**Returns:** Object mapping chord names to progression options, or null if not found

**Usage:**
```typescript
import { lookUpGraph } from 'ollave/lib/mem-db'

const progressions = lookUpGraph('C', 'major')
if (progressions) {
    console.log('Available chord progressions:', progressions)
    // Returns: { 'I': {...}, 'IV': {...}, 'V': {...}, ... }
}
```

#### `sortByNumberAfterColon(a: string, b: string): number`
Sorts strings by the number after a colon (used for bar sorting).

**Parameters:**
- `a`: First string to compare
- `b`: Second string to compare

**Returns:** Comparison result for sorting

**Usage:**
```typescript
import { sortByNumberAfterColon } from 'ollave/lib/mem-db'

const bars = ['verse:2', 'verse:0', 'verse:1']
bars.sort(sortByNumberAfterColon)
// Result: ['verse:0', 'verse:1', 'verse:2']
```

### Utility Functions (`ollave/lib/helpers`)

#### `randId(prefix?: string, length?: number): string`
Generates a random ID with optional prefix.

**Parameters:**
- `prefix`: Optional prefix for the ID
- `length`: Length of the random part (default: 10)

**Returns:** Random ID string

**Usage:**
```typescript
import { randId } from 'ollave/lib/helpers'

const id1 = randId() // "a1b2c3d4e5"
const id2 = randId('note', 6) // "note.f1a2b3"
```

#### `phaseScale(phaseName: string, userScale?: string, userTonic?: string, doUpdatePhase?: boolean): { scaleName: string, scaleTonic: string }`
Gets or sets the scale information for a phase.

**Parameters:**
- `phaseName`: The name of the phase
- `userScale`: Optional scale name to set
- `userTonic`: Optional tonic note to set
- `doUpdatePhase`: Whether to update existing notes (default: true)

**Returns:** Object with current scale information: `{ scaleName: string, scaleTonic: string }`

**Usage:**
```typescript
import { phaseScale } from 'ollave/lib/helpers'

// Get current scale
const current = phaseScale('verse')
// Returns: { scaleName: 'major', scaleTonic: 'C' }

// Set new scale
const newScale = phaseScale('verse', 'major', 'C')
// Returns: { scaleName: 'major', scaleTonic: 'C' }

// Set scale without updating existing notes
phaseScale('chorus', 'minor', 'A', false)
// Returns: { scaleName: 'minor', scaleTonic: 'A' }
```

#### `isString(arg: any): arg is string`
Type guard to check if a value is a string.

**Parameters:**
- `arg`: Value to check

**Returns:** True if the value is a string

**Usage:**
```typescript
import { isString } from 'ollave/lib/helpers'

if (isString(value)) {
    console.log('Value is a string:', value)
}
```

#### `isNum(arg: any): arg is number`
Type guard to check if a value is a number.

**Parameters:**
- `arg`: Value to check

**Returns:** True if the value is a number

**Usage:**
```typescript
import { isNum } from 'ollave/lib/helpers'

if (isNum(value)) {
    console.log('Value is a number:', value)
}
```

#### `strjson(arg: any): string`
Converts an object to a formatted JSON string.

**Parameters:**
- `arg`: Object to stringify

**Returns:** Formatted JSON string

**Usage:**
```typescript
import { strjson } from 'ollave/lib/helpers'

const formatted = strjson({ name: 'test', value: 123 })
console.log(formatted)
```

#### `randomInt(min?: number, max?: number): number`
Generates a random integer within a range.

**Parameters:**
- `min`: Minimum value (default: 1)
- `max`: Maximum value (default: 900000)

**Returns:** Random integer

**Usage:**
```typescript
import { randomInt } from 'ollave/lib/helpers'

const num1 = randomInt() // Random number between 1 and 900000
const num2 = randomInt(1, 100) // Random number between 1 and 100
```

#### `randomNumber(min: number, max: number): number`
Generates a random number within a range.

**Parameters:**
- `min`: Minimum value
- `max`: Maximum value

**Returns:** Random number

**Usage:**
```typescript
import { randomNumber } from 'ollave/lib/helpers'

const num = randomNumber(0, 1) // Random number between 0 and 1
```

#### `peprnIsNum(arg: string | number): boolean`
Checks if a value is a number (supports both string and number types).

**Parameters:**
- `arg`: Value to check

**Returns:** True if the value represents a number

**Usage:**
```typescript
import { peprnIsNum } from 'ollave/lib/helpers'

console.log(peprnIsNum('123')) // true
console.log(peprnIsNum(456)) // true
console.log(peprnIsNum('abc')) // false
```

#### `passivelyNumberize(arg: string | number): number | string`
Converts a string to a number if possible, otherwise returns the original string.

**Parameters:**
- `arg`: Value to convert

**Returns:** Number if convertible, otherwise original string

**Usage:**
```typescript
import { passivelyNumberize } from 'ollave/lib/helpers'

console.log(passivelyNumberize('123')) // 123
console.log(passivelyNumberize('abc')) // 'abc'
```

#### `isStringNumNum(arr: any[]): arr is [string, number, number]`
Type guard to check if an array is of type `[string, number, number]`.

**Parameters:**
- `arr`: Array to check

**Returns:** True if the array matches the expected type

**Usage:**
```typescript
import { isStringNumNum } from 'ollave/lib/helpers'

const data = ['note', 1, 2]
if (isStringNumNum(data)) {
    const [note, num1, num2] = data
    console.log(note, num1, num2)
}
```

#### `isScaleName(str: string): str is typeof allScales[number]['name']`
Checks if a string is a valid scale name.

**Parameters:**
- `str`: String to check

**Returns:** True if the string is a valid scale name

**Usage:**
```typescript
import { isScaleName } from 'ollave/lib/helpers'

console.log(isScaleName('major')) // true
console.log(isScaleName('invalid')) // false
```

#### `isScaleNameWithTonic(str: string): boolean`
Checks if a string represents a scale name with tonic (e.g., "C major").

**Parameters:**
- `str`: String to check

**Returns:** True if the string is a valid scale with tonic

**Usage:**
```typescript
import { isScaleNameWithTonic } from 'ollave/lib/helpers'

console.log(isScaleNameWithTonic('C major')) // true
console.log(isScaleNameWithTonic('major')) // false
```

#### `properScaleName(str: string): string`
Formats a scale name to the proper case.

**Parameters:**
- `str`: Scale name to format

**Returns:** Properly formatted scale name

**Usage:**
```typescript
import { properScaleName } from 'ollave/lib/helpers'

const formatted = properScaleName('major') // Returns properly cased scale name
```

### Note Management (`ollave/lib/addNote`)

#### `addNoteToBar(note: string, bar: string, tagsIn: TagEntries): Promise<NoteByBar>`
Adds a note to a specific bar with tags.

**Parameters:**
- `note`: The note to add (e.g., 'C4', 'F#5')
- `bar`: The bar tag (e.g., 'verse:0')
- `tagsIn`: Array of tag entries

**Returns:** Promise resolving to the added note object

**Usage:**
```typescript
import { addNoteToBar } from 'ollave/lib/addNote'
import { parseNoteTags } from 'ollave/lib/tags'

const tags = parseNoteTags(['noteId=abc123', 'barDelay=0'])
const note = await addNoteToBar('C4', 'verse:0', tags)
```

### Tag Management (`ollave/lib/tags`)

#### `parseNoteTags(tags: string[]): TagEntries`
Parses an array of tag strings into structured tag entries.

**Parameters:**
- `tags`: Array of tag strings (e.g., ['noteId=abc', 'barDelay=0'])

**Returns:** Structured tag entries

**Usage:**
```typescript
import { parseNoteTags } from 'ollave/lib/tags'

const tags = parseNoteTags(['noteId=abc123', 'barDelay=0', 'scaleName=major'])
```

#### `updateNoteTag(note: NoteByBar, tag: string, data: TagData): void`
Updates a specific tag on a note. Modifies the note object in place.

**Parameters:**
- `note`: The note object to update (modified in place)
- `tag`: The tag name to update
- `data`: The new tag data

**Usage:**
```typescript
import { updateNoteTag } from 'ollave/lib/tags'

updateNoteTag(note, 'barDelay', [100])
// Modifies note.tags in place, adding or updating 'barDelay=100'
```

#### `calcFractionalDelay(parsedTags: TagEntries): number`
Calculates the total fractional delay from parsed tags.

**Parameters:**
- `parsedTags`: Parsed tag entries

**Returns:** Total delay value

**Usage:**
```typescript
import { calcFractionalDelay, parseNoteTags } from 'ollave/lib/tags'

const tags = parseNoteTags(['quarter=1', 'eighth=2'])
const delay = calcFractionalDelay(tags)
```

#### `getTagData(tags: TagEntries, tagName: string): TagData | null`
Gets the data for a specific tag.

**Parameters:**
- `tags`: Parsed tag entries
- `tagName`: Name of the tag to find

**Returns:** Tag data or null if not found

**Usage:**
```typescript
import { getTagData, parseNoteTags } from 'ollave/lib/tags'

const tags = parseNoteTags(['noteId=abc', 'barDelay=100'])
const delay = getTagData(tags, 'barDelay') // [100]
```

#### `unparseTagEntries(tes: TagEntries): string[]`
Converts structured tag entries back to string format.

**Parameters:**
- `tes`: Structured tag entries

**Returns:** Array of tag strings

**Usage:**
```typescript
import { unparseTagEntries } from 'ollave/lib/tags'

const strings = unparseTagEntries([['noteId', ['abc']], ['barDelay', [100]]])
// Returns: ['noteId=abc', 'barDelay=100']
```

#### `filterDelayTags(note: NoteByBar, retainBarDelay?: boolean): NoteByBar`
Removes delay-related tags from a note.

**Parameters:**
- `note`: The note to filter
- `retainBarDelay`: Whether to keep barDelay tags (default: false)

**Returns:** Filtered note object

**Usage:**
```typescript
import { filterDelayTags } from 'ollave/lib/tags'

const filtered = filterDelayTags(note, true)
```

#### `filterBarDelayTag(note: NoteByBar): NoteByBar`
Removes only the barDelay tag from a note.

**Parameters:**
- `note`: The note to filter

**Returns:** Filtered note object

**Usage:**
```typescript
import { filterBarDelayTag } from 'ollave/lib/tags'

const filtered = filterBarDelayTag(note)
```

#### `calcTickDelay(parsedTags: TagEntries): number`
Calculates the tick delay from parsed tags.

**Parameters:**
- `parsedTags`: Parsed tag entries

**Returns:** Tick delay value

**Usage:**
```typescript
import { calcTickDelay, parseNoteTags } from 'ollave/lib/tags'

const tags = parseNoteTags(['barDelay=100'])
const delay = calcTickDelay(tags)
```

#### `groupNotesByFirstTagDatum(notes: NoteByBar[], tag: string): NoteByBar[][]`
Groups notes by the first datum of a specific tag.

**Parameters:**
- `notes`: Array of notes to group
- `tag`: Tag name to group by

**Returns:** Array of note groups

**Usage:**
```typescript
import { groupNotesByFirstTagDatum } from 'ollave/lib/tags'

const groups = groupNotesByFirstTagDatum(notes, 'noteId')
```

#### `tagsDeleteMatching1(fn: (te: TagEntry) => boolean, tagEntries: TagEntries): TagEntries`
Filters tag entries using a predicate function.

**Parameters:**
- `fn`: Predicate function
- `tagEntries`: Tag entries to filter

**Returns:** Filtered tag entries

**Usage:**
```typescript
import { tagsDeleteMatching1 } from 'ollave/lib/tags'

const filtered = tagsDeleteMatching1(([name]) => name !== 'barDelay', tags)
```

#### `tagsDeleteMatching2(fn: (te: string) => boolean, tagEntries: string[]): string[]`
Filters tag strings using a predicate function.

**Parameters:**
- `fn`: Predicate function
- `tagEntries`: Tag strings to filter

**Returns:** Filtered tag strings

**Usage:**
```typescript
import { tagsDeleteMatching2 } from 'ollave/lib/tags'

const filtered = tagsDeleteMatching2(tag => !tag.startsWith('barDelay'), tags)
```

#### `tagDataOrNull(note: NoteByBar, tag: string): TagData | null`
Gets tag data from a note, returning null if not found.

**Parameters:**
- `note`: The note to check
- `tag`: Tag name to find

**Returns:** Tag data or null

**Usage:**
```typescript
import { tagDataOrNull } from 'ollave/lib/tags'

const data = tagDataOrNull(note, 'noteId')
```

#### `latestNote(notes: NoteByBar[]): NoteByBar | null`
Finds the latest note in a collection based on delay timing.

**Parameters:**
- `notes`: Array of notes to search

**Returns:** Latest note or null

**Usage:**
```typescript
import { latestNote } from 'ollave/lib/tags'

const latest = latestNote(notes)
```

#### `earliestNote(notes: NoteByBar[]): NoteByBar | null`
Finds the earliest note in a collection based on delay timing.

**Parameters:**
- `notes`: Array of notes to search

**Returns:** Earliest note or null

**Usage:**
```typescript
import { earliestNote } from 'ollave/lib/tags'

const earliest = earliestNote(notes)
```

#### `scale(note: NoteByBar): [string, string] | null`
Extracts scale information from a note's tags.

**Parameters:**
- `note`: The note to analyze

**Returns:** Tuple of [tonic, scaleName] or null

**Usage:**
```typescript
import { scale } from 'ollave/lib/tags'

const scaleInfo = scale(note)
if (scaleInfo) {
    const [tonic, scaleName] = scaleInfo
    console.log(`Note is in ${tonic} ${scaleName}`)
}
```

### Chord Progression and Scale Utilities (`ollave/lib/graphh`)

#### `ProgressionOptions`
Type definition for chord progression options.

**Usage:**
```typescript
import { ProgressionOptions } from 'ollave/lib/graphh'

const options: ProgressionOptions = {
    // Chord progression configuration
}
```

#### `minor`
Minor scale definitions and utilities.

**Usage:**
```typescript
import { minor } from 'ollave/lib/graphh'

// Access minor scale information
```

#### `allScales`
Array of all available scales in the system.

**Usage:**
```typescript
import { allScales } from 'ollave/lib/graphh'

console.log('Available scales:', allScales.map(s => s.name))
```

#### `detectAllScales(notes: string[]): any[]`
Detects which scales contain the given notes.

**Parameters:**
- `notes`: Array of note names

**Returns:** Array of matching scales

**Usage:**
```typescript
import { detectAllScales } from 'ollave/lib/graphh'

const scales = detectAllScales(['C', 'E', 'G'])
console.log('Notes fit these scales:', scales)
```

#### `N6(tonic: string, scaleName: string): ChordNameWithNotes[]`
Generates Neapolitan 6th chord for a given scale.

**Parameters:**
- `tonic`: The tonic note
- `scaleName`: The scale name

**Returns:** Array of chord definitions

**Usage:**
```typescript
import { N6 } from 'ollave/lib/graphh'

const neapolitan = N6('C', 'major')
```

#### `V64(tonic: string): ChordNameWithNotes[]`
Generates V64 chord for a given tonic.

**Parameters:**
- `tonic`: The tonic note

**Returns:** Array of chord definitions

**Usage:**
```typescript
import { V64 } from 'ollave/lib/graphh'

const v64 = V64('C')
```

#### `Aug6(tonic: string, scaleName: string): ChordNameWithNotes[]`
Generates augmented 6th chord for a given scale.

**Parameters:**
- `tonic`: The tonic note
- `scaleName`: The scale name

**Returns:** Array of chord definitions

**Usage:**
```typescript
import { Aug6 } from 'ollave/lib/graphh'

const aug6 = Aug6('C', 'major')
```

### Music Playback and Audio (`ollave/lib/music`)

#### `Triad`
Type definition for musical triads: `[note: string, dur: number, timing?: number]`

**Usage:**
```typescript
import { Triad } from 'ollave/lib/music'

const triad: Triad = ['C4', 0.5, 0]
```

#### `RelativeNote`
Type definition for relative notes: `[note: string, rel: number, onOrOff: 'on' | 'off']`

**Usage:**
```typescript
import { RelativeNote } from 'ollave/lib/music'

const note: RelativeNote = ['C4', 0, 'on']
```

#### `samplerState`
Object containing the current state of the audio sampler.

**Properties:**
- `loaded`: Whether the sampler is loaded
- `sampler`: The sampler instance or promise
- `firstLoad`: Whether this is the first load

**Usage:**
```typescript
import { samplerState } from 'ollave/lib/music'

console.log('Sampler loaded:', samplerState.loaded)
```

#### `getSampler(): Promise<{}>`
Initializes and returns the audio sampler.

**Returns:** Promise resolving to the sampler

**Usage:**
```typescript
import { getSampler } from 'ollave/lib/music'

const sampler = await getSampler()
```

#### `playTriads(notes: Triad[]): Promise<Triad[]>`
Plays an array of triads using the audio sampler.

**Parameters:**
- `notes`: Array of triads to play

**Returns:** Promise resolving to the played notes

**Usage:**
```typescript
import { playTriads, Triad } from 'ollave/lib/music'

const triads: Triad[] = [
    ['C4', 0.5, 0],
    ['E4', 0.5, 0],
    ['G4', 0.5, 0]
]

await playTriads(triads)
```

### MIDI File Generation (`ollave/lib/midi`)

#### `saveRaw(bytes: any, name?: string): void`
Saves raw MIDI data as a downloadable file.

**Parameters:**
- `bytes`: Raw MIDI data
- `name`: Optional filename (default: 'sample-2.midi')

**Usage:**
```typescript
import { saveRaw } from 'ollave/lib/midi'

saveRaw(midiBytes, 'my-song.midi')
```

#### `addEvents(track: Midi.Track, events: RelativeNote[]): void`
Adds relative note events to a MIDI track.

**Parameters:**
- `track`: MIDI track to add events to
- `events`: Array of relative note events

**Usage:**
```typescript
import { addEvents, RelativeNote } from 'ollave/lib/midi'

const events: RelativeNote[] = [
    ['C4', 0, 'on'],
    ['C4', 480, 'off']
]

addEvents(track, events)
```

#### `addNoteEvents(track: Midi.Track, notes: Triad[]): void`
Adds triad notes to a MIDI track.

**Parameters:**
- `track`: MIDI track to add notes to
- `notes`: Array of triads

**Usage:**
```typescript
import { addNoteEvents, Triad } from 'ollave/lib/midi'

const notes: Triad[] = [
    ['C4', 0.5, 0],
    ['E4', 0.5, 0.5]
]

addNoteEvents(track, notes)
```

#### `playNotes(notes: Triad[]): Promise<{ played: Triad[] }>`
Plays notes and returns information about what was played.

**Parameters:**
- `notes`: Array of triads to play

**Returns:** Promise resolving to played notes info

**Usage:**
```typescript
import { playNotes, Triad } from 'ollave/lib/midi'

const notes: Triad[] = [
    ['C4', 0.5, 0],
    ['G4', 0.5, 0.5]
]

const result = await playNotes(notes)
console.log('Played notes:', result.played)
```

### Subcommand Parsing (`ollave/lib/subcommands`)

#### `Subcommand`
Type definition for subcommands with match and do functions.

**Usage:**
```typescript
import { Subcommand } from 'ollave/lib/subcommands'

const subcommand: Subcommand = {
    match: (args) => args.command === 'play',
    do: async (args) => { /* implementation */ }
}
```

#### `SubcommandPatterns`
Type definition for collections of subcommands.

**Usage:**
```typescript
import { SubcommandPatterns } from 'ollave/lib/subcommands'

const patterns: SubcommandPatterns = {
    play: { match: ..., do: ... },
    stop: { match: ..., do: ... }
}
```

#### `runSubcommandsOrNull(patterns: SubcommandPatterns, args: ParsedCli): Promise<[string, Subcommand] | null>`
Runs the first matching subcommand from a collection.

**Parameters:**
- `patterns`: Collection of subcommand patterns
- `args`: Parsed command line arguments

**Returns:** Promise resolving to matched subcommand or null

**Usage:**
```typescript
import { runSubcommandsOrNull, SubcommandPatterns } from 'ollave/lib/subcommands'

const patterns: SubcommandPatterns = {
    play: { match: ..., do: ... }
}

const result = await runSubcommandsOrNull(patterns, args)
if (result) {
    const [name, subcommand] = result
    console.log(`Executed subcommand: ${name}`)
}
```

#### `romanChordNameToRealModule`
Module for converting Roman numeral chord names to actual chord names.

**Usage:**
```typescript
import { romanChordNameToRealModule } from 'ollave/lib/subcommands'

// Used internally for chord name conversion
```

### Song Timing Utilities (`ollave/lib/mapSongToTicks`)

#### `mapSongToMidiTicks(): MidiMap`
Maps the current song structure to MIDI ticks.

**Returns:** Object where keys are tick numbers and values are arrays of note objects with properties: `note`, `velocity?`, `duration?`, `compositionTags`

**Usage:**
```typescript
import { mapSongToMidiTicks } from 'ollave/lib/mapSongToTicks'

const midiMap = mapSongToMidiTicks()
// Returns: {
//   0: [{ note: 'C4', velocity: 80, duration: 480, compositionTags: ['verse:0'] }],
//   480: [{ note: 'E4', velocity: 80, duration: 480, compositionTags: ['verse:0'] }],
//   960: [{ note: 'G4', velocity: 80, duration: 480, compositionTags: ['verse:0'] }]
// }
```

#### `barsAtMidi(songTick: number): BarTagPercent[]`
Finds which bars are active at a specific tick position.

**Parameters:**
- `songTick`: The tick position to check

**Returns:** Array of `[barTag, percentage]` tuples, or `[null, 0]` if no bars are active

**Usage:**
```typescript
import { barsAtMidi } from 'ollave/lib/mapSongToTicks'

const bars = barsAtMidi(1000)
// Returns: [['verse:0', 25]] // bar 'verse:0' is 25% complete at tick 1000
```

### Memory Management (`ollave/lib/mem`)

#### `mem(): Mem`
Returns the global memory object containing all song data.

**Returns:** Memory object with song state

**Usage:**
```typescript
import { mem } from 'ollave/lib/mem'

const memory = mem()
console.log('Current phases:', Object.keys(memory.phases))
```

#### `NoteByBar`
Type definition for notes stored by bar.

**Properties:**
- `note`: The note string
- `tags`: Array of tag strings

**Usage:**
```typescript
import { NoteByBar } from 'ollave/lib/mem'

const note: NoteByBar = {
    note: 'C4',
    tags: ['noteId=abc123', 'barDelay=0']
}
```

### Chord Addition (`ollave/lib/addChord`)

#### `DEFAULT_ARP`
Default arpeggio pattern: `['0th','0th','0th','0th','0th', '0th', '0th']`

**Usage:**
```typescript
import { DEFAULT_ARP } from 'ollave/lib/addChord'

const arp = [...DEFAULT_ARP] // Copy default pattern
```

#### `addChord(chordCsvArg: string, phaseName: string, barIndex: number, arp: string[], tags: string[], userScaleTonic?: string, userScaleName?: string, doAddSlider?: boolean): { noteIds: string[], barName: string, commonTags: string[], notes: NoteByBar[] }`
Adds a chord to a specific bar with arpeggiation and tags.

**Parameters:**
- `chordCsvArg`: Chord definition with octave (e.g., 'C,4')
- `phaseName`: Name of the phase
- `barIndex`: Index of the bar
- `arp`: Arpeggio pattern array
- `tags`: Array of tag strings
- `userScaleTonic`: Optional scale tonic
- `userScaleName`: Optional scale name
- `doAddSlider`: Whether to add UI slider (default: false)

**Returns:** Object with note IDs, bar name, common tags, and notes

**Usage:**
```typescript
import { addChord } from 'ollave/lib/addChord'

const result = await addChord(
    'C,4',           // C major chord in octave 4
    'verse',         // Phase name
    0,               // Bar index
    ['0th', '4th', '8th'], // Arpeggio pattern
    ['layer=melody'],      // Tags
    'C',             // Scale tonic
    'major',         // Scale name
    false            // Don't add slider
)

console.log('Added chord with note IDs:', result.noteIds)
```

### Slider Controls (`ollave/lib/addSlider`)

#### `addSlider(barName: string, noteId: string): void`
Adds a UI slider to control the timing of a specific note.

**Parameters:**
- `barName`: The bar containing the note
- `noteId`: The ID of the note to control

**Usage:**
```typescript
import { addSlider } from 'ollave/lib/addSlider'

addSlider('verse:0', 'abc123')
```

#### `updateBarDelay(noteData: NoteByBar, newBarDelay: number): NoteByBar`
Updates the bar delay of a note and refreshes the MIDI map.

**Parameters:**
- `noteData`: The note object to update (modified in place)
- `newBarDelay`: New delay value

**Returns:** The updated note object

**Usage:**
```typescript
import { updateBarDelay } from 'ollave/lib/addSlider'

const updated = updateBarDelay(note, 100)
// Modifies note.tags in place and returns the updated note
```
