import { createApp } from 'peprn/browser'
import { playTriads } from './lib/music'

import { app } from './cli'

document.body.onload = () => {
    document.body.onclick = () => {
        playTriads([['c3', .05, 0]])
        document.body.onclick = null
    }
    createApp(app)
}


