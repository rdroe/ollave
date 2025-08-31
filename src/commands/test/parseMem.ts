import { mem, memSchema } from "src/lib/mem"

export const parseMem = {
    fn: async () => {
        const parsedMem = memSchema.parse(mem())
        return parsedMem
    }
}