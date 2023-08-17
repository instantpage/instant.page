const form = document.forms[0]
form.addEventListener('submit', (e) => {
  e.preventDefault()
  const cookieValue = [
    form.aqsael.checked ? 1 : 0,
    form.sleep.value,
    form.cacheAge.value,
    form.whitelist.checked ? 1 : 0,
    form.intensity.value,
    form.minified.checked ? 1 : 0,
    form.varyAccept.value,
  ].join(',')
  document.cookie = `instantpage_test=${cookieValue}`
  location.reload()
})
