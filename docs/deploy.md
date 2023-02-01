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

```sh
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

## Knex Change to Access Cloud MySQL

Add the following at the start of `knexfile.js`:

```
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
```

And change the end of `knexfile.js` to:

```
const NODE_ENV = process.env.NODE_ENV
const config
  = NODE_ENV === 'production' ? deployMySql
  : NODE_ENV === 'staging' ? deployMySql
  : localMySql

module.exports = config
```

And add the following to your `.env` file:

`{"port":3306,"host":"<SQL instance public IP address>","user":"<SQL instance user name>","password":"<SQL instance user password>","database":"staging-myac"}`

## Automate Process From Source Control

With the foundation in place on the Google Cloud Platform (GCP), begin to make the changes to enable deployment automation through GitHub repository Actions.

In the Certifier Server project, add a `deploy.yaml` file in a nested new folder `.github/workflows` with the contents:

```yaml
name: Deployment
on:
  push:
    branches:
      - master
      - production
env:
  CURRENT_BRANCH: ${{ github.ref_name =='production' && 'production' || 'master' }}
  GCR_HOST: us.gcr.io
  GOOGLE_PROJECT_ID: computing-with-integrity
  GCR_IMAGE_NAME: myac-server
jobs:
  build:
    name: Deploy
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: RafikFarhad/push-to-gcr-github-action@v4.1
        with:
          gcloud_service_key: ${{ secrets.DOCKER_REGISTRY_PUSH_KEY }}
          registry: ${{ env.GCR_HOST }}
          project_id: ${{ env.GOOGLE_PROJECT_ID }}
          image_name: ${{ env.GCR_IMAGE_NAME }}
          image_tag: ${{ env.CURRENT_BRANCH }}-${{ github.sha }}
      - name: "Create service description file"
        run: "./scripts/mkenv.sh service.${{ env.CURRENT_BRANCH }}.yaml"
        env:
          IMAGE: "${{ env.GCR_HOST }}/${{ env.GOOGLE_PROJECT_ID }}/${{ env.GCR_IMAGE_NAME }}:${{ env.CURRENT_BRANCH }}-${{ github.sha }}"
          SERVICE: ${{ env.CURRENT_BRANCH =='production' && 'prod-myac-server' || 'staging-myac-server' }}
          NODE_ENV: ${{ env.CURRENT_BRANCH == 'production' && 'production' || 'staging' }}
          KNEX_DB_CONNECTION: ${{ env.CURRENT_BRANCH == 'production' && secrets.PROD_KNEX_DB_CONNECTION || secrets.STAGING_KNEX_DB_CONNECTION }}
          KNEX_DB_CLIENT: mysql
          CERTIFIER_UI_URL: ${{ env.CURRENT_BRANCH == 'production' && secrets.PROD_CERTIFIER_UI_URL || secrets.STAGING_CERTIFIER_UI_URL }}
          SERVER_PRIVATE_KEY: ${{ env.CURRENT_BRANCH == 'production' && secrets.PROD_SERVER_PRIVATE_KEY || secrets.STAGING_SERVER_PRIVATE_KEY }}
          HOSTING_DOMAIN: ${{ env.CURRENT_BRANCH == 'production' && secrets.PROD_HOSTING_DOMAIN || secrets.STAGING_HOSTING_DOMAIN }}
          HTTP_PORT: ${{ env.CURRENT_BRANCH == 'production' && secrets.PROD_HTTP_PORT || secrets.STAGING_HTTP_PORT }}
          ROUTING_PREFIX: ${{ env.CURRENT_BRANCH == 'production' && secrets.PROD_ROUTING_PREFIX || secrets.STAGING_ROUTING_PREFIX }}
          ALLOW_HTTP: 'false'
      - uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.gcp_deploy_creds }}
      - uses: google-github-actions/deploy-cloudrun@v0
        with:
          region: us-east4
          metadata: "service.${{ env.CURRENT_BRANCH }}.yaml"
```

Overview of how `deploy.yaml` file works:

1. The action triggers when a push occurs on branches `master` or `production`.
2. Values are assigned to env variables not defined elsewhere.
3. A single build job named Deploy is defined which will run on an ubuntu VM.
4. The `RafikFarhad/push-to-gcr-github-action` step builds a Docker image and pushes it to the GCP artifact registry.
5. A temporary `service.staging.yaml` file is created with `metadata` settings for the next step by running the new `scripts/mkenv.sh` shell script on the ubuntu VM.
6. The `google-github-actions/deploy-cloudrun` step creates or updates a Cloud Run service to run the new Docker image.

Add the new `mkenv.sh` file to the `scripts` folder with the contents:

```sh
#!/bin/bash

