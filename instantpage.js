/*! instant.page v5.2.0 - (C) 2019-2024 Alexandre Dieulot - https://instant.page/license */

let _chromiumMajorVersionInUserAgent = null
  , _speculationRulesType
  , _allowQueryString
  , _allowExternalLinks
  , _useWhitelist
  , _delayOnHover = 65
  , _lastTouchstartEvent
  , _mouseoverTimer
  , _preloadedList = new Set()

init()

function init() {
  const supportCheckRelList = document.createElement('link').relList
  const isSupported = supportCheckRelList.supports('prefetch')
    && supportCheckRelList.supports('modulepreload')
  // instant.page is meant to be loaded with <script type=module>
  // (though sometimes webmasters load it as a regular script).
  // So it’s normally executed (and must not cause JavaScript errors) in:
  // - Chromium 61+
  // - Gecko in Firefox 60+
  // - WebKit in Safari 10.1+ (iOS 10.3+, macOS 10.10+)
  //
  // The check above used to check for IntersectionObserverEntry.isIntersecting
  // but module scripts support implies this compatibility — except in Safari
  // 10.1–12.0, but this prefetch check takes care of it.
  //
  // The modulepreload check is used to drop support for Firefox < 115 in order
  // to lessen maintenance.
  // This implies Safari 17+ (if it supported prefetch), if we ever support
  // fetch()-based preloading for Safari we might want to OR that check with
  // something that Safari 15.4 or 16.4 supports.
  // Also implies Chromium 66+.

  if (!isSupported) {
    return
  }

  const handleVaryAcceptHeader = 'instantVaryAccept' in document.body.dataset || 'Shopify' in window
  // The `Vary: Accept` header when received in Chromium 79–109 makes prefetches
  // unusable, as Chromium used to send a different `Accept` header.
  // It’s applied on all Shopify sites by default, as Shopify is very popular
  // and is the main source of this problem.
  // `window.Shopify` only exists on “classic” Shopify sites. Those using
  // Hydrogen (Remix SPA) aren’t concerned.

  const chromiumUserAgentIndex = navigator.userAgent.indexOf('Chrome/')
  if (chromiumUserAgentIndex > -1) {
    _chromiumMajorVersionInUserAgent = parseInt(navigator.userAgent.substring(chromiumUserAgentIndex + 'Chrome/'.length))
  }
  // The user agent client hints API is a theoretically more reliable way to
  // get Chromium’s version… but it’s not available in Samsung Internet 20.
  // It also requires a secure context, which would make debugging harder,
  // and is only available in recent Chromium versions.
  // In practice, Chromium browsers never shy from announcing "Chrome" in
  // their regular user agent string, as that maximizes their compatibility.

  if (handleVaryAcceptHeader && _chromiumMajorVersionInUserAgent && _chromiumMajorVersionInUserAgent < 110) {
    return
  }

  _speculationRulesType = 'none'
  if (HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
    const speculationRulesConfig = document.body.dataset.instantSpecrules
    if (speculationRulesConfig == 'prerender') {
      _speculationRulesType = 'prerender'
    } else if (speculationRulesConfig != 'no') {
      _speculationRulesType = 'prefetch'
    }
  }

  const useMousedownShortcut = 'instantMousedownShortcut' in document.body.dataset
  _allowQueryString = 'instantAllowQueryString' in document.body.dataset
  _allowExternalLinks = 'instantAllowExternalLinks' in document.body.dataset
  _useWhitelist = 'instantWhitelist' in document.body.dataset

  let preloadOnMousedown = false
  let preloadOnlyOnMousedown = false
  let preloadWhenVisible = false
  if ('instantIntensity' in document.body.dataset) {
    const intensityParameter = document.body.dataset.instantIntensity

    if (intensityParameter == 'mousedown' && !useMousedownShortcut) {
      preloadOnMousedown = true
    }

    if (intensityParameter == 'mousedown-only' && !useMousedownShortcut) {
      preloadOnMousedown = true
      preloadOnlyOnMousedown = true
    }

    if (intensityParameter == 'viewport') {
      const isOnSmallScreen = document.documentElement.clientWidth * document.documentElement.clientHeight < 450000
      // Smartphones are the most likely to have a slow connection, and
      // their small screen size limits the number of links (and thus
      // server load).
      //
      // Foldable phones (being expensive as of 2023), tablets and PCs
      // generally have a decent connection, and a big screen displaying
      // more links that would put more load on the server.
      //
      // iPhone 14 Pro Max (want): 430×932 = 400 760
      // Samsung Galaxy S22 Ultra with display size set to 80% (want):
      // 450×965 = 434 250
      // Small tablet (don’t want): 600×960 = 576 000
      // Those number are virtual screen size, the viewport (used for
      // the check above) will be smaller with the browser’s interface.

      const isNavigatorConnectionSaveDataEnabled = navigator.connection && navigator.connection.saveData
      const isNavigatorConnectionLike2g = navigator.connection && navigator.connection.effectiveType && navigator.connection.effectiveType.includes('2g')
      const isNavigatorConnectionAdequate = !isNavigatorConnectionSaveDataEnabled && !isNavigatorConnectionLike2g

      if (isOnSmallScreen && isNavigatorConnectionAdequate) {
        preloadWhenVisible = true
      }
    }

    if (intensityParameter == 'viewport-all') {
      preloadWhenVisible = true
    }

    const intensityAsInteger = parseInt(intensityParameter)
    if (!isNaN(intensityAsInteger)) {
      _delayOnHover = intensityAsInteger
    }
  }

  const eventListenersOptions = {
    capture: true,
    passive: true,
  }

  if (preloadOnlyOnMousedown) {
    document.addEventListener('touchstart', touchstartEmptyListener, eventListenersOptions)
  }
  else {
    document.addEventListener('touchstart', touchstartListener, eventListenersOptions)
  }

  if (!preloadOnMousedown) {
    document.addEventListener('mouseover', mouseoverListener, eventListenersOptions)
  }

  if (preloadOnMousedown) {
    document.addEventListener('mousedown', mousedownListener, eventListenersOptions)
  }
  if (useMousedownShortcut) {
    document.addEventListener('mousedown', mousedownShortcutListener, eventListenersOptions)
  }

  if (preloadWhenVisible) {
    let requestIdleCallbackOrFallback = window.requestIdleCallback
    // Safari has no support as of 16.3: https://webkit.org/b/164193
    if (!requestIdleCallbackOrFallback) {
      requestIdleCallbackOrFallback = (callback) => {
        callback()
        // A smarter fallback like setTimeout is not used because devices that
        // may eventually be eligible to a Safari version supporting prefetch
        // will be very powerful.
        // The weakest devices that could be eligible are the 2017 iPad and
        // the 2016 MacBook.
      }
    }

    requestIdleCallbackOrFallback(function observeIntersection() {
      const intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const anchorElement = entry.target
            intersectionObserver.unobserve(anchorElement)
            preload(anchorElement.href)
          }
        })
      })

      document.querySelectorAll('a').forEach((anchorElement) => {
        if (isPreloadable(anchorElement)) {
          intersectionObserver.observe(anchorElement)
        }
      })
    }, {
      timeout: 1500,
    })
  }
}

