import { ParsedCli, Module } from "peprn/util"
import { z } from "zod"
import { romanChordNameToReal  } from "./graphh"
export type Subcommand = {
    match: (args: ParsedCli) => boolean,
    do: Module["fn"]
}

export type SubcommandPatterns = {
    [name: string]: Subcommand
}

export const runSubcommandsOrNull = async (subcommandPatterns: SubcommandPatterns, args: ParsedCli) => {
    const matched = Object.entries(subcommandPatterns).find(([name, scp]: [name: string, scp: Subcommand]) => {
        if (scp.match(args)) {
            return true
        }
    })

    if (matched) {
        //try {
        await matched[1].do(args)
        return [matched]
        //} catch (e) {
        //return [e.message, e.stack]
        //}
    }
    return null
}

export const  romanChordNameToRealModule = {
    fn: async ({ positionalNonCommands }) => {
        const [scaleTonic, scaleName, romanName] = positionalNonCommands
        const romanName_ = z.string().parse(romanName)
        const scaleTonic_ = z.string().parse(scaleTonic)
        const scaleName_ = z.string().parse(scaleName)
        return romanChordNameToReal(scaleTonic_, scaleName_, romanName_ )
    }
} as Module