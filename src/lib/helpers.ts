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


export const passivelyNumberize = (arg: string | number): number | string => {
    if (typeof arg === 'number') return arg
    // @ts-ignore
    const isNumber = !isNaN(arg)
    return isNumber ? parseFloat(arg) : arg
}

export const isNum = (arg: any): arg is number => {
    return typeof arg === 'number'
}

export const isString = (arg: any): arg is string => {
    return typeof arg === 'string'
}

export const isNumStringNum = (arr: any[]): arr is [string, number, number] => {
    if (arr.length !== 3) return false
    const [a, b, c] = arr
    return isString(a) && isNum(b) && isNum(c)
}
