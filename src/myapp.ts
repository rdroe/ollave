import { platformIsNode, createApp } from 'nyargs'
import play from './commands/play'
const creator = () => createApp(
    async function nyargsApp({
        cache,
        program,
        test,
        match,
        repl,
        setDictionary,
        nest,
        element,
        configure,
    }) {

        // dynamicall import your own modules here, e.g.
        // const myModule = (await import('./myModule')).default

        setDictionary({
            myprogram: [
                'match scalar -l 1 2 3 -r 1 2 3',
                'match scalar -l comparable -r compaarable'
            ]
        })

        await configure('useFakeDb', false)

        await repl({
            cache,
            test,
            match,
            nest,
            element,
            // myModule,
            // aliases
            pr: program,
            pro: program,
            prog: program,
            play

        }, 'app > ')

    })


export default creator
export const app = creator
// If the platform is node, no need to run a server.
// Run the cli right now.
if (platformIsNode) {
    creator()
}
