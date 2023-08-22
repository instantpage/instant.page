import fs from 'node:fs/promises'
import assert from 'node:assert/strict'

import constants from './constants.js'

export async function servePage(req, res) {
  if (req.url == '/tests/instantpage.js') {
    return serveInstantpageScript(res)
  }

  if (req.url == '/tests/postData') {
    return handlePostData(req, res)
  }

  const filePath = new URL(`.${req.url}`, import.meta.url)
  let fileContent = await fs.readFile(filePath, {encoding: 'utf8'})
  fileContent = await fillConstantsAndEnvironment(req, fileContent)

  const headers = {
    'Content-Type': 'text/html',
  }

  await exertEnvironment(req, res, headers)

  res.writeHead(200, headers)
  res.write(fileContent)
  res.end()
}

async function fillConstantsAndEnvironment(req, pageContent) {
  const {environment} = await getConfig(req.url)
  const environmentString = JSON.stringify(environment)
  const constantsString = JSON.stringify(constants)
  const filledPageContent = pageContent.replace(
    'async (event, constants, environment) =>',
    `async (event, constants = ${constantsString}, environment = ${environmentString}) =>`,
  )
  return filledPageContent
}

async function getConfig(reqUrl) {
  const urlPath = new URL(`.${reqUrl}`, import.meta.url)
  const configPath = new URL('./config.js', urlPath)
  const testConfig = await import(configPath)
  return testConfig
}

async function serveInstantpageScript(res) {
  const path = new URL('../instantpage.js', import.meta.url)
  const content = await fs.readFile(path)
  res.writeHead(200, {
    'Content-Type': 'text/javascript',
  })
  res.end(content)
}

async function exertEnvironment(req, res, headers) {
  const {environment} = await getConfig(req.url)

  if (environment.pageLoadTime) {
    await new Promise(_ => setTimeout(_, environment.pageLoadTime))
  }

  if (environment.cacheMaxAge) {
    assert.ok(environment.cacheMaxAge <= 20, 'cacheMaxAge > 20 (seconds!)')
    headers['Cache-Control'] = `max-age=${environment.cacheMaxAge}`
  }
}

async function handlePostData(req, res) {
  const data = await new Promise((resolve) => {
    const chunks = []
    req.on('data', (chunk) => {
      chunks.push(chunk)
    })

    req.on('end', () => {
      const bodyRaw = Buffer.concat(chunks).toString()
      const bodyObject = JSON.parse(bodyRaw)
      resolve(bodyObject)
    })
  })

  const testPath = new URL(req.headers.referer).pathname
  const {checkExpectation} = await getConfig(testPath)
  const isResultAsExpected = checkExpectation(data)
  if (isResultAsExpected) {
    console.log(`✅ ok!`)
  }
  else {
    console.log(`❌ BAD`)
    console.log(data)
    console.log(checkExpectation.toString())
  }

  res.writeHead(204)
  res.end()
}
