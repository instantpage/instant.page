export const title = 'Uses prefetch cache when clicking after having hovered long enough to prefetch, without HTTP caching set'

export const environment = {
  pageLoadTime: 200,
  cacheMaxAge: false,
}

export function checkExpectation(data) {
  return data.transferSize === 0
}
