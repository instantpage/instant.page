export const title = 'Hover long enough to prefetch, then click (no cache)'

export const environment = {
  pageLoadTime: 200,
  cacheMaxAge: false,
}

export const expectation = 'Navigated page is from prefetch cache'

export function checkExpectation(data) {
  return data.transferSize === 0
}
