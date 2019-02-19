const http = require('http')
const fsPromises = require('fs').promises
const path = require('path')
const crypto = require('crypto')

const sleep = require('util').promisify(setTimeout)

const argvIndexOfFile = process.argv.indexOf(__filename)
let DATA_INSTANT = parseInt(process.argv[argvIndexOfFile + 1])
if (isNaN(DATA_INSTANT)) {
  DATA_INSTANT = 0
}
let SLEEP_TIME = parseInt(process.argv[argvIndexOfFile + 2])
if (isNaN(SLEEP_TIME)) {
  SLEEP_TIME = 200
}
let CACHE_MAX_AGE = parseInt(process.argv[argvIndexOfFile + 3])
if (isNaN(CACHE_MAX_AGE)) {
  CACHE_MAX_AGE = 0
}
let PORT = parseInt(process.argv[argvIndexOfFile + 4])
if (isNaN(PORT)) {
  PORT = 8000
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
    await sleep(SLEEP_TIME)

    if (CACHE_MAX_AGE) {
      headers['Cache-Control'] = `max-age=${CACHE_MAX_AGE}`
    }

    if (DATA_INSTANT) {
      content += `<body>`
    }
    else {
      content += `<body data-instant-allow-query-string data-instant-allow-external-links >`
    }
    dataInstantAttribute = DATA_INSTANT ? `data-instant` : ``

    content += await fsPromises.readFile(path.resolve(__dirname, 'header.html'))
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
    content += `<a href="https://www.google.com/"><span>External link</span></a>`

    let footer = await fsPromises.readFile(path.resolve(__dirname, 'footer.html'))
    footer = footer.toString().replace('__HASH__', jsHash)
    content += footer
  }

  res.writeHead(200, headers)
  res.write(content)
  res.end()
}

http.createServer(requestListener).listen(PORT)
