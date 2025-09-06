import { mem } from "../../core/mem"

const { songNames } = mem()

let namesResolver: Function | null = null

const namesPromise = new Promise((res) => {
    namesResolver = res
});

export const getSongNames = () => {
    return namesPromise.then(() => {
        return songNames
    })
}
