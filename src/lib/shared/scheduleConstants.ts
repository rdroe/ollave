// Bar length in ticks at ollave's ppq=128 (4 beats * 128).
//
// Its own module because phaseSchedule.ts is imported by the worker bundle,
// and util/constantsUtil.ts drags in browser-only siblings through its
// neighbours. Mirrors tickCounts.bar and barTemplates' BASE_BAR_TICKS.
export const BASE_BAR_TICKS = 512
