import { createLaneElementsStore } from './createLaneElementsStore'
import { convertAlphadex, numberToAlphadex } from '../alphadex'
import { cacheLaneElementYCoords } from './laneElements'


type LaneHeightScenarioPreCalculation = {
  elementsRange: [startX: number, endX: number]
  height: null
}

type LaneHeightScenarioPostCalculation = {
  elementsRange: [startX: number, endX: number]
  lanesDims: {
    id: string
    height: number
    top: number
  }[]
}

const laneScenearioElementsStore = createLaneElementsStore(
  [
    // Audio Track - 84 elements (7x12) - Scattered with some dense areas
    ...Array.from({ length: 84 }, (_, i) => ({
      laneId: 'audio' as const,
      elementId: `audio${i + 1}`,
      xInput: numberToAlphadex(Math.floor(Math.random() * 4800) + 50),
      x: null,
      y: null,
      width: Math.floor(Math.random() * 120) + 40, // 40-160 width
      height: 30,
    })),

    // Video Track - 72 elements (6x12) - Larger elements, some bottlenecks
    ...Array.from({ length: 72 }, (_, i) => ({
      laneId: 'video' as const,
      elementId: `video${i + 1}`,
      xInput: numberToAlphadex(Math.floor(Math.random() * 4800) + 50),
      x: null,
      y: null,
      width: Math.floor(Math.random() * 200) + 80, // 80-280 width
      height: 40,
    })),

    // Effects Track - 180 elements (15x12) - Very dense overlapping
    ...Array.from({ length: 180 }, (_, i) => ({
      laneId: 'effects' as const,
      elementId: `fx${i + 1}`,
      xInput: numberToAlphadex(Math.floor(Math.random() * 4800) + 50),
      x: null,
      y: null,
      width: Math.floor(Math.random() * 80) + 20, // 20-100 width
      height: 25,
    })),

    // Subtitles Track - 96 elements (8x12) - Small elements, scattered
    ...Array.from({ length: 96 }, (_, i) => ({
      laneId: 'subtitles' as const,
      elementId: `sub${i + 1}`,
      xInput: numberToAlphadex(Math.floor(Math.random() * 4800) + 50),
      x: null,
      y: null,
      width: Math.floor(Math.random() * 100) + 30, // 30-130 width
      height: 20,
    })),

    // Music Track - 60 elements (5x12) - Medium density
    ...Array.from({ length: 60 }, (_, i) => ({
      laneId: 'music' as const,
      elementId: `music${i + 1}`,
      xInput: numberToAlphadex(Math.floor(Math.random() * 4800) + 50),
      x: null,
      y: null,
      width: Math.floor(Math.random() * 150) + 60, // 60-210 width
      height: 35,
    })),

    // Voice Track - 48 elements (4x12) - Lower density, some bottlenecks
    ...Array.from({ length: 48 }, (_, i) => ({
      laneId: 'voice' as const,
      elementId: `voice${i + 1}`,
      xInput: numberToAlphadex(Math.floor(Math.random() * 4800) + 50),
      x: null,
      y: null,
      width: Math.floor(Math.random() * 120) + 50, // 50-170 width
      height: 25,
    })),

    // Graphics Track - 36 elements (3x12) - Very sparse, bottleneck areas
    ...Array.from({ length: 36 }, (_, i) => ({
      laneId: 'graphics' as const,
      elementId: `graphics${i + 1}`,
      xInput: numberToAlphadex(Math.floor(Math.random() * 4800) + 50),
      x: null,
      y: null,
      width: Math.floor(Math.random() * 100) + 40, // 40-140 width
      height: 30,
    })),

    // Transitions Track - 24 elements (2x12) - Minimal overlap, bottleneck pattern
    ...Array.from({ length: 24 }, (_, i) => ({
      laneId: 'transitions' as const,
      elementId: `trans${i + 1}`,
      xInput: numberToAlphadex(Math.floor(Math.random() * 4800) + 50),
      x: null,
      y: null,
      width: Math.floor(Math.random() * 60) + 20, // 20-80 width
      height: 20,
    })),

    // Add some strategic bottleneck areas with single elements
    // Bottleneck 1: Around x=1000 - Single element in each lane
    {
      laneId: 'audio',
      elementId: 'audio_bottleneck1',
      xInput: numberToAlphadex(1000),
      x: null,
      y: null,
      width: 50,
      height: 30,
    },
    {
      laneId: 'video',
      elementId: 'video_bottleneck1',
      xInput: numberToAlphadex(1000),
      x: null,
      y: null,
      width: 50,
      height: 40,
    },
    {
      laneId: 'effects',
      elementId: 'fx_bottleneck1',
      xInput: numberToAlphadex(1000),
      x: null,
      y: null,
      width: 50,
      height: 25,
    },
    {
      laneId: 'subtitles',
      elementId: 'sub_bottleneck1',
      xInput: numberToAlphadex(1000),
      x: null,
      y: null,
      width: 50,
      height: 20,
    },
    {
      laneId: 'music',
      elementId: 'music_bottleneck1',
      xInput: numberToAlphadex(1000),
      x: null,
      y: null,
      width: 50,
      height: 35,
    },
    {
      laneId: 'voice',
      elementId: 'voice_bottleneck1',
      xInput: numberToAlphadex(1000),
      x: null,
      y: null,
      width: 50,
      height: 25,
    },
    {
      laneId: 'graphics',
      elementId: 'graphics_bottleneck1',
      xInput: numberToAlphadex(1000),
      x: null,
      y: null,
      width: 50,
      height: 30,
    },
    {
      laneId: 'transitions',
      elementId: 'trans_bottleneck1',
      xInput: numberToAlphadex(1000),
      x: null,
      y: null,
      width: 50,
      height: 20,
    },

    // Bottleneck 2: Around x=2500 - Single element in each lane
    {
      laneId: 'audio',
      elementId: 'audio_bottleneck2',
      xInput: numberToAlphadex(2500),
      x: null,
      y: null,
      width: 50,
      height: 30,
    },
    {
      laneId: 'video',
      elementId: 'video_bottleneck2',
      xInput: numberToAlphadex(2500),
      x: null,
      y: null,
      width: 50,
      height: 40,
    },
    {
      laneId: 'effects',
      elementId: 'fx_bottleneck2',
      xInput: numberToAlphadex(2500),
      x: null,
      y: null,
      width: 50,
      height: 25,
    },
    {
      laneId: 'subtitles',
      elementId: 'sub_bottleneck2',
      xInput: numberToAlphadex(2500),
      x: null,
      y: null,
      width: 50,
      height: 20,
    },
    {
      laneId: 'music',
      elementId: 'music_bottleneck2',
      xInput: numberToAlphadex(2500),
      x: null,
      y: null,
      width: 50,
      height: 35,
    },
    {
      laneId: 'voice',
      elementId: 'voice_bottleneck2',
      xInput: numberToAlphadex(2500),
      x: null,
      y: null,
      width: 50,
      height: 25,
    },
    {
      laneId: 'graphics',
      elementId: 'graphics_bottleneck2',
      xInput: numberToAlphadex(2500),
      x: null,
      y: null,
      width: 50,
      height: 30,
    },
    {
      laneId: 'transitions',
      elementId: 'trans_bottleneck2',
      xInput: numberToAlphadex(2500),
      x: null,
      y: null,
      width: 50,
      height: 20,
    },

    // Bottleneck 3: Around x=4000 - Single element in each lane
    {
      laneId: 'audio',
      elementId: 'audio_bottleneck3',
      xInput: numberToAlphadex(4000),
      x: null,
      y: null,
      width: 50,
      height: 30,
    },
    {
      laneId: 'video',
      elementId: 'video_bottleneck3',
      xInput: numberToAlphadex(4000),
      x: null,
      y: null,
      width: 50,
      height: 40,
    },
    {
      laneId: 'effects',
      elementId: 'fx_bottleneck3',
      xInput: numberToAlphadex(4000),
      x: null,
      y: null,
      width: 50,
      height: 25,
    },
    {
      laneId: 'subtitles',
      elementId: 'sub_bottleneck3',
      xInput: numberToAlphadex(4000),
      x: null,
      y: null,
      width: 50,
      height: 20,
    },
    {
      laneId: 'music',
      elementId: 'music_bottleneck3',
      xInput: numberToAlphadex(4000),
      x: null,
      y: null,
      width: 50,
      height: 35,
    },
    {
      laneId: 'voice',
      elementId: 'voice_bottleneck3',
      xInput: numberToAlphadex(4000),
      x: null,
      y: null,
      width: 50,
      height: 25,
    },
    {
      laneId: 'graphics',
      elementId: 'graphics_bottleneck3',
      xInput: numberToAlphadex(4000),
      x: null,
      y: null,
      width: 50,
      height: 30,
    },
    {
      laneId: 'transitions',
      elementId: 'trans_bottleneck3',
      xInput: numberToAlphadex(4000),
      x: null,
      y: null,
      width: 50,
      height: 20,
    },
  ],
  {
    inputToNumber: convertAlphadex,
    numberToInput: numberToAlphadex,
  }
)

