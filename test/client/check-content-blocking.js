main()

async function main() {
  if (!supportsPerformanceResourceTimingTransferSizeMetrics()) {
    return
  }
  await pageFullyLoaded()
  if (!hasBeenFetched()) {
    showMessage()
  }
}

function supportsPerformanceResourceTimingTransferSizeMetrics() {
  // False in Safari < 16.4
  return 'encodedBodySize' in PerformanceResourceTiming.prototype
}

function pageFullyLoaded() {
  return new Promise((resolve) => {
    if (document.readyState == 'complete') {
      resolve()
      return
    }
    addEventListener('load', () => {
      resolve()
    })
  })
}

function hasBeenFetched() {
  const entries = performance.getEntriesByName(new URL('/instantpage.js', location))
  if (entries.length != 1) {
    throw new Error('entries.length ≠ 1')
  }
  const entry = entries.at(0)
  return entry.encodedBodySize > 0
}

function showMessage() {
  const $container = document.querySelector('main')
  const $message = document.createElement('aside')
  $message.classList.add('content-blocking-message')
  $message.innerHTML = `
    <style>
      .content-blocking-message {
        background-color: #fab;
        border: 2px solid #c00;
        padding: 1em;
      }
    </style>

    /instantpage.js couldn’t be loaded. Either disable your content blocker on this domain or add <code>@@/instantpage.js</code> to your custom filters to whitelist it on all sites.
  `
  $container.prepend($message)
}
