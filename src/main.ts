import './style.css'
// import { createGlobe } from './globe'
import { Globe, setupGlobe } from './globes'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <div id="container"></div>
  </div>
`
/* Set the width of the side navigation to 250px */
function openNav() {
  document.getElementById("mySidenav")!.style.width = "250px";
}

/* Set the width of the side navigation to 0 */
function closeNav() {
  document.getElementById("mySidenav")!.style.width = "0";
}

document.addEventListener('DOMContentLoaded', () => {
  const sideNav = document.getElementById("mySidenav");
  const settingsButton = document.getElementById("button");
  const closeButton = document.getElementById("closebtn");

  if (closeButton) closeButton.addEventListener('click', closeNav);
  if (settingsButton) settingsButton.addEventListener('click', openNav);

  if (sideNav) {
    sideNav.addEventListener('click', (event) => {
      if (event.target instanceof HTMLAnchorElement) {
        const link = event.target as HTMLAnchorElement;
        const href = link.getAttribute('href')!;

        switch (href) {
          case '#about':
            console.log("Chose About");
            break;
          case '#services':
            console.log("Chose Services");
            break;
          case '#clients':
            console.log("Chose Clients");
            break;
          case '#contact':
            console.log("Chose Contact");
            break;
          case '#solarterminator':
            if (globe.solarTerminator) {
              console.log("Turning off Solar Terminator");

              globe.setSolarTerminator(false);

              // createGlobe(
              //   document.querySelector<HTMLElement>('#container')!,
              //   { solarTerminator: solarTerminator = false }
              // )
            }
            else {
              console.log("Turning on Solar Terminator");

              globe.setSolarTerminator(true);

              // createGlobe(
              //   document.querySelector<HTMLElement>('#container')!,
              //   { solarTerminator: solarTerminator = true }
              // )
            }
            break;

          default:
            window.location.href = href;
        }
      }
    });
  }
});

// createGlobe(document.querySelector<HTMLElement>('#container')!, { solarTerminator: true })

var globe = new Globe(document.querySelector<HTMLElement>('#container')!);

setupGlobe(globe);