// this function imports utilities from useLaneElements to cache the lane heights at a scenario
const cacheLaneHeightsAtScenarios = (
  scenarios: LaneHeightScenarioPreCalculation[],
  elementsStore: typeof laneScenearioElementsStore
): LaneHeightScenarioPostCalculation[] => {
  return scenarios.map((scenario) => {
    // Get all unique lane IDs from the elements store
    const allElements = elementsStore.getState().laneElements
    const uniqueLaneIds = [...new Set(allElements.map((elem) => elem.laneId))]

    // Calculate lane dimensions for each lane in this scenario
    const lanesDims = uniqueLaneIds.map((laneId) => {
      // Get elements for this lane that overlap with the scenario range
      const laneElements = cacheLaneElementYCoords(
        laneId,
        elementsStore,
        scenario.elementsRange
      )

      // Calculate the maximum Y coordinate + height to get total height needed
      const maxY = Math.max(
        ...laneElements.map((elem) => elem.y + elem.height),
        0
      )

      return {
        id: laneId,
        height: maxY,
        top: 0, // Will be calculated below
      }
    })

    // Calculate cumulative top positions
    let cumulativeTop = 0
    const lanesDimsWithTops = lanesDims.map((lane) => {
      const laneWithTop = { ...lane, top: cumulativeTop }
      cumulativeTop += lane.height
      return laneWithTop
    })

    return {
      elementsRange: scenario.elementsRange,
      lanesDims: lanesDimsWithTops,
    }
  })
}

// this function returns a function that can be used to get the placement of an element in a lane.
// it makes use of the cacheLaneHeightsAtScenario function to get the lane heights at a scenario
export const getLanePlacementFn = (
  scenarios: LaneHeightScenarioPreCalculation[],
  elementsStore: typeof laneScenearioElementsStore
) => {
  const lanesAtScenarios = cacheLaneHeightsAtScenarios(scenarios, elementsStore)

  return (
    laneId: string,
    scenario: LaneHeightScenarioPreCalculation
  ): LaneHeightScenarioPostCalculation['lanesDims'][number] | null => {
    // Find the matching scenario
    const matchingScenario = lanesAtScenarios.find(
      (s) =>
        s.elementsRange[0] === scenario.elementsRange[0] &&
        s.elementsRange[1] === scenario.elementsRange[1]
    )

    if (!matchingScenario) {
      return null
    }

    // Find the lane within that scenario
    const lane = matchingScenario.lanesDims.find((l) => l.id === laneId)

    return lane || null
  }
}

// Export the store and functions for testing
export { laneScenearioElementsStore, cacheLaneHeightsAtScenarios }
