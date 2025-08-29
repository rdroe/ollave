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

import { addChord, subscribeToPhaseBarIds } from './commands/index'
import addNote from './commands/addNote/addNote'
import { romanChordNameToRealModule } from './lib/subcommands'
import { tempo } from './commands/tempo/tempo'
import { nextChord } from './lib/nextChord'
import { z } from 'zod'
import { mem } from './lib/mem'
import { subscribeToNoteIdsByBar } from './commands/notes/subscribers/subscribeToNoteIdsByBar'

export const app: Parameters<typeof createApp>[0] = {
    id: "cli",
    init: async () => {
        await songInit()

        // test the phase bar ids observable
        const songName = mem().song.name
        const { store, subscribe } = subscribeToPhaseBarIds()
        type BarNoteUnsubscribes = {
            [barId: string]: ReturnType<typeof subscribe>
        } 
        const phaseBarNoteIds: {
            [phaseName: string]: BarNoteUnsubscribes
        } = {}

        mem().observables[songName] = mem().observables[songName] || {}
        subscribe({
            next: (phaseBarIds) => {

                phaseBarNoteIds[songName] = phaseBarNoteIds[songName] || {} as BarNoteUnsubscribes
                const phaseNoteUnsubscribes = phaseBarNoteIds[songName]

                Object.entries(phaseBarIds).forEach(([phaseName, phaseBarIds]) => {
                    const barNoteUnsubscribes = (phaseNoteUnsubscribes[phaseName] || {} )as BarNoteUnsubscribes   
                        
                    phaseBarIds.forEach((barId) => {
                        if (!!barNoteUnsubscribes[barId]) {
                            return
                        }
                        const { store: barIdStore, subscribe: barNoteSubscribe } = subscribeToNoteIdsByBar(barId) 
                            barNoteUnsubscribes[barId] = barNoteSubscribe(
                                {
                                    next: (barNoteIds) => {
                                        if (barNoteIds.length === 0) {
                                            barNoteUnsubscribes[barId]?.()
                                            delete barNoteUnsubscribes[barId]
                                            return
                                        }
                                    },
                                    error: (err) => {
                                        console.error('error', err)
                                    },
                                    complete: () => {
                                    }
                                }
                            )
                        })
                    })
            },
            error: (err) => {
                console.error('error', err)
            },
            complete: () => {
                console.log('phase bar ids complete')
            }
        })
    },
    modules: {
        chord, play, phase, song, bars, bar, debug, notes,
        tempo,
        addNote,
        addChord,
        romanChordNameToReal: romanChordNameToRealModule,
        nextChord: {
            fn: async ({positionalNonCommands}) => {
                const [chordCsvArg, userTonic, userScale] = z.tuple([
                    z.string(),
                    z.string(),
                    z.string(),
                ]).parse(positionalNonCommands)
            
                const next = nextChord(
                    chordCsvArg, userTonic, userScale
                )
                return next
            }
        },
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
