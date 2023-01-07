const ejs = require('ejs')
const fs = require('fs')
require('dotenv').config()
const bsv = require('babbage-bsv')

ejs.renderFile(
  'src/templates/documentation.ejs',
  {
    ...process.env,
    ...require('../src/certifier'),
    routes: require('../src/routes')
  },
  {},
  (err, res) => {
    if (err) {
      throw err
    }
    console.log('Generating API Documentation...')
    fs.writeFileSync('public/index.html', res)
  }
)