function touchstartListener(event) {
  _lastTouchstartEvent = event

  const anchorElement = event.target.closest('a')

  if (!isPreloadable(anchorElement)) {
    return
  }

  preload(anchorElement.href, 'high')
}

function touchstartEmptyListener(event) {
  _lastTouchstartEvent = event
}

function mouseoverListener(event) {
  if (isEventLikelyTriggeredByTouch(event)) {
    // This avoids uselessly adding a mouseout event listener and setting a timer.
    return
  }

  if (!('closest' in event.target)) {
    return
    // Without this check sometimes an error “event.target.closest is not a function” is thrown, for unknown reasons
    // That error denotes that `event.target` isn’t undefined. My best guess is that it’s the Document.
    //
    // Details could be gleaned from throwing such an error:
    //throw new TypeError(`instant.page non-element event target: timeStamp=${~~event.timeStamp}, type=${event.type}, typeof=${typeof event.target}, nodeType=${event.target.nodeType}, nodeName=${event.target.nodeName}, viewport=${innerWidth}x${innerHeight}, coords=${event.clientX}x${event.clientY}, scroll=${scrollX}x${scrollY}`)
  }
  const anchorElement = event.target.closest('a')

  if (!isPreloadable(anchorElement)) {
    return
  }

  anchorElement.addEventListener('mouseout', mouseoutListener, {passive: true})

  _mouseoverTimer = setTimeout(() => {
    preload(anchorElement.href, 'high')
    _mouseoverTimer = null
  }, _delayOnHover)
}

