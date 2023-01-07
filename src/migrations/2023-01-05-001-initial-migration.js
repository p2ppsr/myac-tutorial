exports.up = async knex => {

  // Users Table
  // In many applications a certifier will be deployed in a context that already has
  // its own user management infrastructions.
  // For this example we implement a simple users table which
  // associates our own userId with a babbageIdentity (compressed public key as 66 hex digits).
  await knex.schema.createTable('users', table => {
    table.increments('userId')
    table.timestamps()
    table.string('babbageIdentity', 66)
  })

  // Certificates Table
  // The core properties that define a certificate extended with:
  // certificateId
  // userId
  // created_at
  // updated_at
  // In many situations this table's schema will not need to be extended.
  await knex.schema.createTable('certificates', table => {
    table.increments('certificateId')
    table.timestamps()
    table.integer('userId').unsigned().references('userId').inTable('users')
    table.string('type')
    table.string('subject')
    table.string('validationKey')
    table.string('serialNumber')
    table.string('certifier')
    table.string('revocationOutpoint')
    table.string('signature')
  })

  // Certificate Fields Table
  // Captures the field names, values and keys for a specific certificateId issued to a specific userId.
  // The flexible design of this table allows it to work for certificates with arbitrary field definitions.
  await knex.schema.createTable('certificate_fields', table => {
    table.integer('userId').unsigned().references('userId').inTable('users')
    table.integer('certificateId').unsigned().references('certificateId').inTable('certificates')
    table.string('fieldName')
    table.string('fieldValue', 2048)
    table.string('fieldKey')
  })
}

exports.down = async knex => {
  await knex.schema.dropTable('certificate_fields')
  await knex.schema.dropTable('certificates')
  await knex.schema.dropTable('users')
}
