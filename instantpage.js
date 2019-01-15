/*! instant.page v0.0.0 - (C) 2019 Alexandre Dieulot - https://instant.page/license */

let urlBeingPreloaded
let mouseoverTimer

const prefetcher = document.createElement('link')
const isSupported = prefetcher.relList && prefetcher.relList.supports && prefetcher.relList.supports('prefetch')

if (isSupported) {
  prefetcher.rel = 'prefetch'
  document.head.appendChild(prefetcher)

  document.addEventListener('mouseover', mouseoverListener, true)
}

function mouseoverListener(event) {
  const linkElement = event.target.closest('a')

  if (!linkElement) {
    return
  }

  if (!isPreloadable(linkElement)) {
    return
  }

  linkElement.addEventListener('mouseout', mouseoutListener)

  mouseoverTimer = setTimeout(preload, 65, linkElement.href)
}

function mouseoutListener(event) {
  if (event.relatedTarget && event.target.closest('a') == event.relatedTarget.closest('a')) {
    return
  }

  stopPreloading()
}

function isPreloadable(linkElement) {
  if (urlBeingPreloaded == linkElement.href) {
    return false
  }

  const urlObject = new URL(linkElement.href)

  if (urlObject.origin != location.origin) {
    return false
  }

  if (urlObject.pathname + urlObject.search == location.pathname + location.search && urlObject.hash) {
    return
  }

  if ('noInstant' in linkElement.dataset) {
    return false
  }

  return true
}

function preload(url) {
  urlBeingPreloaded = url

  prefetcher.href = url
}

function stopPreloading() {
  if (mouseoverTimer) {
    clearTimeout(mouseoverTimer)
    mouseoverTimer = undefined
  }

  if (!urlBeingPreloaded) {
    return
  }
  urlBeingPreloaded = undefined

  /* The spec says an empty string should abort the prefetching
  * but Firefox 64 interprets it as a relative URL to prefetch. */
  prefetcher.removeAttribute('href')
}
