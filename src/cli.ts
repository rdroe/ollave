import { apps, createApp } from 'peprn/browser'
import play from './commands/play/play'
import phase from './commands/phase/phase'
import song, {init as songInit} from './commands/song/song'
import bars from './commands/bars/bars'
import bar from './commands/bar/bar'
import debug from './commands/debug/debug'
import notes from './commands/notes/notes'
import { chord } from './commands/chord/chord'
import { strjson } from './lib/helpers'
import { PEPRN_MULTILINE, PEPRN_MULTILINE_INDEX, PEPRN_MULTILINE_TOTAL } from 'peprn/util'

import { addChord } from './commands/index'
import addNote from './commands/addNote/addNote'
import { romanChordNameToRealModule } from './lib/subcommands'

export const app: Parameters<typeof createApp>[0] = {
    id: "cli",
    init: () => {
        return songInit()
    },
    modules: {
        chord, play, phase, song, bars, bar, debug, notes,
        addNote,
        addChord,
        romanChordNameToReal: romanChordNameToRealModule,
    },
    catch: (e) => {
        console.error('error', e)
    },
    dataHandler: async (parsedCliRaw, data, id) => {
        const parsedCli = JSON.parse(JSON.stringify(parsedCliRaw))
        const rawIn = parsedCli.rawIn
        const dataContainer = apps[id].dataEl
        let didPrint: boolean = false
        const ancDepth = parsedCli['peprn:ancestralDepth']
        const isMultiline = parsedCli[PEPRN_MULTILINE]
        const multilineTot = parsedCli[PEPRN_MULTILINE_TOTAL]
        const multilineIndex = parsedCli[PEPRN_MULTILINE_INDEX]
        const isFinalLine = !isMultiline ||
            (
                typeof multilineTot === 'number' && typeof multilineIndex === 'number'
                && multilineTot === multilineIndex + 1
            )

        if (!dataContainer) {
            console.error('could not find output region for peprn commands')
        }

        let doPrint = false

        if (isMultiline) {
            doPrint = isFinalLine && ancDepth === 0
        } else {
            doPrint = parsedCli['peprn:childmost'] === true && !parsedCli['peprn:automated']
        }

        // this condition usually gets what the user typed as the last command 
        if (
            doPrint
        ) {
            // console.log('printing for ', {
            //     rawIn,
            //     parsed: JSON.parse(strjson(
            //         parsedCli
            //     )),
            //     data
            // })
            const printable = data?.formatted ?? data
            dataContainer.innerHTML = `${rawIn}\n${JSON.stringify(printable, null, 2)} 
${dataContainer.innerHTML}
`
            didPrint = true
            // if they created a program
            if (data?.formatted?.aaChordProgram) {
                const program = document.querySelector('.program')
                if (program) {

                    (program as HTMLTextAreaElement).value = data.formatted.aaChordProgram
                }
            }
        }
        if (!didPrint && parsedCli.rawIn.split(' ').includes('--man')) {
            dataContainer.innerHTML = `${rawIn}\n${strjson(data)} 
${dataContainer.innerHTML}`
        }
        if (!didPrint) {
            console.warn('unprinted:', { parsedCli, data })
        }
    }
} as const