function mousedownListener(event) {
  if (isEventLikelyTriggeredByTouch(event)) {
    // When preloading only on mousedown, not touch, we need to stop there
    // because touches send compatibility mouse events including mousedown.
    //
    // (When preloading on touchstart, instructions below this block would
    // have no effect.)
    return
  }

  const anchorElement = event.target.closest('a')

  if (!isPreloadable(anchorElement)) {
    return
  }

  preload(anchorElement.href, 'high')
}

function mouseoutListener(event) {
  if (event.relatedTarget && event.target.closest('a') == event.relatedTarget.closest('a')) {
    return
  }

  if (_mouseoverTimer) {
    clearTimeout(_mouseoverTimer)
    _mouseoverTimer = null
  }
}

function mousedownShortcutListener(event) {
  if (isEventLikelyTriggeredByTouch(event)) {
    // Due to a high potential for complications with this mousedown shortcut
    // combined with other parties’ JavaScript code, we don’t want it to run
    // at all on touch devices, even though mousedown and click are triggered
    // at almost the same time on touch.
    return
  }

  const anchorElement = event.target.closest('a')

  if (event.which > 1 || event.metaKey || event.ctrlKey) {
    return
  }

  if (!anchorElement) {
    return
  }

  anchorElement.addEventListener('click', function (event) {
    if (event.detail == 1337) {
      return
    }

    event.preventDefault()
  }, {capture: true, passive: false, once: true})

  const customEvent = new MouseEvent('click', {view: window, bubbles: true, cancelable: false, detail: 1337})
  anchorElement.dispatchEvent(customEvent)
}

function isEventLikelyTriggeredByTouch(event) {
  // Touch devices fire “mouseover” and “mousedown” (and other) events after
  // a touch for compatibility reasons.
  // This function checks if it’s likely that we’re dealing with such an event.

  if (!_lastTouchstartEvent || !event) {
    return false
  }

  if (event.target != _lastTouchstartEvent.target) {
    return false
  }

  const now = event.timeStamp
  // Chromium (tested Chrome 95 and 122 on Android) sometimes uses the same
  // event.timeStamp value in touchstart, mouseover, and mousedown.
  // Testable in test/extras/delay-not-considered-touch.html
  // This is okay for our purpose: two equivalent timestamps will be less
  // than the max duration, which means they’re related events.
  // TODO: fill/find Chromium bug
  const durationBetweenLastTouchstartAndNow = now - _lastTouchstartEvent.timeStamp

  const MAX_DURATION_TO_BE_CONSIDERED_TRIGGERED_BY_TOUCHSTART = 2500
  // How long after a touchstart event can a simulated mouseover/mousedown event fire?
  // /test/extras/delay-not-considered-touch.html tries to answer that question.
  // I saw up to 1450 ms on an overwhelmed Samsung Galaxy S2.
  // On the other hand, how soon can an unrelated mouseover event happen after an unrelated touchstart?
  // Meaning the user taps a link, then grabs their pointing device and clicks another/the same link.
  // That scenario could occur if a user taps a link, thinks it hasn’t worked, and thus fall back to their pointing device.
  // I do that in about 1200 ms on a Chromebook. In which case this function returns a false positive.
  // False positives are okay, as this function is only used to decide to abort handling mouseover/mousedown/mousedownShortcut.
  // False negatives could lead to unforeseen state, particularly in mousedownShortcutListener.

  return durationBetweenLastTouchstartAndNow < MAX_DURATION_TO_BE_CONSIDERED_TRIGGERED_BY_TOUCHSTART

  // TODO: Investigate if pointer events could be used.
  // https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerType

  // TODO: Investigate if InputDeviceCapabilities could be used to make it
  // less hacky on Chromium browsers.
  // https://developer.mozilla.org/en-US/docs/Web/API/InputDeviceCapabilities_API
  // https://wicg.github.io/input-device-capabilities/
  // Needs careful reading of the spec and tests (notably, what happens with a
  // mouse connected to an Android or iOS smartphone?) to make sure it’s solid.
  // Also need to judge if WebKit could implement it differently, as they
  // don’t mind doing when a spec gives room to interpretation.
  // It seems to work well on Chrome on ChromeOS.

  // TODO: Consider using event screen position as another heuristic.
}

