# Ollave - CLI-Style Music Production Framework

Ollave is a browser-based CLI-style music production framework that enables real-time music composition and playback through a command-line interface. Built with TypeScript, RxJS, and Tone.js, it provides a unique approach to music creation with phase-based composition and real-time audio synthesis.

## 🎵 Features

- **CLI Interface**: Command-line style interface running in the browser
- **Real-time Audio**: Live music playback using Tone.js and piano samples
- **Phase-based Composition**: Organize music into phases with following relationships
- **MIDI Integration**: Full MIDI tick-based timing system
- **Chord and Scale Support**: Built-in chord progression and scale functionality
- **Export Capabilities**: Download compositions as MIDI files
- **Visual Feedback**: Real-time display of played notes and timing

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
- Manages timing relationships between phases
- Handles bar and beat subdivisions

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

# Download the song as MIDI file
song dl
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

### Timing System
The timing system supports multiple levels of precision:
- **Bar-level timing**: `barDelay=120` (tick offset within bar)
- **Fractional timing**: `8th=1`, `16th=2` (musical note divisions)
- **Delay patterns**: `8th,4th half 4th,16th` (complex timing matrices)
- **Arpeggiation**: Automatic note spacing for chord voicings

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