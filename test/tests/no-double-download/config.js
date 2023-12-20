export const title = 'No double download when clicking while not preloaded yet'

export const environment = {
  pageLoadTime: 200,
  cacheMaxAge: 2,
}

export function checkExpectation(data) {
  return data.transferSize === 0
}
