
import { airSpeed, exportableTick, parseAirSpeed, setAirSpeed, tempoFromAirSpeed } from "../commands/phase/observables/masterTicksObservable"
import { mem } from "./mem"

/**
 * Given a note id, add a slider to move the note to a new time within the bar
 * controls-1 is the div that will contain the slider
 * 
 */
export function addTempoSlider (selector: string = '.controls-1') {
    const controls = document.querySelector(selector)
    if (!controls) {
        throw new Error('selector not found: ' + selector)
    }
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = '12'
    slider.max = `400`

    slider.value = (airSpeed() * 100).toString()
    let setTimeoutId: NodeJS.Timeout | null = null
    
    slider.oninput = (ev) => {
        const newAirSpeed = parseAirSpeed((ev.target as HTMLInputElement).value)
        if (setTimeoutId) {
            clearTimeout(setTimeoutId)
        }
        setTimeoutId = setTimeout(() => {
            const currTick = exportableTick()
            const newTempo = tempoFromAirSpeed(newAirSpeed)
            setAirSpeed(newAirSpeed)
            mem().playedMap[currTick] = mem().playedMap[currTick] || []
            mem().playedMap[currTick].push({
                note: `tempo: ${newTempo}`,
                compositionTags: []
            })
        }, 50)
    }
    controls.appendChild(slider)
}
