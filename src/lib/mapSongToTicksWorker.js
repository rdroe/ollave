// Web Worker for mapSongToMidiTicks processing
// This is a JavaScript file that will be loaded as a web worker

// Constants
const ppq = 128 // 128 matches GarageBand's default

const BAR = 'bar'
const HALF = 'half'
const QUARTER = 'quarter'
const EIGHTH = 'eighth'
const SIXTEENTH = 'sixteenth'
const THIRTY_SECOND = 'thirtySecond'
const SIXTY_FOURTH = 'sixtyFourth'
const ONE_TWENTY_EIGHTH = 'oneTwentyEighth'
const ZERO = 'zero'

const tickCounts = {
  [ZERO]: 0,
  [BAR]: ppq * 4, // 128 ppq * 4
  [HALF]: (ppq * 4) / 2, // 128 * 2
  [QUARTER]: (ppq * 4) / 4, // 128
  [EIGHTH]: (ppq * 4) / 8, // 64
  [SIXTEENTH]: (ppq * 4) / 16, // 32
  [THIRTY_SECOND]: (ppq * 4) / 32, // 16
  [SIXTY_FOURTH]: (ppq * 4) / 64, // 8
  [ONE_TWENTY_EIGHTH]: (ppq * 4) / 128, // 4
}

// Utility functions
const strjson = (arg) => JSON.stringify(arg, null, 2)

const peprnIsNum = (arg) => {
  return typeof arg === 'number' || (arg !== '' && !isNaN(Number(arg)))
}

const isCsvArg = (str) => {
  return str.includes(',')
}

const parseCsvArg = (str) => {
  if (!isCsvArg(str)) return [str]

  return str.split(',').map((splitOff) => {
    if (splitOff === 'null') return null
    if (peprnIsNum(splitOff)) return parseFloat(splitOff)
    if (splitOff === 'true') return true
    if (splitOff === 'false') return false
    return splitOff
  })
}

const isFraction = (name) => {
  return (
    name.includes('th') ||
    name.includes('quarter') ||
    name.includes('half') ||
    name.includes('whole')
  )
}

const parseNoteTags = (tags) => {
  const parsedTags = tags.reduce((accum, tag) => {
    if (!tag.includes('=')) {
      return [...accum, [tag, []]]
    }
    const split = tag.split('=')
    let tagDat = []
    if (peprnIsNum(split[1])) {
      tagDat = [parseFloat(split[1])]
    } else if (isCsvArg(split[1])) {
      tagDat = parseCsvArg(split[1])
    } else {
      tagDat = [split[1]]
    }

    return [...accum, [split[0], tagDat]]
  }, [])

  return parsedTags
}

const calcFractionalDelay = (parsedTags) => {
  let newNoteDelay = 0
  parsedTags.forEach(([name, data]) => {
    if (isFraction(name)) {
      const [num] = data
      if (typeof num === 'number') {
        const taggedTickFactor = tickCounts[name]
        newNoteDelay += taggedTickFactor * num
      } else {
        const str = strjson(parsedTags)
        throw new Error(
          `Non-numeric fractional delay ${JSON.stringify(
            num
          )} ; all tag entries: ${str}`
        )
      }
    }
  })
  return newNoteDelay
}

const calcTickDelay = (parsedTags) => {
  let newNoteDelay = 0
  const delay = parsedTags.find(([name]) => {
    return name == 'barDelay'
  })

  if (delay) {
    const [noteCnt] = delay[1]
    if (typeof noteCnt === 'number') {
      newNoteDelay += noteCnt
    } else {
      throw new Error(`Non-numeric eigth note ${JSON.stringify(delay)}`)
    }
  }
  return newNoteDelay
}

const quantizeNote = (parsedTags, rawOffset = 0) => {
  let thisNoteOffset = rawOffset
  thisNoteOffset += calcFractionalDelay(parsedTags) // e.g half, 4th etc
  thisNoteOffset += calcTickDelay(parsedTags) // e.g barDelay=1
  thisNoteOffset = quantizeOffset(thisNoteOffset, parsedTags)
  return thisNoteOffset
}

const quantizeOffset = (rawOffset, parsedTags) => {
  // This is a simplified version - the actual implementation would need to be moved here
  return rawOffset
}

