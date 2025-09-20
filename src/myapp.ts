// createApp removed - cli not used by web app
import { playTriads } from './lib/music'

// cli removed - not used by web app

document.body.onload = () => {
    document.body.onclick = () => {
        playTriads([['c3', .05, 0]])
        document.body.onclick = null
    }
    // createApp removed - cli not used by web app
}
