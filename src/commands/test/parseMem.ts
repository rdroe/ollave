import { memSchema } from "src/lib/schemas"
import { mem } from "src/lib/mem"

export const parseMem = {
    fn: async () => {
        const parsedMem = memSchema.parse(mem())
        return parsedMem
    }
}