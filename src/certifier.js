const bsv = require('babbage-bsv')

const myac1 = require('./certificates/myac1Certificate')

const certifierPrivateKey = process.env.SERVER_PRIVATE_KEY
if (!certifierPrivateKey || certifierPrivateKey === '0000000000000000000000000000000000000000000000000000000000000001')
    throw 'Please check your .env file and make sure you have a valid SERVER_PRIVATE_KEY (not the default)'

const certifierPublicKey = bsv.PrivateKey.fromString(certifierPrivateKey).publicKey.toString()

// The confirmCertificate route of this server can be used to confirm that
// the requester has been issued and has authorized access to specific
// certificate types and field values.
// This specifies which types and fields are to be requested by authrite for confirmations.
const requestedTypesAndFields = Object.fromEntries([[myac1.certificateType, myac1.certificateFields]])

module.exports = {
    certifierPrivateKey,
    certifierPublicKey,
    certificateType: myac1.certificateType,
    certificateDefinition: myac1.certificateDefinition,
    certificateFields: myac1.certificateFields,
    requestedTypesAndFields
}
