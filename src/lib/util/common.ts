export const strjson = (arg: any) => JSON.stringify(arg, null, 2)

export const isString = (arg: any): arg is string => {
    return typeof arg === 'string'
}

export const peprnIsNum = (arg: string | number) => {
    return typeof arg === 'number' || arg !== "" && !isNaN(Number(arg))
}

function randomString(length: number) {
    const chars = '0123456789abcdef'
    var result = '';
    for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

export const randId = (prefix = "", length = 10) => {
    let randStr = randomString(length);
    if (prefix) {
        return `${prefix}.${randStr}`
    }
    while (typeof randStr === 'number' || !isNaN(Number(randStr))) {
        randStr = randomString(length);
    }
    return `${randStr}`
}

export const isCsvArg = (str: string): str is string => {
    return str.includes(',')
}

export const parseCsvArg = (str: string): (string | number | boolean | null)[] => {
    if (!isCsvArg(str)) return [str]

    return str.split(',').map((splitOff) => {
        if (splitOff === 'null') return null
        if (peprnIsNum(splitOff)) return parseFloat(splitOff)
        if (splitOff === 'true') return true
        if (splitOff === 'false') return false
        return splitOff
    })
}
