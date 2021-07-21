FROM node:12-alpine3.12

RUN apk add git
WORKDIR /app

ENV NODE_ENV mainnet

RUN mkdir -p /app/keys

COPY . /app/
RUN yarn && yarn build

CMD node ./dist/server.js