echo "Creating $1"
echo "apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: $SERVICE
spec:
  template:
    spec:
      timeoutSeconds: 3540
      containers:
      - image: $IMAGE
        ports:
          - containerPort: $HTTP_PORT
        env:" > $1

echo "Appending environment variables to $1"
perl -E'
  say "        - name: $_
          value: \x27$ENV{$_}\x27" for @ARGV;
' NODE_ENV \
    SERVER_PRIVATE_KEY \
    CERTIFIER_UI_URL \
    HOSTING_DOMAIN \
    HTTP_PORT \
    ROUTING_PREFIX \
    KNEX_DB_CONNECTION \
    KNEX_DB_CLIENT \
    ALLOW_HTTP >> $1

echo "Built! Contents of $1:"
cat $1
```

*Important Note*: Because this is a shell script that needs to run on the GitHub ubuntu deployment automation VM, it needs to have the `execute` flag set. Use the `chmod` command on unix, or on Windows use this git command:

`git update-index --chmod=+x ./scripts/mkenv.sh`

Overview of how `mkenv.sh` file works:

1. The script file has access to all the env settings a top of deploy.yaml and this named run step.
2. It builds a yaml file with the format required of the metadata for Cloud Run service creation.
3. After a fixed format start, Perl adds name and value env properties for a list of variables.
4. The contents of the generated file can be viewed on GitHub when and after the Deploy Action runs.

*If this fails* when the action runs, make sure the file has the execute flag set in the Git index. See *Important Note* above.

### Customizing the Automation

Change `GOOGLE_PROJECT_ID` in `deploy.yaml` to match your GCP project identifier.

Change `region` in `deploy.yaml` to match the region of your SQL instance for best performance.

Possibly change `GCR_HOST` in `deploy.yaml` to match your Cloud Storage location.

The remainder of the automation control settings are configured as repository `Secrets` on GitHub.
Go to your GitHub repository `Settings` and under `Security` find `Secrets and variables`.
The following table lists the secrets you must add and the value to assign:

| Secret | Value |
|---|---|
| DOCKER_REGISTRY_PUSH_KEY | `<base64 contents of keyfile.txt for GCP Service Account with Cloud Storage permission>` |
| GCP_DEPLOY_CREDS | `<json contents of keyfile.json for GCP Service Account with Cloud Run permission>` |
| STAGING_KNEX_DB_CONNECTION | `{"port":3306,"host":"<SQL instance public IP address>","user":"<SQL instance user name>","password":"<SQL instance user password>","database":"staging-myac"}`|
| STAGING_SERVER_PRIVATE_KEY | `<32 random bytes encoded as hex string, save secure copy locally>` |
| STAGING_HOSTING_DOMAIN | `https://<your-domain-for-staging-certifier-server>` |
| STAGING_CERTIFIER_UI_URL | `https://<your-domain-for-staging-certifier-ui>` |
| STAGING_HTTP_PORT | `8081` |
| STAGING_ROUTING_PREFIX | |
| PROD_KNEX_DB_CONNECTION | `{"port":3306,"host":"<SQL instance public IP address>","user":"<SQL instance user name>","password":"<SQL instance user password>","database":"prod-myac"}`|
| PROD_SERVER_PRIVATE_KEY | `<32 random bytes encoded as hex string, save secure copy locally>` |
| PROD_HOSTING_DOMAIN | `https://<your-domain-for-production-certifier-server>` |
| PROD_CERTIFIER_UI_URL | `https://<your-domain-for-production-certifier-ui>` |
| PROD_HTTP_PORT | `8081` |
| PROD_ROUTING_PREFIX | |

### One Final Server Change

Comment out the section in `scripts\start.sh` that waits for the SQL server to start:

```sh
#!/bin/sh
node 'scripts/build.js'

#until nc -z -v -w30 ac-mysql 3001
#do
#    echo "Waiting for database connection..."
#    sleep 1
#done
knex migrate:latest
node 'src/index.js'
```

## Rinse and Repeat for Certifier Application

### First a little housekeeping:

Add a new `.env` file with the contents:

```sh
REACT_APP_CERTIFIER_PUBLIC_KEY='025684945b734e80522f645b9358d4ac5b49e5180444b5911bf8285a7230edee8b'
REACT_APP_CERTIFIER_SERVER_URL='http://localhost:8081'
```

Modify the `App.js` file to use the new environment variables:

```js
import * as dotenv from 'dotenv'
dotenv.config()

// The public key of the certifier at that URL, must match actual public key.
const certifierPublicKey = process.env.REACT_APP_CERTIFIER_PUBLIC_KEY
const certifierServerURL = process.env.REACT_APP_CERTIFIER_SERVER_URL
```

In the Certifier Application project, add a `deploy.yaml` file in a nested new folder `.github/workflows` with the contents:

