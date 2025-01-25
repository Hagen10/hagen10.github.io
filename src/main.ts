import './style.css'
import { createGlobe } from './globe'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <div id="container"></div>
  </div>
`

createGlobe(document.querySelector<HTMLElement>('#container')!)
