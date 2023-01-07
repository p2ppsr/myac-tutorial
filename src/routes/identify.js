const {
    //certifierPrivateKey,
    certifierPublicKey,
    certificateType,
    //certificateDefinition,
    certificateFields,
    ///requestedTypesAndFields
} = require('../certifier')

/*
 * This route returns the certifier's public key and certificate types.
 */
module.exports = {
  type: 'post',
  path: '/identify',
  summary: 'Identify Certifier by returning certifierPublicKey and certificateTypes.',
  exampleResponse: {
    status: 'success',
    certifierPublicKey: '025384871bedffb233fdb0b4899285d73d0f0a2b9ad18062a062c01c8bdb2f720a',
    certificateTypes: [
      ['jVNgF8+rifnz00856b4TkThCAvfiUE4p+t/aHYl1u0c=', ['domain', 'identity', 'when', 'stake']]
    ]
  },
  func: async (req, res) => {
    try {

      return res.status(200).json({
        status: 'success',
        certifierPublicKey,
        certificateTypes: [[certificateType, certificateFields]]
      })

    } catch (e) {
      console.error(e)
      res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL',
        description: 'An internal error has occurred.'
      })
    }
  }
}
