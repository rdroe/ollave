import { TagEntries } from '../schemaTypes'
import { calcFractionalDelay, calcTickDelay } from './tagsUtil'

export const quantizeNote = (parsedTags: TagEntries, rawOffset: number = 0) => {
    let thisNoteOffset = rawOffset
    thisNoteOffset += calcFractionalDelay(parsedTags) // e.g half, 4th etc
    thisNoteOffset += calcTickDelay(parsedTags)// e.g barDelay=1
    thisNoteOffset = quantizeOffset(thisNoteOffset, parsedTags)
    return thisNoteOffset
}

export const quantizeOffset = (rawOffset: number, parsedTags: TagEntries) => {
    // This is a simplified version - the actual implementation would need to be moved here
    return rawOffset
}
