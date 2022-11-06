
// var fs = require('fs');

import { Module, SyncChildCalls } from 'nyargs';

import { isNumStringNum, makeModule, passivelyNumberize } from '../lib/helpers'
import { Observable, interval, take, share } from 'rxjs'
import { playNotes } from 'src/lib/midi';


const module: Module<{}> = {
    help: {
        description: 'Create midi file contents',
        examples: {
            '': 'Generate and log example content'
        }
    },
    fn: async (args, childCalls: SyncChildCalls) => {
        console.log('child calls', childCalls)
        return null
    },
    submodules: {

        nts: {
            help: {
                description: 'play 3-element triads'
            },
            fn: async ({ positional }) => {
                const [str, num1, num2]: [any, any, any] = positional.map(passivelyNumberize)
                console.log('input', str, num1, num2, 'all', positional)
                const tri = [str, num1, num2]
                return isNumStringNum(tri) ? playNotes([tri]) : null

            }
        },
        go: {
            help: {
                description: 'play 3-element triads'
            },
            fn: async ({ positional }) => {

                const foo = new Observable((subscriber) => {
                    console.log('Hello');
                    subscriber.next(42);
                    subscriber.next(100); // "return" another value
                    subscriber.next(200); // "return" yet another
                });

                console.log('before');
                foo.subscribe((x) => {
                    console.log(x);
                });
                console.log('after');

                return 'child a'
            },
        },
        go2: {

            help: {
                description: "experiment 2"
            },
            fn: async ({ positional }) => {
                const first5SpacedNumbers = interval(1000).pipe(take(5), share())

                first5SpacedNumbers.subscribe((v) => console.log("A", v))
                // Will start logging A1... A2...

                setTimeout(() => {
                    first5SpacedNumbers.subscribe((v) => console.log("B", v))
                }, 2000)
                // Will 
            }
        }

    },

}



export default module
