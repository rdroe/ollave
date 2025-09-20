import { playTriads } from './lib/music'
document.body.onload = () => {
  document.body.onclick = () => {
    playTriads([['c3', 0.05, 0]])
    document.body.onclick = null
  }
}
