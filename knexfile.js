
const localMySql = {
  client: 'mysql',
  connection: {
    port:3306,
    host:"localhost",
    user:"",
    password:"",
    database:"myac_database"
  },
  pool: {
    min: 3,
    max: 7,
    idleTimeoutMillis: 30000
  },
  useNullAsDefault: true,
  migrations: {
    directory: './migrations'
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

//module.exports = localMySql
module.exports = localSqlite