let start
let lastTouchTimestamp = 0
const button = document.querySelector('main button')
button.addEventListener('touchstart', () => {
  start = +new Date
  lastTouchTimestamp = start
})

button.addEventListener('mouseover', () => {
  if ((+new Date - lastTouchTimestamp) > 1000) {
    start = +new Date
  }
})

button.addEventListener('click', () => {
  button.innerText = '>>> ' + (+new Date - start) + ' <<<'
  start = undefined
})
