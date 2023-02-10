# Deployment Issues

## Errors on GitHub Actions Deploy Run

This section covers issues you may have when GitHub runs the Deploy action defined in the `deploy.yaml` file.

It runs this action automatically when you push or commit a change to a GitHub repository, either the server or application repositories.

### Server: Create service description file

These are previously reported issues encountered during the `Create service description file` step of Server deployment.

#### `./scripts/mkenv.sh: Permission denied`

This error message suggests you still need to set the execute bit on the mkenv.sh script.

This `git` command will do the job on your local repository, push the change to correct the problem and re-run deployment.

`git update-index --chmod=+x ./scripts/mkenv.sh`

### Server: Run google-github-actions/deploy-cloudrun@v0

These are previously reported issues encountered during the `Run google-github-actions/deploy-cloudrun@v0` step of Server deployment.

#### Error with `service.master.yaml` lines 26 and 27

If you look at the output of the `Create service description file` deployment step, you will see the contents of the automatically generated `service.master.yaml` file.
Counting down from the start of the file, lines 26 and 27 are the `KNEX_DB_CONNECTION` secret.

One typical problem here is to use a multi-line or non-stringified JSON value. Make sure to stringify your `KNEX_DB_CONNECTION` secrets value and leave it as a single line of text.

#### Error with cloudrun permissions...

Make sure to use a stringified, single-line-of-text value for your `GCP_DEPLOY_CREDS` secrets.