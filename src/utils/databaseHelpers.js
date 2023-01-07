const knex = require('knex')(require('../../knexfile.js'))
const { decryptCertificateFields } = require('authrite-utils')

const addFieldsAndKeyring = async (cert) => {

    const fields = await knex('certificate_fields').where({ certificateId: cert.certificateId })
    return {
        serialNumber: cert.serialNumber,
        validationKey: cert.validationKey,
        certifier: cert.certifier,
        subject: cert.subject,
        type: cert.type,
        revocationOutpoint: cert.revocationOutpoint,
        signature: cert.signature,
        fields: Object.fromEntries(fields.map(f => ([f.fieldName, f.fieldValue]))),
        keyring: Object.fromEntries(fields.map(f => ([f.fieldName, f.fieldKey])))
    }
}

const loadCertificate = async (serialNumber, decryptPrivateKey = null) => {
    let [cert] = await knex('certificates').where({ serialNumber })

    const certificate = await addFieldsAndKeyring(cert)

    if (decryptPrivateKey) {
        const decryptedFields = await decryptCertificateFields(certificate, certificate.keyring, decryptPrivateKey)
        certificate.decryptedFields = decryptedFields
    }

    return certificate
}

const saveCertificate = async (certificate, keyring) => {

    const now = new Date()

    let [user] = await knex('users').where({ babbageIdentity: certificate.subject }).select('userId')

    // If the user exists, their user ID is returned
    if (!user) {
        await knex('users').insert({
            created_at: now,
            updated_at: now,
            babbageIdentity: certificate.subject
        });

        [user] = await knex('users').where({ babbageIdentity: certificate.subject }).select('userId')
    }

    const userId = user.userId

    // Insert certificate into database
    const certificateEntry = {
        created_at: now,
        updated_at: now,
        userId,
        type: certificate.type,
        subject: certificate.subject,
        validationKey: certificate.validationKey,
        serialNumber: certificate.serialNumber,
        certifier: certificate.certifier,
        revocationOutpoint: certificate.revocationOutpoint,
        signature: certificate.signature
    }
    await knex('certificates').insert(certificateEntry)

    // Get ID of certificate we just inserted
    const [{ certificateId }] = await knex('certificates').select('certificateId').where({
        type: certificate.type,
        subject: certificate.subject,
        validationKey: certificate.validationKey,
        serialNumber: certificate.serialNumber,
        userId
    })

    // Insert certificate fields into database
    // The values saved are encrypted so that the certifier can decrypt them.
    for (const fieldName in certificate.fields) {
    const certificateFieldEntry = {
        userId,
        certificateId,
        fieldName,
        fieldValue: certificate.fields[fieldName],
        fieldKey: keyring[fieldName]
    }
    await knex('certificate_fields').insert(certificateFieldEntry)
    }

}

module.exports = {
    loadCertificate,
    saveCertificate
}
