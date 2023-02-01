Deploying is broken down into the following steps:
- Switch to production database.
- Build cloud execution container images.
- Configure cloud container image storage.
- Configure cloud certifier server and application services.
- Automate process from source control.

## Switch to Production Database.

This tutorial implemented database support using Sqlite for its simplicity,
but for deployment let's switch to MySql for scalability and manageability.

Add the `mysql` package:
```
npm install mysql
```

Add the following to your `knexfile.js` and comment out the original `module.exports`:
```
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
module.exports = localMySql
//module.exports = localSqlite
```

Unlike Sqlite which runs as part of your executing process and uses a single file for storage, MySql runs as a service. For this to work, the `connection` properties need to match an available instance of MySql. For deployment, the next step configures container images to support this.

## Build Cloud Execution Container Images.

Docker containers enable an entire execution environment to be configured, packaged as a single file, and scalably deployed to any cloud execution infrastructure.

For the Certifier Server, three containers will be created:
- Authrite Certifier Server: ac-server
- MySQL Server: ac-mysql
- MySQL Admin Web Interface: phpmyadmin

### Container 1 - Authrite Certifier Server: ac-server

The first container is configured by the following `Dockerfile`, add it now:
```
FROM node:16-alpine
WORKDIR /app
COPY package.json .
RUN npm i
RUN npm i knex -g
COPY . .
CMD ["sh", "scripts/start.sh"]
```

This is what each line of the `Dockerfile` does:
- Build a container for Node.js running on a very slimmed down Unix OS image
- Make the /app folder the root of our server files.
- Copy project package.json to container /app folder.
- Run npm in the container to install dependencies listed in package.json.
- Run npm in the container to install knex globally to make knex shell command available.
- Copy all project files to the container /app folder.
- When the container starts, use the shell to run `scripts/start.sh`

Add the `start.sh` file which handles the startup of the Certifier server within its Docker contaner to the `scripts` project folder with the following contents:
```
#!/bin/sh
node 'scripts/build.js'

until nc -z -v -w30 ac-mysql 3001
do
    echo "Waiting for database connection..."
    sleep 1
done
knex migrate:latest
node 'src/index.js'
```

This is what the `start.sh` script does:
- Use Node.js to run `build.js` which updates the server documentation for the public web site.
- Wait until the MySql server becomes available to clients on port 3001.
- Use `knex` to create and udpate the database schema.
- Start the Certifier server Node.js process.

*Note for Windows users*: The node:16-alpine image used as the foundation for this container is slimmed down to such an extent that it will fail to process `start.sh` if the file has Windows style CRLF line endings. Make sure to save it with just LF line endings.

### Containers 2 & 3 - MySql Server and Admin Website

The MySql server and admin website containers are configured by adding a `docker-compose.yml` file to the project:

```
version: '3.8'
services:
  ## Authrite Certifier Server
  ac-server:
    build: .
    restart: always
    ports:
    - "3002:3002"
    environment:
      SERVER_PRIVATE_KEY: '0000000000000000000000000000042000000000000000000000000000000000'
      HOSTING_DOMAIN: 'http://localhost:3002'
      HTTP_PORT: '3002'
      ROUTING_PREFIX: ''
      ALLOW_HTTP: 'true'

  ## MySql Database
  ac-mysql:
    image: "mysql:8.0"
    platform: linux/x86_64
    hostname: 'ac-mysql'
    command: 'mysqld --default-authentication-plugin=mysql_native_password --sync_binlog=0 --innodb_doublewrite=OFF  --innodb-flush-log-at-trx-commit=0 --innodb-flush-method=nosync'
    restart: always
    volumes:
     - './data/ac-mysql:/var/lib/mysql'
    environment:
      MYSQL_HOST: "127.0.0.1"
      MYSQL_TCP_PORT: 3001
      MYSQL_ROOT_PASSWORD: "test"
      MYSQL_DATABASE: "myac"
    ports:
      - "3001:3001"
    healthcheck:
      test: ["CMD-SHELL", 'mysqladmin ping']
      interval: 10s
      timeout: 2s
      retries: 10

  ## MySql Admin Website
  ac-admin:
    image: phpmyadmin/phpmyadmin
    links:
    - ac-mysql
    environment:
      PMA_HOST: ac-mysql
      PMA_PORT: 3001
      PMA_ARBITRARY: 2
    restart: always
    ports:
    - 3003:80
```

Docker Compose allows containers to be customized and combined by injecting environment variables and adjusting the file system and network ports.

The first service in the `docker-compose.yml` file, `ac-server` specifies the container image will be built from the Docker file in this project. The `environment` section should mirror the `.env` file. We will be modifying how the `SERVER_PRIVATE_KEY` is configured later to ensure it is kept private from un-authorized parties.

