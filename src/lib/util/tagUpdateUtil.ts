import { NoteByBar } from "../schemas"

export const updateNoteTag = (note: NoteByBar, tag: string, data: (number | string | boolean | null)[]) => {
    const tagIdx = note.tags.findIndex(([k]) => k === tag)
    const updated = `${tag}=${data.join(',')}`
    if (tagIdx === -1) {
        note.tags.push(updated)
    } else {
        note.tags[tagIdx] = `${tag}=${data.join(',')}`
    }
}
