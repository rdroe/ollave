import { Mem } from './types'

export type { Mem }

type NoteByBarInner = {
  // clone
  note: string
  _tags: string[]
  tagsObj: {
    [key: string]: (string | number | boolean)[] // clone of TagData
  }
  set tags(tags: string[])
  get tags(): string[]
}

type NoteByBar = Omit<NoteByBarInner, '_tags' | 'clone'> & {
  // clone of NoteByBar
  tags: string[]
}

const mem_: Mem = {
  subscriptions: {},
  songPauses: {},
  functions: {},
  observables: {},
  song: null,
  tracks: [],
  phases: {},
  notesByBar: {} as Record<string, NoteByBar[]>,
  latestPhaseAndBarStartAndEndTicks: {
    phases: {},
    bars: {},
  },
  songNames: [],
  latestMap: {},
  playedMap: {},
  graphs: {},
  played: [],
  adjustedCursor: 0,
  doLog: true,
}
declare global {
  interface Window {
    mem__: Mem
  }
}
window.mem__ = mem_
export const mem: () => Mem = () => window.mem__

export const getNoteById = (noteId: string) => {
  const note = Object.values(mem().notesByBar)
    .flat()
    .find((note) => note.tagsObj.noteId?.[0] === noteId)
  if (!note) {
    return null
  }
  return note
}
