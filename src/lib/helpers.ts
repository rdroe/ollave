import { Module, ModuleFn, ModuleHelp } from 'nyargs'

type ModuleHelper = <T = {}, R = null>(name: string, fn: ModuleFn<T, R>, help: ModuleHelp) => Module<Parameters<typeof fn>[0]>


export const makeModule: ModuleHelper = (name, fn, help = { 'description': `Do "${name}" (needs documentation)` }) => {
    type T = Parameters<typeof fn>[0]
    return {
        help,
        fn
    } as Module<T>
}

const fn1: ModuleFn<{ testarg: string }, null> = (args) => null
const m1 = makeModule('typetest', fn1, { description: "do nothing" })
