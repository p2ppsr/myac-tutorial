FROM node:16-alpine
WORKDIR /app
COPY package.json .
RUN npm i
RUN npm i knex -g
COPY . .
CMD ["sh", "scripts/start.sh"]