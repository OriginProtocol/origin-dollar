FROM node:19-alpine

# Install Git
RUN apk update
RUN apk add git
RUN git config --global --unset http.proxy
RUN git config --global --unset https.proxy

# Copy files over
WORKDIR /app
COPY contracts ./contracts
COPY dapp ./dapp

# Build contract files
WORKDIR /app/contracts
RUN yarn install
RUN yarn deploy

# Build DApp
WORKDIR /app/dapp
RUN yarn build

CMD ["yarn", "start"]