The second service in the `docker-compose.yml` file, `ac-mysql` customizes the `mysql:8.0` container image. The `MYSQL_ROOT_PASSWORD` will need privacy handling changes. Note that port `3001` must match the port number in both `start.sh` and `knexfile.js`.

The third service in the `docker-compose.yml` file, `ac-admin` customizes the `phpmyadmin/phpmyadmin` container image. Note that the container's internal port 80 is mapped to external port 3003, which is where you'll find the MySql Admin Website.

There are more details and changes to cover, but you should be able to test your changes:

`docker compose up --force-recreate --build -d`

If you have Docker installed and running, this command should create a new parent container `myac-tutorial` containing three service containers: `ac-mysql-1`, `ac-server-1`, and `ac-admin-1`.

Browsing to localhost:3002 should bring up the certifier server's API documentation page.

Browsing to localhost:3003 should bring up the phpMyAdmin website login. Enter `root` for username and `test` for the password and click `Log in`.

If you expand the `myac` database node, you should see the tables created by the `knex migrate:latest` command in the `start.sh` startup script.

<img src="/img/Screenshot_20230128_124405.png" alt="mysql admin website" title="MySQL Admin Website" style="max-height:32vh;object-fit:scale-down;" />

In Docker, you should see three running containers and no errors.

By changing the `certifierServerUrl` to `localhost:3002` in the Certifier Application you can now continue developing locally while using MySQL as the backend server.

This completes the changes to support MySQL, the next step is to deploy both the server and application website to the cloud to begin delivering Certifier service to the public.

## Deployment Overview

The Certifier, like most public services, relies on three parts to function:

- Persistent backend database: MySQL
- Secure backend web service for critical functions: Certifier Server
- User interface website that supports client access: Certifier Application

This tutorial will focus on the Google Cloud Platform (GCP) to host each function. There are many alternatives that will work similarly but the details will obviously vary.

The goal is to automate the deployment process to enable the following workflow:

1. Develop new functionality locally.
2. Test the changes locally.
3. Push or Merge the changes to `master` branch on GitHub.
4. Changes are automatically deployed to GCP staging services.
5. Test the changes over the public network.
6. Merge the changes to `production` branch on GitHub.
7. Changes are automatically deployed to GCP production services.
8. Functionality is now live to all clients.

For both `staging` and `production`, the process will target a GCP MySQL database and two Cloud Run services. Cloud Storage is used to store Docker images in an `Artifact Registry`.

## Configure Cloud MySQL and Container Image Storage

You will need a GCP account and project to complete the next part of the tutorial. Start here, console.cloud.google.com if you need to create one. You will need to enable a number of APIs as well such as `artifactregistry`, `compute`, `sqladmin`, `networkmanagement` and `domains`. Initially, it is possible, and recommended, to create one GCP `Service Account` with permission to use each of these APIs.

To enable GitHub to deploy to GCP you will need the private key to a GCP `Service account`. Start here, https://console.cloud.google.com/iam-admin/serviceaccounts, and follow `Manage keys` on the `Actions` menu. When you add a new key to a service account, a private key file is downloaded. This file must be stored securely by you locally. It looks like this:

```
{
    "type": "service_account",
    "project_id": "computing-with-integrity",
    "private_key_id": "7866ad0f4361a3a45105d797ce31dd3a72f01fa6",
    "private_key": "-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----\n",
    "client_email": "computing-with-integrity@appspot.gserviceaccount.com",
    "client_id": "118333200141030300265",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/computing-with-integrity%40appspot.gserviceaccount.com"
}
```

You will also need a `base64` encoded copy of this file. Generate it with the following unix command (use WSL on Windows) to generate `keyfile.txt` from `keyfile.json`:

`cat keyfile.json | base64 > keyfile.txt`

Resources are organized on GCP under projects. This tutorial will use the project name `computing-with-integrity` but you should create your own and make the changes to use it.

Create a new GCP SQL instance running MySQL, start here https://console.cloud.google.com/sql. Make sure that the instance has a public IP address and that your service account has full access to it.

Create two new databases on the SQL server instance: `prod-myac` and `staging-myac`.

Create a user account with a password and give it access to both databases. This is appropriate for getting started, in time switch to more maintainable security options. Make a secure, local note of the database access account and password.

Finally, make sure you have `Cloud Storage` configured with an `artifact` registry. Start here to verify: https://console.cloud.google.com/storage.

## Automate Process From Source Control

With the foundation in place on the Google Cloud Platform (GCP), begin to make the changes to enable deployment automation through GitHub repository Actions.



## Configure Cloud Run Services