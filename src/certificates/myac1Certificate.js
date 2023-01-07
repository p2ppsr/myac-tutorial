// myac1 Authrite Certificate Type Definition
// 
// An Authrite Certifier defines one or more certificate types that they issue and manage.
// The certificate type encompasses a list of fields and their expected and valid values.
// A certificate type is assigned a unique identifier which must be a random 32 byte value
// encoded as a base64 string.
// A new certificate type identifier can be generated by the following code:
//      require('crypto').randomBytes(32).toString('base64')
//
// Do not re-use type identifiers. The value is not private, so we keep it here with the
// certificate structure definition.
//
// The purpose of this certificate is to server as a self-certified external identity to
// be associated with the certificate owner.
const certificateType = 'jVNgF8+rifnz00856b4TkThCAvfiUE4p+t/aHYl1u0c='
const certificateDefinition = {
    // The external identity's domain.
    domain: 'twitter.com',
    // The identity (typically a username) on the external domain.
    identity: '@bob',
    // When this claim starts.
    // Required format is ISO date time string as returned by new Date().toISOString()
    when: '2023-01-06T15:02:01.772Z',
    // Required amount in US dollars you are staking on this claim.
    // If you transmit this certificate signed by your Babbage Authrite Identity,
    // for any form of personal benefit, and it is later proven that the claim
    // made in this certificate is false, you agree to be personally liable in
    // the amount of this stake to any and all injured parties.
    stake: '$100'
}
const certificateFields = Object.keys(certificateDefinition)

module.exports = {
    certificateType,
    certificateDefinition,
    certificateFields
}
