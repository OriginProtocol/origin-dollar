FROM node:16-bullseye

COPY . .

RUN yarn install --non-interactive --frozen-lockfile

ENV NODE_ENV=production
ENV PORT 8080

RUN yarn run gcp-build
RUN rm -Rf node_modules

RUN yarn install --non-interactive --frozen-lockfile --production

CMD yarn start
