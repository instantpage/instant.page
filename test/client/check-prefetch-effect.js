main()

async function main() {
  if (!isPrefetchSupported()) {
    return
  }
  const href = generateResourceHref()
  let entryContainer = {}
  setUpObserver(href, entryContainer)
  doPrefetch(href)
  const success = await didItPrefetch(entryContainer)
  if (!success) {
    showMessage()
  }
}

function isPrefetchSupported() {
  const supportCheckRelList = document.createElement('link').relList
  return supportCheckRelList.supports('prefetch')
}

function generateResourceHref() {
  const url = new URL(`/?check-prefetch=${Math.random()}`, location)
  return url.toString()
}

function setUpObserver(href, entryContainer) {
  const observer = new PerformanceObserver(function callback(entryList) {
    const entries = entryList.getEntriesByName(href)
    if (entries.length == 0) {
      return
    }
    if (entries.length > 1) {
      throw new Error('entries.length > 1')
    }
    const entry = entries.at(0)
    entryContainer.entry = entry
    hideMessage()
  })
  observer.observe({type: 'resource'})
}

function doPrefetch(href) {
  const $link = document.createElement('link')
  $link.rel = 'prefetch'
  $link.href = href
  document.head.appendChild($link)
}

function didItPrefetch(entryContainer) {
  return new Promise((resolve) => {
    const millisecondsToWait = 50
    setTimeout(function() {
      const didIt = 'entry' in entryContainer
      resolve(didIt)
    }, millisecondsToWait)
  })
}

function showMessage() {
  const $container = document.querySelector('main')
  const $message = document.createElement('aside')
  $message.classList.add('failed-prefetch-message')
  $message.innerHTML = `
    <style>
      .failed-prefetch-message {
        background-color: #fab;
        border: 2px solid #c00;
        padding: 0 1em;
      }
    </style>

    <p>The test prefetch didn’t have any effect.
    You might have a content blocking extension such as uBlock Origin that disables prefetching, or you might have disabled preloading in your browser settings.

    <p>Consider creating and using another browser profile, free of extensions and settings.
  `
  $container.prepend($message)
}

function hideMessage() {
  const $message = document.querySelector('.failed-prefetch-message')
  if ($message) {
    // The timer was too eager
    $message.remove()
    // This is poor user feedback (a flashing banner that disappears), but this
    // situation should be rare and only happening on low-end devices, which
    // means probably no one besides me (if even that) will experience it.
  }
}
