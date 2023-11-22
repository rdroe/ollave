
import { Chord, Note, Scale, Progression, Collection } from "tonal"

// for an array entry in translated values, find the key (the property at which it is stored)


export function untranslate(tonalName: string) {

    const xyz = {
        "iii": ["IIIm", "bIIIm"],
        "iv": ["IVm"],
        "iio": ["IImdim"],
        "i": ["Im"],
        "viio": ["VIImdim"],
        "vi": ["VIm"],
        "I": ["I", "bI"],
        "II": ["II", "bII"],
        "III": ["bIII", "III"],
        "viio/IV": ["VIImdim/IV"],
        "viio/VII": ["VIImdim/VII"],
        "viio/III": ["VIImdim/III"],
        "viio/vi": ["VIImdim/VIm"],
        "viio/V": ["VIImdim/V"],
        "V7/vi": ["V7/VIm"],
        "V/V": ["V"],

    }
    let keyToReturn: string | null = null
    for (const k in xyz) {
        if (xyz[k as keyof typeof xyz].includes(tonalName)) {
            keyToReturn = k
        }
    }

    /*
    const xyz = Object.entries(translation).find(([abc]) => {
        const traArray = translation[abc as keyof typeof translation]
        return traArray && traArray.includes(tonalName)
    })
*/
    //  return xyz && xyz[0] ? xyz[0] : null
    //    const xyzRet = xyz && xyz[0] ? xyz[0] : null
    //    return xyzRet
    return keyToReturn
}
