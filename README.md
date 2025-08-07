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
- Tick resolution: 480 ticks per quarter note
- Supports fractional timing and delays
- Real-time tick emission for live playback

### Tags
Notes use a rich tagging system:
- `chord=Cmaj` - Chord identification
- `scaleTonic=C` - Scale root note
- `scaleName=major` - Scale type
- `delay=0.5` - Timing offset
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