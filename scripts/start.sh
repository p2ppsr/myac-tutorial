#!/bin/sh
node 'scripts/build.js'
knex migrate:latest
node 'src/index.js'