import { TagData, TagEntry, TagEntries } from '../schemaTypes'

import { peprnIsNum, isCsvArg, parseCsvArg } from './common'

// Re-export types for backward compatibility
export type { TagData, TagEntry, TagEntries }

/**
 * Input is eg ['x=1', 'y=2', 'z=3,4']
 * @param tags
 * @returns
 */
export const parseNoteTags = (tags: string[]): TagEntries => {
  const parsedTags = tags.reduce((accum, tag) => {
    if (!tag.includes('=')) {
      return [...accum, [tag, []] as [nm: string, data: TagData]]
    }
    const split = tag.split('=')
    if (split[0] === 'noteId') {
      console.log('noteId', split[1])
    }

    let tagDat: TagData = []
    if (peprnIsNum(split[1])) {
      tagDat = [parseFloat(split[1])]
    } else if (isCsvArg(split[1])) {
      tagDat = parseCsvArg(split[1])
    } else {
      tagDat = [split[1]]
    }

    if (split[0] === 'noteId') {
      console.log('noteId out', tagDat)
    }
    return [...accum, [split[0], tagDat]] as TagEntries
  }, [] as TagEntries)

  return parsedTags
}
