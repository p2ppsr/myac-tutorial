const ejs = require('ejs')
const fs = require('fs')
require('dotenv').config()
const bsv = require('babbage-bsv')

ejs.renderFile(
  'src/templates/documentation.ejs',
  {
    ...process.env,
    ...require('../src/certifier'),
    routes: require('../src/routes'),
    myac1: fs.readFileSync('/Kz/p2ppsr/bab480/myac-tutorial/src/certificates/myac1Certificate.js')
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
