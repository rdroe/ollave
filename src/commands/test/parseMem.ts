import { mem, memSchema } from "src/lib/schemas"

export const parseMem = {
    fn: async () => {
        const parsedMem = memSchema.parse(mem())
        return parsedMem
    }
}