// Worker-specific implementations of functions that depend on mem()
const getAllPhaseBarNotesWorker = (phase, notesByBar) => {
  const sortByNumberAfterColon = (a, b) => {
    const aNumber = parseInt(a.split(':')[1])
    const bNumber = parseInt(b.split(':')[1])
    return aNumber - bNumber
  }

  const getAllPhaseBars = (phase) => {
    if (typeof phase !== 'string') {
      throw new Error(
        `String arg is required in getAllPhaseBars; instead ${JSON.stringify(phase)}`
      )
    }
    const lookedUp = Object.keys(notesByBar)
      .filter((barTag) => barTag.startsWith(`${phase}:`))
      .sort(sortByNumberAfterColon)
    return lookedUp
  }

  const barNames = getAllPhaseBars(phase)
  const myNoteGroups = barNames.map((barName) => notesByBar[barName])
  return myNoteGroups
}

const getFollowingPhasesWorker = (phaseName, phases) => {
  const phase = phases[phaseName]
  const followsPhases = Object.entries(phases).filter(
    ([, { 'follows-ids': followsIds }]) =>
      (phase.id !== null && followsIds.includes(phase.id)) ||
      (phase.id !== null && followsIds.includes(phase['id']))
  )

  return followsPhases
}

// Main processing function
function mapPhaseTicks(
  phaseName,
  phase,
  startTick,
  collector = [],
  phases,
  notesByBar
) {
  const barTickFactor = tickCounts.bar

  // get the bar-sorted bar notes
  const phaseBars = getAllPhaseBarNotesWorker(phaseName, notesByBar)
  // initialize the midi map where we will put each note on a numeric midi property
  const phaseMidi = {}
  // for each bar, use the bar semantic "tags" property to determine which notes to play on that midi tick.
  phaseBars.forEach((barNotes, barIndex) => {
    // loop (not just multiplying by index) because later bars may have a different bar size multiplier each
    const thisBarOffset =
      barIndex *
      barTickFactor *
      (typeof phase?.barSizeMultiplier === 'number'
        ? phase.barSizeMultiplier
        : 1)
    // INTERPRETING INDIVIDUAL NOTES TO REAL TIMING
    barNotes.forEach((note) => {
      const parsedTags = parseNoteTags(note.tags)
      const thisNoteTick = quantizeNote(parsedTags) + startTick + thisBarOffset
      if (!phaseMidi[thisNoteTick]) {
        phaseMidi[thisNoteTick] = []
      }

      phaseMidi[thisNoteTick].push({
        note: note.note,
        compositionTags: note.tags,
      })
    })
  })
  collector.push(phaseMidi)
  const followsPhases = getFollowingPhasesWorker(phaseName, phases)

  followsPhases.forEach(([followsPhaseName, followsPhase]) => {
    mapPhaseTicks(
      followsPhaseName,
      followsPhase,
      phaseBars.length * barTickFactor,
      collector,
      phases,
      notesByBar
    )
  })

  return collector
}

// Main worker function
function mapSongToMidiTicksWorker(phases, notesByBar) {
  const firstPhases = Object.entries(phases).filter(([_, phase]) => {
    return phase['follows-ids'].length === 0
  })

  const collector = []
  firstPhases.forEach(([phaseName, phase]) => {
    mapPhaseTicks(phaseName, phase, 0, collector, phases, notesByBar)
  })

  // phase-level massaging here.
  const midiMap = collector.reduce((acc, curr) => {
    Object.entries(curr).forEach(([tickRaw, notes]) => {
      const tick = parseInt(tickRaw)
      if (!acc[tick]) {
        acc[tick] = []
      }
      acc[tick].push(...notes)
    })
    return acc
  }, {})

  return midiMap
}

// Worker message handler
self.onmessage = function (e) {
  const { type, data } = e.data

  if (type === 'MAP_SONG_TO_MIDI_TICKS') {
    try {
      const result = mapSongToMidiTicksWorker(data.phases, data.notesByBar)

      const response = {
        type: 'MAP_SONG_TO_MIDI_TICKS_RESULT',
        data: result,
      }

      self.postMessage(response)
    } catch (error) {
      self.postMessage({
        type: 'ERROR',
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
    }
  }
}
