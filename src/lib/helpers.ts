import { Module, ModuleFn, ModuleHelp } from 'nyargs'

type ModuleHelper = <T = {}, R = null>(name: string, fn: ModuleFn<T, R>, helpArg: string | ModuleHelp) => {
    [nm: string]: Module<Parameters<typeof fn>[0]>
}

export const isString = (arg: any): arg is string => {
    return typeof arg === 'string'
}

export const isStringNumNum = (arr: any[]): arr is [string, number, number] => {
    if (arr.length !== 3) return false
    const [a, b, c] = arr
    return isString(a) && isNum(b) && isNum(c)
}

export const makeModule: ModuleHelper = (name, fn, help = { 'description': `Do "${name}" (needs documentation)`, examples: { "": "(Also needs examples)" } }) => {
    type T = Parameters<typeof fn>[0]
    const module: Module<T> = {
        help: isString(help) ? { description: help } : help,
        fn
    }
    return { [name]: module }
}

export const makeSubmodule = <T = {}, R = {}>(name: string, fn: ModuleFn<T, R>, help?: string | ModuleHelp) => {
    const module = makeModule(name, fn, help)
    return [name, module[name]]
}

const fn1: ModuleFn<{ testarg: string }, null> = (args) => null
const m1 = makeModule('typetest', fn1, "do nothing")


export const passivelyNumberize = (arg: string | number): number | string => {
    if (typeof arg === 'number') return arg
    // @ts-ignore
    const isNumber = !isNaN(arg)
    return isNumber ? parseFloat(arg) : arg
}

export const isNum = (arg: any): arg is number => {
    return typeof arg === 'number'
}

