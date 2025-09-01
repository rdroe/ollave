import { memSchema } from "src/lib/schemas"
import { mem } from "src/core/mem"

export const parseMem = {
    fn: async () => {
        const parsedMem = memSchema.parse(mem())
        return parsedMem
    }
}