```yaml
name: Deployment
on:
  push:
    branches:
      - master
      - production
env:
  CURRENT_BRANCH: ${{ github.ref_name }}
  GCR_HOST: us.gcr.io
  GOOGLE_PROJECT_ID: computing-with-integrity
  GCR_IMAGE_NAME: myac-ui

jobs:
  build:
    name: Deploy
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 16
      - run: npm ci
      - run: CI=true REACT_APP_CERTIFIER_SERVER_URL=${{ env.CURRENT_BRANCH == 'production' && secrets.PROD_CERTIFIER_SERVER_URL || secrets.STAGING_CERTIFIER_SERVER_URL }} REACT_APP_CERTIFIER_PUBLIC_KEY=${{ env.CURRENT_BRANCH == 'production' && secrets.PROD_CERTIFIER_PUBLIC_KEY || secrets.STAGING_CERTIFIER_PUBLIC_KEY }} REACT_APP_IS_STAGING=${{ env.CURRENT_BRANCH == 'master' }} npm run build
      - uses: RafikFarhad/push-to-gcr-github-action@v4.1
        with:
          gcloud_service_key: ${{ secrets.DOCKER_REGISTRY_PUSH_KEY }}
          registry: ${{ env.GCR_HOST }}
          project_id: ${{ env.GOOGLE_PROJECT_ID }}
          image_name: ${{ env.GCR_IMAGE_NAME }}
          image_tag: ${{ env.CURRENT_BRANCH }}-latest
      - uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.gcp_deploy_creds }}
      - uses: google-github-actions/deploy-cloudrun@v0
        with:
          service: ${{ env.CURRENT_BRANCH =='production' && 'prod-myac-ui' || 'staging-myac-ui' }}
          image: "${{ env.GCR_HOST }}/${{ env.GOOGLE_PROJECT_ID }}/${{ env.GCR_IMAGE_NAME }}:${{ env.CURRENT_BRANCH }}-latest"
          timeout: 3540
          region: us-east4
```

Change `GOOGLE_PROJECT_ID` in `deploy.yaml` to match your GCP project identifier.

Change `region` in `deploy.yaml` to match the region of your SQL instance and server for best performance.

Possibly change `GCR_HOST` in `deploy.yaml` to match your Cloud Storage location.

The remainder of the automation control settings are configured as repository `Secrets` on GitHub.
Go to your GitHub repository `Settings` and under `Security` find `Secrets and variables`.
The following table lists the secrets you must add and the value to assign:

| Secret | Value |
|---|---|
| DOCKER_REGISTRY_PUSH_KEY | `<base64 contents of keyfile.txt for GCP Service Account with Cloud Storage permission>` |
| GCP_DEPLOY_CREDS | `<json contents of keyfile.json for GCP Service Account with Cloud Run permission>` |
| STAGING_CERTIFIER_PUBLIC_KEY | `<from certifier's home (Identify) page>` |
| STAGING_CERTIFIER_SERVER_URL | `https://<your-domain-for-staging-certifier-server>` |
| PROD_CERTIFIER_PUBLIC_KEY | `<from certifier's home (Identify) page>` |
| PROD_CERTIFIER_SERVER_URL | `https://<your-domain-for-production-certifier-server>` |

Add the following three files to the project. No changes are needed.

Add `Dockerfile` with contents:

```sh
FROM nginx
EXPOSE 8080
COPY ./nginx.conf /etc/nginx/nginx.conf
COPY ./build /usr/share/nginx/html
```

Add `docker-compose.yml` with contents:

```yaml
services:
  web:
    build: .
    ports:
    - 8080:8080
```

Add `nginx.conf` with contents:

```sh
user  nginx;
worker_processes  auto;
error_log  /var/log/nginx/error.log notice;
pid        /var/run/nginx.pid;
events {
    worker_connections  1024;
}
http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';
    access_log  /var/log/nginx/access.log  main;
    sendfile        on;
    keepalive_timeout  65;
    gzip  on;
    server {
        listen       8080 http2;
        listen  [::]:8080 http2;
        server_name  localhost;
        location / {
            root   /usr/share/nginx/html;
            index  index.html;
            try_files $uri /index.html;  
        }
    }
}
```

## Configure Cloud Run Services

Commit the changes to your repositories and push them to GitHub on the `master` branch to trigger the execution of the deployment actions.

You can monitor the progress on GitHub as the execute.

Once both deployments run without errors, a final change is required to your Cloud Run services to enable public access and to use HTTP/2 for the Application website.

On each Cloud Run service, go to `Security` tab and select `Allow unauthenticated invocations`.

On the `myac-ui` service (Certifier Application), select `EDIT & DEPLOY NEW REVISION`. Switch to the `NETWORKING` tab. Check the `Use HTTP/2 end-to-end` box. Click `DEPLOY`.

Congratulations, you've finished the tutorial!