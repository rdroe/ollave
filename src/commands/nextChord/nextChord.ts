import { Module } from "peprn/util"
import z from "zod"
import { nextChord as nextChordFn } from "../../lib/nextChord"
import { romanize as romanizeFn } from "../../lib/romanize"
import { romans as romansFn } from "../../lib/romans"

export const nextChord = {
    fn: async ({positionalNonCommands}) => {
        
                const [chordCsvArg, userTonic, userScale] = z.tuple([
                    z.string(),
                    z.string(),
                    z.string(),
                ]).parse(positionalNonCommands)
            
                const next = nextChordFn(
                    chordCsvArg, userTonic, userScale
                )
                return next
            }
        } as Module

export const romanize = {
    fn: async ({positionalNonCommands}) => {
        const [chordCsvArg, userTonic, userScale] = z.tuple([
            z.string(),
            z.string(),
            z.string(),
        ]).parse(positionalNonCommands)

        const roman = romanizeFn(chordCsvArg, userTonic, userScale)
        return roman
    }
    } as Module

export const romans: Module = {
    // just return all romans for a given scale by peeling the keys from the graph
    fn: async ({positionalNonCommands}) => {
        const [userTonic, userScale] = z.tuple([
            z.string(),
            z.string(),
        ]).parse(positionalNonCommands)

        return romansFn(userTonic, userScale)
    }
} as Module