function isPreloadable(anchorElement) {
  if (!anchorElement || !anchorElement.href) {
    return
  }

  if (_useWhitelist && !('instant' in anchorElement.dataset)) {
    return
  }

  if (anchorElement.origin != location.origin) {
    let allowed = _allowExternalLinks || 'instant' in anchorElement.dataset
    if (!allowed || !_chromiumMajorVersionInUserAgent) {
      // Chromium-only: see comment on “restrictive prefetch” and “cross-site speculation rules prefetch”
      return
    }
  }

  if (!['http:', 'https:'].includes(anchorElement.protocol)) {
    return
  }

  if (anchorElement.protocol == 'http:' && location.protocol == 'https:') {
    return
  }

  if (!_allowQueryString && anchorElement.search && !('instant' in anchorElement.dataset)) {
    return
  }

  if (anchorElement.hash && anchorElement.pathname + anchorElement.search == location.pathname + location.search) {
    return
  }

  if ('noInstant' in anchorElement.dataset) {
    return
  }

  return true
}

function preload(url, fetchPriority = 'auto') {
  if (_preloadedList.has(url)) {
    return
  }

  if (_speculationRulesType != 'none') {
    preloadUsingSpeculationRules(url)
  } else {
    preloadUsingLinkElement(url, fetchPriority)
  }

  _preloadedList.add(url)
}

function preloadUsingSpeculationRules(url) {
  const scriptElement = document.createElement('script')
  scriptElement.type = 'speculationrules'

  scriptElement.textContent = JSON.stringify({
    [_speculationRulesType]: [{
      source: 'list',
      urls: [url]
    }]
  })

  // When using speculation rules, cross-site prefetch is supported, but will
  // only work if the user has no cookies for the destination site. The
  // prefetch will not be sent, if the user does have such cookies.

  document.head.appendChild(scriptElement)
}

function preloadUsingLinkElement(url, fetchPriority = 'auto') {
  const linkElement = document.createElement('link')
  linkElement.rel = 'prefetch'
  linkElement.href = url

  linkElement.fetchPriority = fetchPriority
  // By default, a prefetch is loaded with a low priority.
  // When there’s a fair chance that this prefetch is going to be used in the
  // near term (= after a touch/mouse event), giving it a high priority helps
  // make the page load faster in case there are other resources loading.
  // Prioritizing it implicitly means deprioritizing every other resource
  // that’s loading on the page. Due to HTML documents usually being much
  // smaller than other resources (notably images and JavaScript), and
  // prefetches happening once the initial page is sufficiently loaded,
  // this theft of bandwidth should rarely be detrimental.

  linkElement.as = 'document'
  // as=document is Chromium-only and allows cross-origin prefetches to be
  // usable for navigation. They call it “restrictive prefetch” and intend
  // to remove it: https://crbug.com/1352371
  //
  // This document from the Chrome team dated 2022-08-10
  // https://docs.google.com/document/d/1x232KJUIwIf-k08vpNfV85sVCRHkAxldfuIA5KOqi6M
  // claims (I haven’t tested) that data- and battery-saver modes as well as
  // the setting to disable preloading do not disable restrictive prefetch,
  // unlike regular prefetch. That’s good for prefetching on a touch/mouse
  // event, but might be bad when prefetching every link in the viewport.

  document.head.appendChild(linkElement)
}
