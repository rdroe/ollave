import { Module } from 'peprn/util'
import z from 'zod'

import { mem } from '../../core/mem'
import { midiAtBarUtil } from '../../lib/mapSongToTicks'
import { getNoteByBar } from '../../lib/util/notesUtil'

export const lengthenBar: Module = {
  help: {
    description: 'Lengthen a bar',
  },
  fn: lengthenBarFn,
}

export async function lengthenBarFn(...args: Parameters<Module['fn']>) {
  const { noteIds: noteIdsArg, amount: amountArg } = args[0]

  const { noteIds, amount } = z
    .object({
      noteIds: z.array(z.string()),
      amount: z.number(),
    })
    .parse({
      noteIds: noteIdsArg,
      amount: amountArg,
    })
  const note = getNoteByBar(mem, noteIds[0])
  const bar = z.string().parse(note.tagsObj.barId[0])
  if (!bar) {
    throw new Error(`bar note found for note ${noteIds[0]}`)
  }
  const midiAtBar = midiAtBarUtil(mem())(bar, 100)
  const midiStart = midiAtBarUtil(mem())(bar, 0)
  const barLength = midiAtBar - midiStart
  const notesByBar = mem().notesByBar[bar]
  notesByBar.forEach((note) => {
    const sliderMax = barLength * amount - 1
    note.tagsObj.sliderMax = [sliderMax]
    const duration = z.number().parse(note.tagsObj.duration?.[0] || 128)
    const barDelay = z.number().parse(note.tagsObj.barDelay?.[0] || 0)
    const newDuration =
      barDelay + duration <= sliderMax
        ? barDelay + duration
        : sliderMax - barDelay
    note.tagsObj.duration = [newDuration]
    note.tagsObj.sliderMax = [sliderMax]
  })
}
