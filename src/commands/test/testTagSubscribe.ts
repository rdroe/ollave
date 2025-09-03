// exports three modules: one that creates several notes with an extra tag "testTag"
// another module that subscribes to them using the subscribeToNotesByTag store. 
// it logs on an interval to output the subscribed tags.
// the other is a module that allows updating a note, taking a noteId value as the first argument , a tagName as second, and a tagValue as the third to updated it.
// this should change the subscription in the first module. only the subscribed tags should then be logged. 

import { fakeCli } from "peprn/browser"
import { Module } from "peprn/util"
import { mem } from "../../core/mem"
import { createNotesByTagStore } from "../../subscribers/subscribeToNotesByTag"
import { setLatestMap } from "../../core/observables"
import { mapSongToMidiTicks } from "../../lib"
const intervalsByTag: Record<string, ReturnType<typeof setInterval>> = {}
const unsubscribeByTag: Record<string, () => void> = {}


const TEST_BAR_ID = 'testphase:1'
// create notes and subscribe to them; return the note ids (so that they print to the cliOut on the dom.)
export const createTestNotes =  {
    fn: async () => {

        // use fakeCli to call addChord
        const noteIds = await fakeCli(`addChord F,3 --arp half,quarter half,quarter,eighth,128th half,quarter,eighth,64th --barName ${TEST_BAR_ID} --tags testTag=1 x=2 y=3`, 'cli', true)
        // subscribe to the notes
        
        // peprn module "fn" propery to return for printing to the cliOut on the dom.
        return {
            noteIds,
        }
    } 
} as Module

export const subscribeToTags = {
    fn: async ({ positionalNonCommands }) => {
        const [tagName, tagValue] = positionalNonCommands
        // validate the arguments. tagName should be a string, tagValue should be a string or number.
        const tagNameType = typeof tagName
        const tagValueType = typeof tagValue
        if (tagNameType !== 'string' || 
            !['string', 'number'].includes(tagValueType)
        ) {
            console.error({
                tagName, tagValue,
                "tagName type": tagNameType,
                "tagValue type": tagValueType,
            })
            throw new Error(`Invalid arguments: tagName=${tagName}, tagValue=${tagValue}`)
        }
        const tagString = `${tagName}=${tagValue}`
        const { store, unsubscribe } = createNotesByTagStore([tagString])
        if (intervalsByTag[tagString]) {
            clearInterval(intervalsByTag[tagString])
            delete intervalsByTag[tagString]
        }
        if (unsubscribeByTag[tagString]) {
            unsubscribeByTag[tagString]()
            delete unsubscribeByTag[tagString]
        }

        unsubscribeByTag[tagString] = unsubscribe
        // return output (success, etc)
        return {
            success: "apparently so",
        }
    }
} as Module

export const updateNoteTagValue = {
    fn: async ({ positionalNonCommands }) => {
        const [noteId, tagName, tagValue] = positionalNonCommands 
        // validate the arguments. noteId should be a string, tagName should be a string, tagValue should be a string or number.
        const noteIdType = typeof noteId
        const tagNameType = typeof tagName
        const tagValueType = typeof tagValue
        if (noteIdType !== 'string' || tagNameType !== 'string' || !['string', 'number'].includes(tagValueType)) {
            console.error({
                noteId, tagName, tagValue,
                "noteId type": noteIdType,
                "tagName type": tagNameType,
                "tagValueType type": tagValueType,
            })
            throw new Error('Invalid arguments')
        }
        // update the note tag 
        const note = mem().notesByBar[TEST_BAR_ID].find((note) => note.tags.includes(`noteId=${noteId}`)) 
        if (!note) {
            throw new Error('Note not found')
        }
        note.tagsObj[tagName] = [tagValue]
        setLatestMap(mapSongToMidiTicks())
        return {
            success: "apparently so!",
        }
    } 
} as Module  