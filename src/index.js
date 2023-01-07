require('dotenv').config()
const express = require('express')
const bodyparser = require('body-parser')
const prettyjson = require('prettyjson')

const authrite = require('authrite-express')
const bsv = require('babbage-bsv')

const routes = require('./routes')

const ALLOW_HTTP = JSON.parse(process.env.ALLOW_HTTP)
const HOSTING_DOMAIN = process.env.HOSTING_DOMAIN
const HTTP_PORT = process.env.HTTP_PORT || 8081
const ROUTING_PREFIX = process.env.ROUTING_PREFIX

const {
    certifierPrivateKey,
    certifierPublicKey,
    certificateType,
    //certificateDefinition,
    //certificateFields,
    requestedTypesAndFields
} = require('./certifier')

const app = express()
app.use(bodyparser.json())

// This allows the API to be used when CORS is enforced
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', '*')
  res.header('Access-Control-Allow-Methods', '*')
  res.header('Access-Control-Expose-Headers', '*')
  res.header('Access-Control-Allow-Private-Network', 'true')
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

// This ensures that HTTPS is used unless you are in development mode
app.use((req, res, next) => {
  if (!ALLOW_HTTP && !req.secure && req.get('x-forwarded-proto') !== 'https') {
    return res.redirect('https://' + req.get('host') + req.url)
  }
  next()
})

// This makes the documentation site available
app.use(express.static('public'))

// This is a simple API request logger
app.use((req, res, next) => {
  console.log('[' + req.method + '] <- ' + req._parsedUrl.pathname)
  const logObject = { ...req.body }
  console.log(prettyjson.render(logObject, { keysColor: 'blue' }))
  res.nologJson = res.json
  res.json = json => {
    res.nologJson(json)
    console.log('[' + req.method + '] -> ' + req._parsedUrl.pathname)
    console.log(prettyjson.render(json, { keysColor: 'green' }))
  }
  next()
})

// Authrite is enforced from here forward
app.use(authrite.middleware({

  serverPrivateKey: certifierPrivateKey,

  baseUrl: HOSTING_DOMAIN,

  // Request our own certificates from clients:
  requestedCertificates: {

    // Specify the types and fields supported by confirmCertificate.
    types: requestedTypesAndFields,

    // The only certificates we handle are our own in confirmCertificate.
    certifiers: [certifierPublicKey]
  }
}))

// This adds all the API routes
routes.forEach((route) => {
  app[route.type](`${ROUTING_PREFIX}${route.path}`, route.func)
})

// This is the 404 route
app.use((req, res) => {
  console.log('404', req.url)
  res.status(404).json({
    status: 'error',
    code: 'ERR_ROUTE_NOT_FOUND',
    description: 'Route not found.'
  })
})

// This starts myac server listening for requests
app.listen(HTTP_PORT, () => {
  console.log('myac listening on port', HTTP_PORT)
  console.log('Certifier:', certifierPublicKey)
  console.log('Type ID:', certificateType)
})
