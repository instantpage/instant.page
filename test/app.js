const http = require('http')
const fsPromises = require('fs').promises
const path = require('path')
const crypto = require('crypto')

const sleep = require('util').promisify(setTimeout)

const argvIndexOfFile = process.argv.indexOf(__filename)
let PORT = parseInt(process.argv[argvIndexOfFile + 1])
if (isNaN(PORT)) {
  PORT = 8000
}

let DATA_INSTANT = 0
let SLEEP_TIME = 200
let CACHE_MAX_AGE = 0
let USE_WHITELIST = 0

function handleCookies(req) {
  const cookies = req.headers.cookie

  if (!cookies) {
    return
  }

  cookies.split('; ').map((cookie) => {
    const [key, value] = cookie.split('=')

    if (key != 'instantpage_test') {
      return
    }

    const cookieValueSplit = value.split(',').map((param) => parseInt(param))
    DATA_INSTANT = cookieValueSplit[0]
    SLEEP_TIME = cookieValueSplit[1]
    CACHE_MAX_AGE = cookieValueSplit[2]
    USE_WHITELIST = cookieValueSplit[3]
  })
}

function sha384(data) {
  const hash = crypto.createHash('sha384')
  hash.update(data)
  return hash.digest('base64')
}

async function requestListener(req, res) {
  let headers = {
    'Content-Type': 'text/html',
  }

  let pathString = req.url.substr(1)
  let page = parseInt(pathString)
  if (pathString == '') {
    page = 1
  }

  let content = ''

  const jsContent = await fsPromises.readFile(path.resolve(__dirname, '../instantpage.js'))
  const jsHash = sha384(jsContent)

  if (pathString == 'instantpage.js') {
    headers['Content-Type'] = 'text/javascript'
    content += jsContent
  }
  else if (!isNaN(page)) {
    handleCookies(req)

    await sleep(SLEEP_TIME)

    if (CACHE_MAX_AGE) {
      headers['Cache-Control'] = `max-age=${CACHE_MAX_AGE}`
    }

    content += await fsPromises.readFile(path.resolve(__dirname, 'header.html'))

    if (!DATA_INSTANT) {
      content = content.replace('<body>', '<body data-instant-allow-query-string data-instant-allow-external-links>')
    }
    if (USE_WHITELIST) {
      content = content.replace('<body', '<body data-instant-whitelist')
    }
    dataInstantAttribute = DATA_INSTANT || USE_WHITELIST ? `data-instant` : ``

    content = content.replace(':checked_aqsael', DATA_INSTANT ? 'checked' : '')
    content = content.replace(':checked_whitelist', USE_WHITELIST ? 'checked' : '')
    content = content.replace(':value_sleep', `value="${SLEEP_TIME}"`)
    content = content.replace(':value_cacheAge', `value="${CACHE_MAX_AGE}"`)

    content += `<h1>Page ${page}</h1>`
    for (let i = 1; i <= 3; i++) {
      if (page != i) {
        content += `<a href="/${i}?${Math.random()}" ${dataInstantAttribute}><span>Page ${i}</span></a>`
      }
    }

    content += `<a href="/${page}?${Math.random()}" target="_blank" ${dataInstantAttribute}><span>Opens in a new tab</span></a>`
    content += `<a href="/${page}?${Math.random()}#anchor" ${dataInstantAttribute}><span>Other page anchor</span></a>`
    content += `<a href="${req.url}#anchor" id="anchor"><span>Same-page anchor</span></a>`
    content += `<a href="/${page}?${Math.random()}" data-no-instant><span>Manually blacklisted link</span></a>`
    content += `<a href="/${page}?${Math.random()}"><span>Non-whitelisted link</span></a>`
    content += `<a href="https://www.google.com/" ${dataInstantAttribute}><span>External link</span></a>`
    content += `<a><span>&lt;a&gt; without <code>href</code></span></a>`
    content += `<a href="file:///C:/"><span>file: link</span></a>`

    let footer = await fsPromises.readFile(path.resolve(__dirname, 'footer.html'))
    footer = footer.toString().replace('__HASH__', jsHash)
    content += footer
  }

  res.writeHead(200, headers)
  res.write(content)
  res.end()
}

http.createServer(requestListener).listen(PORT)
console.log(`-> Running on http://127.0.0.1:${PORT}/`)
