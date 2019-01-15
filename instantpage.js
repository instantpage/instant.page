/*! instant.page v0.0.0 - (C) 2019 Alexandre Dieulot - https://instant.page/license */

let urlBeingPreloaded

const prefetcher = document.createElement('link')
const useAjaxFallback = !(prefetcher.relList && prefetcher.relList.supports && prefetcher.relList.supports('prefetch'))

if (!useAjaxFallback) {
  prefetcher.rel = 'prefetch'
  document.head.appendChild(prefetcher)
}

document.addEventListener('mouseover', mouseoverListener, true)

function mouseoverListener(event) {
  const linkElement = event.target.closest('a')

  if (!linkElement) {
    return
  }

  linkElement.addEventListener('mouseout', mouseoutListener)

  preload(linkElement.href)
}

function mouseoutListener(event) {
  if (event.relatedTarget && event.target.closest('a') == event.relatedTarget.closest('a')) {
    return
  }

  stopPreloading()
}

function preload(url) {
  if (urlBeingPreloaded == url) {
    return
  }
  urlBeingPreloaded = url

  if (!useAjaxFallback) {
    prefetcher.href = url
    console.log(`Preloading ${url}`)
  }
  else {
    console.log(`Todo: preload with Ajax ${url}`)
  }
}

function stopPreloading() {
  urlBeingPreloaded = undefined

  if (!useAjaxFallback) {
    /* The spec says an empty string should abort the prefetching
     * but Firefox 64 interprets it as a relative URL to prefetch. */
    prefetcher.removeAttribute('href')
    console.log(`Stopped preloading`)
  }
  else {
    console.log(`Todo: stop preloading with xhr.abort()`)
  }
}
