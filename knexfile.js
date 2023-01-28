require('dotenv').config()

const deployMySql = {
  client: 'mysql',
  connection: process.env.KNEX_DB_CONNECTION
    ? JSON.parse(process.env.KNEX_DB_CONNECTION)
    : undefined,
  useNullAsDefault: true,
  migrations: {
    directory: './src/migrations'
  },
  pool: {
    min: 0,
    max: 7,
    idleTimeoutMillis: 15000
  }
}

const localSqlite = {
  client: 'sqlite3',
  connection: {
    filename: './data/myac_database.sqlite'
  },
  useNullAsDefault: true,
  fileMustExist: true,
  migrations: {
    directory: './src/migrations'
  }
}

const localMySql = {
  client: 'mysql',
  connection: {
    port:3001,
    host:"ac-mysql",
    user:"root",
    password:"test",
    database:"myac"
  },
  pool: {
    min: 3,
    max: 7,
    idleTimeoutMillis: 30000
  },
  useNullAsDefault: true,
  migrations: {
    directory: './src/migrations'
  }
}

const NODE_ENV = process.env.NODE_ENV
const config
  = NODE_ENV === 'production' ? deployMySql
  : NODE_ENV === 'staging' ? deployMySql
  : localMySql

module.exports = config

